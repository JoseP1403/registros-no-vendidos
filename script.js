/* ── Datos ── */
const MONTHS = ['May','Jun','Jul','Ago','Sep','Oct','Nov','Dic','Ene','Feb','Mar','Abr'];

const DATA = {
  totals:  [257, 16994, 64495, 51312, 50145, 26895, 28729, 195085, 137409, 190802, 135104, 249700],
  recesa:  [0,   0,     0,     0,     700,   4910,  4357,  0,      0,      10115,  40038,  121815],
  redelsa: [0,   16994, 64495, 51312, 49445, 21985, 24372, 195085, 137409, 180687, 95066,  127885],
};

const PRODUCTS = [
  { name: 'Perno S/Muestra',          val: 265074 },
  { name: 'Barra lisa GR55 25mm',     val: 45865  },
  { name: 'Tornillo lámina 14×1½',    val: 30940  },
  { name: 'Tornillo hex. A325 1×3½',  val: 30906  },
  { name: 'Tuerca hex. A325 1.3/8',   val: 26250  },
  { name: 'Tuerca hex. A325 5/8',     val: 26198  },
  { name: 'Barra lisa GR105 1"',      val: 24840  },
];

const YELLOW = '#F5C400';
const BLACK  = '#1a1a1a';
const GRAY   = 'rgba(128,128,128,0.1)';

/* ── Utilidades ── */
function fmtK(v) {
  return 'Q' + (v >= 1000 ? Math.round(v / 1000) + 'k' : v);
}

/* ── Gráfico de líneas ── */
function initLine() {
  new Chart(document.getElementById('lineChart'), {
    type: 'line',
    data: {
      labels: MONTHS,
      datasets: [{
        label: 'Total ventas',
        data: DATA.totals,
        borderColor: YELLOW,
        backgroundColor: 'rgba(245,196,0,0.10)',
        borderWidth: 2,
        pointBackgroundColor: YELLOW,
        pointRadius: 3,
        pointHoverRadius: 5,
        fill: true,
        tension: 0.35,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: {
          ticks: { font: { size: 9 }, maxRotation: 0, autoSkip: false },
          grid:  { display: false },
        },
        y: {
          ticks: { font: { size: 9 }, callback: fmtK },
          grid:  { color: GRAY },
        },
      },
    },
  });
}

/* ── Gráfico de barras apiladas ── */
function initBar() {
  new Chart(document.getElementById('barChart'), {
    type: 'bar',
    data: {
      labels: MONTHS,
      datasets: [
        { label: 'RECESA',  data: DATA.recesa,  backgroundColor: BLACK,  borderRadius: 2 },
        { label: 'REDELSA', data: DATA.redelsa, backgroundColor: YELLOW, borderRadius: 2 },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: {
          stacked: true,
          ticks: { font: { size: 9 }, maxRotation: 0, autoSkip: false },
          grid:  { display: false },
        },
        y: {
          stacked: true,
          ticks: { font: { size: 9 }, callback: fmtK },
          grid:  { color: GRAY },
        },
      },
    },
  });
}

/* ── Gráfico de dona ── */
function initDonut() {
  new Chart(document.getElementById('donutChart'), {
    type: 'doughnut',
    data: {
      labels: ['RECESA', 'REDELSA'],
      datasets: [{
        data: [181935, 964992],
        backgroundColor: [BLACK, YELLOW],
        borderWidth: 0,
        hoverOffset: 4,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '65%',
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: ctx => ctx.label + ': Q' + ctx.parsed.toLocaleString(),
          },
        },
      },
    },
  });
}

/* ── Lista de productos ── */
function renderProducts() {
  const container = document.getElementById('products');
  const maxVal = PRODUCTS[0].val;

  PRODUCTS.forEach(p => {
    const pct  = Math.round((p.val / maxVal) * 100);
    const item = document.createElement('div');
    item.className = 'prod-item';
    item.innerHTML = `
      <div class="prod-name">${p.name}</div>
      <div class="prod-bar-wrap">
        <div class="prod-bar" style="width:${pct}%"></div>
      </div>
      <div class="prod-val">Q${Math.round(p.val / 1000)}k</div>
    `;
    container.appendChild(item);
  });
}

/* ── Init ── */
document.addEventListener('DOMContentLoaded', () => {
  initLine();
  initBar();
  initDonut();
  renderProducts();
});
