const ordersList = document.querySelector("#ordersList");
const orderDetail = document.querySelector("#orderDetail");
const emptyState = document.querySelector("#emptyState");
const exportButton = document.querySelector("#exportButton");
const logoutButton = document.querySelector("#logoutButton");
const clearFiltersButton = document.querySelector("#clearFiltersButton");
const filteredCount = document.querySelector("#filteredCount");
const loggedUserLabel = document.querySelector("#loggedUserLabel");
const filters = {
  search: document.querySelector("#searchFilter"),
  name: document.querySelector("#nameFilter"),
  status: document.querySelector("#statusFilter"),
  urgency: document.querySelector("#urgencyFilter"),
  startDate: document.querySelector("#startDateFilter"),
  endDate: document.querySelector("#endDateFilter")
};

let selectedOrderId = "";
let currentUser = null;

const USERS = {
  Daniel: { name: "Daniel", canManage: false },
  Felipe: { name: "Felipe", canManage: true },
  Dan: { name: "Dan", canManage: false },
  Visitante: { name: "Visitante", canManage: false }
};

function canManageOrders() {
  return Boolean(currentUser?.canManage);
}

function readSession() {
  const name = sessionStorage.getItem("admin-user");
  if (!name) return null;
  return USERS[name] || null;
}

function setAuthenticated(user) {
  currentUser = user;
  exportButton.hidden = !canManageOrders();
  loggedUserLabel.textContent = canManageOrders()
    ? `Usuário: ${currentUser.name} - acesso completo`
    : `Usuário: ${currentUser.name} - somente visualização`;
}

function formatDateTime(value) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short"
  }).format(new Date(value));
}

function normalizeText(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function normalizeClass(value) {
  return normalizeText(value).replaceAll(" ", "-");
}

function normalizeStatus(value) {
  return normalizeText(value).replaceAll(" ", "-");
}

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

async function getFilteredOrders() {
  const search = normalizeText(filters.search.value);
  const name = normalizeText(filters.name.value);
  const status = filters.status.value;
  const urgency = filters.urgency.value;
  const start = filters.startDate.value ? new Date(`${filters.startDate.value}T00:00:00`) : null;
  const end = filters.endDate.value ? new Date(`${filters.endDate.value}T23:59:59`) : null;

  const orders = await OrderStore.list();
  return orders.filter((order) => {
    const issuedAt = new Date(order.issuedAt);
    const text = normalizeText(`${order.protocol} ${order.room} ${order.description} ${order.issuer}`);
    const notifiedName = normalizeText(order.recipient);
    const matchesStatus = !status ||
      (status === "Lista" ? order.status !== "Cancelada" && order.status !== "Concluída" : order.status === status);

    return (!search || text.includes(search)) &&
      (!name || notifiedName.includes(name)) &&
      matchesStatus &&
      (!urgency || order.urgency === urgency) &&
      (!start || issuedAt >= start) &&
      (!end || issuedAt <= end);
  });
}

function renderOrders(orders) {
  emptyState.hidden = orders.length > 0;
  filteredCount.textContent = `${orders.length} ${orders.length === 1 ? "registro" : "registros"}`;
  ordersList.innerHTML = "";

  if (!orders.some((order) => order.id === selectedOrderId)) {
    selectedOrderId = orders[0]?.id || "";
  }

  orders.forEach((order) => {
    const item = document.createElement("button");
    item.type = "button";
    item.className = `order-list-item status-${normalizeStatus(order.status)}${order.id === selectedOrderId ? " selected" : ""}`;
    item.dataset.action = "select";
    item.dataset.id = order.id;
    item.innerHTML = `
      <span class="order-list-info">
        <strong>${escapeHtml(order.protocol)} • ${escapeHtml(order.issuer)}</strong>
        <span>${escapeHtml(order.room)}</span>
        <p>${escapeHtml(order.description)}</p>
      </span>
      <span class="order-list-side">
        <span class="order-list-date">${formatDateTime(order.issuedAt)}</span>
        <b class="urgency ${normalizeClass(order.urgency)}">${escapeHtml(order.urgency)}</b>
        <em>${escapeHtml(order.status)}</em>
      </span>
    `;
    ordersList.appendChild(item);
  });

  renderSelectedOrder(orders.find((order) => order.id === selectedOrderId));
}

function renderSelectedOrder(order) {
  if (!order) {
    orderDetail.innerHTML = `<div class="empty-state">Selecione uma ordem para ver os detalhes.</div>`;
    return;
  }

  const disabled = canManageOrders() ? "" : " disabled";
  const permissionNote = canManageOrders()
    ? ""
    : `<p class="permission-note">Somente o usuário Felipe pode alterar status, excluir ordens e exportar CSV.</p>`;

  orderDetail.innerHTML = `
    <article class="order-detail-card">
      <header>
        <div>
          <span>Ordem selecionada</span>
          <strong>${escapeHtml(order.protocol)}</strong>
        </div>
        <b class="urgency ${normalizeClass(order.urgency)}">${escapeHtml(order.urgency)}</b>
      </header>
      <dl class="order-meta detail-meta">
        <div><dt>Data e hora</dt><dd>${formatDateTime(order.issuedAt)}</dd></div>
        <div><dt>Status</dt><dd>${escapeHtml(order.status)}</dd></div>
        <div><dt>Quem está sendo notificado</dt><dd>${escapeHtml(order.recipient)}</dd></div>
        <div><dt>Quem notificou</dt><dd>${escapeHtml(order.issuer)}</dd></div>
        <div><dt>Apartamento ou local</dt><dd>${escapeHtml(order.room)}</dd></div>
      </dl>
      <section class="description-block detail-description">
        <h3>Descrição</h3>
        <p>${escapeHtml(order.description)}</p>
      </section>
      <div class="order-actions detail-actions">
        <label>
          Status
          <select data-action="status" data-id="${order.id}"${disabled}>
            <option value="Nova"${order.status === "Nova" ? " selected" : ""}>Nova</option>
            <option value="Em andamento"${order.status === "Em andamento" ? " selected" : ""}>Em andamento</option>
            <option value="Concluída"${order.status === "Concluída" ? " selected" : ""}>Concluída</option>
            <option value="Cancelada"${order.status === "Cancelada" ? " selected" : ""}>Cancelada</option>
          </select>
        </label>
        <button class="danger" type="button" data-action="delete" data-id="${order.id}"${disabled}>Excluir</button>
        ${permissionNote}
      </div>
      ${order.photo ? `<img class="detail-photo" src="${order.photo}" alt="Foto da ${escapeHtml(order.protocol)}">` : `<div class="empty-state">Sem foto anexada.</div>`}
    </article>
  `;
}

async function renderDashboard() {
  const filtered = await getFilteredOrders();
  renderOrders(filtered);
}

async function handleOrderAction(event) {
  const target = event.target;
  const action = target.dataset.action;
  const id = target.dataset.id;
  if (!action || !id) return;

  const orders = await OrderStore.list();
  const order = orders.find((item) => item.id === id);
  if (!order) return;

  if (action === "select" && event.type === "click") {
    selectedOrderId = id;
    renderOrders(await getFilteredOrders());
    return;
  }

  if (action === "status" && event.type === "change") {
    if (!canManageOrders()) {
      renderDashboard();
      return;
    }

    if (target.value === "Cancelada" && order.status !== "Cancelada") {
      const reason = window.prompt(`Informe o motivo do cancelamento da ordem ${order.protocol}:`);

      if (!reason || !reason.trim()) {
        renderDashboard();
        return;
      }

      order.description = `${order.description}\n\nMotivo do cancelamento: ${reason.trim()}`;
    }

    const changes = { status: target.value };
    if (target.value === "Cancelada" && order.status !== "Cancelada") {
      changes.description = order.description;
    }

    selectedOrderId = id;
    await OrderStore.update(id, changes);
    await renderDashboard();
    return;
  }

  if (action === "delete" && event.type === "click") {
    if (!canManageOrders()) return;
    if (!window.confirm(`Excluir a ordem ${order.protocol}?`)) return;
    if (selectedOrderId === id) selectedOrderId = "";
    await OrderStore.remove(id);
    await renderDashboard();
  }
}

async function exportCsv() {
  if (!canManageOrders()) {
    alert("Somente o usuário Felipe pode exportar CSV.");
    return;
  }

  const orders = await getFilteredOrders();
  if (!orders.length) return;

  const header = ["Protocolo", "Data e hora", "Status", "Quem está sendo notificado", "Quem notificou", "Apartamento ou local", "Grau de impacto", "Descrição"];
  const rows = orders.map((order) => [
    order.protocol,
    formatDateTime(order.issuedAt),
    order.status,
    order.recipient,
    order.issuer,
    order.room,
    order.urgency,
    order.description
  ]);

  const csv = [header, ...rows]
    .map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(";"))
    .join("\n");

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "ordens-filtradas.csv";
  link.click();
  URL.revokeObjectURL(url);
}

Object.values(filters).forEach((filter) => {
  filter.addEventListener("input", renderDashboard);
  filter.addEventListener("change", renderDashboard);
});

clearFiltersButton.addEventListener("click", () => {
  Object.values(filters).forEach((filter) => {
    filter.value = "";
  });
  renderDashboard();
});

ordersList.addEventListener("change", handleOrderAction);
ordersList.addEventListener("click", handleOrderAction);
orderDetail.addEventListener("change", handleOrderAction);
orderDetail.addEventListener("click", handleOrderAction);
exportButton.addEventListener("click", exportCsv);
logoutButton.addEventListener("click", () => {
  sessionStorage.removeItem("admin-user");
  currentUser = null;
  window.location.href = "login.html";
});
window.addEventListener("storage", renderDashboard);

const savedUser = readSession();
if (savedUser) {
  setAuthenticated(savedUser);
  renderDashboard();
} else {
  window.location.replace("login.html");
}
