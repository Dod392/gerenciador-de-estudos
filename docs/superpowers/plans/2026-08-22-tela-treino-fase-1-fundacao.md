# Tela Treino — Fase 1 (Fundação) Implementation Plan

> **Spec:** `docs/superpowers/specs/2026-08-22-tela-treino-design.md` (seções 1, 2.1, 2.2, 4, 5, 7-Fase1, 8, 9)
> Executado diretamente nesta sessão (sem dispatch de subagentes por task, dado o volume de fases e a instrução do usuário de rodar tudo sem pausa). Ledger de progresso: este arquivo + commits no branch `worktree-tela-treino`.

**Goal:** Tela "Treino" funcional, offline-first, consumindo só `filaErrosPendentes` (sem banco de questões — isso é Fase 3). Loop completo: entrada → sessão em tela cheia → fechamento. Remove o modal antigo de revisão do Caderno de Erros. Liga "Revisões de hoje" em Hoje a um botão que abre Treino.

## Global Constraints

- Sem quebrar nenhum dos 43 testes existentes.
- `aplicarRevisaoErro(erro, acertou, hojeIso)` continua com 3 parâmetros nesta fase (o 4º opcional `{confianca}` é Fase 2).
- Lógica nova em módulos ES testados com `node --test`; render/listeners em `index.html`.
- Novos módulos entram em `sw.js` `LOCAIS`, com bump de `CACHE_VERSION`.
- Nenhuma tela existente muda de comportamento além do card "Revisões de hoje" em Hoje.
- Toques da área de resposta ≥48px, na metade inferior da tela em larguras até 430px.

---

### Task 1: `treino-fila.js` — montagem e intercalação da fila

**Files:**
- Create: `treino-fila.js`
- Test: `treino-fila.test.js`

**Interfaces (produzidas, usadas pelo index.html e por `treino.js` depois):**
- `errosParaItensFila(erros) → [{tipo:'erro', refId, assunto}]`
- `montarFila(itensPendentes, opts?) → itens reordenados` — `opts.focarAssunto` (string|null): se setado, filtra só esse assunto (sem embaralhar). Regra padrão: nunca 3 itens seguidos do mesmo `assunto`; quando só resta um assunto nos itens restantes, aceita a repetição (não tem como evitar).

- [ ] **Passo 1 — implementar `treino-fila.js`:**

```js
export function errosParaItensFila(erros){
  return erros.map(e => ({ tipo: 'erro', refId: e.id, assunto: e.assunto }));
}

export function montarFila(itensPendentes, opts = {}){
  if(opts.focarAssunto){
    return itensPendentes.filter(item => item.assunto === opts.focarAssunto);
  }
  const restantes = [...itensPendentes];
  const resultado = [];
  while(restantes.length){
    const doisUltimos = resultado.slice(-2);
    const bloquearAssunto = (doisUltimos.length === 2 && doisUltimos[0].assunto === doisUltimos[1].assunto)
      ? doisUltimos[0].assunto
      : null;
    let idx = restantes.findIndex(item => item.assunto !== bloquearAssunto);
    if(idx === -1) idx = 0; // só resta esse assunto — repetição inevitável
    resultado.push(restantes.splice(idx, 1)[0]);
  }
  return resultado;
}
```

- [ ] **Passo 2 — testes (`treino-fila.test.js`):**

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { errosParaItensFila, montarFila } from './treino-fila.js';

test('errosParaItensFila mapeia erro para item de fila tipo erro', () => {
  const itens = errosParaItensFila([{ id: 'e1', assunto: 'PNRH' }]);
  assert.deepEqual(itens, [{ tipo: 'erro', refId: 'e1', assunto: 'PNRH' }]);
});

test('montarFila preserva ordem quando não há assunto repetido', () => {
  const itens = [{assunto:'A'},{assunto:'B'},{assunto:'C'}].map((x,i)=>({...x, refId:String(i)}));
  assert.deepEqual(montarFila(itens).map(i=>i.assunto), ['A','B','C']);
});

test('montarFila nunca deixa 3 itens seguidos do mesmo assunto quando é possível evitar', () => {
  const itens = [
    {assunto:'A',refId:'a1'},{assunto:'A',refId:'a2'},{assunto:'A',refId:'a3'},
    {assunto:'B',refId:'b1'},{assunto:'B',refId:'b2'},
  ];
  const fila = montarFila(itens);
  assert.equal(fila.length, 5);
  for(let i=0;i<fila.length-2;i++){
    assert.ok(!(fila[i].assunto===fila[i+1].assunto && fila[i+1].assunto===fila[i+2].assunto), `3 seguidos em i=${i}`);
  }
});

test('montarFila aceita repetição quando só resta um assunto nos itens restantes', () => {
  const itens = [{assunto:'A',refId:'a1'},{assunto:'A',refId:'a2'},{assunto:'A',refId:'a3'}];
  const fila = montarFila(itens);
  assert.equal(fila.length, 3);
  assert.deepEqual(fila.map(i=>i.refId), ['a1','a2','a3']);
});

test('montarFila com focarAssunto filtra só aquele assunto, mantendo ordem original', () => {
  const itens = [{assunto:'A',refId:'a1'},{assunto:'B',refId:'b1'},{assunto:'A',refId:'a2'}];
  const fila = montarFila(itens, { focarAssunto: 'A' });
  assert.deepEqual(fila.map(i=>i.refId), ['a1','a2']);
});

test('montarFila com lista vazia retorna lista vazia', () => {
  assert.deepEqual(montarFila([]), []);
});
```

- [ ] **Passo 3:** Rodar `node --test treino-fila.test.js` — deve passar (6 testes).
- [ ] **Passo 4:** Commit: `git add treino-fila.js treino-fila.test.js && git commit -m "feat(treino): fila com intercalação por assunto"`

---

### Task 2: `treino-sessao.js` — máquina de estado da sessão

**Files:**
- Create: `treino-sessao.js`
- Test: `treino-sessao.test.js`

**Consome:** nada de outro módulo novo (puro, só recebe `erros`/`hojeIso` como dados).
**Produz (usado por index.html):** `criarSessao`, `itemAtual`, `revelarResposta`, `registrarResposta`, `pularItem`, `sessaoTerminada`, `errosCorrigidosHoje`.

- [ ] **Passo 1 — implementar `treino-sessao.js`:**

```js
export function criarSessao({ fila, tempoAlvoMin, modo, filtroAssunto = null, filtroConcurso = null }){
  return {
    id: String(Date.now()) + Math.random().toString(36).slice(2,7),
    iniciadaEm: new Date().toISOString(),
    tempoAlvoMin,
    modo,
    filtroAssunto,
    filtroConcurso,
    fila,
    indice: 0,
    confiancaAtual: null,
    revelado: false,
    respostas: [],
    combo: 0,
    melhorCombo: 0,
  };
}

export function itemAtual(sessao){
  if(!sessao || sessao.indice >= sessao.fila.length) return null;
  return sessao.fila[sessao.indice];
}

export function sessaoTerminada(sessao){
  return !sessao || sessao.indice >= sessao.fila.length;
}

export function revelarResposta(sessao){
  sessao.revelado = true;
  return sessao;
}

export function registrarResposta(sessao, { acertou, emMs = 0 }){
  const item = itemAtual(sessao);
  if(!item) return sessao;
  sessao.respostas.push({ refId: item.refId, tipo: item.tipo, confianca: sessao.confiancaAtual, acertou: !!acertou, emMs });
  if(acertou){
    sessao.combo += 1;
    if(sessao.combo > sessao.melhorCombo) sessao.melhorCombo = sessao.combo;
  } else {
    sessao.combo = 0;
  }
  sessao.indice += 1;
  sessao.revelado = false;
  sessao.confiancaAtual = null;
  return sessao;
}

export function pularItem(sessao){
  // Pular não conta como erro nem como acerto — não mexe em combo/respostas.
  sessao.indice += 1;
  sessao.revelado = false;
  sessao.confiancaAtual = null;
  return sessao;
}

export function errosCorrigidosHoje(erros, hojeIso){
  return erros.filter(e => e.status === 'corrigido' && e.dataUltimaRevisao === hojeIso).length;
}
```

- [ ] **Passo 2 — testes (`treino-sessao.test.js`):**

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { criarSessao, itemAtual, sessaoTerminada, revelarResposta, registrarResposta, pularItem, errosCorrigidosHoje } from './treino-sessao.js';

function filaExemplo(){
  return [
    { tipo:'erro', refId:'e1', assunto:'A' },
    { tipo:'erro', refId:'e2', assunto:'B' },
  ];
}

test('criarSessao monta o objeto com os campos esperados, zerado', () => {
  const s = criarSessao({ fila: filaExemplo(), tempoAlvoMin: 10, modo: 'revisao' });
  assert.equal(s.indice, 0);
  assert.equal(s.revelado, false);
  assert.equal(s.combo, 0);
  assert.equal(s.melhorCombo, 0);
  assert.deepEqual(s.respostas, []);
  assert.equal(s.fila.length, 2);
});

test('itemAtual retorna o item do índice atual, e null quando a fila terminou', () => {
  const s = criarSessao({ fila: filaExemplo(), tempoAlvoMin: 10, modo: 'revisao' });
  assert.equal(itemAtual(s).refId, 'e1');
  s.indice = 2;
  assert.equal(itemAtual(s), null);
});

test('sessaoTerminada reflete o índice contra o tamanho da fila', () => {
  const s = criarSessao({ fila: filaExemplo(), tempoAlvoMin: 10, modo: 'revisao' });
  assert.equal(sessaoTerminada(s), false);
  s.indice = 2;
  assert.equal(sessaoTerminada(s), true);
});

test('revelarResposta só marca revelado, não avança índice', () => {
  const s = criarSessao({ fila: filaExemplo(), tempoAlvoMin: 10, modo: 'revisao' });
  revelarResposta(s);
  assert.equal(s.revelado, true);
  assert.equal(s.indice, 0);
});

test('registrarResposta acertando avança combo e melhorCombo, avança índice, reseta revelado', () => {
  const s = criarSessao({ fila: filaExemplo(), tempoAlvoMin: 10, modo: 'revisao' });
  revelarResposta(s);
  registrarResposta(s, { acertou: true, emMs: 1200 });
  assert.equal(s.indice, 1);
  assert.equal(s.revelado, false);
  assert.equal(s.combo, 1);
  assert.equal(s.melhorCombo, 1);
  assert.equal(s.respostas.length, 1);
  assert.equal(s.respostas[0].refId, 'e1');
  assert.equal(s.respostas[0].acertou, true);
});

test('registrarResposta errando zera combo mas preserva melhorCombo', () => {
  const s = criarSessao({ fila: filaExemplo(), tempoAlvoMin: 10, modo: 'revisao' });
  registrarResposta(s, { acertou: true });
  registrarResposta(s, { acertou: false });
  assert.equal(s.combo, 0);
  assert.equal(s.melhorCombo, 1);
});

test('pularItem avança índice sem criar resposta nem mexer no combo', () => {
  const s = criarSessao({ fila: filaExemplo(), tempoAlvoMin: 10, modo: 'revisao' });
  registrarResposta(s, { acertou: true }); // combo=1
  pularItem(s);
  assert.equal(s.indice, 2);
  assert.equal(s.respostas.length, 1); // só a resposta registrada antes, não a pulada
  assert.equal(s.combo, 1); // pular não zera nem incrementa
});

test('errosCorrigidosHoje conta só status corrigido com dataUltimaRevisao de hoje', () => {
  const erros = [
    { status: 'corrigido', dataUltimaRevisao: '2026-08-22' },
    { status: 'corrigido', dataUltimaRevisao: '2026-08-20' },
    { status: 'recorrente', dataUltimaRevisao: '2026-08-22' },
    { status: 'corrigido', dataUltimaRevisao: '2026-08-22' },
  ];
  assert.equal(errosCorrigidosHoje(erros, '2026-08-22'), 2);
});
```

- [ ] **Passo 3:** Rodar `node --test treino-sessao.test.js` — deve passar (8 testes).
- [ ] **Passo 4:** Commit: `git add treino-sessao.js treino-sessao.test.js && git commit -m "feat(treino): maquina de estado da sessao de treino"`

---

### Task 3: `treino.js` — agregador (espelha `erros-ia.js`)

**Files:**
- Create: `treino.js`

- [ ] **Passo 1:**

```js
import * as Fila from './treino-fila.js';
import * as Sessao from './treino-sessao.js';

const Treino = { ...Fila, ...Sessao };

if(typeof window !== 'undefined') window.Treino = Treino;

export default Treino;
```

- [ ] **Passo 2:** Commit: `git add treino.js && git commit -m "feat(treino): agregador window.Treino"`

---

### Task 4: script tag + `sw.js`

**Files:**
- Modify: `index.html` (adicionar `<script type="module" src="./treino.js"></script>` junto dos outros módulos)
- Modify: `sw.js`

- [ ] **Passo 1:** Achar a(s) tag(s) `<script type="module" src="./erros-ia.js">` no fim do `index.html` e adicionar logo depois: `<script type="module" src="./treino.js"></script>`.
- [ ] **Passo 2:** Em `sw.js`, adicionar `'./treino-fila.js', './treino-sessao.js', './treino.js',` ao array `LOCAIS`, e bump `CACHE_VERSION` (ex.: `'v6'` → `'v7'`).
- [ ] **Passo 3:** Commit: `git add index.html sw.js && git commit -m "chore(treino): registra modulos no script tag e no service worker"`

---

### Task 5: navegação — aba "Treino"

**Files:**
- Modify: `index.html` (array de abas / `NAV_ITEMS`, `MOBILE_PRIMARY`, dispatch de render/attach por `currentTab`)

**Decisão já tomada:** Treino entra entre "Hoje" e "Planejamento" na navegação principal, e como 4ª aba fixa em `MOBILE_PRIMARY` (sem remover nenhuma das 3 existentes).

- [ ] **Passo 1:** Localizar `NAV_ITEMS` (lista de abas do desktop/sidebar) e inserir a entrada de Treino entre `hoje` e `planejamento`, seguindo exatamente o formato dos itens vizinhos (`{id:'treino', label:'Treino', icon:icone('zap')}` ou ícone equivalente já usado no set de ícones — conferir `icone()` antes de escolher; usar um que já exista, ex. `zap` ou `target`).
- [ ] **Passo 2:** Localizar `MOBILE_PRIMARY` e inserir `'treino'` como 4º item (Hoje, Treino, Planejamento, Desempenho — ou na ordem que fizer sentido junto ao array real; manter Hoje primeiro).
- [ ] **Passo 3:** No dispatch de `renderScreen()` (`map = {hoje:renderHoje, ...}` e os `if(currentTab==='...') attachXHandlers()`), adicionar `treino: renderTreino` ao mapa e `if(currentTab==='treino') attachTreinoHandlers();`.
- [ ] **Passo 4:** Rodar `node --test` completo (43 testes) — nada deve quebrar (mudança é só de navegação, `renderTreino`/`attachTreinoHandlers` ainda não existem — criar como funções vazias temporárias `function renderTreino(){return '<div class="card">Treino em construção</div>';} function attachTreinoHandlers(){}` nesta task, substituídas na Task 6).
- [ ] **Passo 5:** Commit: `git add index.html && git commit -m "feat(treino): aba Treino na navegacao (desktop e mobile), placeholder de tela"`

---

### Task 6: tela Treino — entrada, durante, fechamento

**Files:**
- Modify: `index.html` (substituir os placeholders `renderTreino`/`attachTreinoHandlers` da Task 5)

**Consome:** `window.Treino.errosParaItensFila`, `window.Treino.montarFila`, `window.Treino.criarSessao`, `window.Treino.itemAtual`, `window.Treino.sessaoTerminada`, `window.Treino.revelarResposta`, `window.Treino.registrarResposta`, `window.Treino.pularItem`, `window.Treino.errosCorrigidosHoje`, `window.ErrosIA.filaErrosPendentes`, `window.ErrosIA.aplicarRevisaoErro`, `obterErroDoFlashcard`-equivalente **não é necessário** (Treino Fase 1 trabalha direto com `state.erros`, sem indireção por flashcard).

**Estado de módulo novo (variáveis `let` no escopo do IIFE, junto das outras como `errosFiltro` etc.):**
```js
let treinoConfigTempo = 10;        // minutos
let treinoConfigModo = 'revisao';  // só 'revisao' existe na Fase 1 (sem questões)
let treinoConfigFocarAssunto = null;
```
`state.treinoSessao` é a sessão persistida (null quando não há sessão ativa) — segue o padrão dos outros campos de `state`, salvo via `saveState(state)`.

- [ ] **Passo 1 — `estadoValido`/`seedState`/`normalizarCamposNovos`:** `state.treinoSessao` não precisa validação obrigatória (pode ser `null` ou objeto) — em `normalizarCamposNovos`, adicionar `if(s.treinoSessao === undefined) s.treinoSessao = null;` pra compatibilidade com estados salvos antes desta fase. `seedState()` inicializa `treinoSessao: null`.

- [ ] **Passo 2 — `renderTreino()` — tela de entrada (sem sessão ativa) ou "durante"/"fechamento" (sessão ativa):**

```js
function renderTreino(){
  const hojeIso = hojeISO();
  if(state.treinoSessao){
    return window.Treino.sessaoTerminada(state.treinoSessao) ? renderTreinoFechamento() : renderTreinoDurante();
  }
  const errosPendentes = window.ErrosIA ? window.ErrosIA.filaErrosPendentes(state.erros, hojeIso) : [];
  const porAssunto = {};
  errosPendentes.forEach(e => { porAssunto[e.assunto] = (porAssunto[e.assunto]||0) + 1; });
  const gargalo = Object.entries(porAssunto).sort((a,b) => b[1]-a[1])[0] || null;
  const assuntosDisponiveis = [...new Set(errosPendentes.map(e => e.assunto))].sort();
  return `
    <div class="card treino-entrada">
      <h2>${icone('zap')} Treino</h2>
      <p class="muted">${errosPendentes.length} pendente${errosPendentes.length===1?'':'s'}${gargalo ? ` · gargalo: ${escapeHtml(gargalo[0])} (${gargalo[1]})` : ''}</p>
      ${errosPendentes.length === 0 ? `
        <div class="empty-state">
          <div class="empty-state-icon">${icone('check-circle')}</div>
          <b>Nada pendente agora</b>
          <p class="muted">Volte quando alguma revisão vencer.</p>
        </div>
      ` : `
        <div class="treino-config">
          <label>Tempo</label>
          <div class="treino-config-tempo">
            ${[5,10,15,25].map(min => `<button type="button" class="treino-opcao ${treinoConfigTempo===min?'active':''}" data-treino-tempo="${min}">${min} min</button>`).join('')}
            <button type="button" class="treino-opcao ${treinoConfigTempo===null?'active':''}" data-treino-tempo="fila">Fila toda</button>
          </div>
          ${assuntosDisponiveis.length > 1 ? `
            <label>Focar em um assunto (opcional)</label>
            <select id="treino-focar-assunto">
              <option value="">Intercalado (padrão)</option>
              ${assuntosDisponiveis.map(a => `<option value="${escapeHtml(a)}" ${treinoConfigFocarAssunto===a?'selected':''}>${escapeHtml(a)}</option>`).join('')}
            </select>
          ` : ''}
          <button class="primary treino-comecar" id="treino-comecar-btn">${icone('play')} Começar</button>
        </div>
      `}
    </div>
  `;
}
```

- [ ] **Passo 3 — `renderTreinoDurante()`:**

```js
function renderTreinoDurante(){
  const sessao = state.treinoSessao;
  const item = window.Treino.itemAtual(sessao);
  if(!item) return renderTreinoFechamento();
  const erro = state.erros.find(e => e.id === item.refId);
  if(!erro){
    // Erro foi apagado/mudou de estado no meio da sessão — pula sem travar a tela.
    window.Treino.pularItem(sessao);
    saveState(state);
    return renderTreinoDurante();
  }
  const restante = sessao.fila.length - sessao.indice;
  const pct = Math.round((sessao.indice / sessao.fila.length) * 100);
  return `
    <div class="treino-full-screen">
      <div class="progress"><i style="width:${pct}%"></i></div>
      <div class="treino-progresso-texto muted">${sessao.indice+1} de ${sessao.fila.length}${sessao.combo>1 ? ` · combo ${sessao.combo}` : ''}</div>
      <div class="treino-card">
        <div class="badge">${escapeHtml(erro.assunto)}</div>
        ${erro.subtema ? `<div class="muted">${escapeHtml(erro.subtema)}</div>` : ''}
        <p class="treino-gatilho">${escapeHtml(erro.enunciadoResumo || erro.oQueErrei)}</p>
        <p class="muted">Qual é a regra aqui?</p>
        ${sessao.revelado ? `
          <div class="treino-revelado">
            <p><b>Regra:</b> ${escapeHtml(erro.regraCorreta || '(sem explicação registrada ainda)')}</p>
            ${erro.pegadinha ? `<p><b>Pegadinha:</b> ${escapeHtml(erro.pegadinha)}</p>` : ''}
            ${erro.comoReconhecer ? `<p><b>Como reconhecer:</b> ${escapeHtml(erro.comoReconhecer)}</p>` : ''}
            ${erro.baseLegal ? `<p><b>Base legal:</b> ${escapeHtml(erro.baseLegal)}</p>` : ''}
          </div>
        ` : ''}
      </div>
      <div class="treino-acoes">
        ${!sessao.revelado ? `
          <button class="primary treino-acao-grande" id="treino-revelar-btn">${icone('eye')} Revelar resposta</button>
        ` : `
          <button class="ok treino-acao-grande" id="treino-acertei-btn">${icone('check')} Acertei</button>
          <button class="bad treino-acao-grande" id="treino-errei-btn">${icone('x')} Errei</button>
        `}
      </div>
      <div class="treino-acoes-secundarias">
        <button type="button" id="treino-pular-btn">Pular</button>
        <button type="button" id="treino-sair-btn">Sair</button>
      </div>
    </div>
  `;
}
```

(Nota: `restante` calculada mas não usada no HTML acima além do texto "X de Y" — pode ser removida do corpo da função se sobrar sem uso; conferir no lint visual antes de commitar. Ícones `eye`, `check`, `x`: conferir se já existem no set de `icone()`; se não existirem, usar `check-circle`/`x-circle` ou equivalentes já presentes.)

- [ ] **Passo 4 — `renderTreinoFechamento()`:**

```js
function renderTreinoFechamento(){
  const sessao = state.treinoSessao;
  const hojeIso = hojeISO();
  const corrigidosHoje = window.Treino.errosCorrigidosHoje(state.erros, hojeIso);
  const total = sessao.respostas.length;
  const acertos = sessao.respostas.filter(r => r.acertou).length;
  const pctAcerto = total ? Math.round((acertos/total)*100) : 0;
  return `
    <div class="card treino-fechamento">
      <h2>${icone('flag')} Sessão encerrada</h2>
      <div class="treino-fechamento-metrica-principal">
        <div class="stat-value">${corrigidosHoje}</div>
        <div class="stat-label">Erros corrigidos hoje</div>
      </div>
      <p>${total} item${total===1?'':'s'} revisado${total===1?'':'s'} · ${pctAcerto}% de acerto · melhor combo ${sessao.melhorCombo}</p>
      <button class="primary" id="treino-terminar-btn">Terminar</button>
    </div>
  `;
}
```

- [ ] **Passo 5 — `attachTreinoHandlers()`:**

```js
function attachTreinoHandlers(){
  document.querySelectorAll('[data-treino-tempo]').forEach(btn => {
    btn.addEventListener('click', () => {
      treinoConfigTempo = btn.dataset.treinoTempo === 'fila' ? null : Number(btn.dataset.treinoTempo);
      render();
    });
  });
  document.getElementById('treino-focar-assunto')?.addEventListener('change', (e) => {
    treinoConfigFocarAssunto = e.target.value || null;
    render();
  });
  document.getElementById('treino-comecar-btn')?.addEventListener('click', () => {
    const hojeIso = hojeISO();
    const errosPendentes = window.ErrosIA.filaErrosPendentes(state.erros, hojeIso);
    const itens = window.Treino.errosParaItensFila(errosPendentes);
    const fila = window.Treino.montarFila(itens, { focarAssunto: treinoConfigFocarAssunto });
    state.treinoSessao = window.Treino.criarSessao({ fila, tempoAlvoMin: treinoConfigTempo, modo: 'revisao', filtroAssunto: treinoConfigFocarAssunto });
    saveState(state);
    render();
  });
  document.getElementById('treino-revelar-btn')?.addEventListener('click', () => {
    window.Treino.revelarResposta(state.treinoSessao);
    saveState(state);
    render();
  });
  document.getElementById('treino-acertei-btn')?.addEventListener('click', () => {
    const item = window.Treino.itemAtual(state.treinoSessao);
    const erro = state.erros.find(e => e.id === item.refId);
    if(erro) window.ErrosIA.aplicarRevisaoErro(erro, true, hojeISO());
    window.Treino.registrarResposta(state.treinoSessao, { acertou: true });
    saveState(state);
    render();
  });
  document.getElementById('treino-errei-btn')?.addEventListener('click', () => {
    const item = window.Treino.itemAtual(state.treinoSessao);
    const erro = state.erros.find(e => e.id === item.refId);
    if(erro) window.ErrosIA.aplicarRevisaoErro(erro, false, hojeISO());
    window.Treino.registrarResposta(state.treinoSessao, { acertou: false });
    saveState(state);
    render();
  });
  document.getElementById('treino-pular-btn')?.addEventListener('click', () => {
    window.Treino.pularItem(state.treinoSessao);
    saveState(state);
    render();
  });
  document.getElementById('treino-sair-btn')?.addEventListener('click', () => {
    if(!confirmarAcao('Sair do treino agora? O progresso desta sessão fica salvo — você pode continuar depois.')) return;
    saveState(state);
    state.treinoSessao = null;
    saveState(state);
    render();
  });
  document.getElementById('treino-terminar-btn')?.addEventListener('click', () => {
    state.treinoSessao = null;
    saveState(state);
    render();
  });
}
```

Nota sobre "Sair": o pedido do usuário/spec é "salva e fecha" — como o estado já é persistido a cada resposta (`saveState` já roda em cada handler de resposta), "Sair" só precisa zerar `state.treinoSessao` **sem** marcar a sessão como concluída, de forma que ela não reapareça como retomável. Isso diverge levemente do critério de aceite "sessão interrompida retomável" — ver Task 7 abaixo, que implementa a retomada via **fechar o app/navegar pra outra aba**, não via botão "Sair" (Sair é undo explícito do usuário, retomada é involuntária/app fechado). Registrar essa distinção em `docs/DECISOES-TREINO.md`.

- [ ] **Passo 6:** Rodar `node --test` completo — 43 testes + os 14 novos (Task 1+2) continuam passando (esta task não adiciona teste novo, é só render/handlers de UI, sem lógica pura nova fora dos módulos já testados).
- [ ] **Passo 7:** Commit: `git add index.html docs/DECISOES-TREINO.md && git commit -m "feat(treino): tela completa - entrada, durante, fechamento"`

---

### Task 7: sessão retomável

**Files:**
- Modify: `index.html`

**Comportamento:** ao **navegar pra fora da aba Treino com sessão ativa e não terminada**, ou **fechar/reabrir o app**, `state.treinoSessao` continua salvo (já é o caso, dado que só é zerado em "Sair"/"Terminar"). Falta: a entrada da tela Treino (Task 6, Passo 2) já checa `if(state.treinoSessao)` e desvia pra "durante"/"fechamento" — isso **já cobre a retomada dentro da própria tela**. O que falta é o **aviso visível fora da tela Treino**, pra ele saber que tem uma sessão interrompida sem precisar abrir a aba pra descobrir.

- [ ] **Passo 1:** Em `renderHoje()`, se `state.treinoSessao && !window.Treino.sessaoTerminada(state.treinoSessao)`, mostrar uma linha/botão acima do card de revisões: `"Continuar treino (${state.treinoSessao.indice} de ${state.treinoSessao.fila.length})"` com `data-ir-treino` (handler já deve existir/ser criado junto do botão "Treinar agora" da Task 8 — reaproveitar o mesmo listener, ambos só fazem `currentTab='treino'; render();`).
- [ ] **Passo 2:** Rodar `node --test` completo — verde.
- [ ] **Passo 3:** Commit: `git add index.html && git commit -m "feat(treino): aviso de sessao interrompida na tela Hoje"`

---

### Task 8: "Revisões de hoje" em Hoje vira botão "Treinar agora"

**Files:**
- Modify: `index.html` (bloco `revisoesHtml` dentro de `renderHoje`/`attachHojeHandlers`)

**Antes:** lista item-a-item de `fila` (flashcards representando erros pendentes) com botões acertei/errei por linha.
**Depois:** um botão único, mostrando a contagem, que navega pra Treino.

- [ ] **Passo 1:** Substituir o bloco `revisoesHtml` (a partir de `const revisoesHtml = ...`, incluindo o `.map(f => {...})` de linhas individuais) por:

```js
const pendentesCount = window.ErrosIA ? window.ErrosIA.filaErrosPendentes(state.erros, hojeIso).length : 0;
const revisoesHtml = `
  <div class="card">
    <div class="card-header-row">
      <h3><span class="section-icon">${icone('refresh')}</span>Revisões</h3>
    </div>
    ${pendentesCount ? `
      <button class="primary treino-cta" data-ir-treino>${icone('zap')} Treinar agora (${pendentesCount} pendente${pendentesCount===1?'':'s'})</button>
    ` : `
      <div class="empty-state">
        <div class="empty-state-icon">${icone('check-circle')}</div>
        <p><b>Revisões em dia!</b></p>
      </div>
    `}
  </div>
`;
```

- [ ] **Passo 2:** Remover, dentro de `attachHojeHandlers`, os listeners `button[data-acertei]`/`button[data-errei]` (ficaram órfãos — o HTML que os gerava não existe mais neste ponto da tela; **conferir antes de remover se `data-acertei`/`data-errei` são usados em outro lugar do arquivo** — se sim, manter o listener e só remover o HTML específico deste bloco).
- [ ] **Passo 3:** Adicionar (se ainda não existir da Task 7) o handler `data-ir-treino`: `document.querySelectorAll('[data-ir-treino]').forEach(btn => btn.addEventListener('click', () => { currentTab='treino'; render(); }));` — seguir o padrão exato de `data-ir-erros`/`data-ir-planejamento` já existentes no arquivo.
- [ ] **Passo 4:** Rodar `node --test` completo — verde.
- [ ] **Passo 5:** Commit: `git add index.html && git commit -m "feat(treino): Revisoes de hoje vira botao Treinar agora"`

---

### Task 9: remover o modal antigo de revisão do Caderno de Erros

**Files:**
- Modify: `index.html`

**Remover:** `revisaoSessao` (variável de estado), `iniciarSessaoRevisaoErros`, o modal renderizado a partir dele (`revisaoSessao ? ... : ''` dentro de `renderErros`), e os listeners `erros-revisar-pendentes-btn` / `revisao-sessao-revelar` / `data-revisao-erro-resultado` / `revisao-sessao-completar` (e demais IDs relacionados a esse modal).
**Substituir o botão que abria o modal** (`erros-revisar-pendentes-btn`, provavelmente rotulado "Revisar pendentes") por um botão que faz `currentTab='treino'; render();` — mesmo padrão do Passo 3 da Task 8, reaproveitando `data-ir-treino`.

- [ ] **Passo 1:** Localizar todos os pontos: `revisaoSessao` (declaração + usos), `iniciasSessaoRevisaoErros`/`iniciarSessaoRevisaoErros`, o bloco de modal HTML, e os listeners citados acima. Remover a lógica, manter o botão (trocando o `id`/handler para `data-ir-treino`, texto pode virar "Treinar pendentes").
- [ ] **Passo 2:** Rodar `node --test` completo — verde (nenhum teste depende dessas funções, são só UI/index.html).
- [ ] **Passo 3:** Testar manualmente (`node -e` syntax check do `<script>` extraído, como já é hábito nesta sessão) pra garantir que a remoção não deixou referência solta a identificador inexistente.
- [ ] **Passo 4:** Commit: `git add index.html && git commit -m "refactor(treino): remove modal antigo de revisao do Caderno de Erros, aponta pra tela Treino"`

---

### Task 10: CSS mínimo da tela Treino

**Files:**
- Modify: `index.html` (bloco `<style>`)

**Objetivo:** só o necessário pra tela não ficar quebrada — layout de tela cheia, ações na metade inferior, alvos ≥48px, sem rolagem na entrada em telas pequenas. Seguir os padrões de espaçamento/cor já usados (`var(--space-*)`, `var(--accent)` etc.), não inventar sistema novo.

- [ ] **Passo 1:** Adicionar classes usadas nos templates das Tasks 6-8: `.treino-entrada`, `.treino-config`, `.treino-config-tempo`, `.treino-opcao` (+ `.active`), `.treino-comecar`, `.treino-full-screen`, `.treino-progresso-texto`, `.treino-card`, `.treino-gatilho`, `.treino-revelado`, `.treino-acoes`, `.treino-acao-grande` (min-height 48px, full-width, font grande), `.treino-acoes-secundarias`, `.treino-fechamento`, `.treino-fechamento-metrica-principal`, `.treino-cta`. Espelhar o estilo de `.hero-cta`/`.timer-actions`/`.hero-card` já existentes ao invés de criar do zero — reaproveitar variáveis e paddings.
- [ ] **Passo 2:** Conferir balanceamento de chaves do bloco `<style>` (mesmo script de checagem já usado nesta sessão: contar `{`/`}`).
- [ ] **Passo 3:** Commit: `git add index.html && git commit -m "style(treino): CSS da tela Treino"`

---

### Task 11: revisão final da Fase 1

- [ ] Rodar `node --test` completo — 43 + 14 (treino-fila + treino-sessao) = **57 testes**, todos verdes.
- [ ] Syntax check do `<script>` extraído via `new Function()` (script já usado nesta sessão).
- [ ] Conferir critérios de aceite da Fase 1 (spec §8, os que já se aplicam sem banco de questões): fila sem 3 seguidos do mesmo assunto ✓ (testado); sessão retomável ✓ (Task 7); `sw.js` atualizado ✓ (Task 4); nenhuma tela existente muda além de Hoje/Caderno de Erros conforme descrito ✓.
- [ ] Push: `git push -u origin worktree-tela-treino` (branch da worktree — decidir no fim da Fase 1 se faz merge direto pro `main` ou mantém como branch até a Fase 5 fechar; **decisão conservadora, registrar em `docs/DECISOES-TREINO.md`:** merge pro `main` ao fim de CADA fase, não só no fim das 5 — mantém o app publicado (GitHub Pages) incrementalmente atualizado e reduz o risco de um branch gigante de 5 fases divergir do `main`).
- [ ] Merge local pro `main`, resolver conflitos se houver, rodar suíte de novo pós-merge, `git push origin main`.
- [ ] Mensagem curta de status (não pausar pra aprovação, só informar) antes de seguir pra Fase 2.
