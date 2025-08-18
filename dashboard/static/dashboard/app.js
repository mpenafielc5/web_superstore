const qs = (s) => document.querySelector(s);
const form = qs('#filters');
const kpiTotal = qs('#kpiTotal');
const kpiSegment = qs('#kpiSegment');
const tblCustomers = qs('#tblCustomers');
const tblProducts = qs('#tblProducts');
const selCat = qs('#category');
const selSub = qs('#sub_category');
const selState = qs('#state');
const selCity = qs('#city');
const legendCategory = qs('#legendCategory');
const chips = qs('#activeFilters');

let lineChart, pieChart, fpFrom, fpTo;

const nfMoney = new Intl.NumberFormat('es-EC', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const money = (n) => `$${nfMoney.format(Number(n || 0))}`;

const cssVar = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();
const hexToRgba = (hex, a=.18) => { const h=hex.replace('#',''); const n=parseInt(h,16); return `rgba(${(n>>16)&255},${(n>>8)&255},${n&255},${a})`; };
const todayStr = () => { const d=new Date(); const mm=String(d.getMonth()+1).padStart(2,'0'); const dd=String(d.getDate()).padStart(2,'0'); return `${d.getFullYear()}-${mm}-${dd}`; };
const esc = (s='') => String(s).replace(/[&<>"']/g, m=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[m]));

function setOptions(select, values, allLabel) {
  const current = select.value;
  const prefix = allLabel ? [`<option value="">(${allLabel})</option>`] : [];
  select.innerHTML = prefix.concat((values || []).map(v => `<option value="${esc(v)}">${esc(v)}</option>`)).join('');
  if ([...select.options].some(o => o.value === current)) select.value = current;
}

function initDatePickers(){
  const common = {
    dateFormat: "Y-m-d",
    altInput: true, altFormat: "d M Y",
    allowInput: true, locale: flatpickr.l10ns.es,
    disableMobile: true, monthSelectorType: "dropdown",
    prevArrow: '<i class="ti ti-chevron-left"></i>',
    nextArrow: '<i class="ti ti-chevron-right"></i>'
  };
  const fromEl = form.querySelector('input[name="date_from"]');
  const toEl   = form.querySelector('input[name="date_to"]');

  fpFrom = flatpickr(fromEl, { ...common, onChange: (sel)=>{ if(sel.length) fpTo.set('minDate', sel[0]); } });
  fpTo   = flatpickr(toEl,   { ...common, onChange: (sel)=>{ if(sel.length) fpFrom.set('maxDate', sel[0]); } });
}

function getFormFilters(){
  const fd = new FormData(form);
  return {
    date_from: fd.get('date_from') || '',
    date_to: fd.get('date_to') || '',
    category: fd.get('category') || '',
    sub_category: fd.get('sub_category') || '',
    state: fd.get('state') || '',
    city: fd.get('city') || ''
  };
}
function getAppliedFilters(){
  const f = getFormFilters();
  const applied = { ...f };
  if (f.date_from && !f.date_to) applied.date_to = todayStr();
  return { form: f, applied };
}
function queryFrom(applied){
  const p = new URLSearchParams();
  Object.entries(applied).forEach(([k,v])=>{ if (v) p.append(k, v); });
  return p.toString() ? `?${p.toString()}` : '';
}
function renderChips({form, applied}){
  const items = [];
  if (form.date_from && !form.date_to){
    items.push(`<span class="badge me-2 mb-2" data-key="date_from"><i class="ti ti-calendar me-1"></i>Desde: ${esc(form.date_from)} <a href="#" data-clear="date_from" class="ms-2 text-muted">✕</a></span>`);
    items.push(`<span class="badge me-2 mb-2"><i class="ti ti-calendar-event me-1"></i>Hasta: hoy (auto)</span>`);
  } else {
    if (applied.date_from) items.push(`<span class="badge me-2 mb-2" data-key="date_from"><i class="ti ti-calendar me-1"></i>Desde: ${esc(applied.date_from)} <a href="#" data-clear="date_from" class="ms-2 text-muted">✕</a></span>`);
    if (applied.date_to)   items.push(`<span class="badge me-2 mb-2" data-key="date_to"><i class="ti ti-calendar-event me-1"></i>Hasta: ${esc(applied.date_to)} <a href="#" data-clear="date_to" class="ms-2 text-muted">✕</a></span>`);
  }
  if (form.category)     items.push(`<span class="badge me-2 mb-2" data-key="category"><i class="ti ti-category me-1"></i>${esc(form.category)} <a href="#" data-clear="category" class="ms-2 text-muted">✕</a></span>`);
  if (form.sub_category) items.push(`<span class="badge me-2 mb-2" data-key="sub_category"><i class="ti ti-category-2 me-1"></i>${esc(form.sub_category)} <a href="#" data-clear="sub_category" class="ms-2 text-muted">✕</a></span>`);
  if (form.state)        items.push(`<span class="badge me-2 mb-2" data-key="state"><i class="ti ti-map-pin me-1"></i>${esc(form.state)} <a href="#" data-clear="state" class="ms-2 text-muted">✕</a></span>`);
  if (form.city)         items.push(`<span class="badge me-2 mb-2" data-key="city"><i class="ti ti-building me-1"></i>${esc(form.city)} <a href="#" data-clear="city" class="ms-2 text-muted">✕</a></span>`);
  chips.innerHTML = items.join('') || `<span class="text-muted">Sin filtros activos</span>`;
}

const ctl = {};
async function jget(url, key){
  if (ctl[key]) ctl[key].abort();
  const ac = new AbortController(); ctl[key] = ac;
  const r = await fetch(url, { signal: ac.signal });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json();
}

async function loadFilters() {
  try {
    const { applied } = getAppliedFilters();
    const data = await jget(`/api/filters${queryFrom(applied)}`, 'filters');
    if (data.categories) setOptions(selCat, data.categories, 'Todas');
    if (data.subcategories && data.subcategories.length) setOptions(selSub, data.subcategories, 'Todas'); else selSub.innerHTML = '<option value="">(Todas)</option>';
    if (data.states && data.states.length) setOptions(selState, data.states, 'Todos');
    if (data.cities && data.cities.length) setOptions(selCity, data.cities, 'Todas'); else selCity.innerHTML = '<option value="">(Todas)</option>';
  } catch(e){ console.error(e); }
}

async function loadKPIs() {
  const { applied } = getAppliedFilters();
  const d = await jget(`/api/kpis${queryFrom(applied)}`);

  const total = Number(d.total_sales || 0);
  kpiTotal.textContent = money(total);

  const seg = d.sales_by_segment || [];
  const items = seg.map(s => {
    const val = Number(s.total || 0);
    const pct = total > 0 ? (val / total * 100) : 0;
    return `
      <li class="list-group-item">
        <div class="d-flex justify-content-between align-items-center">
          <span><i class="ti ti-tag me-2"></i>${s.segment}</span>
          <strong>${money(val)} <span class="text-muted ms-2">(${pct.toFixed(1)}%)</span></strong>
        </div>
        <div class="mini-bar mt-2"><span style="width:${Math.min(100, Math.max(0, pct))}%"></span></div>
      </li>
    `;
  }).join('');

  kpiSegment.innerHTML = items || `
    <li class="list-group-item text-muted">Sin datos</li>
  `;
}


async function loadTables() {
  try {
    const { applied } = getAppliedFilters();
    const cust = await jget(`/api/top-customers${queryFrom(applied)}`, 'topc');
    const rowsC = (cust.rows || []);
    tblCustomers.innerHTML = rowsC.length ? rowsC.map(r =>
      `<tr>
        <td>${esc(r.customer_name)}</td>
        <td>${esc(r.segment)}</td>
        <td>${esc(r.city)}</td>
        <td>${esc(r.state)}</td>
        <td class="text-end">${money(r.total)}</td>
      </tr>`
    ).join('') : `<tr><td colspan="5" class="text-muted">Sin datos</td></tr>`;

    const prod = await jget(`/api/top-products${queryFrom(applied)}`, 'topp');
    const rowsP = (prod.rows || []);
    tblProducts.innerHTML = rowsP.length ? rowsP.map(r =>
      `<tr>
        <td>${esc(r.product_id)}</td>
        <td>${esc(r.category)}</td>
        <td>${esc(r.sub_category)}</td>
        <td>${esc(r.product_name)}</td>
        <td class="text-end">${money(r.total_sales)}</td>
      </tr>`
    ).join('') : `<tr><td colspan="5" class="text-muted">Sin datos</td></tr>`;
  } catch(e){
    console.error(e);
    tblCustomers.innerHTML = `<tr><td colspan="5" class="text-muted">Sin datos</td></tr>`;
    tblProducts.innerHTML = `<tr><td colspan="5" class="text-muted">Sin datos</td></tr>`;
  }
}

function recreateLine(labels, values){
  const ctx = document.getElementById('lineSales');
  const accent = cssVar('--accent') || '#0A84FF';
  if (lineChart) lineChart.destroy();
  lineChart = new Chart(ctx, {
    type: 'line',
    data: { labels, datasets: [{ label:'Ventas', data:values, borderColor:accent, backgroundColor:hexToRgba(accent,.18), fill:true, tension:.35, pointRadius:0, borderWidth:2 }] },
    options: {
      responsive:true, maintainAspectRatio:false, resizeDelay:100,
      plugins:{ legend:{ display:false }, tooltip:{ callbacks:{ label:(c)=>` ${money(c.parsed.y)}` } } },
      interaction:{ intersect:false, mode:'index' },
      scales:{ y:{ ticks:{ callback:(v)=>money(v) } } }
    }
  });
}
function recreatePie(labels, values){
  const ctx = document.getElementById('pieCategory');
  if (pieChart) pieChart.destroy();

  const nums = (values || []).map(v => Number(v || 0));
  const total = nums.reduce((a,b)=>a+b, 0);
  const perc  = nums.map(v => total > 0 ? (v / total * 100) : 0);

  const centerText = {
    id: 'centerText',
    afterDraw(chart){
      if (!total) return;
      const {ctx, chartArea:{left,right,top,bottom}} = chart;
      const x = (left+right)/2, y = (top+bottom)/2;
      ctx.save();
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--text').trim();
      ctx.font = '600 12px Inter, system-ui, -apple-system, Segoe UI, Roboto, Arial';
      ctx.fillText('Total', x, y - 8);
      ctx.font = '700 14px Inter, system-ui, -apple-system, Segoe UI, Roboto, Arial';
      ctx.fillText(money(total), x, y + 10);
      ctx.restore();
    }
  };

  pieChart = new Chart(ctx, {
    type: 'doughnut',
    data: { labels, datasets: [{ data: nums }] },
    options: {
      responsive: true, maintainAspectRatio: false, resizeDelay: 100, cutout: '62%',
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (item) => {
              const val = item.parsed || 0;
              const p = total > 0 ? (val / total * 100) : 0;
              return ` ${item.label}: ${money(val)} (${p.toFixed(1)}%)`;
            }
          }
        }
      }
    },
    plugins: [centerText]
  });

  if (legendCategory) {
    legendCategory.innerHTML = labels.map((c,i)=>{
      const val = nums[i];
      const p = total > 0 ? (val / total * 100) : 0;
      return `
        <span class="badge">
          <i class="ti ti-tags"></i>
          <span class="label">${c}</span>
          <span class="text-muted ms-1">${money(val)} · ${p.toFixed(1)}%</span>
          <span class="mini-bar"><span style="width:${Math.min(100, Math.max(0, p))}%"></span></span>
        </span>
      `;
    }).join('');
  }
}
async function loadCharts() {
  try {
    const { applied } = getAppliedFilters();
    const series = await jget(`/api/series-sales${queryFrom(applied)}`, 'series');
    const bycat  = await jget(`/api/sales-by-category${queryFrom(applied)}`, 'bycat');

    const pts = (series.points || []);
    const labels = pts.map(p=>p.period);
    const values = pts.map(p=>Number(p.total||0));
    recreateLine(labels, values);

    const rows = (bycat.rows || []);
    const catLabels = rows.map(x=>x.category);
    const catValues = rows.map(x=>Number(x.total||0));
    recreatePie(catLabels, catValues);
  } catch(e){ console.error(e); }
}

async function refreshAll(){
  const packs = getAppliedFilters();
  renderChips(packs);
  await loadFilters();
  await Promise.all([loadKPIs(), loadTables(), loadCharts()]);
}

form.addEventListener('submit', (e)=>{ e.preventDefault(); refreshAll(); });
qs('#clearFilters').addEventListener('click', ()=>{
  form.reset();
  if (fpFrom){ fpFrom.clear(); fpFrom.set('maxDate', null); }
  if (fpTo){ fpTo.clear(); fpTo.set('minDate', null); }
  selSub.innerHTML = '<option value="">(Todas)</option>';
  selCity.innerHTML = '<option value="">(Todas)</option>';
  refreshAll();
});
selCat.addEventListener('change', ()=>{ selSub.value=''; loadFilters(); });
selState.addEventListener('change', ()=>{ selCity.value=''; loadFilters(); });

chips.addEventListener('click', (e)=>{
  const a = e.target.closest('[data-clear]'); if(!a) return;
  e.preventDefault();
  const key=a.getAttribute('data-clear');
  const input=form.querySelector(`[name="${key}"]`);
  if(input) input.value='';
  if(key==='state') selCity.innerHTML='<option value="">(Todas)</option>';
  if(key==='category') selSub.innerHTML='<option value="">(Todas)</option>';
  if(key==='date_from'){ if (fpTo) fpTo.set('minDate', null); }
  if(key==='date_to'){ if (fpFrom) fpFrom.set('maxDate', null); }
  refreshAll();
});

document.addEventListener('theme:change', ()=>{ loadCharts(); });
document.addEventListener('DOMContentLoaded', ()=>{ initDatePickers(); refreshAll(); });

let lastCust = [], lastProd = [];

function setLastUpdated(){
  const el = document.getElementById('lastUpdated');
  if(!el) return;
  const d = new Date();
  const hh = String(d.getHours()).padStart(2,'0');
  const mm = String(d.getMinutes()).padStart(2,'0');
  el.textContent = `Actualizado ${hh}:${mm}`;
}

function buildShareURL(){
  const { applied } = getAppliedFilters();
  const u = new URL(window.location.href);
  u.search = queryFrom(applied);
  return u.toString();
}

async function copyShareURL(){
  try{
    await navigator.clipboard.writeText(buildShareURL());
    toast('Enlace copiado');
  }catch{
    prompt('Copia este enlace:', buildShareURL());
  }
}

function toCSV(rows, headers){
  const scape = (v) => {
    const s = (v==null ? '' : String(v));
    return /[",\n;]/.test(s) ? `"${s.replace(/"/g,'""')}"` : s;
  };
  const head = headers.map(h=>scape(h)).join(',');
  const body = rows.map(r => headers.map(h => scape(r[h])).join(',')).join('\n');
  return head + '\n' + body;
}
function downloadCSV(filename, csv){
  const blob = new Blob([csv], { type:'text/csv;charset=utf-8;' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}
function exportCustomers(){
  if(!lastCust.length) return toast('No hay datos de clientes');
  const csv = toCSV(lastCust, ['customer_name','segment','city','state','total']);
  downloadCSV('clientes.csv', csv);
}
function exportProducts(){
  if(!lastProd.length) return toast('No hay datos de productos');
  const csv = toCSV(lastProd, ['product_id','category','sub_category','product_name','total_sales']);
  downloadCSV('productos.csv', csv);
}

(function compactInit(){
  const key='compact';
  const saved = localStorage.getItem(key);
  if(saved==='1') document.documentElement.setAttribute('data-compact','1');
  const btn = document.getElementById('compactToggle');
  if(!btn) return;
  btn.addEventListener('click', (e)=>{
    e.preventDefault();
    const root = document.documentElement;
    const isOn = root.getAttribute('data-compact') === '1';
    if(isOn){ root.removeAttribute('data-compact'); localStorage.setItem(key,'0'); }
    else { root.setAttribute('data-compact','1'); localStorage.setItem(key,'1'); }
  });
})();

(function headerActions(){
  const btnShare = document.getElementById('shareView');
  const bExpC = document.getElementById('expCustomers');
  const bExpP = document.getElementById('expProducts');
  if(btnShare) btnShare.addEventListener('click', (e)=>{ e.preventDefault(); copyShareURL(); });
  if(bExpC) bExpC.addEventListener('click', exportCustomers);
  if(bExpP) bExpP.addEventListener('click', exportProducts);
})();

function toast(msg){
  if (window.Tabler && Tabler.Toast) {
    new Tabler.Toast({ message: msg, position: 'top-right', duration: 1800 }).show();
    return;
  }
  console.log(msg);
}

(async function hookRefresh(){
  const orig = refreshAll;
  window.refreshAll = async function(){
    await orig();
    setLastUpdated();
  };
})();

(function(){
  const btn = document.getElementById('exportExcel');
  if(!btn) return;
  btn.addEventListener('click', ()=>{
    const { applied } = getAppliedFilters();
    const q = queryFrom(applied);
    window.location.href = `/export/xlsx${q}`;
  });
})();

document.addEventListener('DOMContentLoaded', ()=>{
  if (window.innerWidth < 768) {
    document.documentElement.setAttribute('data-compact','1');
  }
});
