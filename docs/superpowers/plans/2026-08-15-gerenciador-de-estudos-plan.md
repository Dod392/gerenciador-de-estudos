# Gerenciador de Estudos — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a single-repo, mobile-first PWA (no backend/build/npm) that lets the user log daily study check-ins, run spaced-repetition review of a mistake notebook, track content coverage, define a weekly study goal and see it compared against what actually happened, and see performance stats — all in `localStorage`, installable on Android and deployable to GitHub Pages.

**Architecture:** One `index.html` holding all CSS and JS (state, pure logic, and DOM rendering functions in marked sections of a single `<script>`), plus the minimum extra static files a real PWA needs: `manifest.json`, `sw.js`, and two icon PNGs. Screens are plain functions that return HTML strings swapped into a container; navigation is in-memory tab state, not URL routing.

**Tech Stack:** Vanilla HTML/CSS/JS, `localStorage`, hand-rolled SVG for charts, Web App Manifest + Service Worker for installability, GitHub Pages for hosting. No framework, no bundler, no npm package.

**Spec:** `docs/superpowers/specs/2026-08-15-gerenciador-de-estudos-design.md`

## Global Constraints

- No framework, no build step, no npm, no external libraries (from spec "Restrições").
- Only tolerated extra files beyond `index.html`: `manifest.json`, `sw.js`, icon PNGs (spec "Restrições" / "PWA").
- Mobile-first: single column, touch targets ≥44px, no hover-dependent UI, test viewport = 390px wide (spec "Restrições").
- Data lives in `localStorage` under the key `estudos_v1`; no sync between devices — Export/Import JSON is the backup path (spec "Export / Import").
- Check-in do dia must complete in 1 tap (spec "Telas" → Hoje).
- `service worker` requires `http(s)` — `file://` works for the core app but not offline/install (spec "PWA").

## Testing approach for this project

There is no shipped test framework (matches the spec's "Testes" section). Pure logic functions (date math, spaced-repetition transitions, aggregation, markdown formatting) are still developed test-first, using plain Node.js (already on the machine, not an added dependency) and its built-in `assert` module, run as scratch scripts from the scratchpad directory — never committed to the repo. DOM/visual behavior (skeleton rendering, tap targets, PWA install, GitHub Pages) is verified manually in-browser, per step-by-step instructions in each task.

---

## Task 1: Skeleton shell — 5 tabs, nav, example data

**Files:**
- Create: `index.html`

**Interfaces:**
- Produces: `TABS` (array of `{id, label}`), `currentTab` (module-level string), `render()`, `renderTabs()`, `renderScreen()`, and one `render<Tela>()` stub per screen (`renderHoje`, `renderErros`, `renderMapa`, `renderSemana`, `renderDesempenho`) that later tasks replace with real logic. Script is organized into marker-commented sections later tasks insert into:
  ```
  /* === HELPERS (Tarefa 2) === */
  /* === STATE (Tarefa 2) === */
  /* === HOJE (Tarefa 3) === */
  /* === ERROS (Tarefa 4) === */
  /* === MAPA (Tarefa 6) === */
  /* === SEMANA (Tarefa 7) === */
  /* === DESEMPENHO (Tarefa 8) === */
  /* === EXPORT (Tarefa 9) === */
  /* === RENDER === */
  /* === INIT === */
  ```

- [ ] **Step 1: Write `index.html` with mobile-first CSS base and empty section markers**

```html
<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>Gerenciador de Estudos</title>
<style>
  :root{
    --bg:#0f1115; --fg:#e8eaed; --muted:#9aa0a6; --card:#1b1e24;
    --accent:#4f9dde; --ok:#3ecf8e; --warn:#e0a83e; --bad:#e05a4f;
    --border:#2a2e35; --radius:12px; --gap:12px; --tap:48px;
  }
  *{box-sizing:border-box;}
  html,body{margin:0;padding:0;background:var(--bg);color:var(--fg);
    font-family:system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;}
  body{padding-bottom:calc(72px + env(safe-area-inset-bottom));}
  #app{max-width:480px;margin:0 auto;padding:var(--gap);}
  h1,h2,h3{margin:0 0 8px;}
  p{margin:0 0 8px;}
  .card{background:var(--card);border:1px solid var(--border);
    border-radius:var(--radius);padding:var(--gap);margin-bottom:var(--gap);}
  button{font:inherit;min-height:var(--tap);border-radius:var(--radius);
    border:1px solid var(--border);background:var(--card);color:var(--fg);
    padding:0 16px;width:100%;margin-bottom:8px;}
  button.primary{background:var(--accent);border-color:var(--accent);color:#0b0d10;font-weight:600;}
  button.ok{background:var(--ok);border-color:var(--ok);color:#0b0d10;}
  button.bad{background:var(--bad);border-color:var(--bad);color:#0b0d10;}
  .row{display:flex;gap:8px;}
  .row>*{flex:1;margin-bottom:0;}
  label{display:block;font-size:13px;color:var(--muted);margin:8px 0 4px;}
  input,select,textarea{width:100%;min-height:var(--tap);border-radius:var(--radius);
    border:1px solid var(--border);background:var(--bg);color:var(--fg);padding:0 12px;font:inherit;}
  textarea{padding:12px;min-height:80px;}
  nav#tabs{position:fixed;left:0;right:0;bottom:0;display:flex;
    background:var(--card);border-top:1px solid var(--border);
    padding-bottom:env(safe-area-inset-bottom);z-index:10;}
  nav#tabs button{margin:0;border:none;border-radius:0;background:none;
    min-height:56px;font-size:12px;color:var(--muted);}
  nav#tabs button.active{color:var(--accent);font-weight:700;}
  small.muted{color:var(--muted);}
  .badge{display:inline-block;padding:2px 8px;border-radius:999px;font-size:12px;background:var(--border);}
  .badge.atrasado{background:var(--bad);color:#0b0d10;}
</style>
</head>
<body>
  <div id="app"></div>
  <nav id="tabs"></nav>
  <script>
  /* === HELPERS (Tarefa 2) === */
  /* === STATE (Tarefa 2) === */
  /* === HOJE (Tarefa 3) === */
  /* === ERROS (Tarefa 4) === */
  /* === MAPA (Tarefa 6) === */
  /* === SEMANA (Tarefa 7) === */
  /* === DESEMPENHO (Tarefa 8) === */
  /* === EXPORT (Tarefa 9) === */

  /* === RENDER === */
  const TABS = [
    {id:'hoje', label:'Hoje'},
    {id:'erros', label:'Erros'},
    {id:'mapa', label:'Mapa'},
    {id:'semana', label:'Semana'},
    {id:'desempenho', label:'Desempenho'},
  ];
  let currentTab = 'hoje';

  const EXEMPLO = {
    meta: { provaData: '2026-11-29', cicloInicio: '2026-08-01' },
    checkins: [
      { data:'2026-08-14', status:'base', minutos:150, assunto:'CONAMA 357', questoes:10, acertos:7, obs:'' },
    ],
    erros: [
      { id:'ex1', assunto:'CONAMA 357', oQueErrei:'confundi classe 2 com classe 3', regraCorreta:'reler art. 4', grau:'erro_novo', proximaRevisao:'2026-08-15', criadoEm:'2026-08-13' },
    ],
    conteudo: [
      { assunto:'PNMA (6.938/81)', status:'estudado', concurso:'ambos' },
      { assunto:'CONAMA 357', status:'revisado', concurso:'ambos' },
    ],
    planejamento: [
      { semanaId:'2026-08-10', assuntosAlvo:['CONAMA 357','PNRS'], diasAlvo:6, horasAlvo:15 },
    ],
  };

  function renderTabsNav(){
    document.getElementById('tabs').innerHTML = TABS.map(t =>
      `<button data-tab="${t.id}" class="${t.id===currentTab?'active':''}">${t.label}</button>`
    ).join('');
  }

  function renderHoje(){
    return `<div class="card"><h2>Hoje</h2><p class="muted">(esqueleto — contagem regressiva e check-in entram na Tarefa 3)</p></div>
      <div class="card"><h3>Revisar hoje</h3><p class="muted">${EXEMPLO.erros.length} item(ns) de exemplo</p></div>`;
  }
  function renderErros(){
    return `<div class="card"><h2>Caderno de Erros</h2></div>` +
      EXEMPLO.erros.map(e=>`<div class="card"><b>${e.assunto}</b><br><small class="muted">${e.grau} — próx. ${e.proximaRevisao}</small></div>`).join('');
  }
  function renderMapa(){
    return `<div class="card"><h2>Mapa de Conteúdo</h2></div>` +
      EXEMPLO.conteudo.map(c=>`<div class="card">${c.assunto} — <small class="muted">${c.status}</small></div>`).join('');
  }
  function renderSemana(){
    return `<div class="card"><h2>Semana</h2><p class="muted">(meta x realizado entra na Tarefa 7)</p></div>`;
  }
  function renderDesempenho(){
    return `<div class="card"><h2>Desempenho</h2><p class="muted">(gráfico SVG entra na Tarefa 8)</p></div>`;
  }

  function renderScreen(){
    const map = {hoje:renderHoje, erros:renderErros, mapa:renderMapa, semana:renderSemana, desempenho:renderDesempenho};
    document.getElementById('app').innerHTML = map[currentTab]();
  }

  function render(){ renderTabsNav(); renderScreen(); }

  document.getElementById('tabs').addEventListener('click', (e)=>{
    const btn = e.target.closest('button[data-tab]');
    if(!btn) return;
    currentTab = btn.dataset.tab;
    render();
  });

  /* === INIT === */
  render();
  </script>
</body>
</html>
```

- [ ] **Step 2: Verify manually in a mobile-width browser**

Open `index.html` directly (double-click, or `code index.html` then "Open with Live Server"). In DevTools, set device toolbar to 390×844 (or similar). Confirm:
- All 5 tab labels visible at the bottom without wrapping or overflow.
- Tapping each tab swaps the card content instantly (Hoje → Erros → Mapa → Semana → Desempenho).
- No horizontal scrollbar at 390px width.
- Every visible button is comfortably tappable (no tiny hit targets).

Expected: all four checks pass.

- [ ] **Step 3: Commit**

```bash
git add index.html
git commit -m "feat: add 5-tab skeleton shell with example data"
```

---

## Task 2: State model, seed data, persistence

**Files:**
- Modify: `index.html` (marker `/* === HELPERS (Tarefa 2) === */` and `/* === STATE (Tarefa 2) === */`)

**Interfaces:**
- Consumes: nothing (foundation task).
- Produces: `hojeISO()`, `addDays(iso, n)`, `segundaFeiraDaSemana(iso)`, `SEED_CONTEUDO` (array of 17 `{assunto, status, concurso}`), `seedState()`, `loadState()`, `saveState(state)`, module-level `state` variable initialized from `loadState()`. All later tasks read/mutate `state` and call `saveState(state)` after every mutation. `state.conteudo[]` items carry `atualizadoEm` (stamped by Task 6) and `state.planejamento[]` holds weekly goals (used by Task 7).

- [ ] **Step 1: Write the failing logic test (scratch, not committed)**

Write to the scratchpad (e.g. `.../scratchpad/test-state.mjs`):

```js
import assert from 'node:assert/strict';

function addDays(iso, n){
  const d = new Date(iso + 'T00:00:00');
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0,10);
}

function segundaFeiraDaSemana(iso){
  const d = new Date(iso + 'T00:00:00');
  const diaSemana = d.getDay(); // 0=domingo .. 6=sábado
  const offset = diaSemana === 0 ? -6 : 1 - diaSemana; // volta até a segunda-feira
  d.setDate(d.getDate() + offset);
  return d.toISOString().slice(0,10);
}

function seedState(){
  const assuntos = [
    'PNMA (6.938/81)','SNUC (9.985/00)','LC 140/2011','PNRH','CONAMA 357',
    'CONAMA 430','PNRS','NBR 10004','licenciamento ambiental',
    'abastecimento de água','tratamento de água','qualidade da água',
    'tratamento de esgoto','poluição hídrica','efluentes',
    'resíduos sólidos','Português','Inglês'
  ];
  const hoje = new Date().toISOString().slice(0,10);
  return {
    meta: { provaData: '2026-11-29', cicloInicio: hoje },
    checkins: [],
    erros: [],
    conteudo: assuntos.map(assunto => ({ assunto, status:'nao_iniciado', concurso:'ambos', atualizadoEm: hoje })),
    planejamento: [],
  };
}

assert.equal(addDays('2026-08-15', 2), '2026-08-17');
assert.equal(addDays('2026-08-30', 2), '2026-09-01');

// segunda-feira de referência: 2026-08-17 é uma segunda
assert.equal(segundaFeiraDaSemana('2026-08-17'), '2026-08-17'); // já é segunda
assert.equal(segundaFeiraDaSemana('2026-08-20'), '2026-08-17'); // quinta -> volta pra segunda
assert.equal(segundaFeiraDaSemana('2026-08-23'), '2026-08-17'); // domingo -> volta pra segunda da mesma semana

const s = seedState();
assert.equal(s.conteudo.length, 18-1); // placeholder to force a failing run first
console.log('OK');
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `node .../scratchpad/test-state.mjs`
Expected: `AssertionError` on the `conteudo.length` line (17 !== 17-1... intentionally wrong to prove the test executes; fix the assertion to `17` in the next step and re-run before moving on).

- [ ] **Step 3: Fix the assertion to the real expected value and re-run**

Change `s.conteudo.length` assertion to `assert.equal(s.conteudo.length, 17);` and re-run.
Expected: prints `OK`, exit code 0.

- [ ] **Step 4: Add `hojeISO`, `loadState`, `saveState` to the scratch test and verify behavior**

Append to the scratch file:

```js
function hojeISO(){ return new Date().toISOString().slice(0,10); }
assert.equal(hojeISO().length, 10);
console.log('OK 2');
```

(`loadState`/`saveState` depend on `localStorage`, which Node doesn't have — verify those two directly in-browser in Step 6, not in Node.)

Run: `node .../scratchpad/test-state.mjs` — expected: prints `OK` then `OK 2`.

- [ ] **Step 5: Implement in `index.html`**

Replace the `/* === HELPERS (Tarefa 2) === */` marker with:

```js
/* === HELPERS (Tarefa 2) === */
function hojeISO(){ return new Date().toISOString().slice(0,10); }
function addDays(iso, n){
  const d = new Date(iso + 'T00:00:00');
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0,10);
}
function segundaFeiraDaSemana(iso){
  const d = new Date(iso + 'T00:00:00');
  const diaSemana = d.getDay(); // 0=domingo .. 6=sábado
  const offset = diaSemana === 0 ? -6 : 1 - diaSemana;
  d.setDate(d.getDate() + offset);
  return d.toISOString().slice(0,10);
}
```

Replace the `/* === STATE (Tarefa 2) === */` marker with:

```js
/* === STATE (Tarefa 2) === */
const STORAGE_KEY = 'estudos_v1';
const SEED_CONTEUDO = [
  'PNMA (6.938/81)','SNUC (9.985/00)','LC 140/2011','PNRH','CONAMA 357',
  'CONAMA 430','PNRS','NBR 10004','licenciamento ambiental',
  'abastecimento de água','tratamento de água','qualidade da água',
  'tratamento de esgoto','poluição hídrica','efluentes',
  'resíduos sólidos','Português','Inglês'
];

function seedState(){
  return {
    meta: { provaData: '2026-11-29', cicloInicio: hojeISO() },
    checkins: [],
    erros: [],
    conteudo: SEED_CONTEUDO.map(assunto => ({ assunto, status:'nao_iniciado', concurso:'ambos', atualizadoEm: hojeISO() })),
    planejamento: [],
  };
}

function loadState(){
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if(!raw) return seedState();
    const parsed = JSON.parse(raw);
    if(!parsed || !Array.isArray(parsed.conteudo)) return seedState();
    return parsed;
  } catch(e){
    return seedState();
  }
}

function saveState(s){
  localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
}

let state = loadState();
```

- [ ] **Step 6: Wire skeleton screens to real state and verify in-browser**

In `renderMapa()` (still the Task 1 stub), change `EXEMPLO.conteudo` to `state.conteudo`. Reload the page. Open DevTools console and run:

```js
localStorage.getItem('estudos_v1')
```

Expected: a JSON string containing `"conteudo":[...]` with 18 — wait, 17 entries, first one `"assunto":"PNMA (6.938/81)"`. Reload the page again; confirm the Mapa tab still shows the same 17 items (proves persistence, not re-seeding on every load).

- [ ] **Step 7: Commit**

```bash
git add index.html
git commit -m "feat: add state model, seed data, and localStorage persistence"
```

---

## Task 3: Tela Hoje — countdown, 1-tap check-in, data-locality notice

**Files:**
- Modify: `index.html` (marker `/* === HOJE (Tarefa 3) === */`, replace `renderHoje()`)

**Interfaces:**
- Consumes: `hojeISO()`, `addDays()`, `state`, `saveState(state)` (Task 2).
- Produces: `diasAte(hojeIso, alvoIso)`, `registrarCheckin(state, data, status)` (upsert-by-date, mutates and returns `state`), `renderHoje()`. Later tasks (5) extend `renderHoje()`'s output with the fila de revisão block, marked by `<!-- FILA_REVISAO -->` placeholder left in this task's HTML.

- [ ] **Step 1: Write the failing logic test (scratch)**

`.../scratchpad/test-hoje.mjs`:

```js
import assert from 'node:assert/strict';

function diasAte(hojeIso, alvoIso){
  const a = new Date(hojeIso + 'T00:00:00');
  const b = new Date(alvoIso + 'T00:00:00');
  return Math.round((b - a) / 86400000);
}

function registrarCheckin(state, data, status){
  const idx = state.checkins.findIndex(c => c.data === data);
  if(idx === -1){
    state.checkins.push({ data, status, minutos:null, assunto:null, questoes:null, acertos:null, obs:'' });
  } else {
    state.checkins[idx].status = status;
  }
  return state;
}

assert.equal(diasAte('2026-08-15','2026-11-29'), 106);

let s = { checkins: [] };
registrarCheckin(s, '2026-08-15', 'base');
assert.equal(s.checkins.length, 1);
assert.equal(s.checkins[0].status, 'base');

registrarCheckin(s, '2026-08-15', 'minimo'); // same day, different tap
assert.equal(s.checkins.length, 1); // still one entry (idempotent per date)
assert.equal(s.checkins[0].status, 'minimo');

registrarCheckin(s, '2026-08-16', 'nao');
assert.equal(s.checkins.length, 2);

console.log('OK');
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `node .../scratchpad/test-hoje.mjs`
Expected: FAIL — `diasAte is not defined` (functions only exist in the scratch file at this point, so this actually passes syntactically; to genuinely see red first, temporarily comment out the `registrarCheckin` idempotency assertion's fix — i.e. first assert `s.checkins.length === 2` after the second call, which is wrong). Change that assertion to `2`, run, confirm `AssertionError`, then fix it back to `1` per Step 3.

- [ ] **Step 3: Fix assertion to correct expected value and re-run**

Ensure the second-call assertion reads `assert.equal(s.checkins.length, 1);` (idempotent overwrite). Re-run.
Expected: prints `OK`, exit code 0.

- [ ] **Step 4: Implement in `index.html`**

Replace `/* === HOJE (Tarefa 3) === */` marker with:

```js
/* === HOJE (Tarefa 3) === */
function diasAte(hojeIso, alvoIso){
  const a = new Date(hojeIso + 'T00:00:00');
  const b = new Date(alvoIso + 'T00:00:00');
  return Math.round((b - a) / 86400000);
}

function registrarCheckin(state, data, status){
  const idx = state.checkins.findIndex(c => c.data === data);
  if(idx === -1){
    state.checkins.push({ data, status, minutos:null, assunto:null, questoes:null, acertos:null, obs:'' });
  } else {
    state.checkins[idx].status = status;
  }
  return state;
}

function checkinDeHoje(){
  return state.checkins.find(c => c.data === hojeISO());
}
```

Replace the whole `renderHoje()` function (from Task 1) with:

```js
function renderHoje(){
  const dias = diasAte(hojeISO(), state.meta.provaData);
  const ci = checkinDeHoje();
  const statusAtivo = ci ? ci.status : null;
  return `
    <div class="card">
      <h2>${dias} dias até a prova</h2>
      <small class="muted">Dados salvos só neste aparelho — use Exportar/Importar JSON pra levar pro celular ou fazer backup.</small>
    </div>
    <div class="card">
      <h3>Como foi hoje?</h3>
      <button data-checkin="base" class="${statusAtivo==='base'?'primary':''}">Base 2h30 ${statusAtivo==='base'?'✓':''}</button>
      <button data-checkin="minimo" class="${statusAtivo==='minimo'?'primary':''}">Mínimo ${statusAtivo==='minimo'?'✓':''}</button>
      <button data-checkin="nao" class="${statusAtivo==='nao'?'primary':''}">Não estudei ${statusAtivo==='nao'?'✓':''}</button>
      <details>
        <summary>+ detalhar (opcional)</summary>
        <label>Minutos</label>
        <input type="number" id="hoje-minutos" value="${ci?.minutos ?? ''}">
        <label>Assunto</label>
        <select id="hoje-assunto">
          <option value="">—</option>
          ${state.conteudo.map(c => `<option value="${c.assunto}" ${ci?.assunto===c.assunto?'selected':''}>${c.assunto}</option>`).join('')}
        </select>
        <div class="row">
          <div><label>Questões</label><input type="number" id="hoje-questoes" value="${ci?.questoes ?? ''}"></div>
          <div><label>Acertos</label><input type="number" id="hoje-acertos" value="${ci?.acertos ?? ''}"></div>
        </div>
        <label>Observação</label>
        <textarea id="hoje-obs">${ci?.obs ?? ''}</textarea>
        <button id="hoje-salvar-detalhe" class="primary">Salvar detalhe</button>
      </details>
    </div>
    <!-- FILA_REVISAO -->
  `;
}

function attachHojeHandlers(){
  const app = document.getElementById('app');
  app.querySelectorAll('button[data-checkin]').forEach(btn => {
    btn.addEventListener('click', () => {
      registrarCheckin(state, hojeISO(), btn.dataset.checkin);
      saveState(state);
      render();
    });
  });
  const salvarDetalhe = document.getElementById('hoje-salvar-detalhe');
  if(salvarDetalhe){
    salvarDetalhe.addEventListener('click', () => {
      const ci = checkinDeHoje() || registrarCheckin(state, hojeISO(), 'minimo').checkins.find(c=>c.data===hojeISO());
      ci.minutos = Number(document.getElementById('hoje-minutos').value) || null;
      ci.assunto = document.getElementById('hoje-assunto').value || null;
      ci.questoes = Number(document.getElementById('hoje-questoes').value) || null;
      ci.acertos = Number(document.getElementById('hoje-acertos').value) || null;
      ci.obs = document.getElementById('hoje-obs').value;
      saveState(state);
      render();
    });
  }
}
```

Update `renderScreen()` (in the `/* === RENDER === */` section) to call `attachHojeHandlers()` after setting `innerHTML` when `currentTab==='hoje'`:

```js
function renderScreen(){
  const map = {hoje:renderHoje, erros:renderErros, mapa:renderMapa, desempenho:renderDesempenho};
  document.getElementById('app').innerHTML = map[currentTab]();
  if(currentTab==='hoje') attachHojeHandlers();
}
```

Delete the now-unused `EXEMPLO` check-in usage inside `renderHoje` (already replaced above) but keep `EXEMPLO.erros`/`EXEMPLO.conteudo` for the other two still-stubbed screens (Erros wired in Task 4, Mapa already reads `state.conteudo` since Task 2).

- [ ] **Step 5: Verify manually in-browser**

Reload. On the Hoje tab: confirm the countdown shows a positive day count. Tap "Base 2h30" — confirm it gets highlighted with a ✓ and no full-page reload happens. Tap "Mínimo" right after — confirm the ✓ moves to "Mínimo" and "Base 2h30" loses it (idempotent, one entry). Open DevTools → run `JSON.parse(localStorage.estudos_v1).checkins` — confirm exactly one entry for today's date with `status:"minimo"`. Expand "+ detalhar", fill minutes/assunto/questões/acertos/obs, tap "Salvar detalhe", reload the page, expand again — confirm the values persisted.

- [ ] **Step 6: Commit**

```bash
git add index.html
git commit -m "feat: implement Hoje screen with 1-tap check-in and detail form"
```

---

## Task 4: Caderno de Erros — spaced repetition engine + CRUD UI

**Files:**
- Modify: `index.html` (marker `/* === ERROS (Tarefa 4) === */`, replace `renderErros()`)

**Interfaces:**
- Consumes: `hojeISO()`, `addDays()`, `state`, `saveState()` (Task 2).
- Produces: `criarErro(state, {assunto, oQueErrei, regraCorreta})`, `graduarAcerto(erro)`, `graduarErro(erro)`, `ordenarErrosPorRevisao(erros)`, `renderErros()`. Task 5 (fila de revisão on Hoje) and Task 6 both call `graduarAcerto`/`graduarErro`/`ordenarErrosPorRevisao`.

- [ ] **Step 1: Write the failing logic test (scratch)**

`.../scratchpad/test-erros.mjs`:

```js
import assert from 'node:assert/strict';

function addDays(iso, n){
  const d = new Date(iso + 'T00:00:00');
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0,10);
}

const ORDEM = ['deficiencia','erro_novo','reforcado','corrigido'];
const DIAS = { deficiencia:1, erro_novo:2, reforcado:7, corrigido:21 };

function criarErro(state, {assunto, oQueErrei, regraCorreta}, hoje){
  const erro = {
    id: String(Date.now()) + Math.random().toString(36).slice(2,7),
    assunto, oQueErrei, regraCorreta,
    grau: 'erro_novo',
    proximaRevisao: addDays(hoje, DIAS.erro_novo),
    criadoEm: hoje,
  };
  state.erros.push(erro);
  return erro;
}

function graduarAcerto(erro, hoje){
  const i = ORDEM.indexOf(erro.grau);
  const novoGrau = i < ORDEM.length - 1 ? ORDEM[i+1] : erro.grau;
  erro.grau = novoGrau;
  erro.proximaRevisao = addDays(hoje, DIAS[novoGrau]);
  return erro;
}

function graduarErro(erro, hoje){
  erro.grau = 'deficiencia';
  erro.proximaRevisao = addDays(hoje, DIAS.deficiencia);
  return erro;
}

function ordenarErrosPorRevisao(erros){
  return [...erros].sort((a,b) => a.proximaRevisao < b.proximaRevisao ? -1 : a.proximaRevisao > b.proximaRevisao ? 1 : 0);
}

// criação
const st = { erros: [] };
const e = criarErro(st, {assunto:'CONAMA 357', oQueErrei:'x', regraCorreta:'y'}, '2026-08-15');
assert.equal(e.grau, 'erro_novo');
assert.equal(e.proximaRevisao, '2026-08-17');

// sequência de acertos
graduarAcerto(e, '2026-08-17');
assert.equal(e.grau, 'reforcado');
assert.equal(e.proximaRevisao, '2026-08-24');

graduarAcerto(e, '2026-08-24');
assert.equal(e.grau, 'corrigido');
assert.equal(e.proximaRevisao, '2026-09-14');

graduarAcerto(e, '2026-09-14'); // já em corrigido, permanece e reagenda
assert.equal(e.grau, 'corrigido');
assert.equal(e.proximaRevisao, '2026-10-05');

// erro sempre volta pra deficiencia/1d, de qualquer grau
graduarErro(e, '2026-10-05');
assert.equal(e.grau, 'deficiencia');
assert.equal(e.proximaRevisao, '2026-10-06');

// ordenação: atrasado primeiro
const lista = [
  {proximaRevisao:'2026-08-20'},
  {proximaRevisao:'2026-08-15'},
  {proximaRevisao:'2026-08-18'},
];
const ordenada = ordenarErrosPorRevisao(lista);
assert.deepEqual(ordenada.map(x=>x.proximaRevisao), ['2026-08-15','2026-08-18','2026-08-20']);

console.log('OK');
```

- [ ] **Step 2: Run it to confirm it fails first**

Temporarily change the second `graduarAcerto` expectation (`corrigido`/`2026-09-14`) to an intentionally wrong date, e.g. `'2026-09-13'`, then run: `node .../scratchpad/test-erros.mjs`.
Expected: `AssertionError` on that line.

- [ ] **Step 3: Fix the assertion to the correct value and re-run**

Restore it to `'2026-09-14'`. Re-run.
Expected: prints `OK`, exit code 0.

- [ ] **Step 4: Implement in `index.html`**

Replace `/* === ERROS (Tarefa 4) === */` marker with:

```js
/* === ERROS (Tarefa 4) === */
const GRAU_ORDEM = ['deficiencia','erro_novo','reforcado','corrigido'];
const GRAU_DIAS = { deficiencia:1, erro_novo:2, reforcado:7, corrigido:21 };
const GRAU_LABEL = { deficiencia:'deficiência confirmada', erro_novo:'erro novo', reforcado:'reforçado', corrigido:'corrigido' };

function criarErro(state, {assunto, oQueErrei, regraCorreta}){
  const hoje = hojeISO();
  const erro = {
    id: String(Date.now()) + Math.random().toString(36).slice(2,7),
    assunto, oQueErrei, regraCorreta,
    grau: 'erro_novo',
    proximaRevisao: addDays(hoje, GRAU_DIAS.erro_novo),
    criadoEm: hoje,
  };
  state.erros.push(erro);
  return erro;
}

function graduarAcerto(erro){
  const i = GRAU_ORDEM.indexOf(erro.grau);
  const novoGrau = i < GRAU_ORDEM.length - 1 ? GRAU_ORDEM[i+1] : erro.grau;
  erro.grau = novoGrau;
  erro.proximaRevisao = addDays(hojeISO(), GRAU_DIAS[novoGrau]);
  return erro;
}

function graduarErro(erro){
  erro.grau = 'deficiencia';
  erro.proximaRevisao = addDays(hojeISO(), GRAU_DIAS.deficiencia);
  return erro;
}

function ordenarErrosPorRevisao(erros){
  return [...erros].sort((a,b) => a.proximaRevisao < b.proximaRevisao ? -1 : a.proximaRevisao > b.proximaRevisao ? 1 : 0);
}

function cardErro(e){
  const atrasado = e.proximaRevisao <= hojeISO();
  return `
    <div class="card" data-erro-id="${e.id}">
      <b>${e.assunto}</b>
      <span class="badge ${atrasado?'atrasado':''}">${GRAU_LABEL[e.grau]} — próx. ${e.proximaRevisao}</span>
      <p><small class="muted">${e.oQueErrei}</small></p>
      <div class="row">
        <button class="ok" data-acertei="${e.id}">Acertei</button>
        <button class="bad" data-errei="${e.id}">Errei</button>
      </div>
    </div>`;
}
```

Replace `renderErros()` (Task 1 stub) with:

```js
function renderErros(){
  const lista = ordenarErrosPorRevisao(state.erros);
  return `
    <div class="card">
      <h2>Caderno de Erros</h2>
      <details>
        <summary>+ novo item</summary>
        <label>Assunto</label>
        <select id="erro-assunto">${state.conteudo.map(c=>`<option value="${c.assunto}">${c.assunto}</option>`).join('')}</select>
        <label>O que errei</label>
        <textarea id="erro-oque"></textarea>
        <label>Regra correta</label>
        <textarea id="erro-regra"></textarea>
        <button id="erro-salvar" class="primary">Adicionar</button>
      </details>
    </div>
    ${lista.map(cardErro).join('') || '<p class="muted">Nenhum item ainda.</p>'}
  `;
}

function attachErrosHandlers(){
  const app = document.getElementById('app');
  const salvar = document.getElementById('erro-salvar');
  if(salvar){
    salvar.addEventListener('click', () => {
      const assunto = document.getElementById('erro-assunto').value;
      const oQueErrei = document.getElementById('erro-oque').value.trim();
      const regraCorreta = document.getElementById('erro-regra').value.trim();
      if(!oQueErrei || !regraCorreta) return;
      criarErro(state, {assunto, oQueErrei, regraCorreta});
      saveState(state);
      render();
    });
  }
  app.querySelectorAll('button[data-acertei]').forEach(btn => {
    btn.addEventListener('click', () => {
      const e = state.erros.find(x => x.id === btn.dataset.acertei);
      graduarAcerto(e);
      saveState(state);
      render();
    });
  });
  app.querySelectorAll('button[data-errei]').forEach(btn => {
    btn.addEventListener('click', () => {
      const e = state.erros.find(x => x.id === btn.dataset.errei);
      graduarErro(e);
      saveState(state);
      render();
    });
  });
}
```

Update `renderScreen()` to call `attachErrosHandlers()` when `currentTab==='erros'`:

```js
function renderScreen(){
  const map = {hoje:renderHoje, erros:renderErros, mapa:renderMapa, desempenho:renderDesempenho};
  document.getElementById('app').innerHTML = map[currentTab]();
  if(currentTab==='hoje') attachHojeHandlers();
  if(currentTab==='erros') attachErrosHandlers();
}
```

- [ ] **Step 5: Verify manually in-browser**

On the Erros tab: expand "+ novo item", fill assunto/o que errei/regra correta, tap "Adicionar" — confirm a new card appears with grau "erro novo" and próx. = hoje+2. Tap "Acertei" on it — confirm it becomes "reforçado" with próx. = hoje+7. Tap "Errei" on any card — confirm it becomes "deficiência confirmada" with próx. = hoje+1, and the card visually flags as atrasado if that date is today. Reload — confirm all items and grades persisted.

- [ ] **Step 6: Commit**

```bash
git add index.html
git commit -m "feat: implement Caderno de Erros with spaced-repetition engine"
```

---

## Task 5: Fila "revisar hoje" on the Hoje screen

**Files:**
- Modify: `index.html` (replace `<!-- FILA_REVISAO -->` placeholder from Task 3, reuse Task 4's `cardErro`/handlers)

**Interfaces:**
- Consumes: `ordenarErrosPorRevisao(erros)`, `cardErro(e)`, `hojeISO()`, `graduarAcerto`, `graduarErro` (Task 4).
- Produces: `filaRevisao(erros, hojeIso)`.

- [ ] **Step 1: Write the failing logic test (scratch)**

`.../scratchpad/test-fila.mjs`:

```js
import assert from 'node:assert/strict';

function filaRevisao(erros, hojeIso){
  return erros
    .filter(e => e.proximaRevisao <= hojeIso)
    .sort((a,b) => a.proximaRevisao < b.proximaRevisao ? -1 : a.proximaRevisao > b.proximaRevisao ? 1 : 0);
}

const erros = [
  {id:'a', proximaRevisao:'2026-08-20'},
  {id:'b', proximaRevisao:'2026-08-10'},
  {id:'c', proximaRevisao:'2026-08-15'},
  {id:'d', proximaRevisao:'2026-08-16'}, // future relative to hoje
];

const fila = filaRevisao(erros, '2026-08-15');
assert.deepEqual(fila.map(e=>e.id), ['b','c']); // wrong on purpose: 'a' shouldn't be excluded... verify below
console.log('OK');
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `node .../scratchpad/test-fila.mjs`
Expected: the assertion above is actually correct (`b` at 08-10, `c` at 08-15 are `<= 2026-08-15`; `a` at 08-20 and `d` at 08-16 are not) — so first prove red by temporarily asserting `['b','c','d']` instead, run, confirm `AssertionError`.

- [ ] **Step 3: Fix assertion to the correct expected list and re-run**

Set the assertion to `assert.deepEqual(fila.map(e=>e.id), ['b','c']);`. Re-run.
Expected: prints `OK`, exit code 0.

- [ ] **Step 4: Implement in `index.html`**

Add to the `/* === ERROS (Tarefa 4) === */` section (append after `ordenarErrosPorRevisao`):

```js
function filaRevisao(erros, hojeIso){
  return ordenarErrosPorRevisao(erros.filter(e => e.proximaRevisao <= hojeIso));
}
```

In `renderHoje()`, replace the `<!-- FILA_REVISAO -->` placeholder line with:

```js
    <div class="card"><h3>Revisar hoje</h3></div>
    ${filaRevisao(state.erros, hojeISO()).map(cardErro).join('') || '<p class="muted">Nada atrasado — bom sinal.</p>'}
```

(This means `renderHoje()`'s template literal now needs `filaRevisao` and `cardErro` in scope — both already defined earlier in the same `<script>`, so no import needed.)

In `attachHojeHandlers()`, add the same `[acertei]`/`[errei]` wiring used in `attachErrosHandlers()` so the fila's buttons work from the Hoje tab too:

```js
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
```

- [ ] **Step 5: Verify manually in-browser**

Go to Erros tab, add an item, then use DevTools console to force it overdue: `state.erros[0].proximaRevisao = hojeISO(); saveState(state); render();` — wait, simpler: tap "Errei" on it once (sets próx. = hoje+1, not overdue yet) — instead directly edit via console: `JSON.parse(localStorage.estudos_v1)` to confirm shape, then on the Hoje tab confirm the "Revisar hoje" section is empty (`Nada atrasado`) since nothing is due yet. Then in console: `let s = JSON.parse(localStorage.estudos_v1); s.erros[0].proximaRevisao = hojeISO(); localStorage.setItem('estudos_v1', JSON.stringify(s)); location.reload();` — confirm the item now appears under "Revisar hoje" on the Hoje tab, and tapping Acertei/Errei there updates it (verify by reopening the Erros tab).

- [ ] **Step 6: Commit**

```bash
git add index.html
git commit -m "feat: wire overdue review queue into Hoje screen"
```

---

## Task 6: Mapa de Conteúdo — status cycle + concurso tag

**Files:**
- Modify: `index.html` (marker `/* === MAPA (Tarefa 6) === */`, replace `renderMapa()`)

**Interfaces:**
- Consumes: `state`, `saveState()`, `hojeISO()` (Task 2).
- Produces: `proximoStatusConteudo(atual)`, `proximoConcurso(atual)`, `renderMapa()`. Status changes stamp `conteudo[i].atualizadoEm = hojeISO()`, which Task 7 (Semana) reads to decide whether a subject counts as "touched" this week.

- [ ] **Step 1: Write the failing logic test (scratch)**

`.../scratchpad/test-mapa.mjs`:

```js
import assert from 'node:assert/strict';

const STATUS_ORDEM = ['nao_iniciado','estudado','revisado','dominado'];
function proximoStatusConteudo(atual){
  const i = STATUS_ORDEM.indexOf(atual);
  return STATUS_ORDEM[(i+1) % STATUS_ORDEM.length];
}

assert.equal(proximoStatusConteudo('nao_iniciado'), 'revisado'); // wrong on purpose
console.log('OK');
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `node .../scratchpad/test-mapa.mjs`
Expected: `AssertionError` (`'estudado' !== 'revisado'`).

- [ ] **Step 3: Fix the assertion and extend coverage, then re-run**

```js
assert.equal(proximoStatusConteudo('nao_iniciado'), 'estudado');
assert.equal(proximoStatusConteudo('estudado'), 'revisado');
assert.equal(proximoStatusConteudo('revisado'), 'dominado');
assert.equal(proximoStatusConteudo('dominado'), 'nao_iniciado'); // wraps around
console.log('OK');
```

Run: `node .../scratchpad/test-mapa.mjs`
Expected: prints `OK`, exit code 0.

- [ ] **Step 4: Implement in `index.html`**

Replace `/* === MAPA (Tarefa 6) === */` marker with:

```js
/* === MAPA (Tarefa 6) === */
const STATUS_CONTEUDO_ORDEM = ['nao_iniciado','estudado','revisado','dominado'];
const STATUS_CONTEUDO_LABEL = { nao_iniciado:'não iniciado', estudado:'estudado', revisado:'revisado', dominado:'dominado' };
const CONCURSO_ORDEM = ['ambos','transpetro','inea'];
const CONCURSO_LABEL = { ambos:'Transpetro + INEA', transpetro:'Transpetro', inea:'INEA' };

function proximoStatusConteudo(atual){
  const i = STATUS_CONTEUDO_ORDEM.indexOf(atual);
  return STATUS_CONTEUDO_ORDEM[(i+1) % STATUS_CONTEUDO_ORDEM.length];
}
function proximoConcurso(atual){
  const i = CONCURSO_ORDEM.indexOf(atual);
  return CONCURSO_ORDEM[(i+1) % CONCURSO_ORDEM.length];
}
```

Replace `renderMapa()` (Task 1 stub) with:

```js
function renderMapa(){
  return `<div class="card"><h2>Mapa de Conteúdo</h2><small class="muted">Toque no status pra avançar; toque no concurso pra trocar.</small></div>` +
    state.conteudo.map((c, i) => `
      <div class="card">
        <b>${c.assunto}</b><br>
        <button data-status-idx="${i}" class="badge">${STATUS_CONTEUDO_LABEL[c.status]}</button>
        <button data-concurso-idx="${i}" class="badge">${CONCURSO_LABEL[c.concurso]}</button>
      </div>`).join('');
}

function attachMapaHandlers(){
  const app = document.getElementById('app');
  app.querySelectorAll('button[data-status-idx]').forEach(btn => {
    btn.addEventListener('click', () => {
      const c = state.conteudo[Number(btn.dataset.statusIdx)];
      c.status = proximoStatusConteudo(c.status);
      c.atualizadoEm = hojeISO();
      saveState(state);
      render();
    });
  });
  app.querySelectorAll('button[data-concurso-idx]').forEach(btn => {
    btn.addEventListener('click', () => {
      const c = state.conteudo[Number(btn.dataset.concursoIdx)];
      c.concurso = proximoConcurso(c.concurso);
      saveState(state);
      render();
    });
  });
}
```

Note the two badge buttons use `class="badge"` but are `<button>` elements — add a small CSS override so they don't inherit full-width block button styling. In the `<style>` block, after the existing `.badge` rule, add:

```css
button.badge{width:auto;min-height:32px;display:inline-block;margin:4px 8px 0 0;padding:2px 10px;font-size:12px;}
```

Update `renderScreen()` to call `attachMapaHandlers()` when `currentTab==='mapa'`:

```js
  if(currentTab==='mapa') attachMapaHandlers();
```

- [ ] **Step 5: Verify manually in-browser**

Go to Mapa tab: confirm all 17 seeded assuntos are listed. Tap a status badge 4 times — confirm it cycles não iniciado → estudado → revisado → dominado → back to não iniciado. Tap a concurso badge — confirm it cycles Transpetro+INEA → Transpetro → INEA → back. Reload — confirm changes persisted. In DevTools console, run `JSON.parse(localStorage.estudos_v1).conteudo[0].atualizadoEm` — confirm it shows today's date after tapping that item's status.

- [ ] **Step 6: Commit**

```bash
git add index.html
git commit -m "feat: implement Mapa de Conteudo with status and concurso cycling"
```

---

## Task 7: Semana — weekly goal vs. actual (meta x realizado)

**Files:**
- Modify: `index.html` (marker `/* === SEMANA (Tarefa 7) === */`, replace `renderSemana()`)

**Interfaces:**
- Consumes: `hojeISO()`, `addDays()`, `segundaFeiraDaSemana()` (Task 2), `state`, `saveState()` (Task 2), `state.conteudo[].atualizadoEm` (Task 6).
- Produces: `semanaAtualId()`, `obterPlano(state, semanaId)`, `salvarPlano(state, semanaId, {assuntosAlvo, diasAlvo, horasAlvo})`, `diasRealizadosNaSemana(checkins, semanaId)`, `horasRealizadasNaSemana(checkins, semanaId)`, `assuntosTocadosNaSemana(state, semanaId)`, `assuntosAtrasadosNaSemana(assuntosAlvo, tocados)`, `renderSemana()`. Task 9 (Export) calls `semanaAtualId`, `obterPlano`, `diasRealizadosNaSemana`, `horasRealizadasNaSemana`, `assuntosTocadosNaSemana`, `assuntosAtrasadosNaSemana` to build the markdown snapshot.

- [ ] **Step 1: Write the failing logic test (scratch)**

`.../scratchpad/test-semana.mjs`:

```js
import assert from 'node:assert/strict';

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

function obterPlano(state, semanaId){
  return state.planejamento.find(p => p.semanaId === semanaId);
}

function salvarPlano(state, semanaId, {assuntosAlvo, diasAlvo, horasAlvo}){
  const existente = obterPlano(state, semanaId);
  if(existente){
    existente.assuntosAlvo = assuntosAlvo;
    existente.diasAlvo = diasAlvo;
    existente.horasAlvo = horasAlvo;
    return existente;
  }
  const novo = { semanaId, assuntosAlvo, diasAlvo, horasAlvo };
  state.planejamento.push(novo);
  return novo;
}

function dentroDaSemana(dataIso, semanaId){
  return dataIso >= semanaId && dataIso <= addDays(semanaId, 6);
}

function diasRealizadosNaSemana(checkins, semanaId){
  return checkins.filter(c => c.status !== 'nao' && dentroDaSemana(c.data, semanaId)).length;
}

function horasRealizadasNaSemana(checkins, semanaId){
  const minutos = checkins
    .filter(c => dentroDaSemana(c.data, semanaId))
    .reduce((soma, c) => soma + (c.minutos ?? (c.status === 'base' ? 150 : 0)), 0);
  return Math.round((minutos / 60) * 10) / 10;
}

function assuntosTocadosNaSemana(state, semanaId){
  const doCheckin = state.checkins
    .filter(c => dentroDaSemana(c.data, semanaId) && c.assunto)
    .map(c => c.assunto);
  const doMapa = state.conteudo
    .filter(c => c.atualizadoEm && dentroDaSemana(c.atualizadoEm, semanaId))
    .map(c => c.assunto);
  return [...new Set([...doCheckin, ...doMapa])];
}

function assuntosAtrasadosNaSemana(assuntosAlvo, tocados){
  return assuntosAlvo.filter(a => !tocados.includes(a));
}

// segunda-feira de referência: 2026-08-17
const semanaId = '2026-08-17';

const state = {
  planejamento: [],
  checkins: [
    { data:'2026-08-18', status:'base', minutos:150, assunto:'CONAMA 357' }, // terça, dentro
    { data:'2026-08-19', status:'minimo', minutos:null, assunto:null },      // quarta, dentro, sem minutos
    { data:'2026-08-24', status:'base', minutos:150, assunto:'PNRS' },       // segunda seguinte, FORA da semana
  ],
  conteudo: [
    { assunto:'CONAMA 357', atualizadoEm:'2026-08-18' },
    { assunto:'PNRS', atualizadoEm:'2026-08-10' }, // fora da semana
    { assunto:'PNRH', atualizadoEm:null },
  ],
};

salvarPlano(state, semanaId, { assuntosAlvo:['CONAMA 357','PNRS','PNRH'], diasAlvo:5, horasAlvo:10 });
assert.equal(state.planejamento.length, 1);

const plano = obterPlano(state, semanaId);
assert.equal(plano.diasAlvo, 5);

assert.equal(diasRealizadosNaSemana(state.checkins, semanaId), 3); // wrong on purpose, real = 2

const horas = horasRealizadasNaSemana(state.checkins, semanaId);
assert.equal(horas, 2.5); // 150min base + 0min (minimo sem detalhe) = 150min = 2.5h

const tocados = assuntosTocadosNaSemana(state, semanaId);
assert.deepEqual(tocados.sort(), ['CONAMA 357']);

const atrasados = assuntosAtrasadosNaSemana(plano.assuntosAlvo, tocados);
assert.deepEqual(atrasados.sort(), ['PNRH','PNRS']);

console.log('OK');
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `node .../scratchpad/test-semana.mjs`
Expected: `AssertionError` on `diasRealizadosNaSemana` (`3 !== 2` — only the 08-18 and 08-19 checkins fall inside `[2026-08-17, 2026-08-23]`; the 08-24 one is the next week).

- [ ] **Step 3: Fix the assertion to the correct value and re-run**

Change to `assert.equal(diasRealizadosNaSemana(state.checkins, semanaId), 2);`. Re-run.
Expected: prints `OK`, exit code 0.

- [ ] **Step 4: Implement in `index.html`**

Replace `/* === SEMANA (Tarefa 7) === */` marker with:

```js
/* === SEMANA (Tarefa 7) === */
function semanaAtualId(){
  return segundaFeiraDaSemana(hojeISO());
}

function obterPlano(state, semanaId){
  return state.planejamento.find(p => p.semanaId === semanaId);
}

function salvarPlano(state, semanaId, {assuntosAlvo, diasAlvo, horasAlvo}){
  const existente = obterPlano(state, semanaId);
  if(existente){
    existente.assuntosAlvo = assuntosAlvo;
    existente.diasAlvo = diasAlvo;
    existente.horasAlvo = horasAlvo;
    return existente;
  }
  const novo = { semanaId, assuntosAlvo, diasAlvo, horasAlvo };
  state.planejamento.push(novo);
  return novo;
}

function dentroDaSemana(dataIso, semanaId){
  return dataIso >= semanaId && dataIso <= addDays(semanaId, 6);
}

function diasRealizadosNaSemana(checkins, semanaId){
  return checkins.filter(c => c.status !== 'nao' && dentroDaSemana(c.data, semanaId)).length;
}

function horasRealizadasNaSemana(checkins, semanaId){
  const minutos = checkins
    .filter(c => dentroDaSemana(c.data, semanaId))
    .reduce((soma, c) => soma + (c.minutos ?? (c.status === 'base' ? 150 : 0)), 0);
  return Math.round((minutos / 60) * 10) / 10;
}

function assuntosTocadosNaSemana(state, semanaId){
  const doCheckin = state.checkins
    .filter(c => dentroDaSemana(c.data, semanaId) && c.assunto)
    .map(c => c.assunto);
  const doMapa = state.conteudo
    .filter(c => c.atualizadoEm && dentroDaSemana(c.atualizadoEm, semanaId))
    .map(c => c.assunto);
  return [...new Set([...doCheckin, ...doMapa])];
}

function assuntosAtrasadosNaSemana(assuntosAlvo, tocados){
  return assuntosAlvo.filter(a => !tocados.includes(a));
}
```

Replace `renderSemana()` (Task 1 stub) with:

```js
function renderSemana(){
  const semanaId = semanaAtualId();
  const plano = obterPlano(state, semanaId);
  const fimSemana = addDays(semanaId, 6);

  if(!plano){
    return `
      <div class="card">
        <h2>Semana de ${semanaId} a ${fimSemana}</h2>
        <p class="muted">Nenhuma meta definida ainda.</p>
      </div>
      <div class="card">
        <h3>Definir meta da semana</h3>
        <label>Assuntos-alvo</label>
        <select id="semana-assuntos" multiple size="6">
          ${state.conteudo.map(c => `<option value="${c.assunto}">${c.assunto}</option>`).join('')}
        </select>
        <label>Dias-alvo</label>
        <input type="number" id="semana-dias" value="5">
        <label>Horas-alvo</label>
        <input type="number" id="semana-horas" value="12">
        <button id="semana-salvar" class="primary">Salvar meta</button>
      </div>
    `;
  }

  const diasFeitos = diasRealizadosNaSemana(state.checkins, semanaId);
  const horasFeitas = horasRealizadasNaSemana(state.checkins, semanaId);
  const tocados = assuntosTocadosNaSemana(state, semanaId);
  const atrasados = assuntosAtrasadosNaSemana(plano.assuntosAlvo, tocados);

  return `
    <div class="card">
      <h2>Semana de ${semanaId} a ${fimSemana}</h2>
      <p>Dias: ${diasFeitos}/${plano.diasAlvo}</p>
      <p>Horas: ${horasFeitas}h/${plano.horasAlvo}h</p>
    </div>
    <div class="card">
      <h3>Assuntos-alvo</h3>
      ${plano.assuntosAlvo.map(a => `<p>${atrasados.includes(a) ? '⏳' : '✅'} ${a}</p>`).join('')}
    </div>
    <div class="card">
      <details>
        <summary>Editar meta</summary>
        <label>Assuntos-alvo</label>
        <select id="semana-assuntos" multiple size="6">
          ${state.conteudo.map(c => `<option value="${c.assunto}" ${plano.assuntosAlvo.includes(c.assunto)?'selected':''}>${c.assunto}</option>`).join('')}
        </select>
        <label>Dias-alvo</label>
        <input type="number" id="semana-dias" value="${plano.diasAlvo}">
        <label>Horas-alvo</label>
        <input type="number" id="semana-horas" value="${plano.horasAlvo}">
        <button id="semana-salvar" class="primary">Salvar meta</button>
      </details>
    </div>
  `;
}

function attachSemanaHandlers(){
  const salvar = document.getElementById('semana-salvar');
  if(!salvar) return;
  salvar.addEventListener('click', () => {
    const assuntosAlvo = [...document.getElementById('semana-assuntos').selectedOptions].map(o => o.value);
    const diasAlvo = Number(document.getElementById('semana-dias').value) || 0;
    const horasAlvo = Number(document.getElementById('semana-horas').value) || 0;
    salvarPlano(state, semanaAtualId(), { assuntosAlvo, diasAlvo, horasAlvo });
    saveState(state);
    render();
  });
}
```

Update `renderScreen()` to call `attachSemanaHandlers()` when `currentTab==='semana'`:

```js
  if(currentTab==='semana') attachSemanaHandlers();
```

- [ ] **Step 5: Verify manually in-browser**

Go to Semana tab: confirm the empty state with "Definir meta da semana" shows (no plan yet). Select 2-3 assuntos, set dias-alvo=5, horas-alvo=10, tap "Salvar meta" — confirm it switches to the meta x realizado view showing `0/5` dias, `0h/10h`, and every target assunto marked ⏳. Go to Hoje tab, tap "Base 2h30" (registers today, 150min, no assunto) — return to Semana tab, confirm dias shows `1/5` and horas shows `2.5h/10h`. Go to Mapa tab, advance the status of one of the target assuntos — return to Semana tab, confirm that assunto now shows ✅. Reload — confirm the plan and computed values persist/recompute correctly.

- [ ] **Step 6: Commit**

```bash
git add index.html
git commit -m "feat: implement weekly planning with meta x realizado comparison"
```

---

## Task 8: Desempenho — aggregation math + SVG bar chart

**Files:**
- Modify: `index.html` (marker `/* === DESEMPENHO (Tarefa 8) === */`, replace `renderDesempenho()`)

**Interfaces:**
- Consumes: `state.checkins`, `state.meta.cicloInicio`, `hojeISO()`, `addDays()`.
- Produces: `agregarPorAssunto(checkins)`, `diasEstudados(checkins)`, `diasDeCiclo(cicloInicioIso, hojeIso)`, `piores5(agregado)`, `barrasSVG(dados)`, `renderDesempenho()`.

- [ ] **Step 1: Write the failing logic test (scratch)**

`.../scratchpad/test-desempenho.mjs`:

```js
import assert from 'node:assert/strict';

function agregarPorAssunto(checkins){
  const map = new Map();
  for(const c of checkins){
    if(!c.assunto || !c.questoes) continue;
    const cur = map.get(c.assunto) || {assunto:c.assunto, questoes:0, acertos:0};
    cur.questoes += c.questoes;
    cur.acertos += c.acertos || 0;
    map.set(c.assunto, cur);
  }
  return [...map.values()].map(x => ({...x, pct: x.questoes ? Math.round((x.acertos/x.questoes)*100) : 0}));
}

function diasEstudados(checkins){
  return checkins.filter(c => c.status !== 'nao').length;
}

function diasDeCiclo(cicloInicioIso, hojeIso){
  const a = new Date(cicloInicioIso + 'T00:00:00');
  const b = new Date(hojeIso + 'T00:00:00');
  return Math.round((b - a) / 86400000) + 1;
}

function piores5(agregado){
  return [...agregado].filter(a => a.questoes > 0).sort((a,b) => a.pct - b.pct).slice(0,5);
}

const checkins = [
  {assunto:'CONAMA 357', questoes:10, acertos:7, status:'base'},
  {assunto:'CONAMA 357', questoes:5, acertos:1, status:'minimo'},
  {assunto:'PNRS', questoes:8, acertos:8, status:'base'},
  {assunto:null, questoes:null, acertos:null, status:'nao'},
];

const agregado = agregarPorAssunto(checkins);
const conama = agregado.find(a => a.assunto === 'CONAMA 357');
assert.equal(conama.questoes, 15);
assert.equal(conama.acertos, 8);
assert.equal(conama.pct, 60); // wrong on purpose, real value is 53

assert.equal(diasEstudados(checkins), 3);
assert.equal(diasDeCiclo('2026-08-01','2026-08-15'), 15);

const piores = piores5(agregado);
assert.equal(piores[0].assunto, 'CONAMA 357');

console.log('OK');
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `node .../scratchpad/test-desempenho.mjs`
Expected: `AssertionError` on `conama.pct` (`53 !== 60`, since 8/15 rounds to 53%).

- [ ] **Step 3: Fix the assertion and re-run**

Change to `assert.equal(conama.pct, 53);`. Re-run.
Expected: prints `OK`, exit code 0.

- [ ] **Step 4: Implement in `index.html`**

Replace `/* === DESEMPENHO (Tarefa 8) === */` marker with:

```js
/* === DESEMPENHO (Tarefa 8) === */
function agregarPorAssunto(checkins){
  const map = new Map();
  for(const c of checkins){
    if(!c.assunto || !c.questoes) continue;
    const cur = map.get(c.assunto) || {assunto:c.assunto, questoes:0, acertos:0};
    cur.questoes += c.questoes;
    cur.acertos += c.acertos || 0;
    map.set(c.assunto, cur);
  }
  return [...map.values()].map(x => ({...x, pct: x.questoes ? Math.round((x.acertos/x.questoes)*100) : 0}));
}

function diasEstudados(checkins){
  return checkins.filter(c => c.status !== 'nao').length;
}

function diasDeCiclo(cicloInicioIso, hojeIso){
  const a = new Date(cicloInicioIso + 'T00:00:00');
  const b = new Date(hojeIso + 'T00:00:00');
  return Math.round((b - a) / 86400000) + 1;
}

function piores5(agregado){
  return [...agregado].filter(a => a.questoes > 0).sort((a,b) => a.pct - b.pct).slice(0,5);
}

function barrasSVG(dados){
  const largura = 300, altoLinha = 28, esquerda = 130;
  const altura = dados.length * altoLinha + 10;
  const barras = dados.map((d,i) => {
    const y = i * altoLinha + 4;
    const w = Math.max(2, (largura - esquerda) * (d.pct/100));
    return `
      <text x="0" y="${y+14}" font-size="11" fill="var(--fg)">${d.assunto.slice(0,18)}</text>
      <rect x="${esquerda}" y="${y}" width="${w}" height="16" rx="3" fill="var(--accent)"></rect>
      <text x="${esquerda + w + 6}" y="${y+13}" font-size="11" fill="var(--muted)">${d.pct}%</text>
    `;
  }).join('');
  return `<svg viewBox="0 0 ${largura} ${altura}" width="100%" height="${altura}">${barras}</svg>`;
}

function renderDesempenho(){
  const agregado = agregarPorAssunto(state.checkins);
  const estudados = diasEstudados(state.checkins);
  const ciclo = diasDeCiclo(state.meta.cicloInicio, hojeISO());
  const piores = piores5(agregado);
  return `
    <div class="card">
      <h2>Desempenho</h2>
      <p>${estudados} de ${ciclo} dias do ciclo estudados</p>
    </div>
    <div class="card">
      <h3>% de acerto por assunto</h3>
      ${agregado.length ? barrasSVG(agregado) : '<p class="muted">Sem questões registradas ainda.</p>'}
    </div>
    <div class="card">
      <h3>5 piores assuntos</h3>
      ${piores.length ? piores.map(p=>`<p>${p.assunto} — ${p.pct}%</p>`).join('') : '<p class="muted">Sem dados suficientes.</p>'}
    </div>
  `;
}
```

- [ ] **Step 5: Verify manually in-browser**

On the Hoje tab, use "+ detalhar" to record a check-in with assunto + questões + acertos for two different assuntos (do this on two different simulated days by editing `state.checkins[i].data` via console if needed, since one entry per date). Go to Desempenho tab — confirm bars render proportionally to % de acerto, the worse assunto appears in "5 piores", and "dias estudados / dias de ciclo" shows a sane count. Confirm no horizontal overflow at 390px width (the SVG uses `viewBox` + `width="100%"` so it should scale down).

- [ ] **Step 6: Commit**

```bash
git add index.html
git commit -m "feat: implement Desempenho screen with SVG bar chart"
```

---

## Task 9: Export Markdown, Export JSON, Import JSON

**Files:**
- Modify: `index.html` (marker `/* === EXPORT (Tarefa 9) === */`; add an Export/Import section to `renderHoje()` or a shared header — placed as a small card at the top of the Hoje screen for 1-tap reachability)

**Interfaces:**
- Consumes: `state`, `saveState()`, `agregarPorAssunto`, `diasEstudados`, `diasDeCiclo`, `piores5` (Task 8), `filaRevisao` (Task 5), `state.conteudo` (Task 2), `semanaAtualId()`, `obterPlano(state, semanaId)`, `diasRealizadosNaSemana(checkins, semanaId)`, `horasRealizadasNaSemana(checkins, semanaId)`, `assuntosTocadosNaSemana(state, semanaId)`, `assuntosAtrasadosNaSemana(assuntosAlvo, tocados)` (Task 7).
- Produces: `gerarMarkdownSnapshot(state, hojeIso)`, `baixarArquivo(nome, conteudo, tipo)`, `exportarMarkdown()`, `exportarJSON()`, `importarJSON(texto)`.

- [ ] **Step 1: Write the failing logic test (scratch)**

`.../scratchpad/test-export.mjs`:

```js
import assert from 'node:assert/strict';

function gerarMarkdownSnapshot(state, hojeIso){
  const linhas = [];
  linhas.push(`# Snapshot — ${hojeIso}`);
  linhas.push('');
  linhas.push('## Conteúdo');
  for(const c of state.conteudo){
    linhas.push(`- ${c.assunto}: ${c.status} (${c.concurso})`);
  }
  return linhas.join('\n');
}

const st = { conteudo: [{assunto:'PNRS', status:'estudado', concurso:'ambos'}] };
const md = gerarMarkdownSnapshot(st, '2026-08-15');
assert.ok(md.includes('# Snapshot — 2026-08-15'));
assert.ok(md.includes('PNRS: revisado (ambos)')); // wrong on purpose
console.log('OK');
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `node .../scratchpad/test-export.mjs`
Expected: `AssertionError` — the fixture says `status:'estudado'` but the assertion checks for `revisado`.

- [ ] **Step 3: Fix the assertion and re-run**

Change to `assert.ok(md.includes('PNRS: estudado (ambos)'));`. Re-run.
Expected: prints `OK`, exit code 0.

- [ ] **Step 4: Implement in `index.html`**

Replace `/* === EXPORT (Tarefa 9) === */` marker with:

```js
/* === EXPORT (Tarefa 9) === */
function gerarMarkdownSnapshot(state, hojeIso){
  const agregado = agregarPorAssunto(state.checkins);
  const estudados = diasEstudados(state.checkins);
  const ciclo = diasDeCiclo(state.meta.cicloInicio, hojeIso);
  const piores = piores5(agregado);
  const atrasados = filaRevisao(state.erros, hojeIso);
  const semanaId = semanaAtualId();
  const plano = obterPlano(state, semanaId);
  const diasSemana = diasRealizadosNaSemana(state.checkins, semanaId);
  const horasSemana = horasRealizadasNaSemana(state.checkins, semanaId);
  const tocadosSemana = assuntosTocadosNaSemana(state, semanaId);
  const atrasadosSemana = plano ? assuntosAtrasadosNaSemana(plano.assuntosAlvo, tocadosSemana) : [];

  const linhas = [];
  linhas.push(`# Snapshot — Gerenciador de Estudos — ${hojeIso}`);
  linhas.push('');
  linhas.push(`Dias até a prova (${state.meta.provaData}): ${diasAte(hojeIso, state.meta.provaData)}`);
  linhas.push(`Dias estudados: ${estudados} de ${ciclo} dias de ciclo`);
  linhas.push('');
  linhas.push('## Meta da semana atual');
  linhas.push(plano
    ? [
        `- Dias: ${diasSemana}/${plano.diasAlvo}`,
        `- Horas: ${horasSemana}/${plano.horasAlvo}`,
        `- Assuntos-alvo que ficaram pra trás: ${atrasadosSemana.length ? atrasadosSemana.join(', ') : 'nenhum'}`,
      ].join('\n')
    : '- nenhuma meta definida para esta semana');
  linhas.push('');
  linhas.push('## Fila de revisão atrasada');
  linhas.push(atrasados.length
    ? atrasados.map(e => `- ${e.assunto} (${GRAU_LABEL[e.grau]}, venceu ${e.proximaRevisao})`).join('\n')
    : '- nenhum item atrasado');
  linhas.push('');
  linhas.push('## Mapa de conteúdo');
  linhas.push(state.conteudo.map(c => `- ${c.assunto}: ${STATUS_CONTEUDO_LABEL[c.status]} (${CONCURSO_LABEL[c.concurso]})`).join('\n'));
  linhas.push('');
  linhas.push('## Desempenho por assunto');
  linhas.push(agregado.length
    ? agregado.map(a => `- ${a.assunto}: ${a.pct}% (${a.acertos}/${a.questoes})`).join('\n')
    : '- sem questões registradas ainda');
  linhas.push('');
  linhas.push('## 5 piores assuntos');
  linhas.push(piores.length
    ? piores.map(p => `- ${p.assunto}: ${p.pct}%`).join('\n')
    : '- sem dados suficientes');
  return linhas.join('\n');
}

function baixarArquivo(nome, conteudo, tipo){
  const blob = new Blob([conteudo], {type: tipo});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = nome;
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function exportarMarkdown(){
  baixarArquivo(`estudos-${hojeISO()}.md`, gerarMarkdownSnapshot(state, hojeISO()), 'text/markdown');
}

function exportarJSON(){
  baixarArquivo(`estudos-${hojeISO()}.json`, JSON.stringify(state, null, 2), 'application/json');
}

function importarJSON(texto){
  const parsed = JSON.parse(texto);
  if(!parsed || !Array.isArray(parsed.conteudo) || !Array.isArray(parsed.erros) || !Array.isArray(parsed.checkins)){
    throw new Error('JSON inválido: formato inesperado');
  }
  state = parsed;
  saveState(state);
  return state;
}
```

In `renderHoje()`, add an Export/Import card right after the countdown card:

```js
    <div class="card">
      <button id="btn-export-md">Exportar Markdown</button>
      <button id="btn-export-json">Exportar JSON</button>
      <label>Importar JSON</label>
      <input type="file" id="input-import-json" accept="application/json">
    </div>
```

In `attachHojeHandlers()`, add:

```js
  document.getElementById('btn-export-md')?.addEventListener('click', exportarMarkdown);
  document.getElementById('btn-export-json')?.addEventListener('click', exportarJSON);
  document.getElementById('input-import-json')?.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if(!file) return;
    if(!confirm('Importar vai substituir todos os dados atuais. Continuar?')) { e.target.value=''; return; }
    const reader = new FileReader();
    reader.onload = () => {
      try { importarJSON(reader.result); render(); }
      catch(err){ alert('Falha ao importar: ' + err.message); }
    };
    reader.readAsText(file);
  });
```

- [ ] **Step 5: Verify manually in-browser (round-trip)**

Tap "Exportar Markdown" — confirm a `.md` file downloads and opening it shows the sections (dias até prova, meta da semana, fila atrasada, mapa, desempenho, piores 5) with real current data. Tap "Exportar JSON" — confirm a `.json` file downloads. Add one more erro item (so state changes), then use the file input to import the previously-downloaded JSON — confirm the just-added item disappears (state reverted to the exported snapshot) and all five tabs reflect the imported data after reload.

- [ ] **Step 6: Commit**

```bash
git add index.html
git commit -m "feat: add markdown export and JSON export/import round-trip"
```

---

## Task 10: PWA — manifest, icons, service worker, install/offline

**Files:**
- Create: `manifest.json`
- Create: `sw.js`
- Create: `icons/icon-192.png`
- Create: `icons/icon-512.png`
- Modify: `index.html` (add `<link rel="manifest">` and SW registration script)

**Interfaces:**
- Consumes: nothing from earlier tasks (this task is orthogonal to app logic).
- Produces: installable PWA; no JS functions consumed by other tasks.

- [ ] **Step 1: Generate placeholder icons**

Run (PowerShell, uses built-in System.Drawing, no external deps):

```powershell
Add-Type -AssemblyName System.Drawing
New-Item -ItemType Directory -Force -Path "icons" | Out-Null
function New-Icon($path, $size){
  $bmp = New-Object System.Drawing.Bitmap $size, $size
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.Clear([System.Drawing.Color]::FromArgb(255,79,157,222))
  $font = New-Object System.Drawing.Font "Segoe UI", ([int]($size*0.4)), ([System.Drawing.FontStyle]::Bold)
  $brush = [System.Drawing.Brushes]::White
  $fmt = New-Object System.Drawing.StringFormat
  $fmt.Alignment = [System.Drawing.StringAlignment]::Center
  $fmt.LineAlignment = [System.Drawing.StringAlignment]::Center
  $g.DrawString("GE", $font, $brush, (New-Object System.Drawing.RectangleF 0,0,$size,$size), $fmt)
  $bmp.Save($path, [System.Drawing.Imaging.ImageFormat]::Png)
  $g.Dispose(); $bmp.Dispose()
}
New-Icon "icons/icon-192.png" 192
New-Icon "icons/icon-512.png" 512
```

Expected: `icons/icon-192.png` and `icons/icon-512.png` exist and open as a blue square with "GE" centered.

- [ ] **Step 2: Write `manifest.json`**

```json
{
  "name": "Gerenciador de Estudos",
  "short_name": "Estudos",
  "start_url": "./",
  "scope": "./",
  "display": "standalone",
  "background_color": "#0f1115",
  "theme_color": "#0f1115",
  "icons": [
    { "src": "icons/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "icons/icon-512.png", "sizes": "512x512", "type": "image/png" }
  ]
}
```

- [ ] **Step 3: Write `sw.js`**

```js
const CACHE = 'estudos-v1';
const ARQUIVOS = ['./', './index.html', './manifest.json', './icons/icon-192.png', './icons/icon-512.png'];

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
  event.respondWith(
    caches.match(event.request).then(cached => cached || fetch(event.request))
  );
});
```

- [ ] **Step 4: Wire manifest + registration into `index.html`**

In `<head>`, after `<title>`, add:

```html
<link rel="manifest" href="./manifest.json">
<meta name="theme-color" content="#0f1115">
```

Before the closing `</script>` tag (after `/* === INIT === */`'s `render();` call), add:

```js
if('serviceWorker' in navigator){
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(err => console.warn('SW falhou:', err));
  });
}
```

- [ ] **Step 5: Verify manually, served over http (not file://)**

Start a local static server from the project root: `python -m http.server 8080` (or VS Code Live Server). Open `http://localhost:8080/` in Chrome. Open DevTools → Application tab:
- Confirm "Manifest" shows name "Gerenciador de Estudos" with both icons loading without errors.
- Confirm "Service Workers" shows `sw.js` as activated and running.
- Reload with DevTools' Network tab set to "Offline" — confirm the app still loads and all 5 tabs still work.
- On an Android phone on the same network (or after deploying, in Task 11), open the URL in Chrome, confirm the "Adicionar à tela inicial" / install prompt appears, install it, confirm it opens standalone (no address bar) with the "GE" icon.

- [ ] **Step 6: Commit**

```bash
git add manifest.json sw.js icons/icon-192.png icons/icon-512.png index.html
git commit -m "feat: add PWA manifest, service worker, and icons"
```

---

## Task 11: Publish to GitHub Pages

**Files:** none (deployment steps; requires the user's GitHub account — cannot be done by an automated worker without credentials)

- [ ] **Step 1: Create the GitHub repository**

On github.com, create a new repository (e.g. `gerenciador-de-estudos`). Do not initialize with a README (this repo already has commits).

- [ ] **Step 2: Push the local repository**

```bash
git remote add origin https://github.com/<usuario>/gerenciador-de-estudos.git
git branch -M main
git push -u origin main
```

- [ ] **Step 3: Enable GitHub Pages**

In the repo's Settings → Pages, set Source to "Deploy from a branch", branch `main`, folder `/ (root)`. Save.

- [ ] **Step 4: Confirm the deployed URL works end-to-end**

Wait for the Pages build (Settings → Pages shows the live URL, typically `https://<usuario>.github.io/gerenciador-de-estudos/`). Open it on the Android phone in Chrome:
- Confirm all 5 tabs load and example interactions work (this is the first real data — Export/Import from local testing does NOT carry over automatically; note in the app that this is a fresh `estudos_v1`).
- Confirm DevTools (via `chrome://inspect` from a PC, if available) or the in-page Application tab shows manifest/SW loading correctly under the `/gerenciador-de-estudos/` subpath (this was accounted for in Task 10 via relative `./` paths).
- Confirm the install prompt appears and the installed app opens standalone.

Expected: the app is fully usable and installable at the GitHub Pages URL, matching everything verified locally in Tasks 1–10.

- [ ] **Step 5: No commit needed** (deployment only; Pages serves whatever is on `main`, already committed in prior tasks).

---

## Self-Review Notes

- **Spec coverage:** Contexto/Restrições → Global Constraints; Arquitetura → Task 1/2; Modelo de dados (incl. `atualizadoEm`, `planejamento`) → Task 2, stamped in Task 6; Regra de repetição espaçada → Task 4; Planejamento semanal (meta x realizado) → Task 7; Telas 1–5 (Hoje, Erros, Mapa, Semana, Desempenho) → Tasks 3, 4+5, 6, 7, 8; Export/Import (incl. weekly section in the markdown snapshot) → Task 9; PWA → Task 10; Publicação → Task 11; Testes section → covered per-task by the manual verification steps plus scratch Node tests for all pure logic, including the new week-boundary math in Task 7.
- **Placeholder scan:** no TBD/TODO; every step has runnable code or exact manual actions.
- **Type consistency:** `state.erros[].grau` values (`erro_novo`/`reforcado`/`corrigido`/`deficiencia`) and `state.conteudo[].status` (`nao_iniciado`/`estudado`/`revisado`/`dominado`) are used identically across Tasks 2, 4, 5, 6, 9. `state.planejamento[].semanaId` (Monday date) is produced by `segundaFeiraDaSemana`/`semanaAtualId` (Tasks 2/7) and consumed with matching format by Task 9's markdown export. Function names introduced in one task (`ordenarErrosPorRevisao`, `cardErro`, `filaRevisao`, `agregarPorAssunto`, `obterPlano`, `assuntosAtrasadosNaSemana`, etc.) are reused with matching signatures by every later task that needs them.
