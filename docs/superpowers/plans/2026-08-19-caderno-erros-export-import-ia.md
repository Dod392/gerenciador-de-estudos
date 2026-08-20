# Caderno de Erros — Export/Import via IA Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deixar o usuário exportar os erros pendentes de explicação do Caderno de Erros como um prompt pronto pra colar numa IA de chat, e importar a resposta da IA de volta (com preview e confirmação) pra preencher `regraCorreta`/`pegadinha`/`comoReconhecer`/`confiancaExplicacao`/`prioridade`, adicionar erros "consolidados" sugeridos pela IA e exibir os padrões que ela identificou.

**Architecture:** Dois módulos ES novos, puros e testáveis (`erros-ia-export.js`, `erros-ia-import.js`), seguindo o mesmo padrão dos módulos do plano anterior (schema + repetição espaçada) — agregados no `erros-ia.js` já existente. O `index.html` ganha dois botões novos no cabeçalho do Caderno de Erros ("Analisar com IA" / "Importar resposta da IA"), cada um com seu próprio modal, e um card "Padrões detectados" populado pela última importação. O mapeamento entre os nomes de campo internos (camelCase: `assunto`, `regraCorreta`, `tipoErro`...) e os nomes que o prompt/resposta da IA usam (snake_case: `tema`, `regra_correta`, `tipo_erro`...) vive só nos dois módulos novos — o resto do app continua falando a língua interna de sempre.

**Tech Stack:** JavaScript vanilla ES2020+, ES modules nativos, Node.js + `node:test` pros módulos novos (mesmo padrão do plano anterior), zero dependências novas.

**Spec:** Definida em conversa (brainstorming architectural path). O template do prompt e o formato de resposta de duas partes (resumo em prosa + bloco ` ```json `) vêm literalmente do pedido original do usuário. As decisões de mapeamento de campo e o desenho de preview/aplicação foram fechadas numa rodada de design condensada, aprovada pelo usuário, referenciando as decisões já tomadas no plano anterior (`docs/superpowers/plans/2026-08-19-caderno-erros-modelo-repeticao.md`), que já está mergeado em `main`.

## Global Constraints

- Zero dependências novas — os módulos novos não têm dependência externa alguma.
- Todo texto de usuário/IA interpolado em HTML passa por `escapeHtml()` (convenção de segurança já existente).
- Nenhuma importação aplica mudança sem o usuário confirmar no preview (a IA pode sugerir qualquer coisa; nada é escrito em `state` antes do clique em "Aplicar alterações").
- A importação nunca escreve nos campos que controlam o motor de repetição espaçada do Erro (`id`, `status`, `proximaRevisao`, `intervaloRevisaoDias`, `revisoes`, `criadoEm`, `dataUltimaRevisao`) mesmo que a resposta colada contenha esses campos — o mapeamento de campos da IA é uma lista de permissão (whitelist), não uma lista de bloqueio, então qualquer campo fora da lista é ignorado por construção.
- `precisaCompletar` nunca é lido diretamente da resposta da IA — é sempre recalculado via `window.ErrosIA.recalcularExplicacaoPendente` depois de aplicar os outros campos.
- Colar um texto malformado (sem bloco ` ```json `, ou JSON inválido, ou não é um array) mostra uma mensagem de erro clara e não quebra a tela.

---

## Task 1: `erros-ia-export.js` — template do prompt e seleção de erros

**Files:**
- Create: `erros-ia-export.js`
- Test: `erros-ia-export.test.js`

**Interfaces:**
- Produces: `PROMPT_TEMPLATE` (string com o placeholder `{{ERROS_JSON}}`), `selecionarErrosParaExportar(erros)` (retorna array filtrado), `montarPromptIA(erros)` (retorna string com o template preenchido).

- [ ] **Step 1: Escrever os testes (falhando)**

Create `erros-ia-export.test.js`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { selecionarErrosParaExportar, montarPromptIA, PROMPT_TEMPLATE } from './erros-ia-export.js';

function erro(overrides){
  return {
    id: '1', criadoEm: '2026-08-10', assunto: 'PNRH', subtema: null, disciplinaId: 'PNRH',
    concurso: null, tipoErro: 'erro_conceitual', oQueErrei: 'confundi outorga com licenciamento',
    regraCorreta: '', pegadinha: null, comoReconhecer: null, confiancaExplicacao: null,
    fonte: null, prioridade: 'media', status: 'novo', dataUltimaRevisao: null,
    proximaRevisao: '2026-08-10', intervaloRevisaoDias: 1, revisoes: [], precisaCompletar: true,
    ...overrides,
  };
}

test('selecionarErrosParaExportar inclui pendentes de explicação e recorrentes, ignora o resto', () => {
  const pendente = erro({ id:'1', precisaCompletar: true, status: 'novo' });
  const recorrente = erro({ id:'2', precisaCompletar: false, status: 'recorrente' });
  const completo = erro({ id:'3', precisaCompletar: false, status: 'novo' });
  const resultado = selecionarErrosParaExportar([pendente, recorrente, completo]);
  assert.deepEqual(resultado.map(e => e.id), ['1', '2']);
});

test('montarPromptIA substitui {{ERROS_JSON}} por um array JSON com os campos mapeados', () => {
  const e = erro({ id:'42', assunto:'PNRH', subtema:'SINGREH', disciplinaId:'Legislação', concurso:'Transpetro',
    tipoErro:'confusao_conceitos', oQueErrei:'confundi X com Y', regraCorreta:'', pegadinha:null,
    comoReconhecer:null, confiancaExplicacao:null, fonte:'CESPE 2023', prioridade:'alta', status:'recorrente',
    dataUltimaRevisao:'2026-08-01', proximaRevisao:'2026-08-10', intervaloRevisaoDias:3,
    revisoes:[{data:'2026-08-01', acertou:false}], precisaCompletar:true });
  const prompt = montarPromptIA([e]);
  assert.ok(prompt.startsWith('Você é um tutor de concursos públicos'));
  assert.ok(prompt.includes('Erros:'));
  const jsonTexto = prompt.slice(prompt.indexOf('Erros:') + 'Erros:'.length).trim();
  const array = JSON.parse(jsonTexto);
  assert.equal(array.length, 1);
  const item = array[0];
  assert.equal(item.id, '42');
  assert.equal(item.tema, 'PNRH');
  assert.equal(item.subtema, 'SINGREH');
  assert.equal(item.disciplina, 'Legislação');
  assert.equal(item.concurso, 'Transpetro');
  assert.equal(item.tipo_erro, 'confusao_conceitos');
  assert.equal(item.o_que_errei, 'confundi X com Y');
  assert.equal(item.regra_correta, '');
  assert.equal(item.explicacao_pendente, true);
  assert.equal(item.origem_questao, 'CESPE 2023');
  assert.equal(item.prioridade, 'alta');
  assert.equal(item.status, 'recorrente');
  assert.equal(item.data_ultima_revisao, '2026-08-01');
  assert.equal(item.proxima_revisao, '2026-08-10');
  assert.equal(item.intervalo_revisao_dias, 3);
  assert.deepEqual(item.revisoes, [{data:'2026-08-01', acertou:false}]);
});

test('montarPromptIA com lista vazia ainda produz um prompt válido com array vazio', () => {
  const prompt = montarPromptIA([]);
  const jsonTexto = prompt.slice(prompt.indexOf('Erros:') + 'Erros:'.length).trim();
  assert.deepEqual(JSON.parse(jsonTexto), []);
});

test('PROMPT_TEMPLATE contém o placeholder e as instruções de formato de resposta', () => {
  assert.ok(PROMPT_TEMPLATE.includes('{{ERROS_JSON}}'));
  assert.ok(PROMPT_TEMPLATE.includes('```json'));
  assert.ok(PROMPT_TEMPLATE.includes('confianca_explicacao'));
});
```

- [ ] **Step 2: Rodar os testes e confirmar que falham**

Run: `node --test`
Expected: FAIL — `Cannot find module './erros-ia-export.js'`

- [ ] **Step 3: Implementar `erros-ia-export.js`**

```js
export const PROMPT_TEMPLATE = `Você é um tutor de concursos públicos (foco em Engenharia Ambiental/Sanitária e legislação
ambiental/de recursos hídricos). Vou te passar uma lista de erros registrados no meu caderno
de erros, em JSON. Para cada item:

1. Preencha regra_correta, pegadinha e como_reconhecer de forma curta e direta (uma frase
   cada, sem enrolação).
2. Se o tema envolver prazo, limite numérico, competência ou norma que pode ter mudado
   (resoluções CONAMA, portarias de potabilidade, marcos do saneamento), marque
   "confianca_explicacao": "baixa" em vez de arriscar um dado desatualizado.
3. Depois de cobrir os itens individuais, identifique PADRÕES entre os erros (ex: confusão
   recorrente entre dois conceitos específicos, mesmo tipo_erro se repetindo) e sugira, em
   até 3 novos objetos, erros "consolidados" que resumem o padrão — só se isso realmente
   ajudar a memorização, não crie erro novo por criar.
4. Sugira prioridade (baixa/media/alta/critica) para cada item com base em quão recorrente
   e quão cobrado esse tema costuma ser.

Responda em duas partes:
1. Um resumo curto em português, em texto normal, com os padrões que você notou.
2. Um bloco de código JSON (\`\`\`json ... \`\`\`) com um array de objetos, cada um contendo pelo
   menos "id" (repita o id original para atualizar um existente, ou omita para um erro novo
   sugerido) e os campos que você preencheu/alterou. Não repita campos que não mudaram.

Erros:
{{ERROS_JSON}}`;

function mapearErroParaJsonIA(erro){
  return {
    id: erro.id,
    tema: erro.assunto,
    subtema: erro.subtema,
    disciplina: erro.disciplinaId,
    concurso: erro.concurso,
    tipo_erro: erro.tipoErro,
    o_que_errei: erro.oQueErrei,
    regra_correta: erro.regraCorreta,
    pegadinha: erro.pegadinha,
    como_reconhecer: erro.comoReconhecer,
    explicacao_pendente: erro.precisaCompletar,
    confianca_explicacao: erro.confiancaExplicacao,
    prioridade: erro.prioridade,
    status: erro.status,
    origem_questao: erro.fonte,
    data_registro: erro.criadoEm,
    data_ultima_revisao: erro.dataUltimaRevisao,
    proxima_revisao: erro.proximaRevisao,
    intervalo_revisao_dias: erro.intervaloRevisaoDias,
    revisoes: erro.revisoes,
  };
}

export function selecionarErrosParaExportar(erros){
  return erros.filter(e => e.precisaCompletar || e.status === 'recorrente');
}

export function montarPromptIA(erros){
  const selecionados = selecionarErrosParaExportar(erros).map(mapearErroParaJsonIA);
  return PROMPT_TEMPLATE.replace('{{ERROS_JSON}}', JSON.stringify(selecionados, null, 2));
}
```

- [ ] **Step 4: Rodar os testes e confirmar que passam**

Run: `node --test`
Expected: PASS — os 4 testes novos, mais os 16 já existentes do plano anterior (20 no total)

- [ ] **Step 5: Commit**

```bash
git add erros-ia-export.js erros-ia-export.test.js
git commit -m "feat(erros): monta prompt de export pra IA com os erros pendentes de explicacao"
```

---

## Task 2: `erros-ia-import.js` — parsing, preview e aplicação da resposta da IA

**Files:**
- Create: `erros-ia-import.js`
- Test: `erros-ia-import.test.js`

**Interfaces:**
- Produces: `extrairRespostaIA(texto)` (retorna `{resumo, itens}` ou lança `Error` com mensagem clara), `gerarPreviewImportacao(itens, errosExistentes)` (retorna array de itens de preview), `aplicarImportacao(state, preview, {criarErro, criarFlashcard, recalcularExplicacaoPendente})` (muta `state`, retorna `{atualizados, criados}`).

- [ ] **Step 1: Escrever os testes (falhando)**

Create `erros-ia-import.test.js`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { extrairRespostaIA, gerarPreviewImportacao, aplicarImportacao } from './erros-ia-import.js';

test('extrairRespostaIA separa o resumo em prosa do bloco json e faz parse', () => {
  const texto = 'Notei um padrão de confusão entre PNRH e SINGREH.\n\n```json\n[{"id":"1","regra_correta":"x"}]\n```\n';
  const { resumo, itens } = extrairRespostaIA(texto);
  assert.equal(resumo, 'Notei um padrão de confusão entre PNRH e SINGREH.');
  assert.deepEqual(itens, [{ id: '1', regra_correta: 'x' }]);
});

test('extrairRespostaIA lança erro claro quando não há bloco ```json', () => {
  assert.throws(() => extrairRespostaIA('só um texto qualquer, sem json nenhum'), /não consegui encontrar/i);
});

test('extrairRespostaIA lança erro claro quando o bloco json é inválido', () => {
  assert.throws(() => extrairRespostaIA('```json\n{invalido\n```'), /json.*inválido|inválido.*json/i);
});

test('extrairRespostaIA lança erro claro quando o bloco json não é um array', () => {
  assert.throws(() => extrairRespostaIA('```json\n{"a":1}\n```'), /array/i);
});

test('gerarPreviewImportacao classifica item com id existente como atualização, com diff só dos campos mudados', () => {
  const existente = { id:'1', assunto:'PNRH', regraCorreta:'', pegadinha:null, comoReconhecer:null, prioridade:'media' };
  const item = { id:'1', regra_correta:'CNRH arbitra conflitos', pegadinha:'confunde com ANA', prioridade:'media' };
  const [preview] = gerarPreviewImportacao([item], [existente]);
  assert.equal(preview.tipo, 'atualizacao');
  assert.equal(preview.erroId, '1');
  assert.equal(preview.dados.regraCorreta, 'CNRH arbitra conflitos');
  assert.equal(preview.dados.pegadinha, 'confunde com ANA');
  const camposAlterados = preview.diffs.map(d => d.campo).sort();
  assert.deepEqual(camposAlterados, ['pegadinha', 'regraCorreta']);
  assert.equal(preview.selecionado, true);
});

test('gerarPreviewImportacao classifica item sem id (ou id desconhecido) como novo erro sugerido', () => {
  const item = { tema:'CONAMA 357', o_que_errei:'confundi classe 1 com classe 2', regra_correta:'x' };
  const [preview] = gerarPreviewImportacao([item], []);
  assert.equal(preview.tipo, 'novo');
  assert.equal(preview.dados.assunto, 'CONAMA 357');
  assert.equal(preview.dados.oQueErrei, 'confundi classe 1 com classe 2');
  assert.equal(preview.valido, true);
  assert.equal(preview.selecionado, true);
});

test('gerarPreviewImportacao marca novo erro sem tema/o_que_errei como inválido e não selecionado', () => {
  const item = { regra_correta: 'x' };
  const [preview] = gerarPreviewImportacao([item], []);
  assert.equal(preview.tipo, 'novo');
  assert.equal(preview.valido, false);
  assert.equal(preview.selecionado, false);
});

test('gerarPreviewImportacao ignora campos fora da whitelist (status, revisoes, proxima_revisao, id não é copiado como dado)', () => {
  const existente = { id:'1', assunto:'PNRH' };
  const item = { id:'1', status:'corrigido', revisoes:[{data:'x',acertou:true}], proxima_revisao:'2099-01-01', intervalo_revisao_dias:99 };
  const [preview] = gerarPreviewImportacao([item], [existente]);
  assert.equal('status' in preview.dados, false);
  assert.equal('revisoes' in preview.dados, false);
  assert.equal('proximaRevisao' in preview.dados, false);
  assert.equal('intervaloRevisaoDias' in preview.dados, false);
  assert.equal('id' in preview.dados, false);
});

test('gerarPreviewImportacao passa adiante flashcards sugeridos válidos e descarta os incompletos', () => {
  const item = { id:'1', flashcards: [{frente:'a', verso:'b'}, {frente:'sem verso'}, {verso:'sem frente'}] };
  const [preview] = gerarPreviewImportacao([item], [{id:'1', assunto:'x'}]);
  assert.deepEqual(preview.flashcardsSugeridos, [{frente:'a', verso:'b'}]);
});

test('aplicarImportacao só aplica itens marcados como selecionado', () => {
  const state = { erros: [{ id:'1', assunto:'PNRH', regraCorreta:'' }], flashcards: [] };
  const preview = [
    { tipo:'atualizacao', erroId:'1', dados:{ regraCorreta:'nova regra' }, diffs:[{campo:'regraCorreta'}], flashcardsSugeridos:[], selecionado:false },
  ];
  let recalculouChamado = false;
  aplicarImportacao(state, preview, {
    criarErro: () => { throw new Error('não deveria chamar criarErro'); },
    criarFlashcard: () => { throw new Error('não deveria chamar criarFlashcard'); },
    recalcularExplicacaoPendente: () => { recalculouChamado = true; },
  });
  assert.equal(state.erros[0].regraCorreta, '');
  assert.equal(recalculouChamado, false);
});

test('aplicarImportacao aplica atualização selecionada via Object.assign e recalcula pendencia', () => {
  const state = { erros: [{ id:'1', assunto:'PNRH', regraCorreta:'', pegadinha:null }], flashcards: [] };
  const preview = [
    { tipo:'atualizacao', erroId:'1', dados:{ regraCorreta:'nova regra', pegadinha:'p' }, diffs:[], flashcardsSugeridos:[{frente:'f',verso:'v'}], selecionado:true },
  ];
  const flashcardsCriados = [];
  const resultado = aplicarImportacao(state, preview, {
    criarErro: () => { throw new Error('não deveria chamar criarErro'); },
    criarFlashcard: (s, erroId, dados) => { flashcardsCriados.push({erroId, dados}); },
    recalcularExplicacaoPendente: (erro) => { erro.precisaCompletar = false; return false; },
  });
  assert.equal(state.erros[0].regraCorreta, 'nova regra');
  assert.equal(state.erros[0].pegadinha, 'p');
  assert.equal(state.erros[0].precisaCompletar, false);
  assert.equal(flashcardsCriados.length, 1);
  assert.equal(flashcardsCriados[0].erroId, '1');
  assert.equal(resultado.atualizados, 1);
  assert.equal(resultado.criados, 0);
});

test('aplicarImportacao cria novo erro selecionado e válido, ignora inválido mesmo se marcado', () => {
  const state = { erros: [], flashcards: [] };
  const preview = [
    { tipo:'novo', dados:{ assunto:'X', oQueErrei:'y' }, flashcardsSugeridos:[], valido:true, selecionado:true },
    { tipo:'novo', dados:{}, flashcardsSugeridos:[], valido:false, selecionado:false },
  ];
  const errosCriados = [];
  const resultado = aplicarImportacao(state, preview, {
    criarErro: (s, dados) => { const novo = { id:'novo-1', ...dados }; errosCriados.push(novo); return novo; },
    criarFlashcard: () => {},
    recalcularExplicacaoPendente: () => false,
  });
  assert.equal(errosCriados.length, 1);
  assert.equal(errosCriados[0].assunto, 'X');
  assert.equal(resultado.criados, 1);
  assert.equal(resultado.atualizados, 0);
});
```

- [ ] **Step 2: Rodar os testes e confirmar que falham**

Run: `node --test`
Expected: FAIL — `Cannot find module './erros-ia-import.js'`

- [ ] **Step 3: Implementar `erros-ia-import.js`**

```js
const CAMPOS_IA_PARA_ERRO = {
  tema: 'assunto',
  subtema: 'subtema',
  disciplina: 'disciplinaId',
  concurso: 'concurso',
  tipo_erro: 'tipoErro',
  o_que_errei: 'oQueErrei',
  regra_correta: 'regraCorreta',
  pegadinha: 'pegadinha',
  como_reconhecer: 'comoReconhecer',
  confianca_explicacao: 'confiancaExplicacao',
  prioridade: 'prioridade',
  origem_questao: 'fonte',
};

export function extrairRespostaIA(texto){
  const match = /```json\s*([\s\S]*?)```/.exec(texto || '');
  if(!match){
    throw new Error('Não consegui encontrar um JSON válido colado. Confira se você colou a resposta inteira, incluindo o bloco ```json.');
  }
  let itens;
  try {
    itens = JSON.parse(match[1]);
  } catch(e){
    throw new Error('O bloco JSON colado não é válido: ' + e.message);
  }
  if(!Array.isArray(itens)){
    throw new Error('O bloco JSON colado deveria ser um array de erros.');
  }
  const resumo = texto.slice(0, match.index).trim();
  return { resumo, itens };
}

function mapearCamposIA(item){
  const dados = {};
  Object.entries(CAMPOS_IA_PARA_ERRO).forEach(([campoIA, campoErro]) => {
    if(campoIA in item) dados[campoErro] = item[campoIA];
  });
  return dados;
}

function flashcardsValidos(item){
  return Array.isArray(item.flashcards) ? item.flashcards.filter(f => f && f.frente && f.verso) : [];
}

export function gerarPreviewImportacao(itens, errosExistentes){
  return itens.map(item => {
    const existente = item.id ? errosExistentes.find(e => e.id === item.id) : null;
    const dados = mapearCamposIA(item);
    const flashcardsSugeridos = flashcardsValidos(item);
    if(existente){
      const diffs = Object.entries(dados)
        .filter(([campo, valor]) => existente[campo] !== valor)
        .map(([campo, valor]) => ({ campo, antes: existente[campo], depois: valor }));
      return {
        tipo: 'atualizacao',
        erroId: existente.id,
        dados,
        diffs,
        flashcardsSugeridos,
        selecionado: diffs.length > 0 || flashcardsSugeridos.length > 0,
      };
    }
    const valido = !!(dados.assunto && dados.oQueErrei);
    return { tipo: 'novo', dados, flashcardsSugeridos, valido, selecionado: valido };
  });
}

export function aplicarImportacao(state, preview, { criarErro, criarFlashcard, recalcularExplicacaoPendente }){
  let atualizados = 0, criados = 0;
  preview.forEach(item => {
    if(!item.selecionado) return;
    if(item.tipo === 'atualizacao'){
      const erro = state.erros.find(e => e.id === item.erroId);
      if(!erro) return;
      Object.assign(erro, item.dados);
      recalcularExplicacaoPendente(erro);
      item.flashcardsSugeridos.forEach(fc => criarFlashcard(state, erro.id, { frente: fc.frente, verso: fc.verso, precisaCompletar: false }));
      atualizados++;
    } else if(item.tipo === 'novo' && item.valido){
      const novo = criarErro(state, item.dados);
      item.flashcardsSugeridos.forEach(fc => criarFlashcard(state, novo.id, { frente: fc.frente, verso: fc.verso, precisaCompletar: false }));
      criados++;
    }
  });
  return { atualizados, criados };
}
```

- [ ] **Step 4: Rodar os testes e confirmar que passam**

Run: `node --test`
Expected: PASS — os 12 testes novos, mais os 20 já existentes (32 no total)

- [ ] **Step 5: Commit**

```bash
git add erros-ia-import.js erros-ia-import.test.js
git commit -m "feat(erros): parseia, gera preview e aplica a resposta da IA colada pelo usuario"
```

---

## Task 3: Wiring — agregador, estado novo e default de schema

**Files:**
- Modify: `erros-ia.js`
- Modify: `index.html` — `normalizarCamposNovos` (~linha 1251), `seedState` (~linha 784), declaração de variáveis de estado do módulo Erros (~linha 3195-3199).

**Interfaces:**
- Consumes: tudo de `erros-ia-export.js` e `erros-ia-import.js` (Tasks 1-2).
- Produces: `window.ErrosIA.montarPromptIA`, `.selecionarErrosParaExportar`, `.extrairRespostaIA`, `.gerarPreviewImportacao`, `.aplicarImportacao` disponíveis no browser; `state.errosPadroesDetectados` (string); variáveis de módulo `iaExportModalAberto`, `iaImportModalAberto`, `iaImportTextoColado`, `iaImportPreview`, `iaImportErro`.

Esta task não adiciona nenhum botão ou modal visível ainda — é só a fiação de base, inerte até as Tasks 4 e 5 a consumirem.

- [ ] **Step 1: Atualizar o agregador**

Modify `erros-ia.js` — old:

```js
import * as Modelo from './erros-ia-modelo.js';
import * as Repeticao from './erros-ia-repeticao.js';

const ErrosIA = { ...Modelo, ...Repeticao };

if(typeof window !== 'undefined') window.ErrosIA = ErrosIA;

export default ErrosIA;
```

New:

```js
import * as Modelo from './erros-ia-modelo.js';
import * as Repeticao from './erros-ia-repeticao.js';
import * as Export from './erros-ia-export.js';
import * as Import from './erros-ia-import.js';

const ErrosIA = { ...Modelo, ...Repeticao, ...Export, ...Import };

if(typeof window !== 'undefined') window.ErrosIA = ErrosIA;

export default ErrosIA;
```

- [ ] **Step 2: Default do campo novo em `seedState` e `normalizarCamposNovos`**

Modify `index.html` — old (dentro de `seedState`):

```js
      historicoImportacoes: [],
      ultimoBackup: null,
    };
  }
```

New:

```js
      historicoImportacoes: [],
      ultimoBackup: null,
      errosPadroesDetectados: '',
    };
  }
```

old (dentro de `normalizarCamposNovos`):

```js
    if(!Array.isArray(s.historicoImportacoes)) s.historicoImportacoes = [];
    if(!s.provasPorConcurso || typeof s.provasPorConcurso !== 'object') s.provasPorConcurso = {};
```

New:

```js
    if(!Array.isArray(s.historicoImportacoes)) s.historicoImportacoes = [];
    if(typeof s.errosPadroesDetectados !== 'string') s.errosPadroesDetectados = '';
    if(!s.provasPorConcurso || typeof s.provasPorConcurso !== 'object') s.provasPorConcurso = {};
```

- [ ] **Step 3: Variáveis de estado do módulo Erros**

Modify `index.html` — old:

```js
  let revisaoSessao = null; // { fila: [erroId,...], indice, revelado }
  let flashcardModalErroId = null; // erroId aberto pra "+ Adicionar flashcard"
```

New:

```js
  let revisaoSessao = null; // { fila: [erroId,...], indice, revelado }
  let flashcardModalErroId = null; // erroId aberto pra "+ Adicionar flashcard"
  let iaExportModalAberto = false;
  let iaImportModalAberto = false;
  let iaImportTextoColado = '';
  let iaImportPreview = null; // array vindo de gerarPreviewImportacao, ou null se ainda não analisado
  let iaImportErro = null; // mensagem de erro de parse, ou null
```

- [ ] **Step 4: Verificar manualmente no browser**

Run: `npx --yes serve .` (se não estiver rodando)

No Console, confirmar que `window.ErrosIA.montarPromptIA`, `.extrairRespostaIA`, `.gerarPreviewImportacao` e `.aplicarImportacao` existem. Abrir a aba Caderno de Erros e confirmar que nada mudou visualmente (nenhum botão novo ainda) e que a tela renderiza sem erro no Console. No Console, rodar `state.errosPadroesDetectados` e confirmar que é `''`.

- [ ] **Step 5: Commit**

```bash
git add erros-ia.js index.html
git commit -m "feat(erros): liga os modulos de export/import via IA e prepara o estado novo"
```

---

## Task 4: Botão e modal "Analisar com IA"

**Files:**
- Modify: `index.html` — `renderErros` (cabeçalho ~linha 3987-4010, composição do retorno ~linha 4307), `attachErrosHandlers` (~linha 4310).

**Interfaces:**
- Consumes: `window.ErrosIA.selecionarErrosParaExportar`, `.montarPromptIA` (Task 1, via ponte da Task 3).

- [ ] **Step 1: Computar a contagem de pendentes e mostrar o botão + badge no cabeçalho**

Modify `index.html` — old:

```js
  function renderErros(){
    const hojeIso = hojeISO();
    const stats = statsErros(state, hojeIso);
    const maisCritico = window.ErrosIA.calcularAssuntoMaisCritico(state.erros);
```

New:

```js
  function renderErros(){
    const hojeIso = hojeISO();
    const stats = statsErros(state, hojeIso);
    const maisCritico = window.ErrosIA.calcularAssuntoMaisCritico(state.erros);
    const pendentesExportar = window.ErrosIA.selecionarErrosParaExportar(state.erros).length;
```

old (dentro de `headerHtml`, no bloco `erros-header-actions`):

```html
          <div class="erros-header-actions">
            <input type="text" id="erros-busca-input" placeholder="Buscar erro ou assunto..." value="${escapeHtml(errosBusca)}">
            ${pendentesCount ? `<button class="primary" id="erros-revisar-pendentes-btn">${icone('play')} Revisar pendentes (${pendentesCount})</button>` : ''}
            <button class="primary" id="erros-novo-btn">+ Novo erro</button>
          </div>
```

New:

```html
          <div class="erros-header-actions">
            <input type="text" id="erros-busca-input" placeholder="Buscar erro ou assunto..." value="${escapeHtml(errosBusca)}">
            ${pendentesCount ? `<button class="primary" id="erros-revisar-pendentes-btn">${icone('play')} Revisar pendentes (${pendentesCount})</button>` : ''}
            ${pendentesExportar ? `<span class="badge" style="background:var(--warn-soft);color:var(--warn);">${pendentesExportar} erro${pendentesExportar===1?'':'s'} sem explicação</span>` : ''}
            <button id="erros-analisar-ia-btn">${icone('zap')} Analisar com IA</button>
            <button class="primary" id="erros-novo-btn">+ Novo erro</button>
          </div>
```

- [ ] **Step 2: Montar o HTML do modal de export**

Modify `index.html` — adicionar logo antes da linha `return \`<div class="erros-screen">...\`;` que fecha `renderErros` (a mesma linha que hoje é):

old:

```js
    return `<div class="erros-screen">${headerHtml}<div class="grid-hoje">${listaHtml}${sidebarHtml}</div>${erroModalHtml}${flashcardModalHtml}${sessaoModalHtml}</div>`;
  }
```

New:

```js
    const iaExportModalHtml = iaExportModalAberto ? (() => {
      const prompt = window.ErrosIA.montarPromptIA(state.erros);
      return `
        <div class="modal-backdrop" id="ia-export-modal-backdrop">
          <div class="modal-panel">
            <h3>Analisar com IA</h3>
            <small class="muted">Copie o texto abaixo e cole numa IA de chat (Claude, ChatGPT etc). Depois, cole a resposta dela em "Importar resposta da IA".</small>
            <textarea id="ia-export-texto" readonly style="min-height:240px;">${escapeHtml(prompt)}</textarea>
            <div class="row">
              <button id="ia-export-fechar">Fechar</button>
              <button class="primary" id="ia-export-copiar">Copiar</button>
            </div>
          </div>
        </div>`;
    })() : '';

    return `<div class="erros-screen">${headerHtml}<div class="grid-hoje">${listaHtml}${sidebarHtml}</div>${erroModalHtml}${flashcardModalHtml}${sessaoModalHtml}${iaExportModalHtml}</div>`;
  }
```

- [ ] **Step 3: Handlers do botão e do modal, incluindo copiar pro clipboard**

Modify `index.html` — dentro de `attachErrosHandlers`, logo depois do bloco que já existe pra `erros-novo-btn`/`erros-novo-rodape` (ou em qualquer ponto dentro da função — adicionar como um bloco novo, sem remover nada existente):

```js
    document.getElementById('erros-analisar-ia-btn')?.addEventListener('click', () => {
      iaExportModalAberto = true;
      render();
    });
    document.getElementById('ia-export-fechar')?.addEventListener('click', () => {
      iaExportModalAberto = false;
      render();
    });
    document.getElementById('ia-export-modal-backdrop')?.addEventListener('click', (e) => {
      if(e.target.id === 'ia-export-modal-backdrop'){ iaExportModalAberto = false; render(); }
    });
    document.getElementById('ia-export-copiar')?.addEventListener('click', () => {
      const texto = document.getElementById('ia-export-texto').value;
      if(navigator.clipboard && navigator.clipboard.writeText){
        navigator.clipboard.writeText(texto).then(
          () => alert('Prompt copiado! Cole numa IA de chat (Claude, ChatGPT etc).'),
          () => copiarTextoIAFallback(texto)
        );
      } else {
        copiarTextoIAFallback(texto);
      }
    });
```

Adicionar também, em qualquer ponto do `<script>` fora de outra função (ao lado de `copiarTextoFallback`, por exemplo — ~linha 2221), esta função auxiliar nova (não reescreva `copiarTextoFallback` existente, que é usada por outro fluxo com outra mensagem):

```js
  function copiarTextoIAFallback(texto){
    const ta = document.createElement('textarea');
    ta.value = texto;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.focus(); ta.select();
    try {
      document.execCommand('copy');
      alert('Prompt copiado! Cole numa IA de chat (Claude, ChatGPT etc).');
    } catch(e){
      alert('Não foi possível copiar automaticamente. Selecione o texto manualmente.');
    }
    document.body.removeChild(ta);
  }
```

- [ ] **Step 4: Verificar manualmente no browser**

Checklist manual:
1. Na aba Caderno de Erros, o botão "Analisar com IA" aparece ao lado de "+ Novo erro"; se houver erros pendentes de explicação ou recorrentes, o badge "N erros sem explicação" aparece também.
2. Clicar no botão abre o modal com o prompt completo (instrução + JSON dos erros pendentes) no textarea.
3. Clicar "Copiar" copia o texto (confirmar colando em outro lugar) e mostra o alerta de confirmação.
4. Clicar "Fechar" ou fora do modal fecha sem alterar nada em `state`.

- [ ] **Step 5: Commit**

```bash
git add index.html
git commit -m "feat(erros): botao e modal Analisar com IA, com copiar pro clipboard"
```

---

## Task 5: Botão e modal "Importar resposta da IA" + "Padrões detectados"

**Files:**
- Modify: `index.html` — `renderErros` (cabeçalho, composição do retorno, novo bloco de padrões), `attachErrosHandlers`.

**Interfaces:**
- Consumes: `window.ErrosIA.extrairRespostaIA`, `.gerarPreviewImportacao`, `.aplicarImportacao`, `.recalcularExplicacaoPendente` (Tasks 1-2, via ponte da Task 3); `criarErro`, `criarFlashcard` (já existentes em `index.html`).

- [ ] **Step 1: Botão "Importar resposta da IA" no cabeçalho**

Modify `index.html` — old (resultado do Step 1 da Task 4):

```html
            <button id="erros-analisar-ia-btn">${icone('zap')} Analisar com IA</button>
            <button class="primary" id="erros-novo-btn">+ Novo erro</button>
```

New:

```html
            <button id="erros-analisar-ia-btn">${icone('zap')} Analisar com IA</button>
            <button id="erros-importar-ia-btn">${icone('download')} Importar resposta da IA</button>
            <button class="primary" id="erros-novo-btn">+ Novo erro</button>
```

- [ ] **Step 2: Bloco "Padrões detectados" e modal de import**

Modify `index.html` — old (resultado do Step 2 da Task 4):

```js
    const iaExportModalHtml = iaExportModalAberto ? (() => {
      const prompt = window.ErrosIA.montarPromptIA(state.erros);
      return `
        <div class="modal-backdrop" id="ia-export-modal-backdrop">
          <div class="modal-panel">
            <h3>Analisar com IA</h3>
            <small class="muted">Copie o texto abaixo e cole numa IA de chat (Claude, ChatGPT etc). Depois, cole a resposta dela em "Importar resposta da IA".</small>
            <textarea id="ia-export-texto" readonly style="min-height:240px;">${escapeHtml(prompt)}</textarea>
            <div class="row">
              <button id="ia-export-fechar">Fechar</button>
              <button class="primary" id="ia-export-copiar">Copiar</button>
            </div>
          </div>
        </div>`;
    })() : '';

    return `<div class="erros-screen">${headerHtml}<div class="grid-hoje">${listaHtml}${sidebarHtml}</div>${erroModalHtml}${flashcardModalHtml}${sessaoModalHtml}${iaExportModalHtml}</div>`;
  }
```

New:

```js
    const iaExportModalHtml = iaExportModalAberto ? (() => {
      const prompt = window.ErrosIA.montarPromptIA(state.erros);
      return `
        <div class="modal-backdrop" id="ia-export-modal-backdrop">
          <div class="modal-panel">
            <h3>Analisar com IA</h3>
            <small class="muted">Copie o texto abaixo e cole numa IA de chat (Claude, ChatGPT etc). Depois, cole a resposta dela em "Importar resposta da IA".</small>
            <textarea id="ia-export-texto" readonly style="min-height:240px;">${escapeHtml(prompt)}</textarea>
            <div class="row">
              <button id="ia-export-fechar">Fechar</button>
              <button class="primary" id="ia-export-copiar">Copiar</button>
            </div>
          </div>
        </div>`;
    })() : '';

    const iaImportModalHtml = iaImportModalAberto ? (() => {
      const previewHtml = iaImportPreview ? iaImportPreview.map((item, idx) => {
        const titulo = item.tipo === 'atualizacao'
          ? `Atualização — ${escapeHtml(state.erros.find(e => e.id === item.erroId)?.assunto || item.erroId)}`
          : `Novo erro sugerido — ${escapeHtml(item.dados.assunto || '(sem assunto)')}`;
        const diffsHtml = item.tipo === 'atualizacao'
          ? item.diffs.map(d => `<p class="muted"><b>${escapeHtml(d.campo)}:</b> ${escapeHtml(String(d.antes ?? '—'))} → ${escapeHtml(String(d.depois ?? '—'))}</p>`).join('')
          : Object.entries(item.dados).map(([campo, valor]) => `<p class="muted"><b>${escapeHtml(campo)}:</b> ${escapeHtml(String(valor ?? '—'))}</p>`).join('');
        const flashcardsHtml = item.flashcardsSugeridos.length
          ? `<p class="muted"><b>Flashcards sugeridos:</b> ${item.flashcardsSugeridos.map(fc => escapeHtml(fc.frente)).join(', ')}</p>`
          : '';
        const avisoInvalido = item.tipo === 'novo' && !item.valido
          ? `<p class="muted" style="color:var(--bad);">Faltam campos obrigatórios (tema/o_que_errei) — este item não pode ser aplicado.</p>` : '';
        return `
          <div class="erro-card-col" style="grid-column:1/-1;border-top:1px solid var(--border);padding-top:var(--space-2);">
            <label style="display:flex;align-items:center;gap:8px;min-height:auto;">
              <input type="checkbox" data-ia-import-item="${idx}" ${item.selecionado?'checked':''} ${item.tipo==='novo' && !item.valido ? 'disabled' : ''} style="width:auto;min-height:auto;flex-shrink:0;">
              <b>${titulo}</b>
            </label>
            ${diffsHtml}
            ${flashcardsHtml}
            ${avisoInvalido}
          </div>`;
      }).join('') : '';
      return `
        <div class="modal-backdrop" id="ia-import-modal-backdrop">
          <div class="modal-panel erro-form-panel">
            <h3>Importar resposta da IA</h3>
            <small class="muted">Cole abaixo a resposta inteira da IA (resumo + bloco de código JSON).</small>
            <textarea id="ia-import-texto" style="min-height:160px;">${escapeHtml(iaImportTextoColado)}</textarea>
            ${iaImportErro ? `<small class="muted" style="color:var(--bad);display:block;margin-top:4px;">${escapeHtml(iaImportErro)}</small>` : ''}
            ${!iaImportPreview ? `
              <div class="row">
                <button id="ia-import-cancelar">Cancelar</button>
                <button class="primary" id="ia-import-analisar">Analisar</button>
              </div>
            ` : `
              <div class="erro-card-body">${previewHtml}</div>
              <div class="row">
                <button id="ia-import-cancelar">Cancelar</button>
                <button class="primary" id="ia-import-aplicar">Aplicar alterações</button>
              </div>
            `}
          </div>
        </div>`;
    })() : '';

    const padroesHtml = state.errosPadroesDetectados ? `
      <div class="card">
        <h3><span class="section-icon">${icone('lightbulb')}</span>Padrões detectados</h3>
        <p class="muted">${escapeHtml(state.errosPadroesDetectados)}</p>
      </div>` : '';

    return `<div class="erros-screen">${headerHtml}${padroesHtml}<div class="grid-hoje">${listaHtml}${sidebarHtml}</div>${erroModalHtml}${flashcardModalHtml}${sessaoModalHtml}${iaExportModalHtml}${iaImportModalHtml}</div>`;
  }
```

- [ ] **Step 3: Handlers do fluxo de import**

Modify `index.html` — dentro de `attachErrosHandlers`, adicionar (em qualquer ponto da função, sem remover nada existente):

```js
    document.getElementById('erros-importar-ia-btn')?.addEventListener('click', () => {
      iaImportModalAberto = true;
      iaImportTextoColado = '';
      iaImportPreview = null;
      iaImportErro = null;
      render();
    });
    document.getElementById('ia-import-cancelar')?.addEventListener('click', () => {
      iaImportModalAberto = false;
      iaImportPreview = null;
      iaImportErro = null;
      render();
    });
    document.getElementById('ia-import-modal-backdrop')?.addEventListener('click', (e) => {
      if(e.target.id === 'ia-import-modal-backdrop'){ iaImportModalAberto = false; iaImportPreview = null; iaImportErro = null; render(); }
    });
    document.getElementById('ia-import-texto')?.addEventListener('input', (e) => {
      iaImportTextoColado = e.target.value;
    });
    document.getElementById('ia-import-analisar')?.addEventListener('click', () => {
      const texto = document.getElementById('ia-import-texto').value;
      iaImportTextoColado = texto;
      try {
        const { resumo, itens } = window.ErrosIA.extrairRespostaIA(texto);
        iaImportPreview = window.ErrosIA.gerarPreviewImportacao(itens, state.erros);
        iaImportErro = null;
        if(resumo) state.errosPadroesDetectados = resumo;
      } catch(err){
        iaImportErro = err.message;
        iaImportPreview = null;
      }
      render();
    });
    document.querySelectorAll('[data-ia-import-item]').forEach(chk => {
      chk.addEventListener('change', () => {
        const idx = Number(chk.dataset.iaImportItem);
        if(iaImportPreview[idx]) iaImportPreview[idx].selecionado = chk.checked;
        render();
      });
    });
    document.getElementById('ia-import-aplicar')?.addEventListener('click', () => {
      const resultado = window.ErrosIA.aplicarImportacao(state, iaImportPreview, {
        criarErro,
        criarFlashcard,
        recalcularExplicacaoPendente: window.ErrosIA.recalcularExplicacaoPendente,
      });
      if(!Array.isArray(state.historicoImportacoes)) state.historicoImportacoes = [];
      state.historicoImportacoes.push({
        id: String(Date.now()) + Math.random().toString(36).slice(2,7),
        tipo: 'erros_ia',
        quando: new Date().toISOString(),
        errosAtualizados: resultado.atualizados,
        errosCriados: resultado.criados,
      });
      saveState(state);
      iaImportModalAberto = false;
      iaImportPreview = null;
      iaImportErro = null;
      render();
    });
```

**Nota:** `state.errosPadroesDetectados` é atualizado dentro do handler de "Analisar" (ao extrair a resposta colada), não dentro de `aplicarImportacao` — assim o resumo aparece mesmo que o usuário acabe desmarcando todos os itens do preview antes de aplicar.

- [ ] **Step 4: Verificar manualmente no browser**

Checklist manual (com o servidor local rodando):
1. Clicar "Importar resposta da IA" abre o modal com um textarea vazio.
2. Colar um texto malformado (ex: só "abc") e clicar "Analisar" — deve mostrar a mensagem de erro, sem quebrar a tela nem fechar o modal.
3. Colar uma resposta simulada bem formada (resumo + \`\`\`json [...] \`\`\`, incluindo pelo menos um item com `id` de um erro existente e um item novo sem `id`) e clicar "Analisar" — o preview deve aparecer com os cards de "Atualização"/"Novo erro sugerido", cada um com checkbox marcado por padrão (exceto o item novo inválido, se houver, que vem desmarcado e desabilitado).
4. Desmarcar um item, clicar "Aplicar alterações" — só os itens marcados devem refletir em `state.erros` (conferir no Console). O item desmarcado não deve mudar.
5. Depois de aplicar, o bloco "Padrões detectados" deve mostrar o resumo em prosa que veio antes do bloco JSON.
6. Conferir em `state.historicoImportacoes` que uma entrada `tipo: 'erros_ia'` foi adicionada com as contagens certas.

- [ ] **Step 5: Commit**

```bash
git add index.html
git commit -m "feat(erros): botao, modal e preview de Importar resposta da IA, com bloco de padroes detectados"
```

---

## Depois deste plano

Fica como próximo plano, também dependente do schema já mergeado: o **fluxo questão-a-questão** dentro da sessão de estudo (tela Hoje), com o botão "Registrar no caderno de erros" pré-preenchendo o formulário a partir da questão errada.
