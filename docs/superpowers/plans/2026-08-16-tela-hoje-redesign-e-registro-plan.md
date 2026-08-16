# Tela Hoje — Redesign e Registro Funcional — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the Hoje screen from a check-in form into the daily operating console: show what to
study today, let the user register real study activity (manually or via a persisted timer) split
by type (Questões/Teoria/Revisão/Anki), and have that data automatically roll up into Hoje's own
summary, Dashboard, and Desempenho — without breaking the existing data model, backup format, or
any other screen's business logic.

**Architecture:** Same single `index.html`, no build step, no new external dependency. A new
additive data structure (`state.sessoes`, `state.sessaoEmAndamento`) sits alongside the existing
`state.checkins` (unchanged) — sessions accumulate their minutes into today's checkin (which every
existing time/streak aggregate already reads), and only the per-subject breakdown functions
(`agregarPorAssunto`, `evolucaoSemanal`, `assuntosTocadosNaSemana`) are extended to also read
`state.sessoes`, so Dashboard/Desempenho pick up the new data with a one-line call-site change each
— their own render logic is otherwise untouched.

**Tech Stack:** Vanilla HTML/CSS/JS, `localStorage`, same design tokens/CSS already in the file
(sidebar/topbar shell and component classes from the prior redesign round).

**Spec:** `docs/superpowers/specs/2026-08-16-tela-hoje-redesign-e-registro-design.md` (this round).
Original data-model spec (`docs/superpowers/specs/2026-08-15-gerenciador-de-estudos-design.md`) and
the prior visual-redesign spec (`docs/superpowers/specs/2026-08-15-gerenciador-de-estudos-redesign-design.md`)
still govern anything this round doesn't touch.

## Global Constraints

- No build step, no framework, no npm.
- `localStorage` key (`estudos_v1`), `estadoValido()`'s required shape, and the JSON backup format
  do not change. Old exports (without `sessoes`/`sessaoEmAndamento`) must keep importing
  correctly — both new fields are read as optional and defaulted, never required.
- Do not change `registrarCheckin`, `checkinDeHoje`, `filaRevisao`, `cardErro`, spaced-repetition
  logic (`graduarAcerto`/`graduarErro`/`GRAU_*`), Mapa's status/concurso cycling, or the
  "Fechamento do dia" checkin flow (3 buttons + `<details>` detail form) — all preserved exactly,
  same field names/ids, so existing behavior and existing records keep working.
- Do not restructure `renderScreen()`'s map/if-chain beyond what's already wired for `hoje` — this
  round only touches `renderHoje()`/`attachHojeHandlers()`'s bodies and a handful of shared
  aggregate functions' signatures.
- Every new touch target (`button`) must be ≥44px tall, matching the existing design system
  (`.activity-action` already set to `min-height:44px` in the CSS added this round).
- Single accent color: any new highlight reuses `var(--accent)`/existing classes (`.card`,
  `button.primary`, `.status-pill.concluida` uses `var(--ok)`, `.status-pill.atrasada` uses
  `var(--bad)` — both already existing tokens, no new hardcoded colors).
- No test framework (matches the rest of the project). New pure functions are developed test-first
  via a scratch Node script in the scratchpad directory, run and verified, then transplanted —
  never committed.
- **CSS already added this session:** the `<style>` block already contains a
  `/* === HOJE (redesign) === */` section with `.hoje-header`, `.hoje-progress-label`, `.hero-card`,
  `.status-pill` (+ `.pendente`/`.atrasada`/`.concluida`), `.activity-list`/`.activity-item`
  (+ `.activity-info`/`.activity-title`/`.activity-meta`/`.activity-action`), `.empty-state`,
  `.summary-strip` (+ `.summary-item`/`.summary-value`/`.summary-label`), and `.grid-hoje`.
  **Task 3 must NOT re-add this CSS** — just reuse the class names below. The block also currently
  has an unused `.highlight-pulse`/`@keyframes pulseBorder` pair (added speculatively before the
  timer design was finalized, never applied by any task in this plan) — **Task 4 removes it** while
  adding its own two small new rules (`.timer-display`, `.hero-card .row`).

---

## Task 1: Data model — sessões, sessão em andamento, backward-compatible load/import

**Files:**
- Modify: `index.html` (`seedState()`, `loadState()`, `importarJSON()`, new
  `/* === HOJE (redesign — sessões) === */` section with new pure functions, placed right after
  the existing `checkinDeHoje()` function and before `/* === ERROS (Tarefa 4) === */`)
- Test: scratch Node script in the scratchpad directory (not committed)

**Interfaces:**
- Consumes: `hojeISO` (existing, unchanged).
- Produces: `calcularErros(questoes, acertos)`, `calcularAproveitamento(questoes, acertos)`,
  `criarSessao({data, tipo, assunto, minutos, questoes, acertos, paginas, concluida, dificuldade, cartoes, obs})`,
  `acumularMinutosHoje(state, hojeIso, minutos)`, `registrarSessao(state, hojeIso, dados)`,
  `iniciarSessaoEmAndamento(state, {assunto, tipo, origem})`, `finalizarSessaoEmAndamento(state)`,
  `normalizarCamposNovos(s)`. All consumed by Tasks 2–4. `state.sessoes`/`state.sessaoEmAndamento`
  become part of `state`'s shape from this task on (both optional/defaulted, never required by
  `estadoValido`).

- [ ] **Step 1: Write and run the failing tests for the new pure functions**

Create `<scratchpad>/sessoes-fns.test.mjs`:
```js
import assert from 'node:assert';

function calcularErros(questoes, acertos){
  if(questoes == null || acertos == null) return null;
  return Math.max(0, questoes - acertos);
}
function calcularAproveitamento(questoes, acertos){
  if(!questoes) return null;
  return Math.round(((acertos||0) / questoes) * 100);
}
function criarSessao({data, tipo, assunto, minutos, questoes, acertos, paginas, concluida, dificuldade, cartoes, obs}){
  return {
    id: String(Date.now()) + Math.random().toString(36).slice(2,7),
    data, tipo, assunto: assunto || null, minutos: Number(minutos) || 0,
    questoes: tipo === 'questoes' ? (Number(questoes) || 0) : null,
    acertos: tipo === 'questoes' ? (Number(acertos) || 0) : null,
    paginas: tipo === 'teoria' && paginas ? Number(paginas) : null,
    concluida: tipo === 'teoria' ? !!concluida : null,
    dificuldade: tipo === 'revisao' ? (dificuldade || null) : null,
    cartoes: tipo === 'anki' && cartoes ? Number(cartoes) : null,
    obs: obs || '',
    criadoEm: new Date().toISOString(),
  };
}
function acumularMinutosHoje(state, hojeIso, minutos){
  let ci = state.checkins.find(c => c.data === hojeIso);
  if(!ci){
    ci = { data: hojeIso, status: null, minutos: 0, assunto: null, questoes: null, acertos: null, obs: '' };
    state.checkins.push(ci);
  }
  ci.minutos = (ci.minutos || 0) + minutos;
  return ci;
}
function registrarSessao(state, hojeIso, dados){
  const sessao = criarSessao({data: hojeIso, ...dados});
  state.sessoes.push(sessao);
  acumularMinutosHoje(state, hojeIso, sessao.minutos);
  return sessao;
}
function iniciarSessaoEmAndamento(state, {assunto, tipo, origem}){
  state.sessaoEmAndamento = { assunto: assunto || null, tipo: tipo || null, origem: origem || null, inicioEm: new Date().toISOString() };
  return state.sessaoEmAndamento;
}
function finalizarSessaoEmAndamento(state){
  const sessao = state.sessaoEmAndamento;
  if(!sessao) return null;
  const minutos = Math.max(1, Math.round((Date.now() - new Date(sessao.inicioEm).getTime()) / 60000));
  state.sessaoEmAndamento = null;
  return { assunto: sessao.assunto, tipo: sessao.tipo, origem: sessao.origem, minutos };
}
function normalizarCamposNovos(s){
  if(!Array.isArray(s.sessoes)) s.sessoes = [];
  if(!s.sessaoEmAndamento || typeof s.sessaoEmAndamento !== 'object') s.sessaoEmAndamento = null;
  return s;
}

// calcularErros / calcularAproveitamento
assert.strictEqual(calcularErros(30, 24), 6);
assert.strictEqual(calcularErros(null, 24), null);
assert.strictEqual(calcularAproveitamento(30, 24), 80);
assert.strictEqual(calcularAproveitamento(0, 0), null, 'sem questoes -> null, nao 0/0');

// criarSessao: tipo=questoes only fills questoes/acertos, other type fields stay null
{
  const s = criarSessao({data:'2026-08-16', tipo:'questoes', assunto:'PNMA', minutos:30, questoes:10, acertos:8, obs:''});
  assert.strictEqual(s.questoes, 10);
  assert.strictEqual(s.acertos, 8);
  assert.strictEqual(s.paginas, null);
  assert.strictEqual(s.concluida, null);
  assert.strictEqual(s.dificuldade, null);
  assert.strictEqual(s.cartoes, null);
  assert.strictEqual(s.data, '2026-08-16');
}
// criarSessao: tipo=teoria only fills paginas/concluida
{
  const s = criarSessao({data:'2026-08-16', tipo:'teoria', assunto:'LC 140/2011', minutos:45, paginas:12, concluida:true});
  assert.strictEqual(s.questoes, null);
  assert.strictEqual(s.paginas, 12);
  assert.strictEqual(s.concluida, true);
}
// criarSessao: tipo=revisao only fills dificuldade
{
  const s = criarSessao({data:'2026-08-16', tipo:'revisao', assunto:'SNUC', minutos:20, dificuldade:'media'});
  assert.strictEqual(s.dificuldade, 'media');
  assert.strictEqual(s.paginas, null);
}
// criarSessao: tipo=anki only fills cartoes
{
  const s = criarSessao({data:'2026-08-16', tipo:'anki', assunto:null, minutos:10, cartoes:50});
  assert.strictEqual(s.cartoes, 50);
  assert.strictEqual(s.assunto, null);
}

// acumularMinutosHoje: creates the day's checkin if missing
{
  const state = { checkins: [] };
  const ci = acumularMinutosHoje(state, '2026-08-16', 30);
  assert.strictEqual(state.checkins.length, 1);
  assert.strictEqual(ci.minutos, 30);
  assert.strictEqual(ci.status, null, 'no Fechamento status chosen yet');
}
// acumularMinutosHoje: adds to an existing checkin without touching its status
{
  const state = { checkins: [{data:'2026-08-16', status:'base', minutos:150, assunto:null, questoes:null, acertos:null, obs:''}] };
  const ci = acumularMinutosHoje(state, '2026-08-16', 20);
  assert.strictEqual(state.checkins.length, 1, 'no duplicate row');
  assert.strictEqual(ci.minutos, 170);
  assert.strictEqual(ci.status, 'base', 'existing Fechamento status preserved');
}

// registrarSessao: pushes to sessoes AND accumulates checkin minutes
{
  const state = { checkins: [], sessoes: [] };
  const sessao = registrarSessao(state, '2026-08-16', {tipo:'questoes', assunto:'PNMA', minutos:30, questoes:10, acertos:8, obs:''});
  assert.strictEqual(state.sessoes.length, 1);
  assert.strictEqual(state.sessoes[0].id, sessao.id);
  assert.strictEqual(state.checkins[0].minutos, 30);
}

// iniciarSessaoEmAndamento / finalizarSessaoEmAndamento
{
  const state = { sessaoEmAndamento: null };
  iniciarSessaoEmAndamento(state, {assunto:'PNMA', tipo:'questoes', origem:'plano'});
  assert.ok(state.sessaoEmAndamento);
  assert.strictEqual(state.sessaoEmAndamento.assunto, 'PNMA');
  // simulate 5 minutes elapsed by rewriting inicioEm into the past
  state.sessaoEmAndamento.inicioEm = new Date(Date.now() - 5*60000).toISOString();
  const resultado = finalizarSessaoEmAndamento(state);
  assert.strictEqual(state.sessaoEmAndamento, null, 'cleared after finalizing');
  assert.strictEqual(resultado.assunto, 'PNMA');
  assert.ok(resultado.minutos >= 4 && resultado.minutos <= 6, `esperado ~5min, veio ${resultado.minutos}`);
}
{
  const state = { sessaoEmAndamento: null };
  assert.strictEqual(finalizarSessaoEmAndamento(state), null, 'nada pra finalizar -> null');
}

// normalizarCamposNovos: defaults missing fields, preserves existing ones
{
  const semCampos = { checkins: [], erros: [], conteudo: [], planejamento: [] };
  normalizarCamposNovos(semCampos);
  assert.deepStrictEqual(semCampos.sessoes, []);
  assert.strictEqual(semCampos.sessaoEmAndamento, null);
}
{
  const comCampos = { sessoes: [{id:'x'}], sessaoEmAndamento: {assunto:'PNMA'} };
  normalizarCamposNovos(comCampos);
  assert.strictEqual(comCampos.sessoes.length, 1, 'preserved, not reset');
  assert.strictEqual(comCampos.sessaoEmAndamento.assunto, 'PNMA', 'preserved, not reset');
}

console.log('All sessoes-fns assertions passed');
```

- [ ] **Step 2: Run it, confirm it passes on this reference implementation**

Run: `node <scratchpad>/sessoes-fns.test.mjs`
Expected: `All sessoes-fns assertions passed`.

- [ ] **Step 3: Add `sessoes`/`sessaoEmAndamento` to `seedState()`**

In `index.html`, find:
```js
  function seedState(){
    return {
      meta: { provaData: '2026-11-29', cicloInicio: hojeISO() },
      checkins: [],
      erros: [],
      conteudo: SEED_CONTEUDO.map(assunto => ({ assunto, status:'nao_iniciado', concurso:'ambos', atualizadoEm: hojeISO() })),
      planejamento: [],
    };
  }
```
Replace with:
```js
  function seedState(){
    return {
      meta: { provaData: '2026-11-29', cicloInicio: hojeISO() },
      checkins: [],
      erros: [],
      conteudo: SEED_CONTEUDO.map(assunto => ({ assunto, status:'nao_iniciado', concurso:'ambos', atualizadoEm: hojeISO() })),
      planejamento: [],
      sessoes: [],
      sessaoEmAndamento: null,
    };
  }
```

- [ ] **Step 4: Add the new pure functions right after `checkinDeHoje()`**

Find:
```js
  function checkinDeHoje(){
    return state.checkins.find(c => c.data === hojeISO());
  }

  /* === ERROS (Tarefa 4) === */
```
Replace with (same two lines, plus the new section inserted between them):
```js
  function checkinDeHoje(){
    return state.checkins.find(c => c.data === hojeISO());
  }

  /* === HOJE (redesign — sessões) === */
  function calcularErros(questoes, acertos){
    if(questoes == null || acertos == null) return null;
    return Math.max(0, questoes - acertos);
  }
  function calcularAproveitamento(questoes, acertos){
    if(!questoes) return null;
    return Math.round(((acertos||0) / questoes) * 100);
  }
  function criarSessao({data, tipo, assunto, minutos, questoes, acertos, paginas, concluida, dificuldade, cartoes, obs}){
    return {
      id: String(Date.now()) + Math.random().toString(36).slice(2,7),
      data, tipo, assunto: assunto || null, minutos: Number(minutos) || 0,
      questoes: tipo === 'questoes' ? (Number(questoes) || 0) : null,
      acertos: tipo === 'questoes' ? (Number(acertos) || 0) : null,
      paginas: tipo === 'teoria' && paginas ? Number(paginas) : null,
      concluida: tipo === 'teoria' ? !!concluida : null,
      dificuldade: tipo === 'revisao' ? (dificuldade || null) : null,
      cartoes: tipo === 'anki' && cartoes ? Number(cartoes) : null,
      obs: obs || '',
      criadoEm: new Date().toISOString(),
    };
  }
  function acumularMinutosHoje(state, hojeIso, minutos){
    let ci = state.checkins.find(c => c.data === hojeIso);
    if(!ci){
      ci = { data: hojeIso, status: null, minutos: 0, assunto: null, questoes: null, acertos: null, obs: '' };
      state.checkins.push(ci);
    }
    ci.minutos = (ci.minutos || 0) + minutos;
    return ci;
  }
  function registrarSessao(state, hojeIso, dados){
    const sessao = criarSessao({data: hojeIso, ...dados});
    state.sessoes.push(sessao);
    acumularMinutosHoje(state, hojeIso, sessao.minutos);
    return sessao;
  }
  function iniciarSessaoEmAndamento(state, {assunto, tipo, origem}){
    state.sessaoEmAndamento = { assunto: assunto || null, tipo: tipo || null, origem: origem || null, inicioEm: new Date().toISOString() };
    return state.sessaoEmAndamento;
  }
  function finalizarSessaoEmAndamento(state){
    const sessao = state.sessaoEmAndamento;
    if(!sessao) return null;
    const minutos = Math.max(1, Math.round((Date.now() - new Date(sessao.inicioEm).getTime()) / 60000));
    state.sessaoEmAndamento = null;
    return { assunto: sessao.assunto, tipo: sessao.tipo, origem: sessao.origem, minutos };
  }
  function normalizarCamposNovos(s){
    if(!Array.isArray(s.sessoes)) s.sessoes = [];
    if(!s.sessaoEmAndamento || typeof s.sessaoEmAndamento !== 'object') s.sessaoEmAndamento = null;
    return s;
  }

  /* === ERROS (Tarefa 4) === */
```

- [ ] **Step 5: Normalize on load and on import**

Find:
```js
  function loadState(){
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if(!raw) return seedState();
      const parsed = JSON.parse(raw);
      if(!estadoValido(parsed)) return seedState();
      return parsed;
    } catch(e){
      return seedState();
    }
  }
```
Replace with:
```js
  function loadState(){
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if(!raw) return seedState();
      const parsed = JSON.parse(raw);
      if(!estadoValido(parsed)) return seedState();
      return normalizarCamposNovos(parsed);
    } catch(e){
      return seedState();
    }
  }
```
Find:
```js
  function importarJSON(texto){
    const parsed = JSON.parse(texto);
    if(!estadoValido(parsed)){
      throw new Error('JSON inválido: formato inesperado');
    }
    state = parsed;
    saveState(state);
    return state;
  }
```
Replace with:
```js
  function importarJSON(texto){
    const parsed = JSON.parse(texto);
    if(!estadoValido(parsed)){
      throw new Error('JSON inválido: formato inesperado');
    }
    state = normalizarCamposNovos(parsed);
    saveState(state);
    return state;
  }
```
Do **not** touch `estadoValido()` itself — it must keep validating old backups (without
`sessoes`/`sessaoEmAndamento`) as valid. `normalizarCamposNovos` is defined later in the file
(Step 4) but that's fine: both call sites only *invoke* it at runtime, after the whole script has
parsed (function declarations are hoisted).

- [ ] **Step 6: Static verification**

Run: `node -e "new Function(require('fs').readFileSync('index.html','utf8').match(/<script>([\s\S]*)<\/script>/)[1])"` —
expect no error. Grep `index.html` for `sessaoEmAndamento` and confirm it appears in exactly:
`seedState`, `normalizarCamposNovos`, `iniciarSessaoEmAndamento`, `finalizarSessaoEmAndamento` (this
task only touches these — Task 4 adds the UI that reads it).

- [ ] **Step 7: Commit**

```bash
git add index.html
git commit -m "feat(hoje): add sessoes/sessaoEmAndamento data model with backward-compatible load/import"
```

---

## Task 2: Extend shared aggregate functions to read `state.sessoes`

**Files:**
- Modify: `index.html` (`agregarPorAssunto`, `assuntosTocadosNaSemana`, `evolucaoSemanal`, and their
  5 call sites)
- Test: scratch Node script in the scratchpad directory (not committed)

**Interfaces:**
- Consumes: `state.sessoes` (Task 1).
- Produces: `agregarPorAssunto(checkins, sessoes = [])` (signature change — 2nd param added,
  defaulted so any caller that forgets it still gets the old, checkins-only behavior),
  `assuntosTocadosNaSemana(state, semanaId)` (same signature, now also reads `state.sessoes` when
  present — no call site needs to change), `evolucaoSemanal(checkins, sessoes = [], hojeIso, numSemanas)`
  (signature change — `sessoes` inserted as 2nd positional param). Consumed by Task 3
  (`atividadesPlanoDoDia` calls `assuntosTocadosNaSemana`) and by Dashboard/Desempenho's existing
  call sites, updated in this task.

- [ ] **Step 1: Write and run the failing tests**

Create `<scratchpad>/agregados-sessoes.test.mjs`:
```js
import assert from 'node:assert';

function dentroDaSemana(dataIso, semanaId){
  function addDays(iso, n){ const d = new Date(iso+'T00:00:00'); d.setDate(d.getDate()+n); return d.toISOString().slice(0,10); }
  return dataIso >= semanaId && dataIso <= addDays(semanaId, 6);
}
function segundaFeiraDaSemana(iso){
  const d = new Date(iso + 'T00:00:00');
  const diaSemana = d.getDay();
  const offset = diaSemana === 0 ? -6 : 1 - diaSemana;
  d.setDate(d.getDate() + offset);
  return d.toISOString().slice(0,10);
}
function addDays(iso, n){ const d = new Date(iso+'T00:00:00'); d.setDate(d.getDate()+n); return d.toISOString().slice(0,10); }

function agregarPorAssunto(checkins, sessoes = []){
  const map = new Map();
  for(const c of checkins){
    if(!c.assunto || !c.questoes) continue;
    const cur = map.get(c.assunto) || {assunto:c.assunto, questoes:0, acertos:0};
    cur.questoes += c.questoes;
    cur.acertos += c.acertos || 0;
    map.set(c.assunto, cur);
  }
  for(const s of sessoes){
    if(s.tipo !== 'questoes' || !s.assunto || !s.questoes) continue;
    const cur = map.get(s.assunto) || {assunto:s.assunto, questoes:0, acertos:0};
    cur.questoes += s.questoes;
    cur.acertos += s.acertos || 0;
    map.set(s.assunto, cur);
  }
  return [...map.values()].map(x => ({...x, pct: x.questoes ? Math.round((x.acertos/x.questoes)*100) : 0}));
}

function assuntosTocadosNaSemana(state, semanaId){
  const doCheckin = state.checkins
    .filter(c => dentroDaSemana(c.data, semanaId) && c.assunto)
    .map(c => c.assunto);
  const doMapa = state.conteudo
    .filter(c => c.atualizadoEm && dentroDaSemana(c.atualizadoEm, semanaId))
    .map(c => c.assunto);
  const doSessoes = (state.sessoes || [])
    .filter(s => dentroDaSemana(s.data, semanaId) && s.assunto)
    .map(s => s.assunto);
  return [...new Set([...doCheckin, ...doMapa, ...doSessoes])];
}

function evolucaoSemanal(checkins, sessoes = [], hojeIso, numSemanas){
  const semanaFim = segundaFeiraDaSemana(hojeIso);
  const buckets = [];
  for(let i = numSemanas - 1; i >= 0; i--){
    const semanaId = addDays(semanaFim, -7*i);
    const fimSemana = addDays(semanaId, 6);
    const doSemanaCheckins = checkins.filter(c => c.data >= semanaId && c.data <= fimSemana && c.questoes);
    const doSemanaSessoes = sessoes.filter(s => s.tipo === 'questoes' && s.data >= semanaId && s.data <= fimSemana && s.questoes);
    const questoes = doSemanaCheckins.reduce((s,c) => s + c.questoes, 0) + doSemanaSessoes.reduce((s,x) => s + x.questoes, 0);
    const acertos = doSemanaCheckins.reduce((s,c) => s + (c.acertos||0), 0) + doSemanaSessoes.reduce((s,x) => s + (x.acertos||0), 0);
    buckets.push({ semanaId, pct: questoes ? Math.round((acertos/questoes)*100) : null });
  }
  return buckets;
}

// agregarPorAssunto: old behavior preserved when sessoes omitted/empty (regression)
assert.deepStrictEqual(
  agregarPorAssunto([{assunto:'PNMA', questoes:10, acertos:8}]),
  [{assunto:'PNMA', questoes:10, acertos:8, pct:80}]
);
// agregarPorAssunto: sessoes merge into the same assunto bucket
{
  const r = agregarPorAssunto(
    [{assunto:'PNMA', questoes:10, acertos:8}],
    [{tipo:'questoes', assunto:'PNMA', questoes:5, acertos:5}, {tipo:'teoria', assunto:'LC 140/2011', minutos:30}]
  );
  assert.strictEqual(r.length, 1, 'teoria session does not create a questoes bucket');
  assert.strictEqual(r[0].questoes, 15);
  assert.strictEqual(r[0].acertos, 13);
}

// assuntosTocadosNaSemana: sessoes count as tocado, alongside existing checkin/mapa sources
{
  const state = {
    checkins: [],
    conteudo: [],
    sessoes: [{data:'2026-08-16', assunto:'PNMA'}],
  };
  const r = assuntosTocadosNaSemana(state, '2026-08-10'); // segunda da semana que contem 2026-08-16
  assert.deepStrictEqual(r, ['PNMA']);
}
// assuntosTocadosNaSemana: missing sessoes array doesn't throw (defensive default)
{
  const state = { checkins: [], conteudo: [] };
  assert.deepStrictEqual(assuntosTocadosNaSemana(state, '2026-08-10'), []);
}

// evolucaoSemanal: merges checkins + sessoes per week bucket
{
  const checkins = [{data:'2026-08-17', questoes:10, acertos:5}];
  const sessoes = [{tipo:'questoes', data:'2026-08-18', questoes:10, acertos:9}];
  const evo = evolucaoSemanal(checkins, sessoes, '2026-08-17', 1);
  assert.strictEqual(evo.length, 1);
  assert.strictEqual(evo[0].pct, 70, '20 questoes, 14 acertos -> 70%');
}
// evolucaoSemanal: sessoes defaults to [] (regression, old 3-arg call shape still works if caller passes hojeIso in slot 2... note: signature now REQUIRES sessoes in position 2, this only checks the default kicks in when [] is passed explicitly)
{
  const evo = evolucaoSemanal([{data:'2026-08-17', questoes:10, acertos:5}], [], '2026-08-17', 1);
  assert.strictEqual(evo[0].pct, 50);
}

console.log('All agregados-sessoes assertions passed');
```

- [ ] **Step 2: Run it, confirm it passes**

Run: `node <scratchpad>/agregados-sessoes.test.mjs`
Expected: `All agregados-sessoes assertions passed`.

- [ ] **Step 3: Update `agregarPorAssunto`**

Find:
```js
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
```
Replace with:
```js
  function agregarPorAssunto(checkins, sessoes = []){
    const map = new Map();
    for(const c of checkins){
      if(!c.assunto || !c.questoes) continue;
      const cur = map.get(c.assunto) || {assunto:c.assunto, questoes:0, acertos:0};
      cur.questoes += c.questoes;
      cur.acertos += c.acertos || 0;
      map.set(c.assunto, cur);
    }
    for(const s of sessoes){
      if(s.tipo !== 'questoes' || !s.assunto || !s.questoes) continue;
      const cur = map.get(s.assunto) || {assunto:s.assunto, questoes:0, acertos:0};
      cur.questoes += s.questoes;
      cur.acertos += s.acertos || 0;
      map.set(s.assunto, cur);
    }
    return [...map.values()].map(x => ({...x, pct: x.questoes ? Math.round((x.acertos/x.questoes)*100) : 0}));
  }
```

- [ ] **Step 4: Update `assuntosTocadosNaSemana`**

Find:
```js
  function assuntosTocadosNaSemana(state, semanaId){
    const doCheckin = state.checkins
      .filter(c => dentroDaSemana(c.data, semanaId) && c.assunto)
      .map(c => c.assunto);
    const doMapa = state.conteudo
      .filter(c => c.atualizadoEm && dentroDaSemana(c.atualizadoEm, semanaId))
      .map(c => c.assunto);
    return [...new Set([...doCheckin, ...doMapa])];
  }
```
Replace with:
```js
  function assuntosTocadosNaSemana(state, semanaId){
    const doCheckin = state.checkins
      .filter(c => dentroDaSemana(c.data, semanaId) && c.assunto)
      .map(c => c.assunto);
    const doMapa = state.conteudo
      .filter(c => c.atualizadoEm && dentroDaSemana(c.atualizadoEm, semanaId))
      .map(c => c.assunto);
    const doSessoes = (state.sessoes || [])
      .filter(s => dentroDaSemana(s.data, semanaId) && s.assunto)
      .map(s => s.assunto);
    return [...new Set([...doCheckin, ...doMapa, ...doSessoes])];
  }
```

- [ ] **Step 5: Update `evolucaoSemanal` and its one call site**

Find:
```js
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
```
Replace with:
```js
  function evolucaoSemanal(checkins, sessoes = [], hojeIso, numSemanas){
    const semanaFim = segundaFeiraDaSemana(hojeIso);
    const buckets = [];
    for(let i = numSemanas - 1; i >= 0; i--){
      const semanaId = addDays(semanaFim, -7*i);
      const fimSemana = addDays(semanaId, 6);
      const doSemanaCheckins = checkins.filter(c => c.data >= semanaId && c.data <= fimSemana && c.questoes);
      const doSemanaSessoes = sessoes.filter(s => s.tipo === 'questoes' && s.data >= semanaId && s.data <= fimSemana && s.questoes);
      const questoes = doSemanaCheckins.reduce((s,c) => s + c.questoes, 0) + doSemanaSessoes.reduce((s,x) => s + x.questoes, 0);
      const acertos = doSemanaCheckins.reduce((s,c) => s + (c.acertos||0), 0) + doSemanaSessoes.reduce((s,x) => s + (x.acertos||0), 0);
      buckets.push({ semanaId, pct: questoes ? Math.round((acertos/questoes)*100) : null });
    }
    return buckets;
  }
```
Its one call site, inside `attachDesempenhoHandlers()`, currently reads:
```js
    const evolucao = evolucaoSemanal(state.checkins, hojeISO(), 12);
```
Replace with:
```js
    const evolucao = evolucaoSemanal(state.checkins, state.sessoes, hojeISO(), 12);
```

- [ ] **Step 6: Update `agregarPorAssunto`'s 4 call sites**

All 4 currently read `agregarPorAssunto(state.checkins)`. Change each to
`agregarPorAssunto(state.checkins, state.sessoes)`:
1. Inside `gerarMarkdownSnapshot(state, hojeIso)`: `const agregado = agregarPorAssunto(state.checkins);`
2. Inside `renderDashboard()`: `const agregado = agregarPorAssunto(state.checkins);`
3. Inside `renderDesempenho()`: `const agregado = agregarPorAssunto(state.checkins);`
4. Inside `attachDesempenhoHandlers()`: `const agregado = agregarPorAssunto(state.checkins);`

Each becomes `const agregado = agregarPorAssunto(state.checkins, state.sessoes);` — same line,
only the call changes, nothing else on that line. Since the literal text
`const agregado = agregarPorAssunto(state.checkins);` appears 4 times, replace all 4 occurrences
(use replace-all, or edit each by its surrounding function for precision).

- [ ] **Step 7: Static verification**

Run the syntax check from Task 1 Step 6. Grep for `agregarPorAssunto(state.checkins)` (without a
second argument) and confirm **zero** remaining matches — all 4 call sites must now pass
`state.sessoes` too. Grep for `evolucaoSemanal(state.checkins, hojeISO()` and confirm zero matches
(old 3-arg call shape gone).

- [ ] **Step 8: Commit**

```bash
git add index.html
git commit -m "feat(hoje): extend agregarPorAssunto/assuntosTocadosNaSemana/evolucaoSemanal to read sessoes"
```

---

## Task 3: Hoje screen — new layout + manual activity registration (no timer yet)

**Files:**
- Modify: `index.html` (`renderHoje()` full rewrite, `attachHojeHandlers()` full rewrite, 3 new
  pure functions in the Hoje section, 2 new module-level `let` UI-state variables, 2 new small DOM
  helper functions)
- Test: scratch Node script in the scratchpad directory (not committed)

**Interfaces:**
- Consumes: `atividadesPlanoDoDia`/`proximaAtividadeDoDia`/`formatarDataExtenso` (new, this task),
  `registrarSessao`/`calcularErros`/`calcularAproveitamento` (Task 1), `assuntosTocadosNaSemana`
  (Task 2, now sessão-aware), `obterPlano`/`assuntosAtrasadosNaSemana`/`semanaAtualId`/`filaRevisao`/
  `cardErro`/`checkinDeHoje`/`registrarCheckin`/`horasNoDia`/`diasAte`/`escapeHtml`/`GRAU_LABEL`/
  `STATUS_CONTEUDO_LABEL`/`CONCURSO_LABEL` (all existing, unchanged).
- Produces: `atividadesPlanoDoDia(plano, conteudo, checkins, sessoes, hojeIso)`,
  `proximaAtividadeDoDia(atividades, filaErros)`, `formatarDataExtenso(iso)` (all pure, no DOM —
  Task 4 reuses `atividadesPlanoDoDia`'s output shape unchanged). `let registroAberto = null;` and
  `let timerIntervalId = null;` (Task 4 uses both — `registroAberto` to open the registration form
  pre-filled after a timer finishes, `timerIntervalId` to manage its own separate `setInterval`).
  `atualizarCamposPorTipo(tipo)` and `atualizarCalculoQuestoes()` (DOM helpers, Task 4 does not need
  to call these directly — they're wired once in `attachHojeHandlers()`).
- **Does not** add "Iniciar" (timer) buttons yet — every activity's action button in this task is
  "Registrar" only (manual entry). Task 4 adds a second "Iniciar" button next to it. This is an
  intentional interim state, same pattern the prior redesign round used between its own tasks —
  fully functional and independently useful on its own (manual registration works end to end).

- [ ] **Step 1: Write and run the failing tests for the 3 new pure functions**

Create `<scratchpad>/hoje-fns.test.mjs`:
```js
import assert from 'node:assert';

function addDays(iso, n){ const d = new Date(iso+'T00:00:00'); d.setDate(d.getDate()+n); return d.toISOString().slice(0,10); }
function segundaFeiraDaSemana(iso){
  const d = new Date(iso + 'T00:00:00');
  const diaSemana = d.getDay();
  const offset = diaSemana === 0 ? -6 : 1 - diaSemana;
  d.setDate(d.getDate() + offset);
  return d.toISOString().slice(0,10);
}
function dentroDaSemana(dataIso, semanaId){ return dataIso >= semanaId && dataIso <= addDays(semanaId, 6); }
function assuntosTocadosNaSemana(state, semanaId){
  const doCheckin = state.checkins.filter(c => dentroDaSemana(c.data, semanaId) && c.assunto).map(c => c.assunto);
  const doMapa = state.conteudo.filter(c => c.atualizadoEm && dentroDaSemana(c.atualizadoEm, semanaId)).map(c => c.assunto);
  const doSessoes = (state.sessoes || []).filter(s => dentroDaSemana(s.data, semanaId) && s.assunto).map(s => s.assunto);
  return [...new Set([...doCheckin, ...doMapa, ...doSessoes])];
}
function assuntosAtrasadosNaSemana(assuntosAlvo, tocados){ return assuntosAlvo.filter(a => !tocados.includes(a)); }
const STATUS_CONTEUDO_LABEL = { nao_iniciado:'não iniciado', estudado:'estudado', revisado:'revisado', dominado:'dominado' };
const CONCURSO_LABEL = { ambos:'Transpetro + INEA', transpetro:'Transpetro', inea:'INEA' };

function atividadesPlanoDoDia(plano, conteudo, checkins, sessoes, hojeIso){
  if(!plano || !plano.assuntosAlvo || !plano.assuntosAlvo.length) return [];
  const semanaId = segundaFeiraDaSemana(hojeIso);
  const tocadosSemana = assuntosTocadosNaSemana({checkins, conteudo, sessoes}, semanaId);
  const atrasados = assuntosAtrasadosNaSemana(plano.assuntosAlvo, tocadosSemana);
  const checkinHoje = checkins.find(c => c.data === hojeIso);
  const sessoesHoje = sessoes.filter(s => s.data === hojeIso);
  return plano.assuntosAlvo.map(assunto => {
    const item = conteudo.find(c => c.assunto === assunto) || null;
    const tocadoHoje = (item && item.atualizadoEm === hojeIso && item.status !== 'nao_iniciado')
      || (checkinHoje && checkinHoje.assunto === assunto)
      || sessoesHoje.some(s => s.assunto === assunto);
    const estado = tocadoHoje ? 'concluida' : (atrasados.includes(assunto) ? 'atrasada' : 'pendente');
    return {
      assunto, estado,
      statusLabel: item ? STATUS_CONTEUDO_LABEL[item.status] : null,
      tag: item ? CONCURSO_LABEL[item.concurso] : null,
    };
  });
}
function proximaAtividadeDoDia(atividades, filaErros){
  const atrasada = atividades.find(a => a.estado === 'atrasada');
  if(atrasada) return {origem:'conteudo', ...atrasada};
  const pendente = atividades.find(a => a.estado === 'pendente');
  if(pendente) return {origem:'conteudo', ...pendente};
  if(filaErros.length) return {origem:'erro', erro: filaErros[0]};
  return null;
}
function formatarDataExtenso(iso){
  const d = new Date(iso + 'T00:00:00');
  const weekday = d.toLocaleDateString('pt-BR', {weekday:'long'});
  const day = d.getDate();
  const month = d.toLocaleDateString('pt-BR', {month:'long'});
  return `${weekday} ${day} de ${month}`;
}

// atividadesPlanoDoDia: no plano -> []
assert.deepStrictEqual(atividadesPlanoDoDia(null, [], [], [], '2026-08-16'), []);
assert.deepStrictEqual(atividadesPlanoDoDia({assuntosAlvo:[]}, [], [], [], '2026-08-16'), []);

// atividadesPlanoDoDia: pendente / atrasada / concluida (via conteudo) states
{
  const plano = {assuntosAlvo:['PNMA','LC 140/2011','Português']};
  const conteudo = [
    {assunto:'PNMA', status:'nao_iniciado', concurso:'ambos', atualizadoEm:null},
    {assunto:'LC 140/2011', status:'estudado', concurso:'inea', atualizadoEm:'2026-08-16'},
    {assunto:'Português', status:'nao_iniciado', concurso:'transpetro', atualizadoEm:'2026-08-10'},
  ];
  const r = atividadesPlanoDoDia(plano, conteudo, [], [], '2026-08-16');
  assert.strictEqual(r.find(a=>a.assunto==='PNMA').estado, 'atrasada');
  assert.strictEqual(r.find(a=>a.assunto==='LC 140/2011').estado, 'concluida');
  assert.strictEqual(r.find(a=>a.assunto==='Português').estado, 'pendente');
}

// atividadesPlanoDoDia: concluida via sessao registrada hoje (not just checkin/mapa)
{
  const plano = {assuntosAlvo:['PNRH']};
  const r = atividadesPlanoDoDia(plano, [], [], [{data:'2026-08-16', assunto:'PNRH', tipo:'teoria'}], '2026-08-16');
  assert.strictEqual(r[0].estado, 'concluida');
}

// atividadesPlanoDoDia: assunto not in conteudo -> statusLabel/tag null, still works
{
  const plano = {assuntosAlvo:['Assunto Livre']};
  const r = atividadesPlanoDoDia(plano, [], [{data:'2026-08-16', assunto:'Assunto Livre', status:'minimo'}], [], '2026-08-16');
  assert.strictEqual(r[0].estado, 'concluida');
  assert.strictEqual(r[0].statusLabel, null);
  assert.strictEqual(r[0].tag, null);
}

// proximaAtividadeDoDia: atrasada > pendente > erro > null
{
  const atividades = [{assunto:'A', estado:'concluida'}, {assunto:'B', estado:'pendente'}, {assunto:'C', estado:'atrasada'}];
  const next = proximaAtividadeDoDia(atividades, [{id:'x'}]);
  assert.strictEqual(next.origem, 'conteudo');
  assert.strictEqual(next.assunto, 'C');
}
{
  const next = proximaAtividadeDoDia([{assunto:'A', estado:'concluida'}], [{id:'erro1'}]);
  assert.strictEqual(next.origem, 'erro');
  assert.strictEqual(next.erro.id, 'erro1');
}
assert.strictEqual(proximaAtividadeDoDia([], []), null);

// formatarDataExtenso
assert.strictEqual(formatarDataExtenso('2026-08-16'), 'domingo 16 de agosto');
assert.strictEqual(formatarDataExtenso('2026-01-01'), 'quinta-feira 1 de janeiro');

console.log('All hoje-fns assertions passed');
```

- [ ] **Step 2: Run it, confirm it passes**

Run: `node <scratchpad>/hoje-fns.test.mjs`
Expected: `All hoje-fns assertions passed`.

- [ ] **Step 3: Add the 3 new pure functions, right before `renderHoje()`**

Find (currently right before `function renderHoje(){`):
```js
  function renderHoje(){
```
Insert the 3 functions immediately before it (keep `function renderHoje(){` as the line right
after):
```js
  function atividadesPlanoDoDia(plano, conteudo, checkins, sessoes, hojeIso){
    if(!plano || !plano.assuntosAlvo || !plano.assuntosAlvo.length) return [];
    const semanaId = segundaFeiraDaSemana(hojeIso);
    const tocadosSemana = assuntosTocadosNaSemana({checkins, conteudo, sessoes}, semanaId);
    const atrasados = assuntosAtrasadosNaSemana(plano.assuntosAlvo, tocadosSemana);
    const checkinHoje = checkins.find(c => c.data === hojeIso);
    const sessoesHoje = sessoes.filter(s => s.data === hojeIso);
    return plano.assuntosAlvo.map(assunto => {
      const item = conteudo.find(c => c.assunto === assunto) || null;
      const tocadoHoje = (item && item.atualizadoEm === hojeIso && item.status !== 'nao_iniciado')
        || (checkinHoje && checkinHoje.assunto === assunto)
        || sessoesHoje.some(s => s.assunto === assunto);
      const estado = tocadoHoje ? 'concluida' : (atrasados.includes(assunto) ? 'atrasada' : 'pendente');
      return {
        assunto, estado,
        statusLabel: item ? STATUS_CONTEUDO_LABEL[item.status] : null,
        tag: item ? CONCURSO_LABEL[item.concurso] : null,
      };
    });
  }
  function proximaAtividadeDoDia(atividades, filaErros){
    const atrasada = atividades.find(a => a.estado === 'atrasada');
    if(atrasada) return {origem:'conteudo', ...atrasada};
    const pendente = atividades.find(a => a.estado === 'pendente');
    if(pendente) return {origem:'conteudo', ...pendente};
    if(filaErros.length) return {origem:'erro', erro: filaErros[0]};
    return null;
  }
  function formatarDataExtenso(iso){
    const d = new Date(iso + 'T00:00:00');
    const weekday = d.toLocaleDateString('pt-BR', {weekday:'long'});
    const day = d.getDate();
    const month = d.toLocaleDateString('pt-BR', {month:'long'});
    return `${weekday} ${day} de ${month}`;
  }

  function renderHoje(){
```

- [ ] **Step 4: Add the 2 new module-level UI-state variables**

Find (in the `/* === RENDER === */` section):
```js
  let currentTab = (window.matchMedia && window.matchMedia('(min-width:900px)').matches) ? 'dashboard' : 'hoje';
  let sidebarCollapsed = false;
```
Replace with:
```js
  let currentTab = (window.matchMedia && window.matchMedia('(min-width:900px)').matches) ? 'dashboard' : 'hoje';
  let sidebarCollapsed = false;
  let registroAberto = null;
  let timerIntervalId = null;
```

- [ ] **Step 5: Replace `renderHoje()`**

Replace the entire current body of `renderHoje()` (from `function renderHoje(){` through its
matching closing `}`) with:
```js
  function renderHoje(){
    const hojeIso = hojeISO();
    const dias = diasAte(hojeIso, state.meta.provaData);
    const ci = checkinDeHoje();
    const statusAtivo = ci ? ci.status : null;
    const semanaId = semanaAtualId();
    const plano = obterPlano(state, semanaId);
    const atividades = atividadesPlanoDoDia(plano, state.conteudo, state.checkins, state.sessoes, hojeIso);
    const fila = filaRevisao(state.erros, hojeIso);
    const proxima = proximaAtividadeDoDia(atividades, fila);
    const estudadoHoje = horasNoDia(state.checkins, hojeIso);
    const planejadoHoje = 2.5;
    const pctDia = Math.min(100, Math.round((estudadoHoje/planejadoHoje)*100));
    const concluidas = atividades.filter(a=>a.estado==='concluida').length;
    const questoesHoje = (ci?.questoes || 0) + state.sessoes.filter(s => s.data===hojeIso && s.tipo==='questoes').reduce((s,x)=>s+(x.questoes||0),0);
    const diasTexto = dias > 0 ? `${dias} dias para a prova` : dias === 0 ? 'A prova é hoje!' : `Prova foi há ${Math.abs(dias)} dias`;

    const headerHtml = `
      <div class="card">
        <div class="hoje-header">
          <div class="hoje-header-icon">📅</div>
          <div>
            <h2>Hoje, ${formatarDataExtenso(hojeIso)}</h2>
            <small class="muted">${diasTexto}</small>
          </div>
        </div>
        <div class="hoje-progress-label"><span class="muted">Estudo de hoje</span><b>${estudadoHoje}h / ${planejadoHoje}h</b></div>
        <div class="progress"><i style="width:${pctDia}%"></i></div>
      </div>
    `;

    const heroHtml = proxima ? (
      proxima.origem === 'conteudo' ? `
        <div class="card hero-card">
          <div class="hero-eyebrow">Próxima atividade</div>
          <h3>${escapeHtml(proxima.assunto)}</h3>
          <div class="hero-meta">
            ${proxima.statusLabel ? `<span class="muted">${escapeHtml(proxima.statusLabel)}</span>` : ''}
            ${proxima.tag ? `<span class="badge">${escapeHtml(proxima.tag)}</span>` : ''}
            ${proxima.estado==='atrasada' ? `<span class="status-pill atrasada">Atrasada</span>` : ''}
          </div>
          <button class="primary" data-abrir-registro="${escapeHtml(proxima.assunto)}" data-tipo-sugerido="questoes">Registrar</button>
        </div>
      ` : `
        <div class="card hero-card">
          <div class="hero-eyebrow">Próxima atividade</div>
          <h3>${escapeHtml(proxima.erro.assunto)}</h3>
          <div class="hero-meta">
            <span class="muted">Revisão — ${GRAU_LABEL[proxima.erro.grau]}</span>
            <span class="status-pill ${proxima.erro.proximaRevisao < hojeIso ? 'atrasada' : 'pendente'}">${proxima.erro.proximaRevisao < hojeIso ? 'Atrasada' : 'Pendente'}</span>
          </div>
          <button class="primary" data-abrir-registro="${escapeHtml(proxima.erro.assunto)}" data-tipo-sugerido="revisao">Registrar</button>
        </div>
      `
    ) : (atividades.length ? `
        <div class="card hero-card"><div class="empty-state"><div class="empty-state-icon">🎉</div><b>Tudo em dia por aqui</b><p class="muted">Você concluiu tudo que planejou pra hoje.</p></div></div>
      ` : '');

    const planoHtml = `
      <div class="card">
        <h3>Plano de hoje</h3>
        ${atividades.length ? `<div class="activity-list">
          ${atividades.map(a => `
            <div class="activity-item ${a.estado}">
              <div class="activity-info">
                <div class="activity-title">${escapeHtml(a.assunto)}</div>
                <div class="activity-meta">
                  ${a.statusLabel ? `<span>${escapeHtml(a.statusLabel)}</span>` : ''}
                  ${a.tag ? `<span class="badge">${escapeHtml(a.tag)}</span>` : ''}
                </div>
              </div>
              <span class="status-pill ${a.estado}">${a.estado==='concluida'?'Concluída':a.estado==='atrasada'?'Atrasada':'Pendente'}</span>
              ${a.estado!=='concluida' ? `<button class="activity-action" data-abrir-registro="${escapeHtml(a.assunto)}" data-tipo-sugerido="questoes">Registrar</button>` : ''}
            </div>`).join('')}
        </div>` : `
        <div class="empty-state">
          <div class="empty-state-icon">🗓️</div>
          <p><b>Nenhum estudo planejado para hoje</b></p>
          <button data-ir-planejamento>Ir para Planejamento</button>
        </div>`}
      </div>
    `;

    const revisoesHtml = `
      <div class="card">
        <h3>Revisões de hoje</h3>
        ${fila.length ? fila.map(cardErro).join('') : `
        <div class="empty-state">
          <div class="empty-state-icon">✅</div>
          <p><b>Nenhuma revisão pendente para hoje</b></p>
        </div>`}
      </div>
    `;

    const resumoHtml = `
      <div class="card">
        <h3>Resumo do dia</h3>
        <div class="summary-strip">
          <div class="summary-item"><div class="summary-value">${planejadoHoje}h</div><div class="summary-label">Planejado</div></div>
          <div class="summary-item"><div class="summary-value">${estudadoHoje}h</div><div class="summary-label">Estudado</div></div>
          <div class="summary-item"><div class="summary-value">${concluidas}/${atividades.length}</div><div class="summary-label">Atividades</div></div>
          <div class="summary-item"><div class="summary-value">${questoesHoje}</div><div class="summary-label">Questões</div></div>
        </div>
      </div>
    `;

    const registroFormHtml = registroAberto ? `
      <div class="card" id="registro-form">
        <h3>Registrar estudo</h3>
        ${registroAberto.assunto ? `<p><b>${escapeHtml(registroAberto.assunto)}</b></p>` : `
          <label>Assunto</label>
          <select id="registro-assunto">
            <option value="">—</option>
            ${state.conteudo.map(c => `<option value="${escapeHtml(c.assunto)}">${escapeHtml(c.assunto)}</option>`).join('')}
          </select>
        `}
        <label>Tipo</label>
        <select id="registro-tipo">
          <option value="questoes" ${registroAberto.tipo==='questoes'?'selected':''}>Questões</option>
          <option value="teoria" ${registroAberto.tipo==='teoria'?'selected':''}>Teoria</option>
          <option value="revisao" ${registroAberto.tipo==='revisao'?'selected':''}>Revisão</option>
          <option value="anki" ${registroAberto.tipo==='anki'?'selected':''}>Anki</option>
        </select>
        <label>Minutos estudados</label>
        <input type="number" id="registro-minutos" value="${registroAberto.minutosPreenchidos ?? ''}">
        <div data-tipo-fields="questoes">
          <div class="row">
            <div><label>Questões</label><input type="number" id="registro-questoes"></div>
            <div><label>Acertos</label><input type="number" id="registro-acertos"></div>
          </div>
          <small class="muted" id="registro-calculo">Preencha questões pra calcular</small>
        </div>
        <div data-tipo-fields="teoria">
          <label>Páginas lidas (opcional)</label>
          <input type="number" id="registro-paginas">
          <label><input type="checkbox" id="registro-concluida" style="width:auto;min-height:auto;display:inline-block;vertical-align:middle;margin-right:6px;"> Atividade/aula concluída</label>
        </div>
        <div data-tipo-fields="revisao">
          <label>Dificuldade (opcional)</label>
          <select id="registro-dificuldade">
            <option value="">—</option>
            <option value="facil">Fácil</option>
            <option value="media">Média</option>
            <option value="dificil">Difícil</option>
          </select>
        </div>
        <div data-tipo-fields="anki">
          <label>Cartões revisados (opcional)</label>
          <input type="number" id="registro-cartoes">
        </div>
        <label>Observação (opcional)</label>
        <textarea id="registro-obs"></textarea>
        <div class="row">
          <button id="registro-cancelar">Cancelar</button>
          <button id="registro-salvar" class="primary">Salvar registro</button>
        </div>
      </div>
    ` : '';

    const fechamentoHtml = `
      <div class="card">
        <h3>Fechamento do dia</h3>
        <p class="muted">Como foi seu estudo hoje?</p>
        <button data-checkin="base" class="${statusAtivo==='base'?'primary':''}">Meta cumprida ${statusAtivo==='base'?'✓':''}</button>
        <button data-checkin="minimo" class="${statusAtivo==='minimo'?'primary':''}">Fiz o mínimo ${statusAtivo==='minimo'?'✓':''}</button>
        <button data-checkin="nao" class="${statusAtivo==='nao'?'primary':''}">Não consegui estudar ${statusAtivo==='nao'?'✓':''}</button>
        <details>
          <summary>+ detalhar (opcional)</summary>
          <label>Minutos</label>
          <input type="number" id="hoje-minutos" value="${ci?.minutos ?? ''}">
          <label>Assunto</label>
          <select id="hoje-assunto">
            <option value="">—</option>
            ${state.conteudo.map(c => `<option value="${escapeHtml(c.assunto)}" ${ci?.assunto===c.assunto?'selected':''}>${escapeHtml(c.assunto)}</option>`).join('')}
          </select>
          <div class="row">
            <div><label>Questões</label><input type="number" id="hoje-questoes" value="${ci?.questoes ?? ''}"></div>
            <div><label>Acertos</label><input type="number" id="hoje-acertos" value="${ci?.acertos ?? ''}"></div>
          </div>
          <label>Observação</label>
          <textarea id="hoje-obs">${escapeHtml(ci?.obs ?? '')}</textarea>
          <button id="hoje-salvar-detalhe" class="primary">Salvar detalhe</button>
        </details>
      </div>
    `;

    return `
      ${headerHtml}
      <div class="grid-hoje">
        <div>
          ${heroHtml}
          ${planoHtml}
        </div>
        <div>
          ${revisoesHtml}
          ${resumoHtml}
        </div>
      </div>
      <div class="card">
        <button data-abrir-registro-global data-tipo-sugerido="questoes">+ Registrar estudo</button>
      </div>
      ${registroFormHtml}
      ${fechamentoHtml}
    `;
  }
```

- [ ] **Step 6: Replace `attachHojeHandlers()`**

Replace the entire current body of `attachHojeHandlers()` (from `function attachHojeHandlers(){`
through its matching closing `}`) with:
```js
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

    app.querySelectorAll('[data-abrir-registro]').forEach(btn => {
      btn.addEventListener('click', () => {
        registroAberto = { assunto: btn.dataset.abrirRegistro, tipo: btn.dataset.tipoSugerido || 'questoes', minutosPreenchidos: null };
        render();
      });
    });
    document.querySelector('[data-abrir-registro-global]')?.addEventListener('click', () => {
      registroAberto = { assunto: null, tipo: 'questoes', minutosPreenchidos: null };
      render();
    });
    document.getElementById('registro-cancelar')?.addEventListener('click', () => {
      registroAberto = null;
      render();
    });
    document.querySelectorAll('[data-ir-planejamento]').forEach(btn => {
      btn.addEventListener('click', () => { currentTab = 'planejamento'; render(); });
    });

    const selTipo = document.getElementById('registro-tipo');
    if(selTipo){
      atualizarCamposPorTipo(selTipo.value);
      selTipo.addEventListener('change', () => atualizarCamposPorTipo(selTipo.value));
    }
    document.getElementById('registro-questoes')?.addEventListener('input', atualizarCalculoQuestoes);
    document.getElementById('registro-acertos')?.addEventListener('input', atualizarCalculoQuestoes);
    if(document.getElementById('registro-calculo')) atualizarCalculoQuestoes();

    document.getElementById('registro-salvar')?.addEventListener('click', () => {
      const tipo = document.getElementById('registro-tipo').value;
      const assuntoSel = document.getElementById('registro-assunto');
      const assunto = registroAberto.assunto || (assuntoSel ? (assuntoSel.value || null) : null);
      const minutos = Number(document.getElementById('registro-minutos').value) || 0;
      if(minutos <= 0){ alert('Informe os minutos estudados.'); return; }
      const dados = { tipo, assunto, minutos, obs: document.getElementById('registro-obs').value };
      if(tipo === 'questoes'){
        dados.questoes = Number(document.getElementById('registro-questoes').value) || 0;
        dados.acertos = Number(document.getElementById('registro-acertos').value) || 0;
      } else if(tipo === 'teoria'){
        dados.paginas = Number(document.getElementById('registro-paginas').value) || null;
        dados.concluida = document.getElementById('registro-concluida').checked;
      } else if(tipo === 'revisao'){
        dados.dificuldade = document.getElementById('registro-dificuldade').value || null;
      } else if(tipo === 'anki'){
        dados.cartoes = Number(document.getElementById('registro-cartoes').value) || null;
      }
      registrarSessao(state, hojeISO(), dados);
      saveState(state);
      registroAberto = null;
      render();
    });
  }

  function atualizarCamposPorTipo(tipo){
    document.querySelectorAll('#registro-form [data-tipo-fields]').forEach(el => {
      el.style.display = el.dataset.tipoFields === tipo ? '' : 'none';
    });
  }
  function atualizarCalculoQuestoes(){
    const q = Number(document.getElementById('registro-questoes')?.value) || 0;
    const a = Number(document.getElementById('registro-acertos')?.value) || 0;
    const el = document.getElementById('registro-calculo');
    if(!el) return;
    el.textContent = q ? `Erros: ${calcularErros(q,a)} · Aproveitamento: ${calcularAproveitamento(q,a)}%` : 'Preencha questões pra calcular';
  }
```

- [ ] **Step 7: Static verification**

Run the syntax check. Confirm every `document.getElementById`/`querySelector` id/attribute
referenced in the new `attachHojeHandlers()` has a matching element in the new `renderHoje()`
output (`registro-form`, `registro-assunto`, `registro-tipo`, `registro-minutos`,
`registro-questoes`, `registro-acertos`, `registro-calculo`, `registro-paginas`,
`registro-concluida`, `registro-dificuldade`, `registro-cartoes`, `registro-obs`,
`registro-cancelar`, `registro-salvar`, `[data-abrir-registro]`, `[data-abrir-registro-global]`,
`[data-ir-planejamento]`, plus the untouched `hoje-*`/`data-checkin`/`data-acertei`/`data-errei`
ids from before). Confirm the `hoje-salvar-detalhe` block and its ids (`hoje-minutos`,
`hoje-assunto`, `hoje-questoes`, `hoje-acertos`, `hoje-obs`) are byte-identical to what existed
before this task (Fechamento do dia's detail form must be untouched).

- [ ] **Step 8: Commit**

```bash
git add index.html
git commit -m "feat(hoje): rebuild Hoje as daily operating console with manual activity registration"
```

Note for the user: after this task, opening Hoje shows the new layout end to end — header,
próxima atividade, plano de hoje, revisões, resumo, and a working "Registrar"/"+ Registrar estudo"
flow that saves real `sessoes` records. There's no "Iniciar" (timer) button yet — Task 4 adds it.

---

## Task 4: Cronômetro (persisted timer) on top of the registration flow

**Files:**
- Modify: `index.html` (`<style>` — 2 new small rules; `renderHoje()` — add timer card + "Iniciar"
  buttons; `attachHojeHandlers()` — add timer start/tick/finish wiring)

**Interfaces:**
- Consumes: `iniciarSessaoEmAndamento`/`finalizarSessaoEmAndamento` (Task 1),
  `registroAberto`/`timerIntervalId` (Task 3, module-level `let`s already declared).
- Produces: no new shared functions — this task only adds markup/wiring inside
  `renderHoje()`/`attachHojeHandlers()`.

- [ ] **Step 1: Add timer CSS, remove unused `.highlight-pulse` (dead code — no task in this plan
  ends up applying it; it was added speculatively in an earlier session before the timer design was
  finalized)**

Find (end of the `/* === HOJE (redesign) === */` block added earlier this session):
```css
  .highlight-pulse{animation:pulseBorder 1.2s ease;}
  @keyframes pulseBorder{0%{box-shadow:0 0 0 3px var(--accent);}100%{box-shadow:var(--shadow-sm);}}
</style>
```
Replace with:
```css
  .timer-display{font-size:var(--text-2xl);font-weight:650;text-align:center;margin:var(--space-3) 0;font-variant-numeric:tabular-nums;}
  .hero-card .row{margin-top:var(--space-3);}
</style>
```

- [ ] **Step 2: Add the timer card and "Iniciar" buttons in `renderHoje()`**

Find (the hero block's two `<button class="primary" ...>Registrar</button>` lines, inside the
`heroHtml` template built in Task 3):
```js
          <button class="primary" data-abrir-registro="${escapeHtml(proxima.assunto)}" data-tipo-sugerido="questoes">Registrar</button>
        </div>
      ` : `
        <div class="card hero-card">
          <div class="hero-eyebrow">Próxima atividade</div>
          <h3>${escapeHtml(proxima.erro.assunto)}</h3>
          <div class="hero-meta">
            <span class="muted">Revisão — ${GRAU_LABEL[proxima.erro.grau]}</span>
            <span class="status-pill ${proxima.erro.proximaRevisao < hojeIso ? 'atrasada' : 'pendente'}">${proxima.erro.proximaRevisao < hojeIso ? 'Atrasada' : 'Pendente'}</span>
          </div>
          <button class="primary" data-abrir-registro="${escapeHtml(proxima.erro.assunto)}" data-tipo-sugerido="revisao">Registrar</button>
        </div>
      `
```
Replace with:
```js
          <div class="row">
            <button class="primary" data-iniciar-timer="${escapeHtml(proxima.assunto)}" data-tipo-sugerido="questoes" data-origem="proxima">▶ Iniciar estudo</button>
            <button data-abrir-registro="${escapeHtml(proxima.assunto)}" data-tipo-sugerido="questoes">Registrar</button>
          </div>
        </div>
      ` : `
        <div class="card hero-card">
          <div class="hero-eyebrow">Próxima atividade</div>
          <h3>${escapeHtml(proxima.erro.assunto)}</h3>
          <div class="hero-meta">
            <span class="muted">Revisão — ${GRAU_LABEL[proxima.erro.grau]}</span>
            <span class="status-pill ${proxima.erro.proximaRevisao < hojeIso ? 'atrasada' : 'pendente'}">${proxima.erro.proximaRevisao < hojeIso ? 'Atrasada' : 'Pendente'}</span>
          </div>
          <div class="row">
            <button class="primary" data-iniciar-timer="${escapeHtml(proxima.erro.assunto)}" data-tipo-sugerido="revisao" data-origem="proxima">▶ Iniciar estudo</button>
            <button data-abrir-registro="${escapeHtml(proxima.erro.assunto)}" data-tipo-sugerido="revisao">Registrar</button>
          </div>
        </div>
      `
```
Find (the Plano de hoje activity item's single "Registrar" button, inside `planoHtml`):
```js
              ${a.estado!=='concluida' ? `<button class="activity-action" data-abrir-registro="${escapeHtml(a.assunto)}" data-tipo-sugerido="questoes">Registrar</button>` : ''}
```
Replace with:
```js
              ${a.estado!=='concluida' ? `
                <button class="activity-action" data-iniciar-timer="${escapeHtml(a.assunto)}" data-tipo-sugerido="questoes" data-origem="plano">Iniciar</button>
                <button class="activity-action" data-abrir-registro="${escapeHtml(a.assunto)}" data-tipo-sugerido="questoes">Registrar</button>
              ` : ''}
```
Find (the `heroHtml`/empty-plano branching — the whole ternary assignment built in Task 3; the
`const heroHtml = proxima ? (` opening line and the timer card need to be introduced right before
it). Find:
```js
    const heroHtml = proxima ? (
```
Replace with:
```js
    const timerHtml = state.sessaoEmAndamento ? `
      <div class="card hero-card">
        <div class="hero-eyebrow">Sessão em andamento</div>
        <h3>${escapeHtml(state.sessaoEmAndamento.assunto || 'Estudo livre')}</h3>
        <div class="timer-display" id="timer-elapsed" data-inicio="${state.sessaoEmAndamento.inicioEm}">00:00</div>
        <button class="primary" id="timer-finalizar">Finalizar</button>
      </div>
    ` : '';

    const heroHtml = proxima ? (
```
Finally, find the template's final return block (built in Task 3):
```js
    return `
      ${headerHtml}
      <div class="grid-hoje">
        <div>
          ${heroHtml}
          ${planoHtml}
        </div>
```
Replace with:
```js
    return `
      ${headerHtml}
      <div class="grid-hoje">
        <div>
          ${state.sessaoEmAndamento ? timerHtml : heroHtml}
          ${planoHtml}
        </div>
```

- [ ] **Step 3: Wire timer start/tick/finish in `attachHojeHandlers()`**

Find (the end of `attachHojeHandlers()`'s body, right before its closing `}` — currently the last
statement is the `registro-salvar` click handler's closing `});`):
```js
      registrarSessao(state, hojeISO(), dados);
      saveState(state);
      registroAberto = null;
      render();
    });
  }
```
Replace with:
```js
      registrarSessao(state, hojeISO(), dados);
      saveState(state);
      registroAberto = null;
      render();
    });

    if(timerIntervalId){ clearInterval(timerIntervalId); timerIntervalId = null; }
    const timerEl = document.getElementById('timer-elapsed');
    if(timerEl){
      const inicio = new Date(timerEl.dataset.inicio).getTime();
      const tick = () => {
        const segundos = Math.floor((Date.now() - inicio) / 1000);
        const mm = String(Math.floor(segundos/60)).padStart(2,'0');
        const ss = String(segundos%60).padStart(2,'0');
        timerEl.textContent = `${mm}:${ss}`;
      };
      tick();
      timerIntervalId = setInterval(tick, 1000);
    }
    document.getElementById('timer-finalizar')?.addEventListener('click', () => {
      const resultado = finalizarSessaoEmAndamento(state);
      saveState(state);
      if(resultado){
        registroAberto = { assunto: resultado.assunto, tipo: resultado.tipo || 'questoes', minutosPreenchidos: resultado.minutos };
      }
      render();
    });
    app.querySelectorAll('[data-iniciar-timer]').forEach(btn => {
      btn.addEventListener('click', () => {
        iniciarSessaoEmAndamento(state, { assunto: btn.dataset.iniciarTimer || null, tipo: btn.dataset.tipoSugerido || null, origem: btn.dataset.origem || null });
        saveState(state);
        render();
      });
    });
  }
```

- [ ] **Step 4: Static verification**

Run the syntax check. Grep for `data-iniciar-timer` and confirm it appears both in `renderHoje()`
(2 hero variants + plano de hoje item) and in `attachHojeHandlers()`'s `querySelectorAll`. Grep for
`timer-elapsed`/`timer-finalizar` and confirm each id is referenced exactly once in `renderHoje()`
(inside `timerHtml`) and once in `attachHojeHandlers()`. Read through `attachHojeHandlers()` once
and confirm `clearInterval` runs before every new `setInterval` — a stray interval would keep
ticking a detached DOM node after navigating away from Hoje and back.

- [ ] **Step 5: Commit**

```bash
git add index.html
git commit -m "feat(hoje): add persisted study timer, hands off to the registration form on finish"
```

Note for the user: `state.sessaoEmAndamento` is saved to `localStorage` on start, so reloading the
page or closing the tab mid-session does not lose elapsed time — the timer card recomputes elapsed
time from the stored `inicioEm` on next load. No browser is available to this plan's implementers,
so please verify: starting a timer, reloading the page, confirming the timer keeps counting from
the correct elapsed time (not reset to 0); and finalizing a timer correctly opens the registration
form pre-filled with the elapsed minutes.

---

## Task 5: Verification and focused Hoje-only review

**Files:** none modified — this task only verifies and reviews.

- [ ] **Step 1: Full static syntax check**

Run: `node -e "new Function(require('fs').readFileSync('index.html','utf8').match(/<script>([\s\S]*)<\/script>/)[1])"` —
expect no error.

- [ ] **Step 2: Backward-compatibility check for old exports**

Run a scratch script that constructs an old-shaped state object (no `sessoes`/`sessaoEmAndamento`,
matching the pre-this-round export format) and confirms: (a) `estadoValido()` still returns `true`
for it (paste `estadoValido`'s current body from `index.html` into the script), and (b)
`normalizarCamposNovos()` (Task 1) fills in `sessoes:[]`/`sessaoEmAndamento:null` without
mutating any of the object's existing arrays' contents. This directly verifies the plan's
backward-compatibility constraint, not just that the code runs.

- [ ] **Step 3: Regression check — other screens unaffected**

Grep `index.html` for `renderDashboard`, `renderDesempenho`, `renderPlanejamento`, `renderMapa`,
`renderErros`, `renderConfig` and confirm none of their function *bodies* changed beyond the exact
one-line `agregarPorAssunto`/`evolucaoSemanal` call-site edits from Task 2 (diff the current file
against the commit before Task 1 for just those functions' line ranges, read the diff, confirm
nothing else moved).

- [ ] **Step 4: Dispatch a Hoje-focused code review**

Review only the cumulative diff of this plan's 4 tasks (Task 1 commit through Task 4 commit) —
not a whole-branch review. Focus explicitly on: (a) does `renderHoje()` correctly handle every
combination of `plano`/`atividades`/`fila`/`sessaoEmAndamento` being empty vs. populated (the 4
empty-state branches); (b) is every new `id`/`data-*` selector referenced in
`attachHojeHandlers()` actually present in the corresponding `renderHoje()` output for every
branch, not just the happy path; (c) does the timer's `setInterval` get cleared on every
`attachHojeHandlers()` re-run, with no leaked interval; (d) is `state.checkins`'s existing
Fechamento-do-dia flow (3 buttons + detail form) byte-identical to before this plan; (e) do the 5
updated call sites (`agregarPorAssunto` ×4, `evolucaoSemanal` ×1) all pass `state.sessoes`
correctly.

- [ ] **Step 5: Address any Critical/Important findings, park Minor findings**

Fix Critical/Important findings directly (this is a controller-owned verification task, not a
fresh-implementer task — findings here are fixed in place, then Step 1's syntax check is re-run).
Minor findings are noted for the user, not blocking.
