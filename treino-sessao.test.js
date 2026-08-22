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
  assert.equal(s.aguardandoDesambiguacao, false);
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

test('registrarResposta reseta aguardandoDesambiguacao ao avançar de item', () => {
  const s = criarSessao({ fila: filaExemplo(), tempoAlvoMin: 10, modo: 'revisao' });
  s.aguardandoDesambiguacao = true;
  registrarResposta(s, { acertou: false });
  assert.equal(s.aguardandoDesambiguacao, false);
});

test('pularItem reseta aguardandoDesambiguacao ao avançar de item', () => {
  const s = criarSessao({ fila: filaExemplo(), tempoAlvoMin: 10, modo: 'revisao' });
  s.aguardandoDesambiguacao = true;
  pularItem(s);
  assert.equal(s.aguardandoDesambiguacao, false);
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
