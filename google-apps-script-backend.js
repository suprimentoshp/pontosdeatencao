const SHEET_NAME = "Ordens";

function doGet() {
  const sheet = getSheet();
  return json({ orders: listOrders(sheet) });
}

function doPost(event) {
  const payload = JSON.parse(event.postData.contents || "{}");
  const sheet = getSheet();

  if (payload.action === "list") {
    return json({ orders: listOrders(sheet) });
  }

  if (payload.action === "create") {
    ensureHeaders(sheet);
    sheet.appendRow(toRow(payload.order));
    return json({ ok: true });
  }

  if (payload.action === "update") {
    const rowIndex = findRowById(sheet, payload.id);
    if (rowIndex > 0) {
      const order = rowToObject(sheet, rowIndex);
      const updated = { ...order, ...payload.changes };
      sheet.getRange(rowIndex, 1, 1, HEADERS.length).setValues([toRow(updated)]);
    }
    return json({ ok: true });
  }

  if (payload.action === "delete") {
    const rowIndex = findRowById(sheet, payload.id);
    if (rowIndex > 0) sheet.deleteRow(rowIndex);
    return json({ ok: true });
  }

  return json({ ok: false, error: "Ação inválida" });
}

function listOrders(sheet) {
  const rows = sheet.getDataRange().getValues();
  const headers = rows.shift() || [];
  return rows
    .filter((row) => row[0])
    .map((row) => Object.fromEntries(headers.map((header, index) => [header, row[index]])));
}

const HEADERS = [
  "id",
  "protocol",
  "issuedAt",
  "status",
  "recipient",
  "issuer",
  "room",
  "urgency",
  "description",
  "photo"
];

function getSheet() {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = spreadsheet.getSheetByName(SHEET_NAME) || spreadsheet.insertSheet(SHEET_NAME);
  ensureHeaders(sheet);
  return sheet;
}

function ensureHeaders(sheet) {
  const currentHeaders = sheet.getRange(1, 1, 1, HEADERS.length).getValues()[0];
  if (currentHeaders.join("") !== HEADERS.join("")) {
    sheet.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]);
  }
}

function toRow(order) {
  return HEADERS.map((header) => order?.[header] || "");
}

function rowToObject(sheet, rowIndex) {
  const row = sheet.getRange(rowIndex, 1, 1, HEADERS.length).getValues()[0];
  return Object.fromEntries(HEADERS.map((header, index) => [header, row[index]]));
}

function findRowById(sheet, id) {
  const values = sheet.getRange(2, 1, Math.max(sheet.getLastRow() - 1, 1), 1).getValues();
  const index = values.findIndex((row) => row[0] === id);
  return index >= 0 ? index + 2 : -1;
}

function json(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}
