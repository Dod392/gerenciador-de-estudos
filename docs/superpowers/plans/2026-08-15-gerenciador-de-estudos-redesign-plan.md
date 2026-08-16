# Gerenciador de Estudos — Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign the existing single-file PWA's shell and screens — desktop sidebar, a real Dashboard home,
full-width layout, a modern dark visual system, and richer Planejamento/Desempenho screens — without touching
the data model, storage format, or spaced-repetition logic.

**Architecture:** Same single `index.html` (all CSS + JS in one file) plus `manifest.json`/`sw.js`/icons. No
build step, no framework. One new external dependency this round: Chart.js via CDN, precached by the service
worker for offline parity. All existing pure-logic functions (state, date math, spaced repetition, aggregation)
are reused as-is; this plan only adds a handful of new small aggregation functions, restructures the HTML
shell/nav, and rewrites render functions per screen.

**Tech Stack:** Vanilla HTML/CSS/JS, `localStorage`, Chart.js (CDN, pinned version), hand-rolled SVG only where
already used (nothing new), Web App Manifest + Service Worker, GitHub Pages.

**Spec:** `docs/superpowers/specs/2026-08-15-gerenciador-de-estudos-redesign-design.md` (this round) and
`docs/superpowers/specs/2026-08-15-gerenciador-de-estudos-design.md` (original, still governs data model/logic).

## Global Constraints

- No build step, no framework, no npm — same as the original MVP. **Exception this round:** Chart.js loaded via
  `<script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.4/dist/chart.umd.min.js">`, added to the service
  worker's precache list so offline/installed behavior is preserved.
- Single accent color: every highlight, button, active nav state, progress bar fill, and chart series color
  must come from `var(--accent)` (read via `getComputedStyle` for chart configs, not hardcoded hex) — changing
  one CSS variable re-themes the whole app including charts.
- Do not change `localStorage` key (`estudos_v1`), `estadoValido()`'s required shape, or the JSON backup
  format — old exports must keep importing correctly.
- Do not change spaced-repetition logic (`GRAU_ORDEM`, `GRAU_DIAS`, `graduarAcerto`, `graduarErro`), Mapa's
  status/concurso cycling, or any existing `render*`/`attach*Handlers` function's underlying data logic —
  this round changes markup/CSS/navigation, not business logic (except the small new aggregation functions
  listed per task).
- Mobile-first constraints from the original spec still apply: touch targets ≥44px, mobile still lands on
  Hoje (not Dashboard) for 1-tap check-in.
- **Shared-function watch item:** `renderScreen()`'s tab→render-function map object and its
  `if(currentTab===...) attach...Handlers();` chain are edited **additively** by Tasks 1, 2, 4, 5, and 6.
  Each of those tasks: open the current `renderScreen()` in the live file and add/update your entry alongside
  what's already there — never replace the whole function body from a stale copy.
- No test framework (matches original MVP). New pure aggregation functions are developed test-first via plain
  Node.js scratch scripts (`node --input-type=module` or a temp `.mjs` file) run from the scratchpad directory,
  never committed. DOM/CSS/nav/chart behavior has no automated test — verify by static code reading (no
  browser tool is available in this environment) and hand off live-device verification to the user per task.

---

## Task 1: Design tokens, sidebar/topbar shell, responsive breakpoint, mobile nav restructure

**Files:**
- Modify: `index.html` (`<style>` block, `<body>` markup, JS shell — `NAV_ITEMS`, sidebar render/attach,
  mobile nav restructure, `renderScreen()` stubs for `dashboard`/`config`)
- Modify: `manifest.json` (theme/background color to match new `--bg`)

**Interfaces:**
- Produces: `NAV_ITEMS` (array of `{id, label, icon}`, 7 entries), `MOBILE_PRIMARY` (array of 3 tab ids),
  `renderSidebar()`, `attachSidebarHandlers()`, `renderMaisSheet()`, `attachTabsHandlers()`, CSS classes
  `.kpi-grid`, `.grid-2`, `.stat-card` (`.stat-label`/`.stat-value`/`.stat-icon`), `.progress` (`> i` fill),
  `table.data`, `.card-grid`. Temporary stub `renderDashboard()`/`attachDashboardHandlers()` and
  `renderConfig()`/`attachConfigHandlers()` (replaced by Tasks 2 and 6).
- Consumes: nothing new from other tasks (this is the foundation task).

- [ ] **Step 1: Replace the `:root` token block and add new layout/component CSS**

In `index.html`, replace the existing `:root{...}` block (currently lines 10-14) with:

```css
:root{
  --bg:#0b0d11; --surface:#14171d; --card:#1a1e26;
  --fg:#e8eaed; --muted:#9aa0a6;
  --accent:#4f9dde; --accent-fg:#06121c;
  --ok:#3ecf8e; --warn:#e0a83e; --bad:#e05a4f;
  --border:#2a2f3a;
  --space-1:4px; --space-2:8px; --space-3:12px; --space-4:16px; --space-6:24px; --space-8:32px;
  --radius-sm:8px; --radius:12px; --radius-lg:16px;
  --text-xs:12px; --text-sm:13px; --text-base:14px; --text-lg:16px; --text-xl:20px; --text-2xl:28px;
  --shadow-sm:0 1px 2px rgba(0,0,0,.35); --shadow:0 4px 16px rgba(0,0,0,.4);
  --tap:48px;
}
```

Keep every other existing rule (`*`, `html,body`, `.card`, `button`, `.row`, `label`, `input,select,textarea`,
`nav#tabs`, `small.muted`, `.badge`) as-is — they already reference the variable names above so they keep
working. Change `.card`'s `border-radius:var(--radius)` line to also add `box-shadow:var(--shadow-sm);` (append
to the existing `.card{...}` rule, don't duplicate it).

Then append this new block right after the existing rules, before `</style>`:

```css
#layout{display:flex;min-height:100vh;}
#main{flex:1;min-width:0;}
#app{max-width:1280px;margin:0 auto;padding:var(--space-6);}
#sidebar{display:none;}
#mais-sheet{position:fixed;inset:0;background:rgba(0,0,0,.6);z-index:20;display:flex;align-items:flex-end;}
#mais-sheet.hidden{display:none;}
#mais-sheet .sheet-content{background:var(--surface);width:100%;border-radius:16px 16px 0 0;
  padding:var(--space-4);padding-bottom:calc(var(--space-4) + env(safe-area-inset-bottom));}
#mais-sheet button{display:flex;align-items:center;gap:var(--space-3);justify-content:flex-start;text-align:left;}

.kpi-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:var(--space-4);}
.grid-2{display:grid;grid-template-columns:1fr;gap:var(--space-4);}
.stat-card{position:relative;}
.stat-card .stat-label{font-size:var(--text-xs);color:var(--muted);text-transform:uppercase;letter-spacing:.04em;}
.stat-card .stat-value{font-size:var(--text-2xl);font-weight:650;margin-top:4px;}
.stat-card .stat-icon{position:absolute;top:var(--space-4);right:var(--space-4);opacity:.5;font-size:18px;}
.progress{height:8px;border-radius:999px;background:var(--border);overflow:hidden;margin-top:6px;}
.progress > i{display:block;height:100%;background:var(--accent);}
table.data{width:100%;border-collapse:collapse;font-size:var(--text-sm);}
table.data th{text-align:left;color:var(--muted);font-weight:600;font-size:var(--text-xs);
  text-transform:uppercase;padding:6px 8px;border-bottom:1px solid var(--border);}
table.data td{padding:8px;border-bottom:1px solid var(--border);}
table.data tr:nth-child(even) td{background:rgba(255,255,255,.02);}
.card-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:var(--space-4);}

@media (min-width:900px){
  body{padding-bottom:0;}
  nav#tabs{display:none;}
  #mais-sheet{display:none !important;}
  #sidebar{display:flex;flex-direction:column;width:220px;flex-shrink:0;
    background:var(--surface);border-right:1px solid var(--border);
    padding:var(--space-4);position:sticky;top:0;height:100vh;box-sizing:border-box;}
  #sidebar.collapsed{width:64px;}
  #sidebar.collapsed .nav-label,#sidebar.collapsed .brand-text{display:none;}
  #sidebar-brand{font-weight:650;font-size:var(--text-lg);display:flex;gap:8px;align-items:center;}
  #sidebar-nav{display:flex;flex-direction:column;gap:4px;margin-top:var(--space-6);flex:1;}
  #sidebar-nav button{width:100%;min-height:44px;background:transparent;border:none;
    color:var(--muted);border-radius:var(--radius-sm);display:flex;align-items:center;
    gap:var(--space-3);text-align:left;padding:0 var(--space-3);}
  #sidebar-nav button.active{background:var(--card);color:var(--accent);font-weight:650;}
  #sidebar-toggle{background:transparent;border:1px solid var(--border);color:var(--muted);}
  .grid-2{grid-template-columns:1fr 1fr;}
}
```

- [ ] **Step 2: Restructure `<body>` markup**

Replace:
```html
<body>
  <div id="app"></div>
  <nav id="tabs"></nav>
  <script>
```
with:
```html
<body>
  <div id="layout">
    <aside id="sidebar">
      <div id="sidebar-brand">📚 <span class="brand-text">Estudos</span></div>
      <nav id="sidebar-nav"></nav>
      <button id="sidebar-toggle" title="Recolher menu">«</button>
    </aside>
    <div id="main">
      <div id="app"></div>
    </div>
  </div>
  <nav id="tabs"></nav>
  <div id="mais-sheet" class="hidden"></div>
  <script>
```

- [ ] **Step 3: Replace the `TABS`/`currentTab`/`renderTabsNav` block with `NAV_ITEMS` + sidebar/mobile nav logic**

Find the existing block (currently around the `/* === RENDER === */` marker):
```js
  /* === RENDER === */
  const TABS = [
    {id:'hoje', label:'Hoje'},
    {id:'erros', label:'Erros'},
    {id:'mapa', label:'Mapa'},
    {id:'semana', label:'Semana'},
    {id:'desempenho', label:'Desempenho'},
  ];
  let currentTab = 'hoje';


  function renderTabsNav(){
    document.getElementById('tabs').innerHTML = TABS.map(t =>
      `<button data-tab="${t.id}" class="${t.id===currentTab?'active':''}">${t.label}</button>`
    ).join('');
  }
```

Replace it with:
```js
  /* === RENDER === */
  const NAV_ITEMS = [
    {id:'dashboard', label:'Dashboard', icon:'📊'},
    {id:'hoje', label:'Hoje', icon:'✅'},
    {id:'planejamento', label:'Planejamento', icon:'🗓️'},
    {id:'mapa', label:'Mapa de Conteúdo', icon:'🗺️'},
    {id:'erros', label:'Caderno de Erros', icon:'📓'},
    {id:'desempenho', label:'Desempenho', icon:'📈'},
    {id:'config', label:'Configurações', icon:'⚙️'},
  ];
  const MOBILE_PRIMARY = ['hoje', 'planejamento', 'desempenho'];
  let currentTab = (window.matchMedia && window.matchMedia('(min-width:900px)').matches) ? 'dashboard' : 'hoje';
  let sidebarCollapsed = false;

  function renderSidebar(){
    const nav = document.getElementById('sidebar-nav');
    if(!nav) return;
    nav.innerHTML = NAV_ITEMS.map(t =>
      `<button data-tab="${t.id}" class="${t.id===currentTab?'active':''}"><span>${t.icon}</span><span class="nav-label">${t.label}</span></button>`
    ).join('');
  }

  function attachSidebarHandlers(){
    document.getElementById('sidebar-nav')?.addEventListener('click', (e) => {
      const btn = e.target.closest('button[data-tab]');
      if(!btn) return;
      currentTab = btn.dataset.tab;
      render();
    });
    document.getElementById('sidebar-toggle')?.addEventListener('click', () => {
      sidebarCollapsed = !sidebarCollapsed;
      document.getElementById('sidebar').classList.toggle('collapsed', sidebarCollapsed);
    });
  }

  function renderTabsNav(){
    const outrosAtivo = !MOBILE_PRIMARY.includes(currentTab);
    document.getElementById('tabs').innerHTML = MOBILE_PRIMARY.map(id => {
      const t = NAV_ITEMS.find(n => n.id === id);
      return `<button data-tab="${id}" class="${id===currentTab?'active':''}">${t.label}</button>`;
    }).join('') + `<button id="btn-mais" class="${outrosAtivo?'active':''}">Mais</button>`;
  }

  function renderMaisSheet(){
    const outros = NAV_ITEMS.filter(t => !MOBILE_PRIMARY.includes(t.id));
    document.getElementById('mais-sheet').innerHTML = `
      <div class="sheet-content">
        ${outros.map(t => `<button data-tab="${t.id}"><span>${t.icon}</span> ${t.label}</button>`).join('')}
        <button id="mais-fechar">Fechar</button>
      </div>`;
  }

  function fecharMais(){
    document.getElementById('mais-sheet').classList.add('hidden');
  }

  function attachTabsHandlers(){
    document.getElementById('tabs').addEventListener('click', (e) => {
      if(e.target.closest('#btn-mais')){
        renderMaisSheet();
        document.getElementById('mais-sheet').classList.remove('hidden');
        return;
      }
      const btn = e.target.closest('button[data-tab]');
      if(!btn) return;
      currentTab = btn.dataset.tab;
      render();
    });
    document.getElementById('mais-sheet').addEventListener('click', (e) => {
      if(e.target.id === 'mais-sheet' || e.target.id === 'mais-fechar'){ fecharMais(); return; }
      const btn = e.target.closest('button[data-tab]');
      if(!btn) return;
      currentTab = btn.dataset.tab;
      fecharMais();
      render();
    });
  }
```

- [ ] **Step 4: Add temporary Dashboard/Config stubs (replaced by Tasks 2 and 6)**

Add right before the `/* === RENDER === */` marker (after the `copiarTextoFallback` function):
```js
  /* === DASHBOARD (redesign, Tarefa 2) === */
  function renderDashboard(){ return '<div class="card"><h2>Dashboard</h2><p class="muted">Em construção.</p></div>'; }
  function attachDashboardHandlers(){}

  /* === CONFIG (redesign, Tarefa 6) === */
  function renderConfig(){ return '<div class="card"><h2>Configurações</h2><p class="muted">Em construção.</p></div>'; }
  function attachConfigHandlers(){}
```

- [ ] **Step 5: Update `renderScreen()`, `render()`, and the INIT event-listener wiring**

Replace:
```js
  function renderScreen(){
    const app = document.getElementById('app');
    const openIdx = [...app.querySelectorAll('details')].reduce((acc,d,i)=>{ if(d.open) acc.push(i); return acc; }, []);
    const fieldValues = {};
    app.querySelectorAll('details input, details select, details textarea').forEach(el => { if(el.id) fieldValues[el.id] = el.value; });

    const map = {hoje:renderHoje, erros:renderErros, mapa:renderMapa, semana:renderSemana, desempenho:renderDesempenho};
    app.innerHTML = map[currentTab]();
    if(currentTab==='hoje') attachHojeHandlers();
    if(currentTab==='erros') attachErrosHandlers();
    if(currentTab==='mapa') attachMapaHandlers();
    if(currentTab==='semana') attachSemanaHandlers();

    app.querySelectorAll('details').forEach((d,i) => { if(openIdx.includes(i)) d.open = true; });
    Object.entries(fieldValues).forEach(([id,val]) => { const el = document.getElementById(id); if(el) el.value = val; });
  }

  function render(){ renderTabsNav(); renderScreen(); }

  document.getElementById('tabs').addEventListener('click', (e)=>{
    const btn = e.target.closest('button[data-tab]');
    if(!btn) return;
    currentTab = btn.dataset.tab;
    render();
  });
```
with:
```js
  function renderScreen(){
    const app = document.getElementById('app');
    const openIdx = [...app.querySelectorAll('details')].reduce((acc,d,i)=>{ if(d.open) acc.push(i); return acc; }, []);
    const fieldValues = {};
    app.querySelectorAll('details input, details select, details textarea').forEach(el => { if(el.id) fieldValues[el.id] = el.value; });

    const map = {hoje:renderHoje, erros:renderErros, mapa:renderMapa, semana:renderSemana, desempenho:renderDesempenho, dashboard:renderDashboard, config:renderConfig};
    app.innerHTML = map[currentTab]();
    if(currentTab==='hoje') attachHojeHandlers();
    if(currentTab==='erros') attachErrosHandlers();
    if(currentTab==='mapa') attachMapaHandlers();
    if(currentTab==='semana') attachSemanaHandlers();
    if(currentTab==='dashboard') attachDashboardHandlers();
    if(currentTab==='config') attachConfigHandlers();

    app.querySelectorAll('details').forEach((d,i) => { if(openIdx.includes(i)) d.open = true; });
    Object.entries(fieldValues).forEach(([id,val]) => { const el = document.getElementById(id); if(el) el.value = val; });
  }

  function render(){ renderSidebar(); renderTabsNav(); renderScreen(); }

  attachSidebarHandlers();
  attachTabsHandlers();
```

Note: `map.semana` still points at the old `renderSemana`/`attachSemanaHandlers` — the nav id is `planejamento`
now (from `NAV_ITEMS`), but there is intentionally no `planejamento` key in `map` yet and no
`currentTab==='planejamento'` branch yet. That's Task 4's job (it renames `renderSemana`→`renderPlanejamento`
and swaps the map key). Until Task 4 runs, navigating to "Planejamento" in the sidebar/mobile nav will show a
blank screen (`map[currentTab]` is `undefined` → `app.innerHTML = undefined()` throws) — **this is expected
and acceptable between tasks**, matching the plan's task order (Task 4 runs before this is user-facing). If
you want Task 1 to be independently demoable, you may optionally add a temporary `planejamento:renderSemana`
entry and `if(currentTab==='planejamento') attachSemanaHandlers();` line here, to be overwritten by Task 4 —
either is fine, Task 4's diff handles both starting states.

- [ ] **Step 6: Update `manifest.json` colors to match the new `--bg`**

Change both `"background_color": "#0f1115"` and `"theme_color": "#0f1115"` to `"#0b0d11"`, and update the
`<meta name="theme-color" content="#0f1115">` tag in `index.html`'s `<head>` to `content="#0b0d11"`.

- [ ] **Step 7: Static verification (no browser available — verify by reading, not running)**

Confirm: `node -e "new Function(require('fs').readFileSync('index.html','utf8').match(/<script>([\s\S]*)<\/script>/)[1])"`
prints no syntax error. Read through the new `renderScreen()`/`render()`/`attachTabsHandlers()`/
`attachSidebarHandlers()` code and confirm every `document.getElementById(...)` id referenced matches an id
that exists in the Step 2 markup (`sidebar`, `sidebar-nav`, `sidebar-toggle`, `tabs`, `mais-sheet`, `app`).

- [ ] **Step 8: Commit**

```bash
git add index.html manifest.json
git commit -m "feat(redesign): design tokens, sidebar/topbar shell, responsive nav restructure"
```

Note for the user: after this task, open `index.html` locally and confirm the sidebar appears on a wide
window and the bottom nav (Hoje/Planejamento/Desempenho/Mais) appears on a narrow one — Dashboard/Config will
show placeholder text and Planejamento may be blank until later tasks land.

---

## Task 2: Dashboard screen, Chart.js integration, service-worker cache-busting fix

**Files:**
- Modify: `index.html` (new pure functions in a new `/* === DASHBOARD (redesign) === */` section replacing
  Task 1's stubs; `<head>`/pre-script Chart.js `<script>` tag; SW registration block)
- Modify: `sw.js` (full rewrite of caching strategy)
- Test: scratch Node script in the scratchpad directory (not committed)

**Interfaces:**
- Consumes: `hojeISO`, `addDays`, `segundaFeiraDaSemana`, `semanaAtualId`, `state`, `filaRevisao`, `cardErro`,
  `registrarCheckin`, `checkinDeHoje`, `saveState`, `render` (all existing, unchanged).
- Produces: `calcularSequencia(checkins, hojeIso)`, `pctCronograma(conteudo)`, `horasNoDia(checkins, dataIso)`,
  `horasPorDiaDaSemana(checkins, semanaId)`, `melhores5(agregado)`, `evolucaoSemanal(checkins, hojeIso, numSemanas)`,
  `criarOuAtualizarChart(canvasId, chartJsConfig)`, `renderDashboard()`, `attachDashboardHandlers()` (replacing
  Task 1's stubs — same names, so `renderScreen()`'s map needs no further edit for these two). `melhores5` and
  `evolucaoSemanal` are also consumed by Task 5.

- [ ] **Step 1: Write the failing tests for the new pure functions**

Create `<scratchpad>/dashboard-fns.test.mjs`:
```js
import assert from 'node:assert';

function addDays(iso, n){
  const d = new Date(iso + 'T00:00:00');
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0,10);
}
function segundaFeiraDaSemana(iso){
  const d = new Date(iso + 'T00:00:00');
  const diaSemana = d.getDay();
  const offset = diaSemana === 0 ? -6 : 1 - diaSemana;
  d.setDate(d.getDate() + offset);
  return d.toISOString().slice(0,10);
}

function calcularSequencia(checkins, hojeIso){
  const estudados = new Set(checkins.filter(c => c.status !== 'nao').map(c => c.data));
  let dia = hojeIso;
  if(!estudados.has(dia)) dia = addDays(dia, -1);
  let sequencia = 0;
  while(estudados.has(dia)){ sequencia++; dia = addDays(dia, -1); }
  return sequencia;
}
function pctCronograma(conteudo){
  if(!conteudo.length) return 0;
  const tocados = conteudo.filter(c => c.status !== 'nao_iniciado').length;
  return Math.round((tocados / conteudo.length) * 100);
}
function horasNoDia(checkins, dataIso){
  const c = checkins.find(x => x.data === dataIso);
  if(!c) return 0;
  const minutos = c.minutos ?? (c.status === 'base' ? 150 : 0);
  return Math.round((minutos/60)*10)/10;
}
function horasPorDiaDaSemana(checkins, semanaId){
  const dias = [];
  for(let i=0;i<7;i++) dias.push(horasNoDia(checkins, addDays(semanaId, i)));
  return dias;
}
function melhores5(agregado){
  return [...agregado].filter(a => a.questoes > 0).sort((a,b) => b.pct - a.pct).slice(0,5);
}
function evolucaoSemanal(checkins, hojeIso, numSemanas){
  const semanaFim = segundaFeiraDaSemana(hojeIso);
  const buckets = [];
  for(let i = numSemanas - 1; i >= 0; i--){
    const semanaId = addDays(semanaFim, -7*i);
    const fimSemana = addDays(semanaId, 6);
    const doSemana = checkins.filter(c => c.data >= semanaId && c.data <= fimSemana && c.questoes);
    const questoes = doSemana.reduce((s,c) => s + c.questoes, 0);
    const acertos = doSemana.reduce((s,c) => s + (c.acertos||0), 0);
    buckets.push({ semanaId, pct: questoes ? Math.round((acertos/questoes)*100) : null });
  }
  return buckets;
}

// calcularSequencia
assert.strictEqual(calcularSequencia([
  {data:'2026-08-13',status:'base'},{data:'2026-08-14',status:'minimo'},{data:'2026-08-15',status:'base'}
], '2026-08-15'), 3, 'sequencia terminando hoje');
assert.strictEqual(calcularSequencia([
  {data:'2026-08-13',status:'base'},{data:'2026-08-14',status:'minimo'}
], '2026-08-15'), 2, 'sequencia terminando ontem (hoje ainda sem checkin)');
assert.strictEqual(calcularSequencia([
  {data:'2026-08-13',status:'base'},{data:'2026-08-15',status:'base'}
], '2026-08-15'), 1, 'gap no meio quebra a sequencia');
assert.strictEqual(calcularSequencia([
  {data:'2026-08-14',status:'nao'},{data:'2026-08-15',status:'base'}
], '2026-08-15'), 1, 'status nao nao conta como estudado');

// pctCronograma
assert.strictEqual(pctCronograma([
  {status:'nao_iniciado'},{status:'nao_iniciado'},{status:'estudado'},{status:'dominado'}
]), 50);
assert.strictEqual(pctCronograma([]), 0);

// horasNoDia
assert.strictEqual(horasNoDia([{data:'2026-08-15',status:'base',minutos:null}], '2026-08-15'), 2.5);
assert.strictEqual(horasNoDia([{data:'2026-08-15',status:'minimo',minutos:40}], '2026-08-15'), 0.7);
assert.strictEqual(horasNoDia([], '2026-08-15'), 0);

// horasPorDiaDaSemana
const semana = horasPorDiaDaSemana([
  {data:'2026-08-17',status:'base',minutos:null}, {data:'2026-08-19',status:'minimo',minutos:60}
], '2026-08-17');
assert.deepStrictEqual(semana, [2.5, 0, 1, 0, 0, 0, 0]);

// melhores5
const agregado = [{assunto:'A',pct:90,questoes:5},{assunto:'B',pct:40,questoes:3},{assunto:'C',pct:0,questoes:0}];
assert.deepStrictEqual(melhores5(agregado).map(a=>a.assunto), ['A','B']);

// evolucaoSemanal
const checkinsEvo = [
  {data:'2026-08-03',questoes:10,acertos:5},   // semana de 2026-08-03..09
  {data:'2026-08-17',questoes:10,acertos:9},   // semana de 2026-08-17..23
];
const evo = evolucaoSemanal(checkinsEvo, '2026-08-17', 3);
assert.strictEqual(evo.length, 3);
assert.strictEqual(evo[0].semanaId, '2026-08-03');
assert.strictEqual(evo[0].pct, 50);
assert.strictEqual(evo[1].pct, null, 'semana sem dados retorna null');
assert.strictEqual(evo[2].semanaId, '2026-08-17');
assert.strictEqual(evo[2].pct, 90);

console.log('All dashboard-fns assertions passed');
```

- [ ] **Step 2: Run it, confirm it passes on this reference implementation**

Run: `node <scratchpad>/dashboard-fns.test.mjs`
Expected: `All dashboard-fns assertions passed` (this validates the logic before it's transplanted into
`index.html` — there's no separate "make it fail first" step here since the functions are new, not modifying
existing passing code; the scratch script itself *is* the TDD cycle for this new logic).

- [ ] **Step 3: Add the pure functions and Dashboard render/attach to `index.html`**

Replace the Task 1 stub section:
```js
  /* === DASHBOARD (redesign, Tarefa 2) === */
  function renderDashboard(){ return '<div class="card"><h2>Dashboard</h2><p class="muted">Em construção.</p></div>'; }
  function attachDashboardHandlers(){}
```
with (same function names, real implementation — copy the 6 pure functions verbatim from the scratch test
above, then add):
```js
  /* === DASHBOARD (redesign, Tarefa 2) === */
  function calcularSequencia(checkins, hojeIso){ /* ...as in Step 1... */ }
  function pctCronograma(conteudo){ /* ...as in Step 1... */ }
  function horasNoDia(checkins, dataIso){ /* ...as in Step 1... */ }
  function horasPorDiaDaSemana(checkins, semanaId){ /* ...as in Step 1... */ }
  function melhores5(agregado){ /* ...as in Step 1... */ }
  function evolucaoSemanal(checkins, hojeIso, numSemanas){ /* ...as in Step 1... */ }

  let chartInstances = {};
  function criarOuAtualizarChart(canvasId, config){
    const canvas = document.getElementById(canvasId);
    if(!canvas) return;
    if(chartInstances[canvasId]) chartInstances[canvasId].destroy();
    chartInstances[canvasId] = new Chart(canvas, config);
  }
  function corAccent(){
    return getComputedStyle(document.documentElement).getPropertyValue('--accent').trim();
  }

  function renderDashboard(){
    const hojeIso = hojeISO();
    const semanaId = semanaAtualId();
    const dias = diasAte(hojeIso, state.meta.provaData);
    const agregado = agregarPorAssunto(state.checkins);
    const piores = piores5(agregado);
    const fila = filaRevisao(state.erros, hojeIso);
    const ci = checkinDeHoje();
    const statusAtivo = ci ? ci.status : null;
    return `
      <div class="card"><h2>${dias} dias até a prova</h2></div>
      <div class="kpi-grid">
        <div class="card stat-card"><div class="stat-label">Horas hoje</div><div class="stat-value">${horasNoDia(state.checkins, hojeIso)}h</div><div class="stat-icon">⏱️</div></div>
        <div class="card stat-card"><div class="stat-label">Horas na semana</div><div class="stat-value">${horasRealizadasNaSemana(state.checkins, semanaId)}h</div><div class="stat-icon">🗓️</div></div>
        <div class="card stat-card"><div class="stat-label">Questões feitas</div><div class="stat-value">${agregado.reduce((s,a)=>s+a.questoes,0)}</div><div class="stat-icon">❓</div></div>
        <div class="card stat-card"><div class="stat-label">% de acerto</div><div class="stat-value">${agregado.length ? Math.round(agregado.reduce((s,a)=>s+a.acertos,0)/Math.max(1,agregado.reduce((s,a)=>s+a.questoes,0))*100) : 0}%</div><div class="stat-icon">✅</div></div>
        <div class="card stat-card"><div class="stat-label">Revisões pendentes</div><div class="stat-value">${fila.length}</div><div class="stat-icon">🔁</div></div>
        <div class="card stat-card"><div class="stat-label">Dias em sequência</div><div class="stat-value">${calcularSequencia(state.checkins, hojeIso)}</div><div class="stat-icon">🔥</div></div>
        <div class="card stat-card"><div class="stat-label">% do cronograma</div><div class="stat-value">${pctCronograma(state.conteudo)}%</div><div class="stat-icon">📘</div></div>
      </div>
      <div class="grid-2">
        <div class="card">
          <h3>Horas por dia da semana</h3>
          <canvas id="chart-horas-semana" height="220"></canvas>
        </div>
        <div class="card">
          <h3>Desempenho por disciplina</h3>
          ${agregado.length ? `<table class="data"><thead><tr><th>Assunto</th><th>%</th></tr></thead><tbody>
            ${agregado.map(a => `<tr><td>${escapeHtml(a.assunto)}<div class="progress"><i style="width:${a.pct}%"></i></div></td><td>${a.pct}%</td></tr>`).join('')}
          </tbody></table>` : '<p class="muted">Sem questões registradas ainda.</p>'}
        </div>
        <div class="card">
          <h3>Assuntos com pior desempenho</h3>
          ${piores.length ? piores.map(p=>`<p>${escapeHtml(p.assunto)} — ${p.pct}%</p>`).join('') : '<p class="muted">Sem dados suficientes.</p>'}
        </div>
        <div class="card">
          <h3>O que estudar hoje</h3>
          ${fila.map(cardErro).join('') || '<p class="muted">Nada atrasado — bom sinal.</p>'}
        </div>
        <div class="card">
          <h3>Como foi hoje?</h3>
          <button data-checkin="base" class="${statusAtivo==='base'?'primary':''}">Base 2h30 ${statusAtivo==='base'?'✓':''}</button>
          <button data-checkin="minimo" class="${statusAtivo==='minimo'?'primary':''}">Mínimo ${statusAtivo==='minimo'?'✓':''}</button>
          <button data-checkin="nao" class="${statusAtivo==='nao'?'primary':''}">Não estudei ${statusAtivo==='nao'?'✓':''}</button>
        </div>
      </div>
    `;
  }

  function attachDashboardHandlers(){
    const app = document.getElementById('app');
    app.querySelectorAll('button[data-checkin]').forEach(btn => {
      btn.addEventListener('click', () => {
        registrarCheckin(state, hojeISO(), btn.dataset.checkin);
        saveState(state);
        render();
      });
    });
    app.querySelectorAll('button[data-acertei]').forEach(btn => {
      btn.addEventListener('click', () => {
        const e = state.erros.find(x => x.id === btn.dataset.acertei);
        graduarAcerto(e); saveState(state); render();
      });
    });
    app.querySelectorAll('button[data-errei]').forEach(btn => {
      btn.addEventListener('click', () => {
        const e = state.erros.find(x => x.id === btn.dataset.errei);
        graduarErro(e); saveState(state); render();
      });
    });
    criarOuAtualizarChart('chart-horas-semana', {
      type: 'bar',
      data: {
        labels: ['Seg','Ter','Qua','Qui','Sex','Sáb','Dom'],
        datasets: [{ data: horasPorDiaDaSemana(state.checkins, semanaAtualId()), backgroundColor: corAccent() }]
      },
      options: {
        responsive:true, plugins:{ legend:{ display:false } },
        scales:{
          x:{ grid:{ display:false }, ticks:{ color:'#9aa0a6' } },
          y:{ beginAtZero:true, grid:{ color:'#2a2f3a' }, ticks:{ color:'#9aa0a6' } }
        }
      }
    });
  }
```

Note: the `data-acertei`/`data-errei` handler block is duplicated a third time here (already duplicated between
Hoje and Erros pre-redesign) — accepted as-is to match the existing codebase pattern; not in scope to
deduplicate this round.

- [ ] **Step 4: Add the Chart.js `<script>` tag**

In `index.html`, immediately before the existing inline `<script>` tag (after `<div id="mais-sheet" class="hidden"></div>`), add:
```html
  <script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.4/dist/chart.umd.min.js"></script>
```
so it loads and executes before the inline script runs (plain `<script>` tags block and execute in document
order — no `async`/`defer` needed here).

- [ ] **Step 5: Rewrite `sw.js` — network-first for navigation, versioned + self-healing cache**

Replace the entire contents of `sw.js` with:
```js
// Bump CACHE_VERSION when precached files change, as an extra safety net —
// navigation requests below are network-first, so this mainly protects
// icons/manifest/Chart.js from going stale.
const CACHE_VERSION = 'v2';
const CACHE = 'estudos-' + CACHE_VERSION;
const ARQUIVOS = [
  './', './index.html', './manifest.json',
  './icons/icon-192.png', './icons/icon-512.png',
  'https://cdn.jsdelivr.net/npm/chart.js@4.4.4/dist/chart.umd.min.js',
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then(c => c.addAll(ARQUIVOS)));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(nomes => Promise.all(nomes.filter(n => n !== CACHE).map(n => caches.delete(n))))
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  if(event.request.method !== 'GET') return;

  const isNavegacao = event.request.mode === 'navigate' || event.request.destination === 'document';
  if(isNavegacao){
    event.respondWith(
      fetch(event.request)
        .then(resp => {
          caches.open(CACHE).then(c => c.put(event.request, resp.clone()));
          return resp;
        })
        .catch(() => caches.match(event.request).then(cached => cached || caches.match('./index.html')))
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then(cached => cached || fetch(event.request).then(resp => {
      if(resp.ok){ caches.open(CACHE).then(c => c.put(event.request, resp.clone())); }
      return resp;
    }))
  );
});
```

This is the actual fix for "phone kept serving the old version after deploy": the previous handler served
`index.html` cache-first unconditionally, so a stale cached copy could persist indefinitely even after a
redeploy, unless the browser happened to re-fetch `sw.js` itself (byte-different) and re-run `install()`. Now,
navigation requests (loading the app shell) always try the network first and only fall back to cache when
offline — so any redeploy is picked up the next time the phone has connectivity, without depending on the SW's
own update cycle. Static assets (icons, manifest, Chart.js) stay cache-first for speed, but a cache-miss now
also stores the fetched response (previously it didn't, so anything not in the original precache list was
re-fetched from network every time).

- [ ] **Step 6: Ask the browser to check for a new service worker on every load**

Replace:
```js
  if('serviceWorker' in navigator){
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('./sw.js').catch(err => console.warn('SW falhou:', err));
    });
  }
```
with:
```js
  if('serviceWorker' in navigator){
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('./sw.js')
        .then(reg => reg.update())
        .catch(err => console.warn('SW falhou:', err));
    });
  }
```

- [ ] **Step 7: Static verification**

Run the same `new Function(...)` syntax check as Task 1, Step 7, against the updated `index.html`. Read
`sw.js` and confirm `ARQUIVOS` lists exactly the 5 local paths plus the one Chart.js CDN URL, and that the
`fetch` handler has the `method !== 'GET'` guard, the navigation branch, and the cache-miss `put()` for the
static branch.

- [ ] **Step 8: Commit**

```bash
git add index.html sw.js
git commit -m "feat(redesign): dashboard screen, Chart.js integration, service-worker cache-busting fix"
```

Note for the user: after deploying this task, do one hard-refresh (or clear site data) on the phone to get
past the *old* service worker one last time — every deploy after this one should pick up automatically because
of the network-first navigation strategy.

---

## Task 3: Hoje screen cleanup

**Files:**
- Modify: `index.html` (`renderHoje()`, `attachHojeHandlers()`)

**Interfaces:**
- Consumes: nothing new.
- Produces: same `renderHoje()`/`attachHojeHandlers()` names, backup-related markup and handlers removed
  (their handler logic is re-added verbatim in Task 6's `renderConfig()`/`attachConfigHandlers()` — Task 3
  does not need to preserve it anywhere, just delete it here).

- [ ] **Step 1: Remove the backup card from `renderHoje()`**

Delete this block from `renderHoje()`'s returned template (currently the second `<div class="card">` in the
function, right after the "dias até a prova" card):
```html
      <div class="card">
        <button id="btn-export-md">Exportar Markdown</button>
        <button id="btn-export-json">Exportar JSON (arquivo)</button>
        <button id="btn-copy-json">Copiar JSON (área de transferência)</button>
        <label>Importar JSON (arquivo)</label>
        <input type="file" id="input-import-json" accept="application/json">
        <label>ou colar JSON aqui</label>
        <textarea id="input-import-paste" placeholder="Cole aqui o JSON exportado"></textarea>
        <button id="btn-import-paste">Importar JSON colado</button>
      </div>
```
Also update the small-print line right above it — change:
```html
        <small class="muted">Dados salvos só neste aparelho — use Exportar/Importar JSON pra levar pro celular ou fazer backup.</small>
```
to:
```html
        <small class="muted">Dados salvos só neste aparelho — veja Configurações → Dados e Backup pra levar pro celular ou fazer backup.</small>
```

- [ ] **Step 2: Remove the now-dead handler wiring from `attachHojeHandlers()`**

Delete these lines from `attachHojeHandlers()` (the backup-button wiring, currently right after the
`data-errei` loop and before the function's closing brace):
```js
    document.getElementById('btn-export-md')?.addEventListener('click', exportarMarkdown);
    document.getElementById('btn-export-json')?.addEventListener('click', exportarJSON);
    document.getElementById('btn-copy-json')?.addEventListener('click', () => {
      copiarTexto(JSON.stringify(state, null, 2));
    });
    document.getElementById('input-import-json')?.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if(!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        if(!tentarImportar(reader.result)) e.target.value = '';
      };
      reader.readAsText(file);
    });
    const btnImportPaste = document.getElementById('btn-import-paste');
    if(btnImportPaste){
      btnImportPaste.addEventListener('click', () => {
        const textarea = document.getElementById('input-import-paste');
        const texto = textarea.value.trim();
        if(!texto) return;
        if(tentarImportar(texto)) textarea.value = '';
      });
    }
```
`exportarMarkdown`, `exportarJSON`, `copiarTexto`, `tentarImportar` stay defined in the file (Task 6 wires them
up again from `renderConfig()`/`attachConfigHandlers()`) — do not delete those function definitions.

- [ ] **Step 3: Restyle the remaining Hoje card with the new tokens**

Wrap the three checkin status buttons in a `.row` if not already, and change the checkin card's heading from
`<h3>` to keep consistent with other screens' new card headers (no structural change needed beyond what Task 1's
global CSS already provides — the existing `.card`/`button.primary` classes already pick up the new tokens
automatically since they reference the same CSS variable names). Read the rendered card mentally against the
new `--card`/`--border` contrast and confirm nothing needs a hardcoded color removed (search `renderHoje` for
any literal hex color — there should be none pre-existing).

- [ ] **Step 4: Static verification**

Run the `new Function(...)` syntax check. Grep `index.html` for `btn-export-md` and confirm it now appears
only inside `renderConfig`-related code once Task 6 lands — for this task alone, confirm it appears zero
times (since Task 6 hasn't run yet).

- [ ] **Step 5: Commit**

```bash
git add index.html
git commit -m "feat(redesign): remove backup UI from Hoje screen (moves to Configuracoes in a later task)"
```

---

## Task 4: Planejamento (renamed from Semana) with realized-per-day week grid

**Files:**
- Modify: `index.html` (`renderSemana`→`renderPlanejamento`, `attachSemanaHandlers`→`attachPlanejamentoHandlers`,
  `renderScreen()`'s map/if-chain, new `.week-grid` CSS)

**Interfaces:**
- Consumes: `semanaAtualId`, `obterPlano`, `addDays`, `diasRealizadosNaSemana`, `horasRealizadasNaSemana`,
  `assuntosTocadosNaSemana`, `assuntosAtrasadosNaSemana`, `salvarPlano`, `escapeHtml` (all existing, unchanged
  signatures).
- Produces: `renderPlanejamento()`, `attachPlanejamentoHandlers()` (renamed from `renderSemana`/
  `attachSemanaHandlers` — same bodies plus the week grid addition). `renderScreen()`'s `map` object gets a
  `planejamento: renderPlanejamento` entry (replacing whatever `Task 1` left, whether that was absent or a
  temporary `renderSemana` placeholder) and the if-chain gets
  `if(currentTab==='planejamento') attachPlanejamentoHandlers();` (replacing any `'semana'`-keyed line).

- [ ] **Step 1: Rename the function and add the week grid**

Rename `function renderSemana(){` to `function renderPlanejamento(){`. Inside it, right after computing
`semanaId`/`plano`/`fimSemana` (top of the function, unchanged), add:
```js
    const DIAS_LABEL = ['SEG','TER','QUA','QUI','SEX','SÁB','DOM'];
    const grade = DIAS_LABEL.map((label, i) => {
      const dataIso = addDays(semanaId, i);
      const c = state.checkins.find(x => x.data === dataIso);
      const feito = c && c.status !== 'nao';
      return { label, dataIso, feito, assunto: c?.assunto || null };
    });
    const gradeHtml = `
      <div class="card">
        <h3>Semana</h3>
        <div class="week-grid">
          ${grade.map(d => `
            <div class="week-day ${d.feito?'feito':''}">
              <div class="week-day-label">${d.label}</div>
              <div class="week-day-date">${d.dataIso.slice(8,10)}</div>
              <div class="week-day-badge ${d.feito?'ok':''}">${d.feito ? `✓${d.assunto?` ${escapeHtml(d.assunto.slice(0,14))}`:''}` : '—'}</div>
            </div>`).join('')}
        </div>
      </div>`;
```
Then insert `gradeHtml` into both of the function's two return paths (the "no plano yet" early return, and the
main return at the end) — right after the first `<div class="card">...dias até a prova...</div>`-equivalent
header card, before the rest of each branch's markup. Example for the early-return branch:
```js
    if(!plano){
      return `
        <div class="card">
          <h2>Semana de ${semanaId} a ${fimSemana}</h2>
          <p class="muted">Nenhuma meta definida ainda.</p>
        </div>
        ${gradeHtml}
        <div class="card">
          <h3>Definir meta da semana</h3>
          ...unchanged...
        </div>
      `;
    }
```
And for the main return, insert `${gradeHtml}` right after the first `<div class="card">...</div>` (the one
with "Semana de ... a ..." + "Dias:"/"Horas:" lines), before the "Assuntos-alvo" card. Also add a progress
bar to that first card — change:
```html
      <div class="card">
        <h2>Semana de ${semanaId} a ${fimSemana}</h2>
        <p>Dias: ${diasFeitos}/${plano.diasAlvo}</p>
        <p>Horas: ${horasFeitas}h/${plano.horasAlvo}h</p>
      </div>
```
to:
```html
      <div class="card">
        <h2>Semana de ${semanaId} a ${fimSemana}</h2>
        <p>Dias: ${diasFeitos}/${plano.diasAlvo}</p>
        <div class="progress"><i style="width:${Math.min(100, plano.diasAlvo ? Math.round(diasFeitos/plano.diasAlvo*100) : 0)}%"></i></div>
        <p>Horas: ${horasFeitas}h/${plano.horasAlvo}h</p>
        <div class="progress"><i style="width:${Math.min(100, plano.horasAlvo ? Math.round(horasFeitas/plano.horasAlvo*100) : 0)}%"></i></div>
      </div>
```

- [ ] **Step 2: Rename the handler function**

Rename `function attachSemanaHandlers(){` to `function attachPlanejamentoHandlers(){` — body unchanged.

- [ ] **Step 3: Add `.week-grid` CSS**

Append to the `<style>` block:
```css
.week-grid{display:grid;grid-template-columns:repeat(7,1fr);gap:8px;}
.week-day{background:var(--bg);border:1px solid var(--border);border-radius:var(--radius-sm);
  padding:8px 4px;text-align:center;}
.week-day.feito{border-color:var(--ok);}
.week-day-label{font-size:var(--text-xs);color:var(--muted);}
.week-day-date{font-weight:650;font-size:var(--text-sm);margin:2px 0;}
.week-day-badge{font-size:10px;color:var(--muted);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
.week-day-badge.ok{color:var(--ok);}
@media(max-width:480px){.week-grid{gap:4px;} .week-day{padding:6px 2px;}}
```

- [ ] **Step 4: Update `renderScreen()`'s map and if-chain**

Open the current `renderScreen()` and: (a) if the `map` object has a `semana:renderSemana` entry, change it to
`planejamento:renderPlanejamento`; if it instead has no `semana`/`planejamento` key at all (Task 1's minimal
path), add `planejamento:renderPlanejamento`. (b) same for the if-chain: replace
`if(currentTab==='semana') attachSemanaHandlers();` (or add, if absent) with
`if(currentTab==='planejamento') attachPlanejamentoHandlers();`. Leave every other entry in `map` and the
if-chain untouched — this is an additive edit per the Global Constraints watch item.

- [ ] **Step 5: Static verification**

Run the `new Function(...)` syntax check. Grep for `renderSemana` and `attachSemanaHandlers` in `index.html`
and confirm zero remaining references (both fully renamed). Confirm `NAV_ITEMS` (from Task 1) already uses id
`planejamento` — no change needed there.

- [ ] **Step 6: Commit**

```bash
git add index.html
git commit -m "feat(redesign): rename Semana to Planejamento, add realized-per-day week grid"
```

---

## Task 5: Desempenho enhancement — melhores assuntos, evolução no tempo, totals, Chart.js bar

**Files:**
- Modify: `index.html` (`renderDesempenho()`, new `attachDesempenhoHandlers()`, remove now-dead `barrasSVG`,
  new totals functions, `renderScreen()`'s map/if-chain)
- Test: scratch Node script in the scratchpad directory (not committed)

**Interfaces:**
- Consumes: `agregarPorAssunto`, `diasEstudados`, `diasDeCiclo`, `piores5`, `melhores5`, `evolucaoSemanal`,
  `criarOuAtualizarChart`, `corAccent` (all from Task 2 or earlier, unchanged signatures).
- Produces: `totalQuestoes(checkins)`, `totalHorasEstudadas(checkins)`, `attachDesempenhoHandlers()` (new —
  `renderScreen()`'s if-chain gets a new `if(currentTab==='desempenho') attachDesempenhoHandlers();` line,
  since Desempenho previously had no interactive/chart elements needing post-render setup).

- [ ] **Step 1: Write and run the failing tests for the two new totals functions**

Create `<scratchpad>/desempenho-fns.test.mjs`:
```js
import assert from 'node:assert';

function totalQuestoes(checkins){ return checkins.reduce((s,c) => s + (c.questoes||0), 0); }
function totalHorasEstudadas(checkins){
  const minutos = checkins.reduce((s,c) => s + (c.minutos ?? (c.status === 'base' ? 150 : 0)), 0);
  return Math.round((minutos/60)*10)/10;
}

assert.strictEqual(totalQuestoes([{questoes:10},{questoes:5},{questoes:null}]), 15);
assert.strictEqual(totalQuestoes([]), 0);
assert.strictEqual(totalHorasEstudadas([{status:'base',minutos:null},{status:'minimo',minutos:30}]), 3, '150+30=180min=3h');
assert.strictEqual(totalHorasEstudadas([{status:'minimo',minutos:null}]), 0, 'minimo sem minutos nao tem default');

console.log('All desempenho-fns assertions passed');
```
Run: `node <scratchpad>/desempenho-fns.test.mjs` — expect `All desempenho-fns assertions passed`.

- [ ] **Step 2: Add the two functions to `index.html`, replace `renderDesempenho()`, add `attachDesempenhoHandlers()`**

In the `/* === DESEMPENHO (Tarefa 8) === */` section, add after `piores5`:
```js
  function totalQuestoes(checkins){ return checkins.reduce((s,c) => s + (c.questoes||0), 0); }
  function totalHorasEstudadas(checkins){
    const minutos = checkins.reduce((s,c) => s + (c.minutos ?? (c.status === 'base' ? 150 : 0)), 0);
    return Math.round((minutos/60)*10)/10;
  }
```

Delete the now-dead `barrasSVG(dados)` function entirely (its only caller is replaced in this task).

Replace `renderDesempenho()`:
```js
  function renderDesempenho(){
    const agregado = agregarPorAssunto(state.checkins);
    const estudados = diasEstudados(state.checkins);
    const ciclo = diasDeCiclo(state.meta.cicloInicio, hojeISO());
    const piores = piores5(agregado);
    const melhores = melhores5(agregado);
    return `
      <div class="card">
        <h2>Desempenho</h2>
        <p>${estudados} de ${ciclo} dias do ciclo estudados</p>
      </div>
      <div class="kpi-grid">
        <div class="card stat-card"><div class="stat-label">Total de questões</div><div class="stat-value">${totalQuestoes(state.checkins)}</div><div class="stat-icon">❓</div></div>
        <div class="card stat-card"><div class="stat-label">Horas estudadas</div><div class="stat-value">${totalHorasEstudadas(state.checkins)}h</div><div class="stat-icon">⏱️</div></div>
      </div>
      <div class="grid-2">
        <div class="card">
          <h3>% de acerto por disciplina</h3>
          ${agregado.length ? `<canvas id="chart-por-assunto" height="${Math.max(120, agregado.length*32)}"></canvas>` : '<p class="muted">Sem questões registradas ainda.</p>'}
        </div>
        <div class="card">
          <h3>Evolução do desempenho</h3>
          <canvas id="chart-evolucao" height="200"></canvas>
        </div>
        <div class="card">
          <h3>Melhores assuntos</h3>
          ${melhores.length ? melhores.map(p=>`<p>${escapeHtml(p.assunto)} — ${p.pct}%</p>`).join('') : '<p class="muted">Sem dados suficientes.</p>'}
        </div>
        <div class="card">
          <h3>Piores assuntos</h3>
          ${piores.length ? piores.map(p=>`<p>${escapeHtml(p.assunto)} — ${p.pct}%</p>`).join('') : '<p class="muted">Sem dados suficientes.</p>'}
        </div>
      </div>
    `;
  }

  function attachDesempenhoHandlers(){
    const agregado = agregarPorAssunto(state.checkins);
    if(agregado.length){
      criarOuAtualizarChart('chart-por-assunto', {
        type: 'bar',
        data: { labels: agregado.map(a=>a.assunto), datasets:[{ data: agregado.map(a=>a.pct), backgroundColor: corAccent() }] },
        options: {
          indexAxis:'y', responsive:true, plugins:{legend:{display:false}},
          scales:{
            x:{min:0,max:100, ticks:{color:'#9aa0a6'}, grid:{color:'#2a2f3a'}},
            y:{ticks:{color:'#9aa0a6'}, grid:{display:false}}
          }
        }
      });
    }
    const evolucao = evolucaoSemanal(state.checkins, hojeISO(), 12);
    criarOuAtualizarChart('chart-evolucao', {
      type: 'line',
      data: {
        labels: evolucao.map(b => b.semanaId.slice(5)),
        datasets: [{ data: evolucao.map(b => b.pct), spanGaps:false, borderColor: corAccent(), backgroundColor:'transparent', tension:.3 }]
      },
      options: {
        responsive:true, plugins:{legend:{display:false}},
        scales:{
          y:{min:0,max:100, ticks:{color:'#9aa0a6'}, grid:{color:'#2a2f3a'}},
          x:{ticks:{color:'#9aa0a6'}, grid:{display:false}}
        }
      }
    });
  }
```

- [ ] **Step 3: Update `renderScreen()`'s if-chain**

Add `if(currentTab==='desempenho') attachDesempenhoHandlers();` alongside the existing lines (additive edit —
`map.desempenho:renderDesempenho` already exists from the original MVP, no change needed there).

- [ ] **Step 4: Static verification**

Run the `new Function(...)` syntax check. Grep for `barrasSVG` and confirm zero remaining references (function
deleted, no callers left). Confirm `melhores5`/`evolucaoSemanal`/`criarOuAtualizarChart`/`corAccent` (from Task
2) are defined earlier in the file than this task's usage of them (script order matters for `function`
declarations only if called before definition in the same synchronous top-level run — since these are all
hoisted `function` declarations, not `const arrow`, actual order doesn't matter for correctness, but keep the
new code inside the existing `/* === DESEMPENHO === */` section for readability).

- [ ] **Step 5: Commit**

```bash
git add index.html
git commit -m "feat(redesign): desempenho screen adds melhores assuntos, evolucao no tempo, totals, Chart.js"
```

---

## Task 6: Mapa/Erros restyle, Configurações screen, final integration pass

**Files:**
- Modify: `index.html` (`renderMapa()`, `renderErros()` restyle; `renderConfig()`/`attachConfigHandlers()`
  replacing Task 1's stubs; final `renderScreen()` map/if-chain check)

**Interfaces:**
- Consumes: `exportarMarkdown`, `exportarJSON`, `copiarTexto`, `tentarImportar` (all existing, unchanged —
  still defined in the `/* === EXPORT (Tarefa 9) === */` section, untouched by Task 3's deletion of their
  *call sites* in Hoje).
- Produces: `renderConfig()`, `attachConfigHandlers()` (replacing Task 1's stubs — same names, so no further
  `renderScreen()` edit needed for these two, they were already wired in Task 1 Step 5).

- [ ] **Step 1: Wrap Mapa's cards in the responsive grid**

In `renderMapa()`, change:
```js
  function renderMapa(){
    return `<div class="card"><h2>Mapa de Conteúdo</h2><small class="muted">Toque no status pra avançar; toque no concurso pra trocar.</small></div>` +
      state.conteudo.map((c, i) => `
        <div class="card">
          <b>${escapeHtml(c.assunto)}</b><br>
          <button data-status-idx="${i}" class="badge">${STATUS_CONTEUDO_LABEL[c.status]}</button>
          <button data-concurso-idx="${i}" class="badge">${CONCURSO_LABEL[c.concurso]}</button>
        </div>`).join('');
  }
```
to:
```js
  function renderMapa(){
    return `<div class="card"><h2>Mapa de Conteúdo</h2><small class="muted">Toque no status pra avançar; toque no concurso pra trocar.</small></div>` +
      `<div class="card-grid">` +
      state.conteudo.map((c, i) => `
        <div class="card">
          <b>${escapeHtml(c.assunto)}</b><br>
          <button data-status-idx="${i}" class="badge">${STATUS_CONTEUDO_LABEL[c.status]}</button>
          <button data-concurso-idx="${i}" class="badge">${CONCURSO_LABEL[c.concurso]}</button>
        </div>`).join('') +
      `</div>`;
  }
```
`attachMapaHandlers()` needs no change — it already uses `app.querySelectorAll('button[data-status-idx]')` /
`[data-concurso-idx]`, which still finds the buttons regardless of the new wrapping `<div class="card-grid">`.

- [ ] **Step 2: Wrap Erros' card list in the responsive grid**

In `renderErros()`, change the final line from:
```js
      ${lista.map(cardErro).join('') || '<p class="muted">Nenhum item ainda.</p>'}
```
to:
```js
      <div class="card-grid">${lista.map(cardErro).join('') || '<p class="muted">Nenhum item ainda.</p>'}</div>
```
`attachErrosHandlers()` needs no change (same reasoning as Step 1).

- [ ] **Step 3: Replace the Task 1 Configurações stub with the real screen**

Replace:
```js
  /* === CONFIG (redesign, Tarefa 6) === */
  function renderConfig(){ return '<div class="card"><h2>Configurações</h2><p class="muted">Em construção.</p></div>'; }
  function attachConfigHandlers(){}
```
with:
```js
  /* === CONFIG (redesign, Tarefa 6) === */
  function renderConfig(){
    return `
      <div class="card"><h2>Configurações</h2></div>
      <div class="card">
        <h3>Dados e Backup</h3>
        <small class="muted">Dados salvos só neste aparelho — use uma das opções abaixo pra levar pro celular ou fazer backup.</small>
        <button id="btn-export-md">Exportar Markdown</button>
        <button id="btn-export-json">Exportar JSON (arquivo)</button>
        <button id="btn-copy-json">Copiar JSON (área de transferência)</button>
        <label>Importar JSON (arquivo)</label>
        <input type="file" id="input-import-json" accept="application/json">
        <label>ou colar JSON aqui</label>
        <textarea id="input-import-paste" placeholder="Cole aqui o JSON exportado"></textarea>
        <button id="btn-import-paste">Importar JSON colado</button>
      </div>
    `;
  }

  function attachConfigHandlers(){
    document.getElementById('btn-export-md')?.addEventListener('click', exportarMarkdown);
    document.getElementById('btn-export-json')?.addEventListener('click', exportarJSON);
    document.getElementById('btn-copy-json')?.addEventListener('click', () => {
      copiarTexto(JSON.stringify(state, null, 2));
    });
    document.getElementById('input-import-json')?.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if(!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        if(!tentarImportar(reader.result)) e.target.value = '';
      };
      reader.readAsText(file);
    });
    const btnImportPaste = document.getElementById('btn-import-paste');
    if(btnImportPaste){
      btnImportPaste.addEventListener('click', () => {
        const textarea = document.getElementById('input-import-paste');
        const texto = textarea.value.trim();
        if(!texto) return;
        if(tentarImportar(texto)) textarea.value = '';
      });
    }
  }
```
(This is the exact block Task 3 deleted from `attachHojeHandlers()`, retargeted at Configurações' markup.)

- [ ] **Step 4: Final cross-check of `renderScreen()`**

Open the current `renderScreen()` and confirm the `map` object has all 7 keys —
`{hoje, planejamento, mapa, erros, desempenho, dashboard, config}` — each pointing at the correctly-named
function (`renderHoje`, `renderPlanejamento`, `renderMapa`, `renderErros`, `renderDesempenho`,
`renderDashboard`, `renderConfig`), and the if-chain has exactly 6 `attach...Handlers()` lines (`dashboard`,
`hoje`, `planejamento`, `mapa`, `erros`, `desempenho` — `config` needs one too, so 7 total; add
`if(currentTab==='config') attachConfigHandlers();` if it's still Task 1's placeholder wiring). Fix any
mismatch found.

- [ ] **Step 5: Static verification**

Run the `new Function(...)` syntax check on the final `index.html`. Grep for `renderScreen` and read the whole
function body once to confirm the map/if-chain match Step 4's expected final state. Grep for `btn-export-md`
and confirm it now appears in exactly one place (`renderConfig`) plus its one `attachConfigHandlers()` listener
— zero remaining references inside `attachHojeHandlers`.

- [ ] **Step 6: Commit**

```bash
git add index.html
git commit -m "feat(redesign): restyle Mapa/Erros into card grid, add Configuracoes screen, final nav wiring"
```

- [ ] **Step 7: Note for the user — manual verification checklist**

No browser is available to the implementer or controller in this environment. Once this task is committed
(and pushed/deployed), verify on a real device/browser:
- Desktop-width window: sidebar visible, Dashboard is the landing screen, collapsing the sidebar works.
- Narrow window / phone: bottom nav shows Hoje/Planejamento/Desempenho/Mais, app lands on Hoje, "Mais" opens
  the sheet with Dashboard/Mapa/Caderno de Erros/Configurações.
- Dashboard's bar chart and Desempenho's bar+line charts render (Chart.js loaded); changing `--accent` in
  DevTools and refreshing updates chart colors along with buttons.
- Planejamento shows the SEG..DOM grid reflecting real checkins for the current week.
- Configurações → export/copy/paste-import all still work (existing backup format, old exports still import).
- After this deploy, force-refresh once on the phone to clear the last pre-network-first service worker; from
  then on, redeploys should show up without manual cache clearing.

---

## Self-Review Notes

- **Spec coverage:** Sidebar → Task 1; Dashboard → Task 2; full-width layout / responsive breakpoint → Task 1;
  screen reorg (Hoje cleanup, Semana→Planejamento, Desempenho enhancement, Mapa/Erros restyle, Configurações) →
  Tasks 3-6; visual overhaul (tokens, cards, charts, tables, progress bars) → Task 1 (tokens/components) +
  Tasks 2/5 (charts) + Task 6 (grid wrapping); single `--accent` driving buttons/nav/progress/charts → Task 1
  (CSS) + Task 2 (`corAccent()` read at chart-config time) — confirmed no hardcoded chart color hex anywhere;
  SW cache-busting bug report → Task 2 Step 5; Planejamento realized-per-day decision → Task 4; Chart.js+CDN
  decision → Task 2 Steps 4-5 (script tag + SW precache).
- **Placeholder scan:** no TBD/TODO; every step has runnable code or exact edit instructions. Task 1 Step 5's
  note about `renderScreen()`'s temporary `planejamento`-key gap between Tasks 1 and 4 is an explicit, reasoned
  interim state (not a placeholder) — flagged so Task 4's implementer isn't surprised by either possible
  starting state.
- **Type consistency:** `evolucaoSemanal`'s bucket shape `{semanaId, pct}` (Task 2) matches exactly how Task 5
  consumes it (`b.semanaId`, `b.pct`). `melhores5`/`piores5` both take and return the same `agregarPorAssunto`
  output shape (`{assunto, questoes, acertos, pct}`). `criarOuAtualizarChart(canvasId, config)` signature (Task
  2) is called identically in Task 5. `horasNoDia`/`horasPorDiaDaSemana` signatures match their Task 2 test
  fixtures exactly. `renderPlanejamento`/`attachPlanejamentoHandlers` (Task 4) are the only names used anywhere
  after Task 4 — grepped for stale `renderSemana`/`attachSemanaHandlers` references in each downstream task's
  verification step.
