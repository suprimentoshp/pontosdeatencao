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

function apiPath(path) {
  return window.APP_CONFIG.API_URL.replace(/\/app-data$/, path);
}

async function serverNextProtocol() {
  const response = await fetch(apiPath("/next-protocol"), {
    method: "GET",
    headers: { "Accept": "application/json" }
  });

  if (!response.ok) throw new Error(`Falha ao carregar próximo protocolo: ${response.status}`);
  const data = await response.json();
  return data.nextProtocol || "OS-1";
}

async function serverCreate(order) {
  const response = await fetch(apiPath("/orders"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(order)
  });

  if (!response.ok) throw new Error(`Falha ao criar ordem: ${response.status}`);
  const data = await response.json();
  return data.order || order;
}

async function serverUpdate(id, changes) {
  const response = await fetch(`${apiPath("/orders")}/${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(changes)
  });

  if (!response.ok) throw new Error(`Falha ao atualizar ordem: ${response.status}`);
}

async function serverRemove(id) {
  const response = await fetch(`${apiPath("/orders")}/${encodeURIComponent(id)}`, {
    method: "DELETE"
  });

  if (!response.ok) throw new Error(`Falha ao excluir ordem: ${response.status}`);
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

  async nextProtocol() {
    if (!canUseServerApi()) {
      const orders = localList();
      const maxNumber = orders.reduce((max, order) => {
        const match = String(order.protocol || "").match(/^OS-(\d+)$/);
        return match ? Math.max(max, Number(match[1])) : max;
      }, 0);
      return `OS-${maxNumber + 1}`;
    }

    try {
      return await serverNextProtocol();
    } catch (error) {
      console.warn(error);
      return "OS-1";
    }
  },

  async create(order) {
    if (canUseServerApi()) {
      const created = await serverCreate(order);
      try {
        localSave(await serverList());
      } catch (error) {
        console.warn(error);
      }
      return created;
    }

    const orders = await listOrders();
    orders.unshift(order);
    await saveOrders(orders);
    return order;
  },

  async update(id, changes) {
    if (canUseServerApi()) {
      await serverUpdate(id, changes);
      try {
        localSave(await serverList());
      } catch (error) {
        console.warn(error);
      }
      return;
    }

    const orders = (await listOrders()).map((order) => order.id === id ? { ...order, ...changes } : order);
    await saveOrders(orders);
  },

  async remove(id) {
    if (canUseServerApi()) {
      await serverRemove(id);
      try {
        localSave(await serverList());
      } catch (error) {
        console.warn(error);
      }
      return;
    }

    const orders = (await listOrders()).filter((order) => order.id !== id);
    await saveOrders(orders);
  }
};
