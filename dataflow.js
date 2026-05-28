const clearFiltersButton = document.querySelector("#clearFiltersButton");
const filters = {
  search: document.querySelector("#searchFilter"),
  status: document.querySelector("#statusFilter"),
  urgency: document.querySelector("#urgencyFilter"),
  startDate: document.querySelector("#startDateFilter"),
  endDate: document.querySelector("#endDateFilter")
};

const kpis = {
  total: document.querySelector("#totalKpi"),
  open: document.querySelector("#openKpi"),
  high: document.querySelector("#highKpi"),
  done: document.querySelector("#doneKpi")
};

const trendPeriod = document.querySelector("#trendPeriod");
const completionPeriod = document.querySelector("#completionPeriod");

function normalizeText(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function getDateWindow(useCurrentMonthDefault = false) {
  const today = new Date();
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
  const monthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0, 23, 59, 59);

  if (!useCurrentMonthDefault) {
    return {
      start: filters.startDate.value ? new Date(`${filters.startDate.value}T00:00:00`) : null,
      end: filters.endDate.value ? new Date(`${filters.endDate.value}T23:59:59`) : null
    };
  }

  return {
    start: filters.startDate.value ? new Date(`${filters.startDate.value}T00:00:00`) : monthStart,
    end: filters.endDate.value ? new Date(`${filters.endDate.value}T23:59:59`) : monthEnd
  };
}

async function getFilteredOrders(useCurrentMonthDefault = false) {
  const search = normalizeText(filters.search.value);
  const status = filters.status.value;
  const urgency = filters.urgency.value;
  const { start, end } = getDateWindow(useCurrentMonthDefault);

  const orders = await OrderStore.list();
  return orders.filter((order) => {
    const issuedAt = new Date(order.issuedAt);
    const text = normalizeText(`${order.protocol} ${order.room} ${order.description} ${order.recipient} ${order.issuer}`);
    const matchesStatus = !status ||
      (status === "Lista" ? order.status !== "Cancelada" && order.status !== "Concluída" : order.status === status);

    return (!search || text.includes(search)) &&
      matchesStatus &&
      (!urgency || order.urgency === urgency) &&
      (!start || issuedAt >= start) &&
      (!end || issuedAt <= end);
  });
}

function countBy(orders, key) {
  return orders.reduce((acc, order) => {
    const value = order[key] || "Não informado";
    acc[value] = (acc[value] || 0) + 1;
    return acc;
  }, {});
}

function renderKpis(orders) {
  kpis.total.textContent = orders.length;
  kpis.open.textContent = orders.filter((order) => order.status === "Nova" || order.status === "Em andamento").length;
  kpis.high.textContent = orders.filter((order) => order.urgency === "Alta" || order.urgency === "Crítica").length;
  kpis.done.textContent = orders.filter((order) => order.status === "Concluída").length;
}

function renderChart(elementId, data) {
  const element = document.querySelector(elementId);
  const entries = Object.entries(data).sort((a, b) => b[1] - a[1]);
  const max = Math.max(...entries.map((entry) => entry[1]), 1);

  element.innerHTML = entries.length
    ? entries.map(([label, value]) => `
      <div class="bar-row">
        <span>${escapeHtml(label)}</span>
        <div class="bar-track"><b style="width: ${(value / max) * 100}%"></b></div>
        <strong>${value}</strong>
      </div>
    `).join("")
    : `<p class="empty-chart">Sem dados</p>`;
}

function formatDayKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatDayLabel(key) {
  const [, month, day] = key.split("-");
  return `${day}/${month}`;
}

function getDaysBetween(start, end) {
  const days = [];
  const current = new Date(start.getFullYear(), start.getMonth(), start.getDate());
  const final = new Date(end.getFullYear(), end.getMonth(), end.getDate());

  while (current <= final) {
    days.push(formatDayKey(current));
    current.setDate(current.getDate() + 1);
  }

  return days;
}

function renderRecipientTrend(orders) {
  const { start, end } = getDateWindow(true);
  const days = getDaysBetween(start, end);
  const recipients = [...new Set(orders.map((order) => order.recipient || "Não informado"))].sort();
  const maxRecipients = recipients.slice(0, 8);
  const colors = ["#0f766e", "#1570ef", "#b54708", "#7f56d9", "#c11574", "#027a48", "#dc6803", "#475467"];
  const width = 980;
  const height = 150;
  const padding = { top: 14, right: 22, bottom: 32, left: 34 };
  const innerWidth = width - padding.left - padding.right;
  const innerHeight = height - padding.top - padding.bottom;
  const series = maxRecipients.map((recipient) => {
    const counts = Object.fromEntries(days.map((day) => [day, 0]));
    orders
      .filter((order) => (order.recipient || "Não informado") === recipient)
      .forEach((order) => {
        const key = formatDayKey(new Date(order.issuedAt));
        if (counts[key] !== undefined) counts[key] += 1;
      });
    return { recipient, counts };
  });

  const maxValue = Math.max(
    ...series.flatMap((item) => Object.values(item.counts)),
    1
  );
  const xFor = (index) => padding.left + (days.length === 1 ? innerWidth / 2 : (index / (days.length - 1)) * innerWidth);
  const yFor = (value) => padding.top + innerHeight - (value / maxValue) * innerHeight;
  const gridValues = [0, Math.ceil(maxValue / 2), maxValue];

  trendPeriod.textContent = `${formatDayLabel(formatDayKey(start))} a ${formatDayLabel(formatDayKey(end))}`;

  if (!orders.length || !series.length) {
    document.querySelector("#recipientTrendChart").innerHTML = `<p class="empty-chart">Sem dados no período.</p>`;
    return;
  }

  const lines = series.map((item, index) => {
    const points = days
      .map((day, dayIndex) => `${xFor(dayIndex)},${yFor(item.counts[day])}`)
      .join(" ");
    const circles = days
      .map((day, dayIndex) => item.counts[day] > 0
        ? `<circle cx="${xFor(dayIndex)}" cy="${yFor(item.counts[day])}" r="3" fill="${colors[index % colors.length]}"><title>${escapeHtml(item.recipient)} - ${formatDayLabel(day)}: ${item.counts[day]}</title></circle>`
        : "")
      .join("");
    return `<polyline points="${points}" fill="none" stroke="${colors[index % colors.length]}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"></polyline>${circles}`;
  }).join("");

  const xLabels = days
    .map((day, index) => `<text x="${xFor(index)}" y="${height - 10}" text-anchor="middle">${formatDayLabel(day)}</text>`)
    .join("");

  const yGrid = gridValues
    .map((value) => `
      <line x1="${padding.left}" y1="${yFor(value)}" x2="${width - padding.right}" y2="${yFor(value)}"></line>
      <text x="${padding.left - 10}" y="${yFor(value) + 4}" text-anchor="end">${value}</text>
    `)
    .join("");

  const legend = series.map((item, index) => `
    <span><i style="background:${colors[index % colors.length]}"></i>${escapeHtml(item.recipient)}</span>
  `).join("");

  document.querySelector("#recipientTrendChart").innerHTML = `
    <svg viewBox="0 0 ${width} ${height}" role="img" aria-label="Registros por destino ao longo do período">
      <g class="line-grid">${yGrid}</g>
      <g class="line-axis">${xLabels}</g>
      <g>${lines}</g>
    </svg>
    <div class="line-legend">${legend}</div>
  `;
}

function renderCompletionTrend(orders) {
  const { start, end } = getDateWindow(true);
  const days = getDaysBetween(start, end);
  const width = 980;
  const height = 150;
  const padding = { top: 14, right: 22, bottom: 32, left: 34 };
  const innerWidth = width - padding.left - padding.right;
  const innerHeight = height - padding.top - padding.bottom;
  const emitted = Object.fromEntries(days.map((day) => [day, 0]));
  const finished = Object.fromEntries(days.map((day) => [day, 0]));

  orders.forEach((order) => {
    const key = formatDayKey(new Date(order.issuedAt));
    if (emitted[key] !== undefined) emitted[key] += 1;
    if (order.status === "Concluída" && finished[key] !== undefined) finished[key] += 1;
  });

  const series = [
    { label: "Emitidos", counts: emitted, color: "#1570ef" },
    { label: "Finalizados", counts: finished, color: "#027a48" }
  ];
  const maxValue = Math.max(...series.flatMap((item) => Object.values(item.counts)), 1);
  const xFor = (index) => padding.left + (days.length === 1 ? innerWidth / 2 : (index / (days.length - 1)) * innerWidth);
  const yFor = (value) => padding.top + innerHeight - (value / maxValue) * innerHeight;
  const gridValues = [0, Math.ceil(maxValue / 2), maxValue];

  completionPeriod.textContent = `${formatDayLabel(formatDayKey(start))} a ${formatDayLabel(formatDayKey(end))}`;

  const lines = series.map((item) => {
    const points = days
      .map((day, dayIndex) => `${xFor(dayIndex)},${yFor(item.counts[day])}`)
      .join(" ");
    const circles = days
      .map((day, dayIndex) => item.counts[day] > 0
        ? `<circle cx="${xFor(dayIndex)}" cy="${yFor(item.counts[day])}" r="3" fill="${item.color}"><title>${item.label} - ${formatDayLabel(day)}: ${item.counts[day]}</title></circle>`
        : "")
      .join("");
    return `<polyline points="${points}" fill="none" stroke="${item.color}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"></polyline>${circles}`;
  }).join("");

  const xLabels = days
    .map((day, index) => `<text x="${xFor(index)}" y="${height - 10}" text-anchor="middle">${formatDayLabel(day)}</text>`)
    .join("");
  const yGrid = gridValues
    .map((value) => `
      <line x1="${padding.left}" y1="${yFor(value)}" x2="${width - padding.right}" y2="${yFor(value)}"></line>
      <text x="${padding.left - 10}" y="${yFor(value) + 4}" text-anchor="end">${value}</text>
    `)
    .join("");
  const legend = series.map((item) => `
    <span><i style="background:${item.color}"></i>${item.label}</span>
  `).join("");

  document.querySelector("#completionTrendChart").innerHTML = `
    <svg viewBox="0 0 ${width} ${height}" role="img" aria-label="Emitidos contra finalizados ao longo do período">
      <g class="line-grid">${yGrid}</g>
      <g class="line-axis">${xLabels}</g>
      <g>${lines}</g>
    </svg>
    <div class="line-legend">${legend}</div>
  `;
}

async function renderDataFlow() {
  const filtered = await getFilteredOrders();
  const trendOrders = await getFilteredOrders(true);
  renderKpis(filtered);
  renderChart("#statusChart", countBy(filtered, "status"));
  renderChart("#urgencyChart", countBy(filtered, "urgency"));
  renderChart("#recipientChart", countBy(filtered, "recipient"));
  renderRecipientTrend(trendOrders);
  renderCompletionTrend(trendOrders);
}

Object.values(filters).forEach((filter) => {
  filter.addEventListener("input", renderDataFlow);
  filter.addEventListener("change", renderDataFlow);
});

clearFiltersButton.addEventListener("click", () => {
  Object.values(filters).forEach((filter) => {
    filter.value = "";
  });
  renderDataFlow();
});

window.addEventListener("storage", renderDataFlow);
renderDataFlow();
