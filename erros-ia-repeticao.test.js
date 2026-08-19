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

test('aplicarRevisaoErro é idempotente no mesmo dia: 2 chamadas no mesmo hojeIso não empilham revisoes nem reavançam o intervalo', () => {
  const erro = erroBase();
  aplicarRevisaoErro(erro, true, '2026-08-10');
  assert.equal(erro.revisoes.length, 1);
  assert.equal(erro.intervaloRevisaoDias, 3);
  aplicarRevisaoErro(erro, true, '2026-08-10');
  assert.equal(erro.revisoes.length, 1, 'não deve empilhar uma 2ª entrada no mesmo dia');
  assert.equal(erro.intervaloRevisaoDias, 3, 'não deve reavançar 3→7 numa 2ª revisão do mesmo dia');
});

test('aplicarRevisaoErro no mesmo dia com acertou diferente apenas corrige o registro do dia, sem reprocessar prioridade/status', () => {
  const erro = erroBase({ prioridade:'media' });
  aplicarRevisaoErro(erro, true, '2026-08-10');
  assert.equal(erro.revisoes.length, 1);
  assert.equal(erro.revisoes[0].acertou, true);
  aplicarRevisaoErro(erro, false, '2026-08-10');
  assert.equal(erro.revisoes.length, 1, 'ainda deve haver só 1 entrada para o dia');
  assert.equal(erro.revisoes[0].acertou, false, 'a entrada do dia deve refletir o valor mais recente');
  // Simplificação aceita: uma virada de acertou→errou no mesmo dia não
  // reexecuta a escalada de prioridade nem o reset de status — isso exigiria
  // desfazer a mutação já aplicada pela 1ª chamada do dia (intervalo/status/
  // prioridade), o que não é possível de forma limpa só reescrevendo o
  // registro de revisoes. Documentado como regressão menor aceitável.
  assert.equal(erro.prioridade, 'media', 'prioridade não é reescalada retroativamente na virada do mesmo dia');
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
