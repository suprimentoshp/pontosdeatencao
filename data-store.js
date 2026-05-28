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

function hasRemoteApi() {
  return Boolean(window.APP_CONFIG?.API_URL);
}

async function remoteRequest(action, payload = {}) {
  const response = await fetch(window.APP_CONFIG.API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(window.APP_CONFIG.API_TOKEN ? { Authorization: `Bearer ${window.APP_CONFIG.API_TOKEN}` } : {})
    },
    body: JSON.stringify({ action, ...payload })
  });

  if (!response.ok) {
    throw new Error(`Falha na API: ${response.status}`);
  }

  return response.json();
}

window.OrderStore = {
  async list() {
    if (!hasRemoteApi()) return localList();
    const result = await remoteRequest("list");
    return result.orders || [];
  },

  async create(order) {
    if (!hasRemoteApi()) {
      const orders = localList();
      orders.unshift(order);
      localSave(orders);
      return order;
    }

    await remoteRequest("create", { order });
    return order;
  },

  async update(id, changes) {
    if (!hasRemoteApi()) {
      const orders = localList().map((order) => order.id === id ? { ...order, ...changes } : order);
      localSave(orders);
      return;
    }

    await remoteRequest("update", { id, changes });
  },

  async remove(id) {
    if (!hasRemoteApi()) {
      localSave(localList().filter((order) => order.id !== id));
      return;
    }

    await remoteRequest("delete", { id });
  }
};
