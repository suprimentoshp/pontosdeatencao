const express = require("express");
const fs = require("fs/promises");
const path = require("path");

const app = express();
const port = process.env.PORT || 3000;
const dataDir = path.join(__dirname, "data");
const dataFile = path.join(dataDir, "ordens.json");

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
    return { orders: Array.isArray(data.orders) ? data.orders : [] };
  } catch {
    return { orders: [] };
  }
}

async function writeData(data) {
  await ensureDataFile();
  await fs.writeFile(dataFile, JSON.stringify({ orders: data.orders || [] }, null, 2));
}

app.get("/api/app-data", async (request, response) => {
  response.json(await readData());
});

app.put("/api/app-data", async (request, response) => {
  const orders = Array.isArray(request.body?.orders) ? request.body.orders : [];
  await writeData({ orders });
  response.json({ ok: true, orders });
});

app.listen(port, () => {
  console.log(`App rodando em http://localhost:${port}`);
});
