# Caderno de Erros — Modelo de Dados + Repetição Espaçada Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Dar ao Erro do Caderno de Erros seu próprio schema estendido (tema/subtema/concurso, tipo de erro mais granular, regra correta + como reconhecer, confiança, prioridade com nível crítico) e seu próprio motor de repetição espaçada (status novo/recorrente/corrigido, curva 1→3→7→14→30 dias), sem quebrar nada que hoje depende do agendamento por Flashcard (tela Hoje, Dashboard, notificações, relatório semanal).

**Architecture:** Lógica pura nova (migração de schema, motor de repetição, cálculo de assunto crítico) entra em dois módulos ES novos (`erros-ia-modelo.js`, `erros-ia-repeticao.js`) testáveis via `node --test`, sem dependência de DOM. Um terceiro módulo (`erros-ia.js`) agrega os dois e expõe `window.ErrosIA` para o `index.html` consumir. O `index.html` (5200 linhas, sem build step) recebe apenas as edições mínimas necessárias: tag de script, chamada de migração, e os pontos de UI do Caderno de Erros que precisam refletir os campos novos. Os outros consumidores do Flashcard (Hoje, Dashboard, notificações, relatório semanal) **não são tocados** — nos 2 lugares onde hoje se registra uma revisão de flashcard, uma linha a mais chama `window.ErrosIA.aplicarRevisaoErro(...)` em paralelo, mantendo os dois sistemas sincronizados pelo mesmo clique do usuário.

**Tech Stack:** JavaScript vanilla ES2020+, ES modules nativos (`<script type="module">`, sem bundler), Node.js 24 + `node:test`/`node:assert` para testes das funções puras (zero dependências novas), GitHub Pages como hospedagem estática.

**Spec:** Definida em conversa (brainstorming architectural path, sem arquivo de spec formal — o usuário optou por pular a escrita do documento e ir direto ao plano). Decisões-chave que este plano implementa:
- `assunto` **não** é renomeado (usado em dezenas de call sites fora do Erro); `subtema` e `concurso` são campos novos, aditivos.
- `tipoErro` troca de enum: `conteudo|interpretacao|distracao` → `chute|erro_conceitual|confusao_conceitos|falha_memorizacao|falha_interpretacao` (migração mapeia os 3 antigos).
- `explicacao` (mín. 200 caracteres, validado) vira `regraCorreta` (sem validação de tamanho) + `comoReconhecer` (novo). `pegadinha` já existia.
- `prioridade` ganha nível `critica` (acima de `alta`).
- Erro ganha `status` (`novo|recorrente|corrigido`), `proximaRevisao`, `intervaloRevisaoDias`, `dataUltimaRevisao`, `revisoes[]` — curva própria 1→3→7→14→30, 2 acertos seguidos → `corrigido`, 1 erro → reseta pra 1 dia + `recorrente` + sobe prioridade um nível.
- O motor de agendamento por Flashcard (SM-2 simplificado) **continua existindo e sendo a fonte de verdade** para tela Hoje, Dashboard, notificações e relatório semanal — não é substituído, só passa a rodar em paralelo com o motor novo do Erro.

## Global Constraints

- Não usar nenhuma dependência nova além do que já está no projeto (Chart.js, Firebase SDK via CDN) — os módulos novos não têm dependências.
- Não alterar o comportamento de nada fora do Caderno de Erros: tela Hoje, Dashboard, notificações e relatório semanal devem continuar funcionando exatamente como hoje.
- Todo texto de usuário interpolado em HTML passa por `escapeHtml()` (convenção de segurança já existente, reforçada pelo CSP do commit `d69aa40`).
- Migração de dados existentes é sempre aditiva e idempotente, seguindo o padrão de `migrarErrosParaModeloV2` (index.html:1282) — nunca apaga dado do usuário.
- Sem framework de testes de UI — mudanças em `index.html` são verificadas manualmente no browser (via servidor estático local, não `file://`, porque `<script type="module">` é bloqueado por CORS em `file://`).

---

## Task 1: `erros-ia-modelo.js` — schema, migração e cálculo de assunto crítico

**Files:**
- Create: `package.json`
- Create: `erros-ia-modelo.js`
- Test: `erros-ia-modelo.test.js`

**Interfaces:**
- Produces: `migrarErroParaSchemaIA(erro)` (mutates e retorna o erro), `recalcularExplicacaoPendente(erro)` (mutates `erro.precisaCompletar`, retorna boolean), `subirPrioridade(prioridade)` (retorna string), `calcularAssuntoMaisCritico(erros)` (retorna `{assunto, pontos}` ou `null`), `TIPO_ERRO_LABEL` (objeto), `PRIORIDADE_ORDEM` (array `['critica','alta','media','baixa']`).

- [ ] **Step 1: Criar `package.json` mínimo pra habilitar ES modules + test runner**

```json
{
  "name": "gerenciador-de-estudos",
  "private": true,
  "type": "module",
  "scripts": {
    "test": "node --test"
  }
}
```

- [ ] **Step 2: Escrever os testes (falhando, módulo ainda não existe)**

Create `erros-ia-modelo.test.js`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { migrarErroParaSchemaIA, recalcularExplicacaoPendente, subirPrioridade, calcularAssuntoMaisCritico } from './erros-ia-modelo.js';

test('migrarErroParaSchemaIA adiciona campos novos e migra tipoErro/explicacao', () => {
  const erro = { id:'1', criadoEm:'2026-08-10', assunto:'PNRH', tipoErro:'conteudo', explicacao:'texto antigo', prioridade:'media' };
  migrarErroParaSchemaIA(erro);
  assert.equal(erro.tipoErro, 'erro_conceitual');
  assert.equal(erro.regraCorreta, 'texto antigo');
  assert.equal('explicacao' in erro, false);
  assert.equal(erro.status, 'novo');
  assert.equal(erro.proximaRevisao, '2026-08-10');
  assert.equal(erro.intervaloRevisaoDias, 1);
  assert.deepEqual(erro.revisoes, []);
  assert.equal(erro.subtema, null);
  assert.equal(erro.concurso, null);
});

test('migrarErroParaSchemaIA é idempotente', () => {
  const erro = { id:'1', criadoEm:'2026-08-10', assunto:'PNRH', tipoErro:'interpretacao', explicacao:'x', prioridade:'alta' };
  migrarErroParaSchemaIA(erro);
  erro.status = 'recorrente';
  migrarErroParaSchemaIA(erro);
  assert.equal(erro.status, 'recorrente');
});

test('migrarErroParaSchemaIA mapeia os 3 tipos antigos', () => {
  const conteudo = { id:'1', criadoEm:'2026-08-10', tipoErro:'conteudo' };
  const interpretacao = { id:'2', criadoEm:'2026-08-10', tipoErro:'interpretacao' };
  const distracao = { id:'3', criadoEm:'2026-08-10', tipoErro:'distracao' };
  migrarErroParaSchemaIA(conteudo);
  migrarErroParaSchemaIA(interpretacao);
  migrarErroParaSchemaIA(distracao);
  assert.equal(conteudo.tipoErro, 'erro_conceitual');
  assert.equal(interpretacao.tipoErro, 'falha_interpretacao');
  assert.equal(distracao.tipoErro, 'chute');
});

test('recalcularExplicacaoPendente exige regraCorreta + pegadinha + comoReconhecer', () => {
  const erro = { regraCorreta:'r', pegadinha:null, comoReconhecer:'c' };
  assert.equal(recalcularExplicacaoPendente(erro), true);
  erro.pegadinha = 'p';
  assert.equal(recalcularExplicacaoPendente(erro), false);
});

test('subirPrioridade avança na escala e trava em critica', () => {
  assert.equal(subirPrioridade('baixa'), 'media');
  assert.equal(subirPrioridade('media'), 'alta');
  assert.equal(subirPrioridade('alta'), 'critica');
  assert.equal(subirPrioridade('critica'), 'critica');
});

test('calcularAssuntoMaisCritico ignora corrigidos e pondera por prioridade+erros', () => {
  const erros = [
    { assunto:'A', status:'novo', prioridade:'baixa', revisoes:[] },
    { assunto:'B', status:'recorrente', prioridade:'critica', revisoes:[{acertou:false},{acertou:false}] },
    { assunto:'B', status:'corrigido', prioridade:'critica', revisoes:[{acertou:false}] },
  ];
  const resultado = calcularAssuntoMaisCritico(erros);
  assert.equal(resultado.assunto, 'B');
});

test('calcularAssuntoMaisCritico retorna null sem erros ativos', () => {
  assert.equal(calcularAssuntoMaisCritico([]), null);
});
```

- [ ] **Step 3: Rodar os testes e confirmar que falham (módulo não existe)**

Run: `node --test`
Expected: FAIL — `Cannot find module './erros-ia-modelo.js'`

- [ ] **Step 4: Implementar `erros-ia-modelo.js`**

```js
export const TIPO_ERRO_LABEL = {
  chute: 'Chute',
  erro_conceitual: 'Erro conceitual',
  confusao_conceitos: 'Confusão entre conceitos',
  falha_memorizacao: 'Falha de memorização',
  falha_interpretacao: 'Falha de interpretação',
};

export const PRIORIDADE_ORDEM = ['critica', 'alta', 'media', 'baixa'];

const TIPO_ERRO_MIGRACAO = { conteudo: 'erro_conceitual', interpretacao: 'falha_interpretacao', distracao: 'chute' };

export function migrarErroParaSchemaIA(erro){
  if('status' in erro) return erro; // já migrado
  erro.subtema = erro.subtema ?? null;
  erro.concurso = erro.concurso ?? null;
  erro.tipoErro = TIPO_ERRO_MIGRACAO[erro.tipoErro] || erro.tipoErro || 'erro_conceitual';
  erro.regraCorreta = erro.explicacao ?? '';
  delete erro.explicacao;
  erro.comoReconhecer = erro.comoReconhecer ?? null;
  erro.confiancaExplicacao = erro.confiancaExplicacao ?? null;
  erro.status = 'novo';
  erro.dataUltimaRevisao = null;
  erro.proximaRevisao = erro.criadoEm;
  erro.intervaloRevisaoDias = 1;
  erro.revisoes = [];
  return erro;
}

export function recalcularExplicacaoPendente(erro){
  const completo = !!(erro.regraCorreta && erro.regraCorreta.trim())
    && !!(erro.pegadinha && erro.pegadinha.trim())
    && !!(erro.comoReconhecer && erro.comoReconhecer.trim());
  erro.precisaCompletar = !completo;
  return erro.precisaCompletar;
}

export function subirPrioridade(prioridade){
  const idx = PRIORIDADE_ORDEM.indexOf(prioridade);
  if(idx <= 0) return PRIORIDADE_ORDEM[0];
  return PRIORIDADE_ORDEM[idx - 1];
}

export function calcularAssuntoMaisCritico(erros){
  const peso = { critica: 4, alta: 3, media: 2, baixa: 1 };
  const pontosPorAssunto = {};
  erros.forEach(e => {
    if(e.status === 'corrigido') return;
    const errosNaRevisao = (e.revisoes || []).filter(r => !r.acertou).length;
    const pontos = (peso[e.prioridade] || 1) * (1 + errosNaRevisao);
    pontosPorAssunto[e.assunto] = (pontosPorAssunto[e.assunto] || 0) + pontos;
  });
  let assunto = null, max = 0;
  Object.entries(pontosPorAssunto).forEach(([nome, pontos]) => { if(pontos > max){ max = pontos; assunto = nome; } });
  return assunto ? { assunto, pontos: max } : null;
}
```

- [ ] **Step 5: Rodar os testes e confirmar que passam**

Run: `node --test`
Expected: PASS — 7 testes ok

- [ ] **Step 6: Commit**

```bash
git add package.json erros-ia-modelo.js erros-ia-modelo.test.js
git commit -m "feat(erros): schema v3 do Erro (subtema/concurso/status/tipoErro novo) com migração aditiva"
```

---

## Task 2: `erros-ia-repeticao.js` — motor de repetição espaçada do Erro

**Files:**
- Create: `erros-ia-repeticao.js`
- Test: `erros-ia-repeticao.test.js`

**Interfaces:**
- Consumes: `subirPrioridade(prioridade)` de `./erros-ia-modelo.js`.
- Produces: `aplicarRevisaoErro(erro, acertou, hojeIso)` (mutates e retorna o erro), `estaPendenteRevisao(erro, hojeIso)` (boolean), `filaErrosPendentes(erros, hojeIso)` (array ordenado por `proximaRevisao` crescente).

- [ ] **Step 1: Escrever os testes (falhando)**

Create `erros-ia-repeticao.test.js`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { aplicarRevisaoErro, estaPendenteRevisao, filaErrosPendentes } from './erros-ia-repeticao.js';

function erroBase(overrides){
  return { status:'novo', prioridade:'media', intervaloRevisaoDias:1, proximaRevisao:'2026-08-10', dataUltimaRevisao:null, revisoes:[], ...overrides };
}

test('acertar dobra o intervalo seguindo 1→3→7→14→30', () => {
  const erro = erroBase();
  aplicarRevisaoErro(erro, true, '2026-08-10');
  assert.equal(erro.intervaloRevisaoDias, 3);
  aplicarRevisaoErro(erro, true, '2026-08-13');
  assert.equal(erro.intervaloRevisaoDias, 7);
  aplicarRevisaoErro(erro, true, '2026-08-20');
  assert.equal(erro.intervaloRevisaoDias, 14);
  aplicarRevisaoErro(erro, true, '2026-09-03');
  assert.equal(erro.intervaloRevisaoDias, 30);
  aplicarRevisaoErro(erro, true, '2026-10-03');
  assert.equal(erro.intervaloRevisaoDias, 30);
});

test('2 acertos seguidos marcam status corrigido', () => {
  const erro = erroBase();
  aplicarRevisaoErro(erro, true, '2026-08-10');
  assert.equal(erro.status, 'novo');
  aplicarRevisaoErro(erro, true, '2026-08-13');
  assert.equal(erro.status, 'corrigido');
});

test('errar reseta intervalo, marca recorrente e sobe prioridade', () => {
  const erro = erroBase({ prioridade:'media', intervaloRevisaoDias:14 });
  aplicarRevisaoErro(erro, false, '2026-08-10');
  assert.equal(erro.intervaloRevisaoDias, 1);
  assert.equal(erro.status, 'recorrente');
  assert.equal(erro.prioridade, 'alta');
  assert.equal(erro.proximaRevisao, '2026-08-11');
});

test('estaPendenteRevisao ignora corrigidos mesmo com data vencida', () => {
  const erro = erroBase({ status:'corrigido', proximaRevisao:'2020-01-01' });
  assert.equal(estaPendenteRevisao(erro, '2026-08-19'), false);
});

test('filaErrosPendentes ordena por proximaRevisao crescente e ignora corrigidos/futuros', () => {
  const erros = [
    erroBase({ proximaRevisao:'2026-08-20' }),
    erroBase({ proximaRevisao:'2026-08-15' }),
    erroBase({ status:'corrigido', proximaRevisao:'2020-01-01' }),
  ];
  const fila = filaErrosPendentes(erros, '2026-08-19');
  assert.equal(fila.length, 1);
  assert.equal(fila[0].proximaRevisao, '2026-08-15');
});
```

- [ ] **Step 2: Rodar e confirmar falha**

Run: `node --test`
Expected: FAIL — `Cannot find module './erros-ia-repeticao.js'`

- [ ] **Step 3: Implementar `erros-ia-repeticao.js`**

```js
import { subirPrioridade } from './erros-ia-modelo.js';

const SEQUENCIA_INTERVALOS = [1, 3, 7, 14, 30];

function addDaysIso(iso, dias){
  const d = new Date(iso + 'T00:00:00');
  d.setDate(d.getDate() + dias);
  return d.toISOString().slice(0, 10);
}

function proximoIntervalo(atual){
  const idx = SEQUENCIA_INTERVALOS.indexOf(atual);
  if(idx === -1 || idx === SEQUENCIA_INTERVALOS.length - 1) return SEQUENCIA_INTERVALOS[SEQUENCIA_INTERVALOS.length - 1];
  return SEQUENCIA_INTERVALOS[idx + 1];
}

export function aplicarRevisaoErro(erro, acertou, hojeIso){
  if(!Array.isArray(erro.revisoes)) erro.revisoes = [];
  erro.revisoes.push({ data: hojeIso, acertou: !!acertou });
  erro.dataUltimaRevisao = hojeIso;
  if(acertou){
    erro.intervaloRevisaoDias = proximoIntervalo(erro.intervaloRevisaoDias || 1);
    erro.proximaRevisao = addDaysIso(hojeIso, erro.intervaloRevisaoDias);
    const ultimasDuas = erro.revisoes.slice(-2);
    const duasSeguidasCorretas = ultimasDuas.length === 2 && ultimasDuas.every(r => r.acertou);
    if(duasSeguidasCorretas) erro.status = 'corrigido';
  } else {
    erro.intervaloRevisaoDias = 1;
    erro.proximaRevisao = addDaysIso(hojeIso, 1);
    erro.status = 'recorrente';
    erro.prioridade = subirPrioridade(erro.prioridade);
  }
  return erro;
}

export function estaPendenteRevisao(erro, hojeIso){
  return erro.status !== 'corrigido' && erro.proximaRevisao <= hojeIso;
}

export function filaErrosPendentes(erros, hojeIso){
  return erros
    .filter(e => estaPendenteRevisao(e, hojeIso))
    .sort((a, b) => a.proximaRevisao < b.proximaRevisao ? -1 : a.proximaRevisao > b.proximaRevisao ? 1 : 0);
}
```

- [ ] **Step 4: Rodar e confirmar que passam todos os testes (Task 1 + Task 2)**

Run: `node --test`
Expected: PASS — 12 testes ok

- [ ] **Step 5: Commit**

```bash
git add erros-ia-repeticao.js erros-ia-repeticao.test.js
git commit -m "feat(erros): motor de repeticao espacada proprio do Erro (1-3-7-14-30, status, prioridade)"
```

---

## Task 3: `erros-ia.js` — agregador + ponte pro `index.html`

**Files:**
- Create: `erros-ia.js`
- Modify: `index.html` (fim do arquivo, ~linha 5201)

**Interfaces:**
- Consumes: tudo de `erros-ia-modelo.js` e `erros-ia-repeticao.js` (Tasks 1-2).
- Produces: `window.ErrosIA` disponível globalmente no browser, contendo todas as funções exportadas pelos dois módulos.

- [ ] **Step 1: Implementar `erros-ia.js`**

```js
import * as Modelo from './erros-ia-modelo.js';
import * as Repeticao from './erros-ia-repeticao.js';

const ErrosIA = { ...Modelo, ...Repeticao };

if(typeof window !== 'undefined') window.ErrosIA = ErrosIA;

export default ErrosIA;
```

- [ ] **Step 2: Adicionar a tag de módulo no `index.html`**

Modify `index.html` — old:

```html
  atualizarVisibilidadeApp();
  iniciarGateDeAutenticacao();
  </script>
</body>
</html>
```

New:

```html
  atualizarVisibilidadeApp();
  iniciarGateDeAutenticacao();
  </script>
  <script type="module" src="erros-ia.js"></script>
</body>
</html>
```

**Nota de ordenação:** `<script type="module">` é sempre adiado (`defer` implícito) e roda depois de todo script clássico síncrono ter terminado — inclusive esse script principal, que termina de rodar antes do parser sequer chegar nessa tag. Como `iniciarGateDeAutenticacao()` é assíncrono (aguarda o SDK do Firebase e o login), o primeiro `render()` de verdade só acontece bem depois — quando `erros-ia.js` já terminou de carregar. É por isso que é seguro consumir `window.ErrosIA` de dentro de `render()`/handlers, mas **não** de código que roda de forma síncrona no `<script>` principal (ex.: dentro de `loadState()` ou de `verificarNotificacoesPendentes()`, que hoje é chamada de forma síncrona logo depois de `attachTabsHandlers()`).

- [ ] **Step 3: Verificar manualmente no browser**

`<script type="module">` é bloqueado por CORS quando a página é aberta via `file://`. Suba um servidor estático local antes de testar:

Run: `npx --yes serve .` (ou `python -m http.server 8000`, se preferir)

Abra a URL indicada, abra o Console do DevTools e confirme que `window.ErrosIA` existe e tem as funções esperadas:

```js
Object.keys(window.ErrosIA)
// deve incluir: migrarErroParaSchemaIA, recalcularExplicacaoPendente, subirPrioridade,
// calcularAssuntoMaisCritico, aplicarRevisaoErro, estaPendenteRevisao, filaErrosPendentes,
// TIPO_ERRO_LABEL, PRIORIDADE_ORDEM
```

O app deve continuar funcionando normalmente (nada consome `window.ErrosIA` ainda nesta task).

- [ ] **Step 4: Commit**

```bash
git add erros-ia.js index.html
git commit -m "feat(erros): expõe window.ErrosIA via modulo agregador"
```

---

## Task 4: Schema v3 no Caderno de Erros — formulário, card e migração ativada

**Files:**
- Modify: `index.html` — constantes (~linha 1323), `criarErro`/`atualizarErro` (~linha 1364), modal de erro em `renderErros` (~linha 4167), handlers em `attachErrosHandlers` (~linha 4394), card em `renderErros` (~linha 4081), CSS (~linha 260), `render()` (~linha 5184).

**Interfaces:**
- Consumes: `window.ErrosIA.migrarErroParaSchemaIA`, `window.ErrosIA.recalcularExplicacaoPendente` (Task 1, via ponte da Task 3).

- [ ] **Step 1: Ativar a migração em toda renderização**

Modify `index.html` — old:

```js
  function render(){ renderSidebar(); renderTabsNav(); renderScreen(); }
```

New:

```js
  function render(){
    if(window.ErrosIA) state.erros.forEach(window.ErrosIA.migrarErroParaSchemaIA);
    renderSidebar(); renderTabsNav(); renderScreen();
  }
```

- [ ] **Step 2: Trocar os enums/labels e remover a validação de 200 caracteres**

Modify `index.html` — old:

```js
  const ORIGEM_LABEL = { questao_prova:'Questão de prova', simulado:'Simulado', leitura:'Leitura', aula:'Aula' };
  const TIPO_ERRO_LABEL = { conteudo:'Conteúdo', interpretacao:'Interpretação', distracao:'Distração' };
  const PRIORIDADE_LABEL = { alta:'Alta prioridade', media:'Média prioridade', baixa:'Baixa prioridade' };
  const EXPLICACAO_MIN_CHARS = 200;
  const EXPLICACAO_PREFIXOS_PROIBIDOS = ['revisar','estudar','ver ','consultar','olhar','buscar','pesquisar','rever'];

  function validarExplicacao(texto){
    const limpo = (texto || '').trim();
    if(limpo.length < EXPLICACAO_MIN_CHARS){
      return `Isso é um lembrete, não uma explicação. Escreva o conteúdo em si — o que você precisa saber para acertar da próxima vez. (mínimo ${EXPLICACAO_MIN_CHARS} caracteres, tem ${limpo.length})`;
    }
    const normalizado = limpo.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'');
    if(EXPLICACAO_PREFIXOS_PROIBIDOS.some(p => normalizado.startsWith(p))){
      return 'Isso é um lembrete, não uma explicação. Escreva o conteúdo em si — o que você precisa saber para acertar da próxima vez.';
    }
    return null;
  }
```

New:

```js
  const ORIGEM_LABEL = { questao_prova:'Questão de prova', simulado:'Simulado', leitura:'Leitura', aula:'Aula' };
  const TIPO_ERRO_LABEL = { chute:'Chute', erro_conceitual:'Erro conceitual', confusao_conceitos:'Confusão entre conceitos', falha_memorizacao:'Falha de memorização', falha_interpretacao:'Falha de interpretação' };
  const PRIORIDADE_LABEL = { critica:'Crítica', alta:'Alta prioridade', media:'Média prioridade', baixa:'Baixa prioridade' };
  const CONFIANCA_EXPLICACAO_LABEL = { alta:'Alta', media:'Média', baixa:'Baixa (pode ter mudado)' };
```

- [ ] **Step 3: Reescrever `criarErro` com o schema novo**

Modify `index.html` — old:

```js
  function criarErro(state, dados){
    const hoje = hojeISO();
    const erro = {
      id: String(Date.now()) + Math.random().toString(36).slice(2,7),
      criadoEm: hoje,
      disciplinaId: dados.disciplinaId || dados.assunto,
      assunto: dados.assunto,
      origem: dados.origem || 'leitura',
      fonte: dados.fonte || null,
      enunciadoResumo: dados.enunciadoResumo || '',
      oQueErrei: dados.oQueErrei,
      explicacao: dados.explicacao || '',
      pegadinha: dados.pegadinha || null,
      baseLegal: dados.baseLegal || null,
      tipoErro: dados.tipoErro || 'conteudo',
      prioridade: dados.prioridade || 'media',
      flashcardIds: [],
      precisaCompletar: !!dados.precisaCompletar,
    };
    state.erros.push(erro);
    criarFlashcard(state, erro.id, {
      frente: erro.pegadinha || erro.oQueErrei,
      verso: erro.explicacao,
      precisaCompletar: erro.precisaCompletar,
    });
    return erro;
  }
```

New:

```js
  function criarErro(state, dados){
    const hoje = hojeISO();
    const erro = {
      id: String(Date.now()) + Math.random().toString(36).slice(2,7),
      criadoEm: hoje,
      disciplinaId: dados.disciplinaId || dados.assunto,
      assunto: dados.assunto,
      subtema: dados.subtema || null,
      concurso: dados.concurso || null,
      origem: dados.origem || 'leitura',
      fonte: dados.fonte || null,
      enunciadoResumo: dados.enunciadoResumo || '',
      oQueErrei: dados.oQueErrei,
      regraCorreta: dados.regraCorreta || '',
      pegadinha: dados.pegadinha || null,
      comoReconhecer: dados.comoReconhecer || null,
      confiancaExplicacao: dados.confiancaExplicacao || null,
      baseLegal: dados.baseLegal || null,
      tipoErro: dados.tipoErro || 'erro_conceitual',
      prioridade: dados.prioridade || 'media',
      status: 'novo',
      dataUltimaRevisao: null,
      proximaRevisao: hoje,
      intervaloRevisaoDias: 1,
      revisoes: [],
      flashcardIds: [],
      precisaCompletar: true,
    };
    window.ErrosIA.recalcularExplicacaoPendente(erro);
    state.erros.push(erro);
    criarFlashcard(state, erro.id, {
      frente: erro.pegadinha || erro.oQueErrei,
      verso: erro.regraCorreta,
      precisaCompletar: erro.precisaCompletar,
    });
    return erro;
  }
```

- [ ] **Step 4: Reescrever `atualizarErro` com o schema novo**

Modify `index.html` — old:

```js
  function atualizarErro(state, id, dados){
    const erro = state.erros.find(e => e.id === id);
    if(!erro) return null;
    erro.assunto = dados.assunto;
    erro.disciplinaId = dados.disciplinaId || dados.assunto;
    erro.origem = dados.origem || erro.origem;
    erro.fonte = dados.fonte ?? erro.fonte;
    erro.enunciadoResumo = dados.enunciadoResumo ?? erro.enunciadoResumo;
    erro.oQueErrei = dados.oQueErrei;
    erro.explicacao = dados.explicacao;
    erro.pegadinha = dados.pegadinha ?? erro.pegadinha;
    erro.baseLegal = dados.baseLegal ?? erro.baseLegal;
    erro.tipoErro = dados.tipoErro || erro.tipoErro;
    erro.prioridade = dados.prioridade || erro.prioridade;
    if(!validarExplicacao(erro.explicacao) && erro.precisaCompletar){
      erro.precisaCompletar = false;
      (erro.flashcardIds||[]).forEach(fcId => {
        const fc = state.flashcards.find(f => f.id === fcId);
        if(fc) fc.precisaCompletar = false;
      });
    }
    return erro;
  }
```

New:

```js
  function atualizarErro(state, id, dados){
    const erro = state.erros.find(e => e.id === id);
    if(!erro) return null;
    erro.assunto = dados.assunto;
    erro.disciplinaId = dados.disciplinaId || dados.assunto;
    erro.subtema = dados.subtema ?? erro.subtema;
    erro.concurso = dados.concurso ?? erro.concurso;
    erro.origem = dados.origem || erro.origem;
    erro.fonte = dados.fonte ?? erro.fonte;
    erro.enunciadoResumo = dados.enunciadoResumo ?? erro.enunciadoResumo;
    erro.oQueErrei = dados.oQueErrei;
    erro.regraCorreta = dados.regraCorreta;
    erro.pegadinha = dados.pegadinha ?? erro.pegadinha;
    erro.comoReconhecer = dados.comoReconhecer ?? erro.comoReconhecer;
    erro.confiancaExplicacao = dados.confiancaExplicacao ?? erro.confiancaExplicacao;
    erro.baseLegal = dados.baseLegal ?? erro.baseLegal;
    erro.tipoErro = dados.tipoErro || erro.tipoErro;
    erro.prioridade = dados.prioridade || erro.prioridade;
    const aindaPendente = window.ErrosIA.recalcularExplicacaoPendente(erro);
    if(!aindaPendente){
      (erro.flashcardIds||[]).forEach(fcId => {
        const fc = state.flashcards.find(f => f.id === fcId);
        if(fc) fc.precisaCompletar = false;
      });
    }
    return erro;
  }
```

- [ ] **Step 5: Reescrever o corpo do formulário no modal (dentro de `renderErros`)**

Modify `index.html` — remover a linha (logo acima do `return` do IIFE do modal):

```js
      const explicacaoInicial = editando ? (erro.explicacao || '') : '';
```

old (bloco do formulário, do label "Explicação completa" até o fim do `<div class="row">` de tipo/prioridade):

```html
            <label>Explicação completa</label>
            <textarea id="erro-form-explicacao" class="erro-form-explicacao" placeholder="Escreva aqui o conteúdo como se fosse ensinar alguém. Ao revisar, você deve conseguir aprender só com este texto.">${escapeHtml(explicacaoInicial)}</textarea>
            <div class="erro-form-contador" id="erro-form-contador">0 / ${EXPLICACAO_MIN_CHARS}</div>
            <small class="muted" id="erro-form-erro-explicacao" style="color:var(--bad);display:none;"></small>
            <details class="erro-form-exemplo">
              <summary>Ver exemplo — ruim vs. bom</summary>
              <p class="muted"><b>Ruim:</b> "Revisar base legal: Lei 9.433/1997"</p>
              <p class="muted"><b>Bom:</b> "O CNRH arbitra conflitos sobre recursos hídricos em última instância administrativa, aprova o Plano Nacional de Recursos Hídricos e estabelece critérios gerais para outorga e cobrança. Pegadinha: o CNRH define critérios gerais — quem executa a outorga é o órgão gestor (ANA, no âmbito federal)."</p>
            </details>
            <label>Pegadinha (opcional)</label>
            <textarea id="erro-form-pegadinha" placeholder="A distinção que a banca explora">${editando ? escapeHtml(erro.pegadinha||'') : ''}</textarea>
            <label>Referência (opcional)</label>
            <input type="text" id="erro-form-baselegal" placeholder="Só a referência. A explicação vai no campo acima." value="${editando ? escapeHtml(erro.baseLegal||'') : ''}">
            <div class="row">
              <div>
                <label>Tipo de erro</label>
                <select id="erro-form-tipo">
                  ${Object.entries(TIPO_ERRO_LABEL).map(([v,l]) => `<option value="${v}" ${(erro?.tipoErro||'conteudo')===v?'selected':''}>${l}</option>`).join('')}
                </select>
              </div>
              <div>
                <label>Prioridade</label>
                <select id="erro-form-prioridade">
                  ${Object.entries(PRIORIDADE_LABEL).map(([v,l]) => `<option value="${v}" ${(erro?.prioridade||'media')===v?'selected':''}>${l}</option>`).join('')}
                </select>
              </div>
            </div>
```

New:

```html
            <label>Regra correta</label>
            <textarea id="erro-form-regra" class="erro-form-explicacao" placeholder="Em uma frase direta: qual é a regra/conceito correto.">${editando ? escapeHtml(erro.regraCorreta||'') : ''}</textarea>
            <label>Pegadinha (opcional)</label>
            <textarea id="erro-form-pegadinha" placeholder="A distinção que a banca explora">${editando ? escapeHtml(erro.pegadinha||'') : ''}</textarea>
            <label>Como reconhecer (opcional)</label>
            <textarea id="erro-form-como-reconhecer" placeholder="O sinal no enunciado que indica esse ponto">${editando ? escapeHtml(erro.comoReconhecer||'') : ''}</textarea>
            <label>Referência (opcional)</label>
            <input type="text" id="erro-form-baselegal" placeholder="Só a referência. A explicação vai no campo acima." value="${editando ? escapeHtml(erro.baseLegal||'') : ''}">
            <div class="row">
              <div>
                <label>Subtema (opcional)</label>
                <input type="text" id="erro-form-subtema" placeholder="Recorte específico do tema" value="${editando ? escapeHtml(erro.subtema||'') : ''}">
              </div>
              <div>
                <label>Concurso (opcional)</label>
                <select id="erro-form-concurso">
                  <option value="" ${!erro?.concurso?'selected':''}>—</option>
                  ${(state.concursos||[]).map(nome => `<option value="${escapeHtml(nome)}" ${(erro?.concurso||'')===nome?'selected':''}>${escapeHtml(nome)}</option>`).join('')}
                </select>
              </div>
            </div>
            <div class="row">
              <div>
                <label>Tipo de erro</label>
                <select id="erro-form-tipo">
                  ${Object.entries(TIPO_ERRO_LABEL).map(([v,l]) => `<option value="${v}" ${(erro?.tipoErro||'erro_conceitual')===v?'selected':''}>${l}</option>`).join('')}
                </select>
              </div>
              <div>
                <label>Prioridade</label>
                <select id="erro-form-prioridade">
                  ${Object.entries(PRIORIDADE_LABEL).map(([v,l]) => `<option value="${v}" ${(erro?.prioridade||'media')===v?'selected':''}>${l}</option>`).join('')}
                </select>
              </div>
            </div>
            <label>Confiança na explicação (opcional)</label>
            <select id="erro-form-confianca">
              <option value="" ${!erro?.confiancaExplicacao?'selected':''}>—</option>
              ${Object.entries(CONFIANCA_EXPLICACAO_LABEL).map(([v,l]) => `<option value="${v}" ${(erro?.confiancaExplicacao||'')===v?'selected':''}>${l}</option>`).join('')}
            </select>
```

- [ ] **Step 6: Remover o contador de caracteres e reescrever o handler de salvar**

Modify `index.html` — remover, dentro de `attachErrosHandlers`:

```js
    const explicacaoInput = document.getElementById('erro-form-explicacao');
    const atualizarContadorExplicacao = () => {
      const contador = document.getElementById('erro-form-contador');
      if(!contador || !explicacaoInput) return;
      const n = explicacaoInput.value.trim().length;
      contador.textContent = `${n} / ${EXPLICACAO_MIN_CHARS}`;
      contador.classList.toggle('ok', n >= EXPLICACAO_MIN_CHARS);
    };
    if(explicacaoInput){
      atualizarContadorExplicacao();
      explicacaoInput.addEventListener('input', atualizarContadorExplicacao);
    }
```

old (handler de salvar):

```js
    document.getElementById('erro-form-salvar')?.addEventListener('click', () => {
      const assunto = document.getElementById('erro-form-assunto').value;
      const origem = document.getElementById('erro-form-origem').value;
      const fonte = document.getElementById('erro-form-fonte').value.trim();
      const enunciadoResumo = document.getElementById('erro-form-enunciado').value.trim();
      const oQueErrei = document.getElementById('erro-form-oque').value.trim();
      const explicacao = document.getElementById('erro-form-explicacao').value.trim();
      const pegadinha = document.getElementById('erro-form-pegadinha').value.trim();
      const baseLegal = document.getElementById('erro-form-baselegal').value.trim();
      const tipoErro = document.getElementById('erro-form-tipo').value;
      const prioridade = document.getElementById('erro-form-prioridade').value;
      const avisoEl = document.getElementById('erro-form-erro-explicacao');
      if(!oQueErrei){ alert('Preencha "o que errei".'); return; }
      const erroValidacao = validarExplicacao(explicacao);
      if(erroValidacao){
        if(avisoEl){ avisoEl.textContent = erroValidacao; avisoEl.style.display = 'block'; }
        return;
      }
      if(avisoEl) avisoEl.style.display = 'none';
      const dados = { assunto, disciplinaId: assunto, origem, fonte: fonte||null, enunciadoResumo, oQueErrei, explicacao, pegadinha: pegadinha||null, baseLegal: baseLegal||null, tipoErro, prioridade };
      if(erroModalAberto.modo === 'editar'){
        atualizarErro(state, erroModalAberto.id, dados);
      } else {
        criarErro(state, dados);
      }
      saveState(state);
      erroModalAberto = null;
      render();
    });
```

New:

```js
    document.getElementById('erro-form-salvar')?.addEventListener('click', () => {
      const assunto = document.getElementById('erro-form-assunto').value;
      const origem = document.getElementById('erro-form-origem').value;
      const fonte = document.getElementById('erro-form-fonte').value.trim();
      const enunciadoResumo = document.getElementById('erro-form-enunciado').value.trim();
      const oQueErrei = document.getElementById('erro-form-oque').value.trim();
      const regraCorreta = document.getElementById('erro-form-regra').value.trim();
      const pegadinha = document.getElementById('erro-form-pegadinha').value.trim();
      const comoReconhecer = document.getElementById('erro-form-como-reconhecer').value.trim();
      const baseLegal = document.getElementById('erro-form-baselegal').value.trim();
      const subtema = document.getElementById('erro-form-subtema').value.trim();
      const concurso = document.getElementById('erro-form-concurso').value;
      const tipoErro = document.getElementById('erro-form-tipo').value;
      const prioridade = document.getElementById('erro-form-prioridade').value;
      const confiancaExplicacao = document.getElementById('erro-form-confianca').value;
      if(!oQueErrei){ alert('Preencha "o que errei".'); return; }
      const dados = { assunto, disciplinaId: assunto, subtema: subtema||null, concurso: concurso||null, origem, fonte: fonte||null, enunciadoResumo, oQueErrei, regraCorreta, pegadinha: pegadinha||null, comoReconhecer: comoReconhecer||null, confiancaExplicacao: confiancaExplicacao||null, baseLegal: baseLegal||null, tipoErro, prioridade };
      if(erroModalAberto.modo === 'editar'){
        atualizarErro(state, erroModalAberto.id, dados);
      } else {
        criarErro(state, dados);
      }
      saveState(state);
      erroModalAberto = null;
      render();
    });
```

- [ ] **Step 7: Atualizar a exibição do card (trecho resumido + corpo expandido)**

Modify `index.html` — old:

```js
      const trechoExplicacao = e.explicacao ? (e.explicacao.length > 110 ? e.explicacao.slice(0,110)+'…' : e.explicacao) : '(sem explicação registrada ainda)';
```

New:

```js
      const trechoExplicacao = e.regraCorreta ? (e.regraCorreta.length > 110 ? e.regraCorreta.slice(0,110)+'…' : e.regraCorreta) : '(sem explicação registrada ainda)';
```

old (corpo expandido do card):

```html
              <div class="erro-card-col" style="grid-column:1/-1;">
                <div class="erro-card-col-titulo erro-col-ok">Explicação</div>
                ${e.explicacao ? `<p>${escapeHtml(e.explicacao)}</p>` : `<p class="muted">Ainda não tem explicação completa registrada. <button class="card-link" data-editar-erro="${e.id}" style="display:inline;width:auto;min-height:auto;padding:0;">Completar agora →</button></p>`}
              </div>
              ${e.pegadinha ? `<div class="erro-card-col erro-card-pegadinha" style="grid-column:1/-1;"><div class="erro-card-col-titulo">Pegadinha</div><p>${escapeHtml(e.pegadinha)}</p></div>` : ''}
```

New:

```html
              <div class="erro-card-col" style="grid-column:1/-1;">
                <div class="erro-card-col-titulo erro-col-ok">Regra correta</div>
                ${e.regraCorreta ? `<p>${escapeHtml(e.regraCorreta)}</p>` : `<p class="muted">Ainda não tem explicação completa registrada. <button class="card-link" data-editar-erro="${e.id}" style="display:inline;width:auto;min-height:auto;padding:0;">Completar agora →</button></p>`}
              </div>
              ${e.pegadinha ? `<div class="erro-card-col erro-card-pegadinha" style="grid-column:1/-1;"><div class="erro-card-col-titulo">Pegadinha</div><p>${escapeHtml(e.pegadinha)}</p></div>` : ''}
              ${e.comoReconhecer ? `<div class="erro-card-col" style="grid-column:1/-1;"><div class="erro-card-col-titulo">Como reconhecer</div><p>${escapeHtml(e.comoReconhecer)}</p></div>` : ''}
```

- [ ] **Step 8: CSS do nível de prioridade crítica**

Modify `index.html` — old:

```css
  .erro-prioridade-badge.prioridade-alta{background:var(--status-high-priority);color:#fff;}
  .erro-prioridade-badge.prioridade-media{background:var(--status-pending);color:#1a1206;}
  .erro-prioridade-badge.prioridade-baixa{background:var(--border);color:var(--muted);}
```

New:

```css
  .erro-prioridade-badge.prioridade-critica{background:var(--fg);color:#fff;}
  .erro-prioridade-badge.prioridade-alta{background:var(--status-high-priority);color:#fff;}
  .erro-prioridade-badge.prioridade-media{background:var(--status-pending);color:#1a1206;}
  .erro-prioridade-badge.prioridade-baixa{background:var(--border);color:var(--muted);}
```

- [ ] **Step 9: Verificar manualmente no browser**

Run: `npx --yes serve .` (se não estiver rodando ainda)

Checklist manual:
1. Abrir a aba "Caderno de Erros" — a lista deve renderizar sem erro no Console.
2. Clicar "+ Novo erro", preencher "O que errei" + "Regra correta", salvar — o erro deve aparecer na lista com badge de prioridade e sem "Explicação pendente" quebrando o layout.
3. Editar um erro existente (dado migrado de antes) — os campos "Regra correta"/"Pegadinha"/"Como reconhecer"/"Subtema"/"Concurso"/"Confiança" devem carregar sem erro no Console (mesmo vazios).
4. No Console, rodar `state.erros[0]` e confirmar que tem `status`, `proximaRevisao`, `intervaloRevisaoDias`, `revisoes: []`, `regraCorreta` (e **não** tem mais `explicacao`).

- [ ] **Step 10: Commit**

```bash
git add index.html
git commit -m "feat(erros): integra schema v3 (regraCorreta/comoReconhecer/subtema/concurso/prioridade critica) no formulario e no card"
```

---

## Task 5: Caderno de Erros passa a agendar pelo próprio Erro (filtros, ordenação, stats)

**Files:**
- Modify: `index.html` — `filtrarErros` (~linha 1469), `statsErros` (~linha 1496), `ordenarErros` (~linha 1517), `renderErros` (`pendentesCount` ~linha 4000, `proximaRevisaoErro` ~linha 4086).

**Interfaces:**
- Consumes: `window.ErrosIA.estaPendenteRevisao`, `window.ErrosIA.filaErrosPendentes`, `window.ErrosIA.PRIORIDADE_ORDEM` (Tasks 1-2, via ponte da Task 3).

- [ ] **Step 1: `filtrarErros` — pendente/revisado/ainda_errando pelo Erro**

Modify `index.html` — old:

```js
      const cards = flashcardsDoErro(state, e.id);
      const pendente = cards.some(f => f.proximaRevisao <= hojeIso);
      const revisado = cards.some(f => f.historico && f.historico.length);
      if(filtro === 'pendentes' && !pendente) return false;
      if(filtro === 'revisados' && !revisado) return false;
      if(filtro === 'alta_prioridade' && prioridadeErro(e) !== 'alta') return false;
      if(filtro === 'ainda_errando'){
        const ultimoResultado = cards
          .flatMap(f => f.historico || [])
          .sort((a,b) => a.data < b.data ? -1 : a.data > b.data ? 1 : 0)
          .pop();
        if(!ultimoResultado || ultimoResultado.resultado !== 'errei') return false;
      }
```

New:

```js
      const pendente = window.ErrosIA.estaPendenteRevisao(e, hojeIso);
      const revisado = e.revisoes && e.revisoes.length > 0;
      if(filtro === 'pendentes' && !pendente) return false;
      if(filtro === 'revisados' && !revisado) return false;
      if(filtro === 'alta_prioridade' && prioridadeErro(e) !== 'alta') return false;
      if(filtro === 'ainda_errando' && e.status !== 'recorrente') return false;
```

- [ ] **Step 2: `statsErros` — pendentes e revisões pelo Erro**

Modify `index.html` — old:

```js
  function statsErros(state, hojeIso){
    const erros = state.erros;
    const flashcards = state.flashcards || [];
    const total = erros.length;
    const pendentes = filaFlashcardsRevisao(state, hojeIso).length;
    const seteDiasAtras = addDays(hojeIso, -7);
    const catorzeDiasAtras = addDays(hojeIso, -14);
    const criadosUltimos7Dias = erros.filter(e => e.criadoEm >= seteDiasAtras).length;
    const historicoTodos = flashcards.flatMap(f => f.historico || []);
    const revisadosEstaSemana = historicoTodos.filter(h => h.data >= seteDiasAtras).length;
    const revisadosSemanaAnterior = historicoTodos.filter(h => h.data >= catorzeDiasAtras && h.data < seteDiasAtras).length;
    const revisoesHoje = historicoTodos.filter(h => h.data === hojeIso).length;
    const errosComRevisao = new Set(flashcards.filter(f => f.historico && f.historico.length).map(f => f.erroId)).size;
    const taxaRevisao = total ? Math.round((errosComRevisao / total) * 100) : 0;
    const porAssunto = {};
    erros.forEach(e => { porAssunto[e.assunto] = (porAssunto[e.assunto]||0) + 1; });
    let assuntoMaisFrequente = null, maxCount = 0;
    Object.entries(porAssunto).forEach(([nome, count]) => { if(count > maxCount){ maxCount = count; assuntoMaisFrequente = nome; } });
    return { total, pendentes, criadosUltimos7Dias, revisadosEstaSemana, deltaRevisados: revisadosEstaSemana - revisadosSemanaAnterior, revisoesHoje, taxaRevisao, assuntoMaisFrequente, assuntoMaisFrequenteCount: maxCount };
  }
```

New:

```js
  function statsErros(state, hojeIso){
    const erros = state.erros;
    const total = erros.length;
    const pendentes = window.ErrosIA.filaErrosPendentes(erros, hojeIso).length;
    const seteDiasAtras = addDays(hojeIso, -7);
    const catorzeDiasAtras = addDays(hojeIso, -14);
    const criadosUltimos7Dias = erros.filter(e => e.criadoEm >= seteDiasAtras).length;
    const revisoesTodas = erros.flatMap(e => e.revisoes || []);
    const revisadosEstaSemana = revisoesTodas.filter(r => r.data >= seteDiasAtras).length;
    const revisadosSemanaAnterior = revisoesTodas.filter(r => r.data >= catorzeDiasAtras && r.data < seteDiasAtras).length;
    const revisoesHoje = revisoesTodas.filter(r => r.data === hojeIso).length;
    const errosComRevisao = erros.filter(e => e.revisoes && e.revisoes.length).length;
    const taxaRevisao = total ? Math.round((errosComRevisao / total) * 100) : 0;
    const porAssunto = {};
    erros.forEach(e => { porAssunto[e.assunto] = (porAssunto[e.assunto]||0) + 1; });
    let assuntoMaisFrequente = null, maxCount = 0;
    Object.entries(porAssunto).forEach(([nome, count]) => { if(count > maxCount){ maxCount = count; assuntoMaisFrequente = nome; } });
    return { total, pendentes, criadosUltimos7Dias, revisadosEstaSemana, deltaRevisados: revisadosEstaSemana - revisadosSemanaAnterior, revisoesHoje, taxaRevisao, assuntoMaisFrequente, assuntoMaisFrequenteCount: maxCount };
  }
```

- [ ] **Step 3: `ordenarErros` — critérios `prioridade`, `mais_errados` e `proxima_revisao` pelo Erro**

Modify `index.html` — old:

```js
    if(criterio === 'prioridade'){
      const peso = { alta:0, media:1, baixa:2 };
      return copia.sort((a,b) => peso[prioridadeErro(a)] - peso[prioridadeErro(b)]);
    }
    if(criterio === 'assunto') return copia.sort((a,b) => a.assunto.localeCompare(b.assunto));
    if(criterio === 'recente') return copia.sort((a,b) => b.criadoEm.localeCompare(a.criadoEm));
    if(criterio === 'mais_errados'){
      const errosCount = id => flashcardsDoErro(state, id).flatMap(f => f.historico||[]).filter(h => h.resultado==='errei').length;
      return copia.sort((a,b) => errosCount(b.id) - errosCount(a.id));
    }
    // 'proxima_revisao' (padrão)
    const proximaDoErro = id => {
      const cards = flashcardsDoErro(state, id);
      if(!cards.length) return '9999-12-31';
      return cards.reduce((min,f) => f.proximaRevisao < min ? f.proximaRevisao : min, cards[0].proximaRevisao);
    };
    return copia.sort((a,b) => proximaDoErro(a.id) < proximaDoErro(b.id) ? -1 : proximaDoErro(a.id) > proximaDoErro(b.id) ? 1 : 0);
```

New:

```js
    if(criterio === 'prioridade'){
      const ordem = window.ErrosIA.PRIORIDADE_ORDEM;
      return copia.sort((a,b) => ordem.indexOf(prioridadeErro(a)) - ordem.indexOf(prioridadeErro(b)));
    }
    if(criterio === 'assunto') return copia.sort((a,b) => a.assunto.localeCompare(b.assunto));
    if(criterio === 'recente') return copia.sort((a,b) => b.criadoEm.localeCompare(a.criadoEm));
    if(criterio === 'mais_errados'){
      const errosCount = e => (e.revisoes||[]).filter(r => !r.acertou).length;
      return copia.sort((a,b) => errosCount(b) - errosCount(a));
    }
    // 'proxima_revisao' (padrão)
    return copia.sort((a,b) => a.proximaRevisao < b.proximaRevisao ? -1 : a.proximaRevisao > b.proximaRevisao ? 1 : 0);
```

- [ ] **Step 4: `renderErros` — `pendentesCount` e `proximaRevisaoErro` do card pelo Erro**

Modify `index.html` — old:

```js
    const pendentesCount = filaFlashcardsRevisao(state, hojeIso).length;
```

New:

```js
    const pendentesCount = window.ErrosIA.filaErrosPendentes(state.erros, hojeIso).length;
```

old (dentro de `cardHtml`):

```js
      const proximaRevisaoErro = cards.length ? cards.reduce((min,f) => f.proximaRevisao < min ? f.proximaRevisao : min, cards[0].proximaRevisao) : null;
```

New:

```js
      const proximaRevisaoErro = e.proximaRevisao;
```

- [ ] **Step 5: Verificar manualmente no browser**

Checklist manual (com o servidor local já rodando):
1. Na aba Caderno de Erros, o contador "Pendentes de revisão" e o botão "Revisar pendentes (N)" devem bater com `state.erros.filter(e => e.status!=='corrigido' && e.proximaRevisao <= hojeISO()).length` calculado manualmente no Console.
2. Trocar o filtro pra "Pendentes"/"Revisados"/"Só os que ainda erro" e confirmar que a lista muda de forma coerente.
3. Trocar a ordenação pra "Prioridade" e confirmar que erros `critica`/`alta` aparecem primeiro.

- [ ] **Step 6: Commit**

```bash
git add index.html
git commit -m "feat(erros): filtros, ordenacao e stats do Caderno de Erros passam a usar o agendamento proprio do Erro"
```

---

## Task 6: Sessão de revisão do Erro + sincronização com a tela Hoje

**Files:**
- Modify: `index.html` — `revisaoSessao` (var, ~linha 3211), `iniciarSessaoRevisao`→`iniciarSessaoRevisaoErros` (~linha 1542), `sessaoModalHtml` em `renderErros` (~linha 3253), handlers em `attachErrosHandlers` (~linha 4453), handlers `data-acertei`/`data-errei` em `attachHojeHandlers` (~linha 3766).

**Interfaces:**
- Consumes: `window.ErrosIA.aplicarRevisaoErro` (Task 2, via ponte da Task 3), `flashcardsDoErro`, `aplicarResultadoRevisao`, `avancarStatusPorAtividade`, `incrementarContadorRevisoes` (já existentes, não tocados nesta task).

**Nota importante:** o motor de agendamento por Flashcard (`aplicarResultadoRevisao`, `filaFlashcardsRevisao`, `obterErroDoFlashcard`) **não é removido nem substituído** — continua sendo a fonte de verdade pra tela Hoje, Dashboard, notificações e relatório semanal. Esta task só faz a sessão de revisão do Caderno de Erros passar a girar em torno do Erro (não mais do Flashcard individual), e garante que os 2 lugares onde o usuário registra uma revisão (aqui e na tela Hoje) também atualizem o status/prioridade do Erro, mantendo os dois sistemas sincronizados pelo mesmo clique.

- [ ] **Step 1: Atualizar o comentário da variável de estado da sessão**

Modify `index.html` — old:

```js
  let revisaoSessao = null; // { fila: [flashcardId,...], indice, revelado }
```

New:

```js
  let revisaoSessao = null; // { fila: [erroId,...], indice, revelado }
```

- [ ] **Step 2: Trocar `iniciarSessaoRevisao` por `iniciarSessaoRevisaoErros`**

Modify `index.html` — old:

```js
  function iniciarSessaoRevisao(state, hojeIso){
    const fila = filaFlashcardsRevisao(state, hojeIso).map(f => f.id);
    if(!fila.length) return null;
    return { fila, indice: 0, revelado: false };
  }
```

New:

```js
  function iniciarSessaoRevisaoErros(state, hojeIso){
    const fila = window.ErrosIA.filaErrosPendentes(state.erros, hojeIso).map(e => e.id);
    if(!fila.length) return null;
    return { fila, indice: 0, revelado: false };
  }
```

- [ ] **Step 3: Reescrever `sessaoModalHtml` pra girar em torno do Erro**

Modify `index.html` — old:

```js
    const sessaoModalHtml = revisaoSessao ? (() => {
      const fcAtual = state.flashcards.find(f => f.id === revisaoSessao.fila[revisaoSessao.indice]);
      const terminou = revisaoSessao.indice >= revisaoSessao.fila.length || !fcAtual;
      const erroAtual = fcAtual ? obterErroDoFlashcard(state, fcAtual) : null;
      return `
        <div class="modal-backdrop" id="revisao-sessao-backdrop">
          <div class="modal-panel revisao-sessao-panel">
            ${terminou ? `
              <div class="empty-state">
                <div class="empty-state-icon">${icone('check-circle',28)}</div>
                <b>Sessão concluída</b>
                <p class="muted">Você revisou ${revisaoSessao.fila.length} flashcard${revisaoSessao.fila.length===1?'':'s'}.</p>
                <button class="primary" id="revisao-sessao-fechar">Fechar</button>
              </div>
            ` : `
              <div class="revisao-sessao-progresso">${revisaoSessao.indice+1} de ${revisaoSessao.fila.length}</div>
              <div class="progress"><i style="width:${Math.round((revisaoSessao.indice)/revisaoSessao.fila.length*100)}%"></i></div>
              ${fcAtual.precisaCompletar ? `
                <div class="erro-form-erro" style="margin-top:var(--space-2);">
                  Card incompleto — completar explicação.
                  <button class="card-link" id="revisao-sessao-completar" style="display:inline;width:auto;min-height:auto;padding:0;">Editar erro de origem →</button>
                </div>` : ''}
              <h3>${escapeHtml(erroAtual?.assunto || '')}</h3>
              <div class="revisao-sessao-secao">
                <p style="font-size:var(--text-lg);">${escapeHtml(fcAtual.frente)}</p>
              </div>
              ${revisaoSessao.revelado ? `
                <div class="revisao-sessao-secao">
                  <div class="erro-card-col-titulo erro-col-ok">Resposta</div>
                  <p>${escapeHtml(fcAtual.verso)}</p>
                </div>
                <div class="revisao-sm2-row">
                  <button class="bad" data-sm2="errei">Errei</button>
                  <button data-sm2="dificil">Difícil</button>
                  <button data-sm2="bom">Bom</button>
                  <button class="ok" data-sm2="facil">Fácil</button>
                </div>
                <button class="card-link" id="revisao-sessao-ver-erro">Ver explicação completa →</button>
              ` : `
                <button class="primary" id="revisao-sessao-revelar">Mostrar resposta</button>
              `}
              <button class="card-link" id="revisao-sessao-cancelar">Encerrar sessão</button>
            `}
          </div>
        </div>`;
    })() : '';
```

New:

```js
    const sessaoModalHtml = revisaoSessao ? (() => {
      const erroAtual = state.erros.find(e => e.id === revisaoSessao.fila[revisaoSessao.indice]);
      const terminou = revisaoSessao.indice >= revisaoSessao.fila.length || !erroAtual;
      const cardsApoio = erroAtual ? flashcardsDoErro(state, erroAtual.id) : [];
      return `
        <div class="modal-backdrop" id="revisao-sessao-backdrop">
          <div class="modal-panel revisao-sessao-panel">
            ${terminou ? `
              <div class="empty-state">
                <div class="empty-state-icon">${icone('check-circle',28)}</div>
                <b>Sessão concluída</b>
                <p class="muted">Você revisou ${revisaoSessao.fila.length} erro${revisaoSessao.fila.length===1?'':'s'}.</p>
                <button class="primary" id="revisao-sessao-fechar">Fechar</button>
              </div>
            ` : `
              <div class="revisao-sessao-progresso">${revisaoSessao.indice+1} de ${revisaoSessao.fila.length}</div>
              <div class="progress"><i style="width:${Math.round((revisaoSessao.indice)/revisaoSessao.fila.length*100)}%"></i></div>
              ${erroAtual.precisaCompletar ? `
                <div class="erro-form-erro" style="margin-top:var(--space-2);">
                  Erro incompleto — completar explicação.
                  <button class="card-link" id="revisao-sessao-completar" style="display:inline;width:auto;min-height:auto;padding:0;">Editar erro de origem →</button>
                </div>` : ''}
              <h3>${escapeHtml(erroAtual.assunto)}</h3>
              <div class="revisao-sessao-secao">
                <p style="font-size:var(--text-lg);">${escapeHtml(erroAtual.oQueErrei)}</p>
              </div>
              ${revisaoSessao.revelado ? `
                <div class="revisao-sessao-secao">
                  <div class="erro-card-col-titulo erro-col-ok">Regra correta</div>
                  <p>${erroAtual.regraCorreta ? escapeHtml(erroAtual.regraCorreta) : '<span class="muted">(sem explicação registrada)</span>'}</p>
                </div>
                ${erroAtual.pegadinha ? `<div class="revisao-sessao-secao"><div class="erro-card-col-titulo">Pegadinha</div><p>${escapeHtml(erroAtual.pegadinha)}</p></div>` : ''}
                ${erroAtual.comoReconhecer ? `<div class="revisao-sessao-secao"><div class="erro-card-col-titulo">Como reconhecer</div><p>${escapeHtml(erroAtual.comoReconhecer)}</p></div>` : ''}
                ${cardsApoio.length ? `<div class="revisao-sessao-secao"><div class="erro-card-col-titulo">Flashcards de apoio</div>${cardsApoio.map(fc => `<p class="muted">${escapeHtml(fc.frente)} → ${escapeHtml(fc.verso)}</p>`).join('')}</div>` : ''}
                <div class="revisao-sm2-row">
                  <button class="bad" data-revisao-erro-resultado="errou">Não lembrei</button>
                  <button class="ok" data-revisao-erro-resultado="acertou">Acertei</button>
                </div>
              ` : `
                <button class="primary" id="revisao-sessao-revelar">Mostrar resposta</button>
              `}
              <button class="card-link" id="revisao-sessao-cancelar">Encerrar sessão</button>
            `}
          </div>
        </div>`;
    })() : '';
```

- [ ] **Step 4: Reescrever os handlers da sessão de revisão**

Modify `index.html` — old:

```js
    document.getElementById('erros-revisar-pendentes-btn')?.addEventListener('click', () => {
      revisaoSessao = iniciarSessaoRevisao(state, hojeISO());
      render();
    });
    document.getElementById('revisao-sessao-revelar')?.addEventListener('click', () => {
      revisaoSessao.revelado = true;
      render();
    });
    document.querySelectorAll('[data-sm2]').forEach(btn => {
      btn.addEventListener('click', () => {
        const fcAtual = state.flashcards.find(f => f.id === revisaoSessao.fila[revisaoSessao.indice]);
        if(fcAtual){
          aplicarResultadoRevisao(fcAtual, btn.dataset.sm2);
          incrementarContadorRevisoes(state);
          const erroDoCard = obterErroDoFlashcard(state, fcAtual);
          if(erroDoCard && (btn.dataset.sm2==='bom'||btn.dataset.sm2==='facil')) avancarStatusPorAtividade(state, erroDoCard.assunto, hojeISO());
        }
        saveState(state);
        revisaoSessao.indice++;
        revisaoSessao.revelado = false;
        render();
      });
    });
    document.getElementById('revisao-sessao-completar')?.addEventListener('click', () => {
      const fcAtual = state.flashcards.find(f => f.id === revisaoSessao.fila[revisaoSessao.indice]);
      const erroDoCard = fcAtual ? obterErroDoFlashcard(state, fcAtual) : null;
      if(erroDoCard){
        erroModalAberto = { modo:'editar', id: erroDoCard.id };
        revisaoSessao = null;
      }
      render();
    });
    document.getElementById('revisao-sessao-ver-erro')?.addEventListener('click', () => {
      const fcAtual = state.flashcards.find(f => f.id === revisaoSessao.fila[revisaoSessao.indice]);
      const erroDoCard = fcAtual ? obterErroDoFlashcard(state, fcAtual) : null;
      if(erroDoCard){
        errosExpandidos.add(erroDoCard.id);
        revisaoSessao = null;
      }
      render();
    });
    document.getElementById('revisao-sessao-fechar')?.addEventListener('click', () => {
      revisaoSessao = null;
      render();
    });
```

New:

```js
    document.getElementById('erros-revisar-pendentes-btn')?.addEventListener('click', () => {
      revisaoSessao = iniciarSessaoRevisaoErros(state, hojeISO());
      render();
    });
    document.getElementById('revisao-sessao-revelar')?.addEventListener('click', () => {
      revisaoSessao.revelado = true;
      render();
    });
    document.querySelectorAll('[data-revisao-erro-resultado]').forEach(btn => {
      btn.addEventListener('click', () => {
        const erroAtual = state.erros.find(e => e.id === revisaoSessao.fila[revisaoSessao.indice]);
        if(erroAtual){
          const acertou = btn.dataset.revisaoErroResultado === 'acertou';
          window.ErrosIA.aplicarRevisaoErro(erroAtual, acertou, hojeISO());
          flashcardsDoErro(state, erroAtual.id).forEach(fc => aplicarResultadoRevisao(fc, acertou ? 'bom' : 'errei'));
          incrementarContadorRevisoes(state);
          if(acertou) avancarStatusPorAtividade(state, erroAtual.assunto, hojeISO());
        }
        saveState(state);
        revisaoSessao.indice++;
        revisaoSessao.revelado = false;
        render();
      });
    });
    document.getElementById('revisao-sessao-completar')?.addEventListener('click', () => {
      const erroAtual = state.erros.find(e => e.id === revisaoSessao.fila[revisaoSessao.indice]);
      if(erroAtual){
        erroModalAberto = { modo:'editar', id: erroAtual.id };
        revisaoSessao = null;
      }
      render();
    });
    document.getElementById('revisao-sessao-fechar')?.addEventListener('click', () => {
      revisaoSessao = null;
      render();
    });
```

(os handlers `revisao-sessao-cancelar` e o clique no backdrop, logo abaixo, não referenciam flashcard e continuam exatamente como estão — não mexer neles.)

- [ ] **Step 5: Sincronizar o Erro quando a revisão acontece pela tela Hoje**

Modify `index.html` — old:

```js
    app.querySelectorAll('button[data-acertei]').forEach(btn => {
      btn.addEventListener('click', () => {
        const f = state.flashcards.find(x => x.id === btn.dataset.acertei);
        if(f){
          aplicarResultadoRevisao(f, 'bom');
          incrementarContadorRevisoes(state);
          const erroDoCard = obterErroDoFlashcard(state, f);
          if(erroDoCard) avancarStatusPorAtividade(state, erroDoCard.assunto, hojeISO());
        }
        saveState(state);
        render();
      });
    });
    app.querySelectorAll('button[data-errei]').forEach(btn => {
      btn.addEventListener('click', () => {
        const f = state.flashcards.find(x => x.id === btn.dataset.errei);
        if(f){
          aplicarResultadoRevisao(f, 'errei');
          incrementarContadorRevisoes(state);
        }
        saveState(state);
        render();
      });
    });
```

New:

```js
    app.querySelectorAll('button[data-acertei]').forEach(btn => {
      btn.addEventListener('click', () => {
        const f = state.flashcards.find(x => x.id === btn.dataset.acertei);
        if(f){
          aplicarResultadoRevisao(f, 'bom');
          incrementarContadorRevisoes(state);
          const erroDoCard = obterErroDoFlashcard(state, f);
          if(erroDoCard){
            avancarStatusPorAtividade(state, erroDoCard.assunto, hojeISO());
            window.ErrosIA.aplicarRevisaoErro(erroDoCard, true, hojeISO());
          }
        }
        saveState(state);
        render();
      });
    });
    app.querySelectorAll('button[data-errei]').forEach(btn => {
      btn.addEventListener('click', () => {
        const f = state.flashcards.find(x => x.id === btn.dataset.errei);
        if(f){
          aplicarResultadoRevisao(f, 'errei');
          incrementarContadorRevisoes(state);
          const erroDoCard = obterErroDoFlashcard(state, f);
          if(erroDoCard) window.ErrosIA.aplicarRevisaoErro(erroDoCard, false, hojeISO());
        }
        saveState(state);
        render();
      });
    });
```

- [ ] **Step 6: Verificar manualmente no browser**

Checklist manual:
1. No Caderno de Erros, clicar "Revisar pendentes" — o modal deve mostrar o "o que errei" do Erro, e ao clicar "Mostrar resposta", a "Regra correta"/pegadinha/como reconhecer/flashcards de apoio.
2. Clicar "Acertei" — no Console, `state.erros.find(...).revisoes` deve ter um item novo `{data, acertou:true}`, e `proximaRevisao` deve ter avançado (1→3 dias).
3. Clicar "Acertei" de novo no mesmo erro (nova sessão) — `status` deve virar `'corrigido'` e o erro deve sumir da fila de pendentes.
4. Na tela Hoje, se houver algum flashcard pendente, clicar ✓ ou ✗ no widget "Revisões de hoje" e confirmar no Console que **tanto** o flashcard (`intervalo`/`historico`) **quanto** o Erro correspondente (`status`/`revisoes`) foram atualizados.
5. Confirmar que o relatório semanal (Configurações → Copiar relatório) e o Dashboard continuam abrindo sem erro no Console — nada ali deveria ter mudado.

- [ ] **Step 7: Commit**

```bash
git add index.html
git commit -m "feat(erros): sessao de revisao passa a girar em torno do Erro, sincronizada com o widget da tela Hoje"
```

---

## Task 7: "Resumo rápido" ganha o assunto mais crítico

**Files:**
- Modify: `index.html` — `renderErros`, bloco `sidebarHtml` (~linha 4147).

**Interfaces:**
- Consumes: `window.ErrosIA.calcularAssuntoMaisCritico` (Task 1, via ponte da Task 3).

- [ ] **Step 1: Calcular o assunto mais crítico no início de `renderErros`**

Modify `index.html` — old:

```js
  function renderErros(){
    const hojeIso = hojeISO();
    const stats = statsErros(state, hojeIso);
```

New:

```js
  function renderErros(){
    const hojeIso = hojeISO();
    const stats = statsErros(state, hojeIso);
    const maisCritico = window.ErrosIA.calcularAssuntoMaisCritico(state.erros);
```

- [ ] **Step 2: Exibir no card "Resumo rápido"**

Modify `index.html` — old:

```html
        <div class="card">
          <h3><span class="section-icon">${icone('link')}</span>Resumo rápido</h3>
          <div class="resumo-meta-item"><div><b>${stats.pendentes}</b><br><small class="muted">Total pendentes</small></div></div>
          <div class="resumo-meta-item"><div><b>${stats.revisoesHoje}</b><br><small class="muted">Revisões hoje</small></div></div>
          <div class="resumo-meta-item"><div><b>${stats.revisadosEstaSemana}</b><br><small class="muted">Revisados esta semana</small></div></div>
          <div class="resumo-meta-item"><div><b>${stats.taxaRevisao}%</b><br><small class="muted">Taxa de revisão</small></div></div>
          <div class="resumo-meta-item"><div><b>${state.contadorRevisoes || 0}</b><br><small class="muted">Total de revisões (desde sempre)</small></div></div>
          ${stats.assuntoMaisFrequente ? `<div class="resumo-meta-item"><div><b>${escapeHtml(stats.assuntoMaisFrequente)}</b><br><small class="muted">Assunto mais frequente — ${stats.assuntoMaisFrequenteCount} erros</small></div></div>` : ''}
        </div>
```

New:

```html
        <div class="card">
          <h3><span class="section-icon">${icone('link')}</span>Resumo rápido</h3>
          <div class="resumo-meta-item"><div><b>${stats.pendentes}</b><br><small class="muted">Total pendentes</small></div></div>
          <div class="resumo-meta-item"><div><b>${stats.revisoesHoje}</b><br><small class="muted">Revisões hoje</small></div></div>
          <div class="resumo-meta-item"><div><b>${stats.revisadosEstaSemana}</b><br><small class="muted">Revisados esta semana</small></div></div>
          <div class="resumo-meta-item"><div><b>${stats.taxaRevisao}%</b><br><small class="muted">Taxa de revisão</small></div></div>
          <div class="resumo-meta-item"><div><b>${state.contadorRevisoes || 0}</b><br><small class="muted">Total de revisões (desde sempre)</small></div></div>
          ${stats.assuntoMaisFrequente ? `<div class="resumo-meta-item"><div><b>${escapeHtml(stats.assuntoMaisFrequente)}</b><br><small class="muted">Assunto mais frequente — ${stats.assuntoMaisFrequenteCount} erros</small></div></div>` : ''}
          ${maisCritico ? `<div class="resumo-meta-item"><div><b style="color:var(--bad);">${escapeHtml(maisCritico.assunto)}</b><br><small class="muted">Assunto mais crítico — recorrência × prioridade</small></div></div>` : ''}
        </div>
```

- [ ] **Step 3: Verificar manualmente no browser**

Checklist manual:
1. Marcar um erro como `recorrente` (errar uma revisão dele) e conferir que ele — ou o assunto dele — aparece como "Assunto mais crítico" no Resumo rápido se tiver a maior pontuação (prioridade × nº de erros na revisão).
2. Com o Caderno de Erros vazio de erros ativos (todos `corrigido`), confirmar que a linha "Assunto mais crítico" simplesmente não aparece (sem erro no Console).

- [ ] **Step 4: Commit**

```bash
git add index.html
git commit -m "feat(erros): resumo rapido do Caderno de Erros ganha o assunto mais critico"
```

---

## Depois deste plano

Este plano cobre só a fundação (schema + motor de repetição + integração no Caderno de Erros). Ficam como plano(s) seguintes, cada um shippável de forma independente:

1. **Export/Import via IA** — botão "Analisar com IA" (monta o prompt com os erros pendentes), campo de colar a resposta, preview de diff, aplicação seletiva, bloco "Padrões detectados". Depende do schema deste plano (usa `regraCorreta`/`comoReconhecer`/`confiancaExplicacao`/`subtema`/`concurso`/`prioridade` já existindo no Erro).
2. **Fluxo questão-a-questão** — novo modo dentro de "Registrar estudo" (Hoje) pra responder questões uma a uma, com "Registrar no caderno de erros" pré-preenchendo o formulário a partir da questão errada. Depende do schema deste plano (usa `criarErro` com os campos novos).
