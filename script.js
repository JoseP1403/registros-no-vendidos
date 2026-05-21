/**
 * script.js — Resortes de León
 * Sistema de reenvío automático para registros pendientes
 */

const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbybpe9aVUiOSHKvXE-7k9p66hvipHhSLP5Vhw5jeUgGpyIVROGpqdVzkD3M6tjVdsbaUw/exec";

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

const MAX_MOTIVOS = 3;
let motivosSeleccionados = [];
const STORAGE_KEY = "rl_registros_v1";
const PENDING_KEY = "rl_pendientes_v1";

// ── Init ──────────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", () => {
  setTodayDate();
  renderMotivos();
  renderHistory();
  bindEvents();
  // Intentar reenviar pendientes al abrir
  reenviarPendientes();
});

function setTodayDate() {
  document.getElementById("fecha").value = new Date().toISOString().split("T")[0];
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
  if (btn.classList.contains("selected")) {
    btn.classList.remove("selected");
    motivosSeleccionados = motivosSeleccionados.filter(m => m !== motivo);
  } else {
    if (motivosSeleccionados.length >= MAX_MOTIVOS) {
      showToast("Máximo 3 motivos", "error");
      return;
    }
    btn.classList.add("selected");
    motivosSeleccionados.push(motivo);
  }
  const otroWrap = document.getElementById("otroWrap");
  const otroInput = document.getElementById("otro_motivo");
  if (motivosSeleccionados.includes("Otro")) {
    otroWrap.hidden = false;
    otroInput.required = true;
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
  ["fecha", "sucursal", "tipo_cliente", "cantidad", "producto", "vendedor"].forEach(id => {
    const el = document.getElementById(id);
    if (!el.value.trim()) { el.classList.add("error"); valid = false; }
    else el.classList.remove("error");
  });
  if (!motivosSeleccionados.length) {
    showToast("Selecciona al menos un motivo", "error");
    valid = false;
  }
  if (motivosSeleccionados.includes("Otro")) {
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

  let motivoFinal = motivosSeleccionados.filter(m => m !== "Otro").join(", ");
  if (motivosSeleccionados.includes("Otro")) {
    const otroTexto = document.getElementById("otro_motivo").value.trim();
    motivoFinal = motivoFinal ? motivoFinal + ", " + otroTexto : otroTexto;
  }

  const registro = {
    id:            Date.now(),
    fecha:         document.getElementById("fecha").value,
    sucursal:      document.getElementById("sucursal").value,
    cliente:       document.getElementById("cliente").value.trim(),
    tipo_cliente:  document.getElementById("tipo_cliente").value,
    codigo:        document.getElementById("codigo").value.trim() || "Sin código",
    producto:      document.getElementById("producto").value.trim(),
    medida:        document.getElementById("medida").value.trim(),
    cantidad:      document.getElementById("cantidad").value,
    motivo:        motivoFinal,
    observaciones: document.getElementById("observaciones").value.trim(),
    vendedor:      document.getElementById("vendedor").value.trim(),
    guardado:      new Date().toLocaleString("es-GT"),
    enviado:       false
  };

  // 1 — Guardar localmente siempre
  saveLocal(registro);

  // 2 — Intentar enviar
  const btn = document.getElementById("btnGuardar");
  btn.disabled = true;
  btn.innerHTML = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="spin"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg> Guardando…`;

  const enviado = await enviarASheets(registro);

  if (enviado) {
    marcarEnviado(registro.id);
    showToast("✓ Registro enviado a Google Sheets", "success");
  } else {
    // Guardar en pendientes para reenvío automático
    guardarPendiente(registro);
    showToast("✓ Guardado — se enviará cuando haya conexión", "");
  }

  btn.disabled = false;
  btn.innerHTML = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg> Guardar registro`;

  renderHistory();
  resetForm();
}

// ── Envío a Google Sheets ─────────────────────────────────
async function enviarASheets(data) {
  try {
    await fetch(SCRIPT_URL, {
      method: "POST",
      mode: "no-cors",
      body: JSON.stringify(data),
    });
    return true;
  } catch (err) {
    return false;
  }
}

// ── Reenvío automático de pendientes ─────────────────────
async function reenviarPendientes() {
  const pendientes = getPendientes();
  if (!pendientes.length) return;

  let enviados = 0;
  for (const registro of pendientes) {
    const ok = await enviarASheets(registro);
    if (ok) {
      eliminarPendiente(registro.id);
      marcarEnviado(registro.id);
      enviados++;
    }
  }

  if (enviados > 0) {
    showToast(`✓ ${enviados} registro${enviados > 1 ? "s" : ""} pendiente${enviados > 1 ? "s" : ""} enviado${enviados > 1 ? "s" : ""}`, "success");
    renderHistory();
  }
}

// ── Pendientes ────────────────────────────────────────────
function getPendientes() {
  try { return JSON.parse(localStorage.getItem(PENDING_KEY) || "[]"); }
  catch { return []; }
}
function guardarPendiente(registro) {
  const pendientes = getPendientes();
  if (!pendientes.find(p => p.id === registro.id)) {
    pendientes.push(registro);
    localStorage.setItem(PENDING_KEY, JSON.stringify(pendientes));
  }
}
function eliminarPendiente(id) {
  const pendientes = getPendientes().filter(p => p.id !== id);
  localStorage.setItem(PENDING_KEY, JSON.stringify(pendientes));
}

// ── Storage local ─────────────────────────────────────────
function getRecords() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]"); }
  catch { return []; }
}
function saveLocal(record) {
  const records = getRecords();
  records.unshift(record);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
}
function marcarEnviado(id) {
  const records = getRecords().map(r => r.id === id ? { ...r, enviado: true } : r);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
}
function deleteRecord(id) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(getRecords().filter(r => r.id !== id)));
  eliminarPendiente(id);
  renderHistory();
  showToast("Registro eliminado");
}
function clearAll() {
  if (!confirm("¿Seguro que deseas borrar todos los registros locales?")) return;
  localStorage.removeItem(STORAGE_KEY);
  localStorage.removeItem(PENDING_KEY);
  renderHistory();
  showToast("Registros locales eliminados");
}

// ── Historial ─────────────────────────────────────────────
function renderHistory() {
  const records = getRecords();
  const section = document.getElementById("historySection");
  const list    = document.getElementById("historyList");
  const count   = document.getElementById("historyCount");
  const pendientes = getPendientes().length;

  if (!records.length) { section.hidden = true; return; }

  section.hidden = false;
  count.textContent = `${records.length} registro${records.length !== 1 ? "s" : ""} en este dispositivo` +
    (pendientes > 0 ? ` · ${pendientes} pendiente${pendientes > 1 ? "s" : ""} de enviar` : "");

  list.innerHTML = "";
  records.forEach(r => {
    const card = document.createElement("div");
    card.className = "history-card";
    const fechaFmt = r.fecha
      ? new Date(r.fecha + "T12:00:00").toLocaleDateString("es-GT", { day: "2-digit", month: "short", year: "numeric" })
      : "—";
    const estadoBadge = r.enviado
      ? `<span class="hc-chip" style="background:#d4edda;color:#2d7d52;">✓ Enviado</span>`
      : `<span class="hc-chip" style="background:#fff3cd;color:#856404;">⏳ Pendiente</span>`;

    card.innerHTML = `
      <div class="hc-top">
        <div>
          <div class="hc-product">${esc(r.producto)}</div>
          <div class="hc-meta">
            <span class="hc-chip">${fechaFmt}</span>
            <span class="hc-chip">${esc(r.sucursal)}</span>
            <span class="hc-chip">${esc(r.tipo_cliente)}</span>
            <span class="hc-chip yellow">${esc(r.motivo)}</span>
            ${estadoBadge}
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
  const headers = ["Fecha","Sucursal","Cliente","Tipo cliente","Código","Producto","Medida","Cantidad","Motivo","Observaciones","Vendedor","Guardado","Enviado"];
  const rows = records.map(r =>
    [r.fecha, r.sucursal, r.cliente, r.tipo_cliente, r.codigo, r.producto,
     r.medida, r.cantidad, r.motivo, r.observaciones, r.vendedor, r.guardado, r.enviado ? "Sí" : "No"]
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
  motivosSeleccionados = [];
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
  toastTimer = setTimeout(() => { t.className = "toast"; }, 3800);
}

// ── Escape HTML ───────────────────────────────────────────
function esc(str) {
  return String(str || "")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;")
    .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}