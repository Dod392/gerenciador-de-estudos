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
