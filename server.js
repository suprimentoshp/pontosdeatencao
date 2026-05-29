const express = require("express");
const fs = require("fs/promises");
const path = require("path");
const crypto = require("crypto");

const app = express();
const port = process.env.PORT || 3000;
const dataDir = process.env.DATA_DIR || path.join(__dirname, "data");
const dataFile = path.join(dataDir, "ordens.json");
const usePostgres = Boolean(process.env.DATABASE_URL);
let postgresPool = null;
let dataLock = Promise.resolve();

app.use(express.json({ limit: "25mb" }));
app.use(express.static(__dirname, {
  extensions: ["html"],
  setHeaders(response, filePath) {
    if (filePath.endsWith(".html") || filePath.endsWith(".js") || filePath.endsWith(".css")) {
      response.setHeader("Cache-Control", "no-cache");
    }
  }
}));

async function ensureDataFile() {
  await fs.mkdir(dataDir, { recursive: true });
  try {
    await fs.access(dataFile);
  } catch {
    await fs.writeFile(dataFile, JSON.stringify({ orders: [] }, null, 2));
  }
}

function normalizeData(data) {
  const orders = Array.isArray(data?.orders) ? data.orders : [];
  return {
    orders,
    nextNumber: Number.isInteger(data?.nextNumber) ? data.nextNumber : getNextNumber(orders)
  };
}

function getPostgresPool() {
  if (!usePostgres) return null;
  if (!postgresPool) {
    const { Pool } = require("pg");
    postgresPool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.PGSSLMODE === "disable" ? false : { rejectUnauthorized: false }
    });
  }
  return postgresPool;
}

async function ensurePostgresData() {
  const pool = getPostgresPool();
  await pool.query(`
    CREATE TABLE IF NOT EXISTS app_data (
      id text PRIMARY KEY,
      data jsonb NOT NULL,
      updated_at timestamptz NOT NULL DEFAULT now()
    )
  `);

  const result = await pool.query("SELECT 1 FROM app_data WHERE id = $1", ["ordens"]);
  if (result.rowCount) return;

  const fileData = await readFileData();
  await pool.query(
    "INSERT INTO app_data (id, data) VALUES ($1, $2::jsonb) ON CONFLICT (id) DO NOTHING",
    ["ordens", JSON.stringify(normalizeData(fileData))]
  );
}

async function readFileData() {
  await ensureDataFile();
  const content = await fs.readFile(dataFile, "utf8");
  try {
    const data = JSON.parse(content);
    return normalizeData(data);
  } catch {
    return normalizeData({ orders: [] });
  }
}

async function writeFileData(data) {
  await ensureDataFile();
  const payload = normalizeData(data);
  const tempFile = `${dataFile}.tmp`;
  await fs.writeFile(tempFile, JSON.stringify(payload, null, 2));
  await fs.rename(tempFile, dataFile);
}

async function readPostgresData() {
  await ensurePostgresData();
  const result = await getPostgresPool().query("SELECT data FROM app_data WHERE id = $1", ["ordens"]);
  return normalizeData(result.rows[0]?.data);
}

async function writePostgresData(data) {
  await ensurePostgresData();
  await getPostgresPool().query(
    `
      INSERT INTO app_data (id, data, updated_at)
      VALUES ($1, $2::jsonb, now())
      ON CONFLICT (id)
      DO UPDATE SET data = EXCLUDED.data, updated_at = now()
    `,
    ["ordens", JSON.stringify(normalizeData(data))]
  );
}

async function readData() {
  return usePostgres ? readPostgresData() : readFileData();
}

async function writeData(data) {
  if (usePostgres) {
    await writePostgresData(data);
    return;
  }

  await writeFileData(data);
}

function getHighestProtocolNumber(orders) {
  return orders.reduce((max, order) => {
    const match = String(order.protocol || "").match(/^OS-(\d+)$/);
    return match ? Math.max(max, Number(match[1])) : max;
  }, 0);
}

function getNextNumber(orders, storedNextNumber) {
  return Math.max(Number(storedNextNumber) || 1, getHighestProtocolNumber(orders) + 1);
}

function withDataLock(work) {
  const run = dataLock.then(work, work);
  dataLock = run.catch(() => {});
  return run;
}

function publicData(data) {
  return {
    orders: data.orders,
    nextProtocol: `OS-${getNextNumber(data.orders, data.nextNumber)}`
  };
}

app.get("/api/app-data", async (request, response) => {
  response.json({
    ...publicData(await readData()),
    storage: usePostgres ? "postgres" : "file"
  });
});

app.get("/api/storage-health", async (request, response) => {
  const data = await readData();
  response.json({
    ok: true,
    storage: usePostgres ? "postgres" : "file",
    orders: data.orders.length,
    nextProtocol: `OS-${getNextNumber(data.orders, data.nextNumber)}`,
    persistent: usePostgres || Boolean(process.env.DATA_DIR)
  });
});

app.put("/api/app-data", async (request, response) => {
  const incomingOrders = Array.isArray(request.body?.orders) ? request.body.orders : [];
  const saved = await withDataLock(async () => {
    const current = await readData();
    const byId = new Map(current.orders.map((order) => [order.id, order]));
    incomingOrders.forEach((order) => {
      if (order?.id) byId.set(order.id, { ...byId.get(order.id), ...order });
    });
    const incomingIds = new Set(incomingOrders.map((order) => order.id));
    const mergedOrders = [
      ...incomingOrders.filter((order) => order?.id),
      ...current.orders.filter((order) => !incomingIds.has(order.id))
    ].map((order) => byId.get(order.id));
    await writeData({ orders: mergedOrders, nextNumber: getNextNumber(mergedOrders, current.nextNumber) });
    return mergedOrders;
  });
  response.json({ ok: true, orders: saved });
});

app.get("/api/next-protocol", async (request, response) => {
  const data = await readData();
  response.json({ nextProtocol: `OS-${getNextNumber(data.orders, data.nextNumber)}` });
});

app.post("/api/orders", async (request, response) => {
  const savedOrder = await withDataLock(async () => {
    const data = await readData();
    const nextNumber = getNextNumber(data.orders, data.nextNumber);
    const order = {
      ...request.body,
      id: request.body?.id || crypto.randomUUID(),
      protocol: `OS-${nextNumber}`,
      issuedAt: request.body?.issuedAt || new Date().toISOString(),
      status: request.body?.status || "Nova"
    };
    const orders = [order, ...data.orders];
    await writeData({ orders, nextNumber: nextNumber + 1 });
    return order;
  });

  response.status(201).json({ ok: true, order: savedOrder });
});

app.patch("/api/orders/:id", async (request, response) => {
  const updated = await withDataLock(async () => {
    const data = await readData();
    let found = null;
    const orders = data.orders.map((order) => {
      if (order.id !== request.params.id) return order;
      found = { ...order, ...request.body, id: order.id, protocol: order.protocol };
      return found;
    });

    if (!found) return null;
    await writeData({ orders, nextNumber: getNextNumber(orders, data.nextNumber) });
    return found;
  });

  if (!updated) {
    response.status(404).json({ ok: false, error: "Ordem não encontrada" });
    return;
  }

  response.json({ ok: true, order: updated });
});

app.delete("/api/orders/:id", async (request, response) => {
  const removed = await withDataLock(async () => {
    const data = await readData();
    const orders = data.orders.filter((order) => order.id !== request.params.id);
    if (orders.length === data.orders.length) return false;
    await writeData({ orders, nextNumber: getNextNumber(orders, data.nextNumber) });
    return true;
  });

  if (!removed) {
    response.status(404).json({ ok: false, error: "Ordem não encontrada" });
    return;
  }

  response.json({ ok: true });
});

app.listen(port, () => {
  console.log(`App rodando em http://localhost:${port}`);
});
