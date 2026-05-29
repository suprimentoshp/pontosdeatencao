const express = require("express");
const fs = require("fs/promises");
const path = require("path");
const crypto = require("crypto");

const app = express();
const port = process.env.PORT || 3000;
const dataDir = process.env.DATA_DIR || path.join(__dirname, "data");
const dataFile = path.join(dataDir, "ordens.json");
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

async function readData() {
  await ensureDataFile();
  const content = await fs.readFile(dataFile, "utf8");
  try {
    const data = JSON.parse(content);
    return {
      orders: Array.isArray(data.orders) ? data.orders : [],
      nextNumber: Number.isInteger(data.nextNumber) ? data.nextNumber : null
    };
  } catch {
    return { orders: [], nextNumber: null };
  }
}

async function writeData(data) {
  await ensureDataFile();
  const payload = {
    orders: Array.isArray(data.orders) ? data.orders : [],
    nextNumber: Number.isInteger(data.nextNumber) ? data.nextNumber : getNextNumber(data.orders || [])
  };
  const tempFile = `${dataFile}.tmp`;
  await fs.writeFile(tempFile, JSON.stringify(payload, null, 2));
  await fs.rename(tempFile, dataFile);
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
  response.json(publicData(await readData()));
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
