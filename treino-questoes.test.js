import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  criarQuestao, atualizarQuestao, excluirQuestao, estaEmCooldown,
  questoesDisponiveis, registrarRespostaQuestao, selecionarPorFraqueza, questoesParaItensFila,
} from './treino-questoes.js';

function dadosBase(overrides){
  return {
    assunto: 'PNRH',
    enunciado: 'Qual é o instrumento X?',
    alternativas: [{letra:'A',texto:'...'},{letra:'B',texto:'...'}],
    gabarito: 'B',
    comentario: 'B está certa porque...',
    ...overrides,
  };
}

test('criarQuestao preenche defaults (estatistica zerada, cooldownAte null, erroIds vazio)', () => {
  const q = criarQuestao(dadosBase());
  assert.equal(q.assunto, 'PNRH');
  assert.equal(q.gabarito, 'B');
  assert.deepEqual(q.estatistica, { respondida: 0, acertos: 0, ultimaResposta: null });
  assert.equal(q.cooldownAte, null);
  assert.deepEqual(q.erroIds, []);
  assert.equal(q.origem, 'manual');
  assert.ok(q.id.startsWith('q-'));
});

test('atualizarQuestao mescla os campos informados e retorna a questão atualizada', () => {
  const questoes = [criarQuestao(dadosBase())];
  const atualizada = atualizarQuestao(questoes, questoes[0].id, { enunciado: 'Novo enunciado' });
  assert.equal(atualizada.enunciado, 'Novo enunciado');
  assert.equal(questoes[0].enunciado, 'Novo enunciado');
});

test('atualizarQuestao com id inexistente retorna null sem lançar', () => {
  assert.equal(atualizarQuestao([], 'id-fantasma', {}), null);
});

test('excluirQuestao remove do array e retorna true; id inexistente retorna false', () => {
  const questoes = [criarQuestao(dadosBase())];
  const id = questoes[0].id;
  assert.equal(excluirQuestao(questoes, id), true);
  assert.equal(questoes.length, 0);
  assert.equal(excluirQuestao(questoes, id), false);
});

test('estaEmCooldown compara cooldownAte com hojeIso (string ISO)', () => {
  const q = criarQuestao(dadosBase());
  assert.equal(estaEmCooldown(q, '2026-08-22'), false, 'sem cooldownAte, nunca está em cooldown');
  q.cooldownAte = '2026-09-05';
  assert.equal(estaEmCooldown(q, '2026-08-22'), true);
  assert.equal(estaEmCooldown(q, '2026-09-05'), false, 'no próprio dia do cooldownAte já libera');
  assert.equal(estaEmCooldown(q, '2026-09-06'), false);
});

test('questoesDisponiveis exclui as em cooldown e filtra por assunto/concurso', () => {
  const q1 = criarQuestao(dadosBase({ assunto: 'PNRH', concurso: 'Transpetro' }));
  const q2 = criarQuestao(dadosBase({ assunto: 'PNRS', concurso: 'INEA' }));
  const q3 = criarQuestao(dadosBase({ assunto: 'PNRH' }));
  q3.cooldownAte = '2099-01-01';
  const questoes = [q1, q2, q3];
  assert.deepEqual(questoesDisponiveis(questoes, '2026-08-22').map(q=>q.id), [q1.id, q2.id]);
  assert.deepEqual(questoesDisponiveis(questoes, '2026-08-22', { assunto: 'PNRH' }).map(q=>q.id), [q1.id]);
  assert.deepEqual(questoesDisponiveis(questoes, '2026-08-22', { concurso: 'INEA' }).map(q=>q.id), [q2.id]);
});

test('registrarRespostaQuestao atualiza estatistica e seta cooldownAte (padrão 14 dias)', () => {
  const q = criarQuestao(dadosBase());
  registrarRespostaQuestao(q, true, '2026-08-22');
  assert.equal(q.estatistica.respondida, 1);
  assert.equal(q.estatistica.acertos, 1);
  assert.equal(q.estatistica.ultimaResposta, '2026-08-22');
  assert.equal(q.cooldownAte, '2026-09-05');
  registrarRespostaQuestao(q, false, '2026-09-05');
  assert.equal(q.estatistica.respondida, 2);
  assert.equal(q.estatistica.acertos, 1, 'erro não incrementa acertos');
});

test('registrarRespostaQuestao aceita cooldownDias customizado', () => {
  const q = criarQuestao(dadosBase());
  registrarRespostaQuestao(q, true, '2026-08-22', 7);
  assert.equal(q.cooldownAte, '2026-08-29');
});

test('selecionarPorFraqueza prioriza nunca respondidas, depois menor % de acerto', () => {
  const nuncaRespondida = criarQuestao(dadosBase({ assunto: 'A' }));
  const boaTaxa = criarQuestao(dadosBase({ assunto: 'B' }));
  boaTaxa.estatistica = { respondida: 4, acertos: 4, ultimaResposta: '2026-08-10' };
  const taxaRuim = criarQuestao(dadosBase({ assunto: 'C' }));
  taxaRuim.estatistica = { respondida: 4, acertos: 1, ultimaResposta: '2026-08-10' };
  const ordenado = selecionarPorFraqueza([boaTaxa, taxaRuim, nuncaRespondida]);
  assert.deepEqual(ordenado.map(q=>q.id), [nuncaRespondida.id, taxaRuim.id, boaTaxa.id]);
});

test('selecionarPorFraqueza empata em % de acerto: desempata pela resposta mais antiga primeiro', () => {
  const recente = criarQuestao(dadosBase({ assunto: 'A' }));
  recente.estatistica = { respondida: 2, acertos: 1, ultimaResposta: '2026-08-20' };
  const antiga = criarQuestao(dadosBase({ assunto: 'B' }));
  antiga.estatistica = { respondida: 2, acertos: 1, ultimaResposta: '2026-08-01' };
  const ordenado = selecionarPorFraqueza([recente, antiga]);
  assert.deepEqual(ordenado.map(q=>q.id), [antiga.id, recente.id]);
});

test('questoesParaItensFila mapeia questao pra item de fila tipo questao', () => {
  const q = criarQuestao(dadosBase({ assunto: 'PNRH' }));
  assert.deepEqual(questoesParaItensFila([q]), [{ tipo: 'questao', refId: q.id, assunto: 'PNRH' }]);
});
