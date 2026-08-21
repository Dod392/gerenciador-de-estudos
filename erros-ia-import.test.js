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
