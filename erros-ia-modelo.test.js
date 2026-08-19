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

test('migrarErroParaSchemaIA usa a menor proximaRevisao dos flashcards do erro, não criadoEm', () => {
  const erro = { id:'1', criadoEm:'2026-01-01', assunto:'PNRH', tipoErro:'conteudo', explicacao:'texto antigo', prioridade:'media' };
  migrarErroParaSchemaIA(erro, [{ proximaRevisao:'2026-09-01' }, { proximaRevisao:'2026-08-25' }]);
  assert.equal(erro.proximaRevisao, '2026-08-25');
  assert.equal(erro.intervaloRevisaoDias, 1, 'intervalo não é semeado a partir do flashcard, permanece no default');
});

test('migrarErroParaSchemaIA sem flashcards (2º argumento omitido) mantém o fallback antigo para criadoEm', () => {
  const erro = { id:'1', criadoEm:'2026-08-10', assunto:'PNRH', tipoErro:'conteudo', explicacao:'texto antigo', prioridade:'media' };
  migrarErroParaSchemaIA(erro);
  assert.equal(erro.proximaRevisao, '2026-08-10');
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

test('recalcularExplicacaoPendente exige apenas regraCorreta (pegadinha/comoReconhecer são opcionais)', () => {
  const erro = { regraCorreta:'r', pegadinha:null, comoReconhecer:null };
  assert.equal(recalcularExplicacaoPendente(erro), false, 'com só regraCorreta preenchido, não deve ficar pendente');

  const semRegra = { regraCorreta:'', pegadinha:'p', comoReconhecer:'c' };
  assert.equal(recalcularExplicacaoPendente(semRegra), true, 'sem regraCorreta, continua pendente mesmo com os opcionais preenchidos');
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
