const STORAGE_KEY = "service-orders";

function localList() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
  } catch {
    return [];
  }
}

function localSave(orders) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(orders));
}

function canUseServerApi() {
  return Boolean(window.APP_CONFIG?.API_URL) && window.location.protocol !== "file:";
}

async function serverList() {
  const response = await fetch(window.APP_CONFIG.API_URL, {
    method: "GET",
    headers: { "Accept": "application/json" }
  });

  if (!response.ok) throw new Error(`Falha ao carregar dados: ${response.status}`);
  const data = await response.json();
  return Array.isArray(data.orders) ? data.orders : [];
}

async function serverSave(orders) {
  const response = await fetch(window.APP_CONFIG.API_URL, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ orders })
  });

  if (!response.ok) throw new Error(`Falha ao salvar dados: ${response.status}`);
}

async function listOrders() {
  if (!canUseServerApi()) return localList();

  try {
    return await serverList();
  } catch (error) {
    console.warn(error);
    return localList();
  }
}

async function saveOrders(orders) {
  if (!canUseServerApi()) {
    localSave(orders);
    return;
  }

  await serverSave(orders);
  localSave(orders);
}

window.OrderStore = {
  async list() {
    return listOrders();
  },

  async create(order) {
    const orders = await listOrders();
    orders.unshift(order);
    await saveOrders(orders);
    return order;
  },

  async update(id, changes) {
    const orders = (await listOrders()).map((order) => order.id === id ? { ...order, ...changes } : order);
    await saveOrders(orders);
  },

  async remove(id) {
    const orders = (await listOrders()).filter((order) => order.id !== id);
    await saveOrders(orders);
  }
};
