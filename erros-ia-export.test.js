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
