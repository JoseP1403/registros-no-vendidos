/**
 * script.js — Resortes de León
 * Formulario: Registro de producto solicitado no vendido
 * Conectado a Google Sheets via Apps Script
 */

// ── CONFIGURACIÓN ─────────────────────────────────────────
// Pega aquí la URL que te da Google Apps Script al implementar
const SCRIPT_URL = "PEGA_TU_URL_AQUI";
// ─────────────────────────────────────────────────────────

const MOTIVOS = [
  "No había inventario",
  "No se maneja el producto",
  "Sin código asignado",
  "No era la medida correcta",
  "Precio alto",
  "Encontró más barato",
  "No se pudo fabricar",
  "Faltó consultar",
  "Falta de orientación",
  "Tiempo de entrega",
  "Cliente solo cotizó",
  "Otro"
];

let motivoSeleccionado = "";

// ── Init ──────────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", () => {
  setTodayDate();
  renderMotivos();
  renderHistory();
  bindEvents();
});

function setTodayDate() {
  const input = document.getElementById("fecha");
  const today = new Date().toISOString().split("T")[0];
  input.value = today;
}

// ── Motivos ───────────────────────────────────────────────
function renderMotivos() {
  const grid = document.getElementById("motivosGrid");
  grid.innerHTML = "";
  MOTIVOS.forEach(m => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "motivo-btn";
    btn.dataset.motivo = m;
    btn.innerHTML = `<span class="motivo-dot"></span>${m}`;
    btn.addEventListener("click", () => selectMotivo(m, btn));
    grid.appendChild(btn);
  });
}

function selectMotivo(motivo, btn) {
  document.querySelectorAll(".motivo-btn").forEach(b => b.classList.remove("selected"));
  btn.classList.add("selected");
  motivoSeleccionado = motivo;

  const otroWrap = document.getElementById("otroWrap");
  const otroInput = document.getElementById("otro_motivo");
  if (motivo === "Otro") {
    otroWrap.hidden = false;
    otroInput.required = true;
    otroInput.focus();
  } else {
    otroWrap.hidden = true;
    otroInput.required = false;
    otroInput.value = "";
  }
}

// ── Bind events ───────────────────────────────────────────
function bindEvents() {
  document.getElementById("mainForm").addEventListener("submit", handleSubmit);
  document.getElementById("btnLimpiar").addEventListener("click", resetForm);
  document.getElementById("btnExport").addEventListener("click", exportCSV);
  document.getElementById("btnClearAll").addEventListener("click", clearAll);
}

// ── Validación ────────────────────────────────────────────
function validateForm() {
  let valid = true;
  const required = ["fecha", "sucursal", "tipo_cliente", "cantidad", "producto", "vendedor"];
  required.forEach(id => {
    const el = document.getElementById(id);
    if (!el.value.trim()) { el.classList.add("error"); valid = false; }
    else el.classList.remove("error");
  });
  if (!motivoSeleccionado) {
    showToast("Selecciona el motivo por el que no se vendió", "error");
    valid = false;
  }
  if (motivoSeleccionado === "Otro") {
    const otro = document.getElementById("otro_motivo");
    if (!otro.value.trim()) { otro.classList.add("error"); valid = false; }
    else otro.classList.remove("error");
  }
  return valid;
}

// ── Submit ────────────────────────────────────────────────
async function handleSubmit(e) {
  e.preventDefault();
  document.querySelectorAll("input, select, textarea").forEach(el => {
    el.addEventListener("input", () => el.classList.remove("error"), { once: true });
  });

  if (!validateForm()) {
    showToast("Completa los campos obligatorios (*)", "error");
    return;
  }

  const motivo = motivoSeleccionado === "Otro"
    ? document.getElementById("otro_motivo").value.trim()
    : motivoSeleccionado;

  const registro = {
    fecha:         document.getElementById("fecha").value,
    sucursal:      document.getElementById("sucursal").value,
    cliente:       document.getElementById("cliente").value.trim(),
    tipo_cliente:  document.getElementById("tipo_cliente").value,
    codigo:        document.getElementById("codigo").value.trim() || "Sin código",
    producto:      document.getElementById("producto").value.trim(),
    medida:        document.getElementById("medida").value.trim(),
    cantidad:      document.getElementById("cantidad").value,
    motivo,
    observaciones: document.getElementById("observaciones").value.trim(),
    vendedor:      document.getElementById("vendedor").value.trim(),
  };

  // Guardar localmente siempre (funciona sin internet)
  saveLocal({ ...registro, id: Date.now(), guardado: new Date().toLocaleString("es-GT") });

  // Intentar enviar a Google Sheets
  if (SCRIPT_URL && SCRIPT_URL !== "PEGA_TU_URL_AQUI") {
    await sendToSheets(registro);
  } else {
    showToast("✓ Guardado localmente (configura SCRIPT_URL para sincronizar)", "success");
  }

  renderHistory();
  resetForm();
}

// ── Envío a Google Sheets ─────────────────────────────────
async function sendToSheets(data) {
  const btn = document.getElementById("btnGuardar");
  btn.disabled = true;
  btn.innerHTML = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="spin"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg> Guardando…`;

  try {
    const res = await fetch(SCRIPT_URL, {
      method: "POST",
      body: JSON.stringify(data),
    });
    const result = await res.json();

    if (result.ok) {
      showToast("✓ Registro enviado a Google Sheets", "success");
    } else {
      showToast("Guardado local. Error en Sheets: " + (result.error || ""), "error");
    }
  } catch (err) {
    // Sin internet: ya quedó guardado localmente
    showToast("Sin conexión — guardado localmente", "");
  } finally {
    btn.disabled = false;
    btn.innerHTML = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg> Guardar registro`;
  }
}

// ── Storage local ─────────────────────────────────────────
const STORAGE_KEY = "rl_registros_v1";

function getRecords() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]"); }
  catch { return []; }
}

function saveLocal(record) {
  const records = getRecords();
  records.unshift(record);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
}

function deleteRecord(id) {
  const records = getRecords().filter(r => r.id !== id);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
  renderHistory();
  showToast("Registro eliminado");
}

function clearAll() {
  if (!confirm("¿Seguro que deseas borrar todos los registros locales?")) return;
  localStorage.removeItem(STORAGE_KEY);
  renderHistory();
  showToast("Registros locales eliminados");
}

// ── Historial local ───────────────────────────────────────
function renderHistory() {
  const records = getRecords();
  const section = document.getElementById("historySection");
  const list    = document.getElementById("historyList");
  const count   = document.getElementById("historyCount");

  if (!records.length) { section.hidden = true; return; }

  section.hidden = false;
  count.textContent = `${records.length} registro${records.length !== 1 ? "s" : ""} en este dispositivo`;
  list.innerHTML = "";

  records.forEach(r => {
    const card = document.createElement("div");
    card.className = "history-card";
    const fechaFmt = r.fecha
      ? new Date(r.fecha + "T12:00:00").toLocaleDateString("es-GT", { day: "2-digit", month: "short", year: "numeric" })
      : "—";

    card.innerHTML = `
      <div class="hc-top">
        <div>
          <div class="hc-product">${esc(r.producto)}</div>
          <div class="hc-meta">
            <span class="hc-chip">${fechaFmt}</span>
            <span class="hc-chip">${esc(r.sucursal)}</span>
            <span class="hc-chip">${esc(r.tipo_cliente)}</span>
            <span class="hc-chip yellow">${esc(r.motivo)}</span>
            ${r.codigo !== "Sin código" ? `<span class="hc-chip">${esc(r.codigo)}</span>` : ""}
          </div>
        </div>
        <button class="hc-del" title="Eliminar" onclick="deleteRecord(${r.id})">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/></svg>
        </button>
      </div>
      <div class="hc-motivo">
        <strong>Cant:</strong> ${esc(r.cantidad)}
        ${r.medida ? ` &nbsp;·&nbsp; <strong>Medida:</strong> ${esc(r.medida)}` : ""}
        &nbsp;·&nbsp; <strong>Vendedor:</strong> ${esc(r.vendedor)}
        ${r.cliente ? ` &nbsp;·&nbsp; <strong>Cliente:</strong> ${esc(r.cliente)}` : ""}
      </div>
      ${r.observaciones ? `<div class="hc-obs">"${esc(r.observaciones)}"</div>` : ""}
    `;
    list.appendChild(card);
  });
}

// ── Export CSV ────────────────────────────────────────────
function exportCSV() {
  const records = getRecords();
  if (!records.length) { showToast("No hay registros para exportar", "error"); return; }

  const headers = ["Fecha","Sucursal","Cliente","Tipo cliente","Código","Producto","Medida","Cantidad","Motivo","Observaciones","Vendedor","Guardado"];
  const rows = records.map(r =>
    [r.fecha, r.sucursal, r.cliente, r.tipo_cliente, r.codigo, r.producto,
     r.medida, r.cantidad, r.motivo, r.observaciones, r.vendedor, r.guardado]
    .map(v => `"${String(v||"").replace(/"/g,'""')}"`).join(",")
  );

  const csv = [headers.join(","), ...rows].join("\n");
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href = url;
  a.download = `ResortesDeLeon_NoVendidos_${new Date().toISOString().slice(0,10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
  showToast("CSV exportado", "success");
}

// ── Reset ─────────────────────────────────────────────────
function resetForm() {
  document.getElementById("mainForm").reset();
  setTodayDate();
  motivoSeleccionado = "";
  document.querySelectorAll(".motivo-btn").forEach(b => b.classList.remove("selected"));
  document.getElementById("otroWrap").hidden = true;
  document.getElementById("otro_motivo").required = false;
  document.querySelectorAll(".error").forEach(el => el.classList.remove("error"));
}

// ── Toast ─────────────────────────────────────────────────
let toastTimer;
function showToast(msg, type = "") {
  clearTimeout(toastTimer);
  const t = document.getElementById("toast");
  t.textContent = msg;
  t.className = "toast show" + (type ? " " + type : "");
  toastTimer = setTimeout(() => { t.className = "toast"; }, 3200);
}

// ── Escape HTML ───────────────────────────────────────────
function esc(str) {
  return String(str || "")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;")
    .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
