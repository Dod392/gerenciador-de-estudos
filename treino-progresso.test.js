import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  mapaDominioPorAssunto, sessaoContaParaSequencia, atualizarSequencia,
  simuladoDisponivel, montarFilaSimulado, registrarResultadoSimulado,
} from './treino-progresso.js';

test('mapaDominioPorAssunto agrupa por assunto e calcula percentualDominio', () => {
  const erros = [
    { assunto: 'PNRH', status: 'corrigido' },
    { assunto: 'PNRH', status: 'corrigido' },
    { assunto: 'PNRH', status: 'recorrente' },
    { assunto: 'PNRH', status: 'novo' },
    { assunto: 'PNRS', status: 'novo' },
  ];
  const mapa = mapaDominioPorAssunto(erros);
  const pnrh = mapa.find(m => m.assunto === 'PNRH');
  assert.equal(pnrh.total, 4);
  assert.equal(pnrh.corrigidos, 2);
  assert.equal(pnrh.recorrentes, 1);
  assert.equal(pnrh.novos, 1);
  assert.equal(pnrh.percentualDominio, 50);
});

test('mapaDominioPorAssunto ordena por total de erros decrescente', () => {
  const erros = [
    { assunto: 'A', status: 'novo' },
    { assunto: 'B', status: 'novo' }, { assunto: 'B', status: 'novo' }, { assunto: 'B', status: 'novo' },
  ];
  const mapa = mapaDominioPorAssunto(erros);
  assert.deepEqual(mapa.map(m=>m.assunto), ['B', 'A']);
});

test('mapaDominioPorAssunto com lista vazia retorna array vazio', () => {
  assert.deepEqual(mapaDominioPorAssunto([]), []);
});

test('sessaoContaParaSequencia conta se atingiu 5 itens, mesmo em poucos segundos', () => {
  const sessao = { iniciadaEm: '2026-08-22T10:00:00.000Z', respostas: [1,2,3,4,5] };
  const agora = new Date('2026-08-22T10:01:00.000Z').getTime();
  assert.equal(sessaoContaParaSequencia(sessao, agora), true);
});

test('sessaoContaParaSequencia conta se passou 8 minutos, mesmo com poucos itens', () => {
  const sessao = { iniciadaEm: '2026-08-22T10:00:00.000Z', respostas: [1] };
  const agora = new Date('2026-08-22T10:08:00.000Z').getTime();
  assert.equal(sessaoContaParaSequencia(sessao, agora), true);
});

test('sessaoContaParaSequencia NAO conta com poucos itens e pouco tempo (só abrir o app não basta)', () => {
  const sessao = { iniciadaEm: '2026-08-22T10:00:00.000Z', respostas: [1] };
  const agora = new Date('2026-08-22T10:02:00.000Z').getTime();
  assert.equal(sessaoContaParaSequencia(sessao, agora), false);
});

test('sessaoContaParaSequencia com sessão nula retorna false', () => {
  assert.equal(sessaoContaParaSequencia(null, Date.now()), false);
});

function seqBase(overrides){
  return { atual: 0, melhor: 0, ultimoDiaValido: null, folgasUsadasNaSemana: 0, semanaRef: null, ...overrides };
}

test('atualizarSequencia sem sessão válida não muda nada', () => {
  const seq = seqBase({ atual: 3 });
  const nova = atualizarSequencia(seq, '2026-08-22', 'sem-34', false);
  assert.equal(nova.atual, 3);
});

test('atualizarSequencia primeiro dia válido começa a sequência em 1', () => {
  const nova = atualizarSequencia(seqBase(), '2026-08-17', 'sem-34', true);
  assert.equal(nova.atual, 1);
  assert.equal(nova.melhor, 1);
  assert.equal(nova.ultimoDiaValido, '2026-08-17');
});

test('atualizarSequencia dia consecutivo incrementa', () => {
  let seq = atualizarSequencia(seqBase(), '2026-08-17', 'sem-34', true);
  seq = atualizarSequencia(seq, '2026-08-18', 'sem-34', true);
  assert.equal(seq.atual, 2);
});

test('atualizarSequencia no mesmo dia é idempotente (não conta 2x)', () => {
  let seq = atualizarSequencia(seqBase(), '2026-08-17', 'sem-34', true);
  seq = atualizarSequencia(seq, '2026-08-17', 'sem-34', true);
  assert.equal(seq.atual, 1);
});

test('atualizarSequencia pula 1 dia consome a folga da semana e mantém a sequência', () => {
  let seq = atualizarSequencia(seqBase(), '2026-08-17', 'sem-34', true);
  seq = atualizarSequencia(seq, '2026-08-19', 'sem-34', true); // pulou 18
  assert.equal(seq.atual, 2, 'sequência continua, não quebra');
  assert.equal(seq.folgasUsadasNaSemana, 1);
});

test('atualizarSequencia só permite 1 folga por semana — segunda falha quebra a sequência', () => {
  let seq = atualizarSequencia(seqBase(), '2026-08-17', 'sem-34', true);
  seq = atualizarSequencia(seq, '2026-08-19', 'sem-34', true); // folga 1, ok
  seq = atualizarSequencia(seq, '2026-08-21', 'sem-34', true); // pulou outro dia, folga já usada
  assert.equal(seq.atual, 1, 'quebrou — segunda falga na mesma semana não é perdoada');
});

test('atualizarSequencia pular 2+ dias quebra mesmo com folga disponível', () => {
  let seq = atualizarSequencia(seqBase(), '2026-08-17', 'sem-34', true);
  seq = atualizarSequencia(seq, '2026-08-21', 'sem-34', true); // pulou 3 dias
  assert.equal(seq.atual, 1);
  assert.equal(seq.folgasUsadasNaSemana, 0, 'folga não foi consumida — só cobre 1 dia de intervalo');
});

test('atualizarSequencia reseta folgasUsadasNaSemana quando a semana muda', () => {
  let seq = atualizarSequencia(seqBase(), '2026-08-17', 'sem-34', true);
  seq = atualizarSequencia(seq, '2026-08-19', 'sem-34', true); // usa a folga da sem-34
  seq = atualizarSequencia(seq, '2026-08-20', 'sem-35', true); // nova semana, dia consecutivo
  assert.equal(seq.folgasUsadasNaSemana, 0);
  assert.equal(seq.atual, 3);
});

test('atualizarSequencia mantém melhor mesmo depois de quebrar', () => {
  let seq = atualizarSequencia(seqBase(), '2026-08-10', 'sem-33', true);
  seq = atualizarSequencia(seq, '2026-08-11', 'sem-33', true);
  seq = atualizarSequencia(seq, '2026-08-12', 'sem-33', true); // atual=3, melhor=3
  seq = atualizarSequencia(seq, '2026-08-20', 'sem-34', true); // quebrou, atual=1
  assert.equal(seq.atual, 1);
  assert.equal(seq.melhor, 3, 'recorde não regride quando a sequência atual quebra');
});

test('simuladoDisponivel é true quando não há simulado registrado pra essa semana', () => {
  assert.equal(simuladoDisponivel([], 'sem-34'), true);
  assert.equal(simuladoDisponivel([{ semanaId: 'sem-33' }], 'sem-34'), true);
});

test('simuladoDisponivel é false quando já existe simulado dessa semana', () => {
  assert.equal(simuladoDisponivel([{ semanaId: 'sem-34' }], 'sem-34'), false);
});

test('montarFilaSimulado prioriza assuntos críticos e completa até o limite com o resto', () => {
  const questoes = [
    { id:'q1', assunto:'A' }, { id:'q2', assunto:'B' }, { id:'q3', assunto:'A' }, { id:'q4', assunto:'C' },
  ];
  const fila = montarFilaSimulado(questoes, ['A'], 3);
  assert.equal(fila.length, 3);
  assert.deepEqual(fila.map(q=>q.id), ['q1', 'q3', 'q2'], 'A (críticas) primeiro, depois as demais na ordem original');
});

test('montarFilaSimulado respeita o limite mesmo com poucas questões críticas', () => {
  const questoes = [{ id:'q1', assunto:'A' }];
  const fila = montarFilaSimulado(questoes, ['A'], 10);
  assert.equal(fila.length, 1);
});

test('registrarResultadoSimulado calcula acertos/pct e empurra pro array (mutando)', () => {
  const simulados = [];
  const respostas = [{acertou:true},{acertou:true},{acertou:false},{acertou:true}];
  const resultado = registrarResultadoSimulado(simulados, 'sem-34', respostas, '2026-08-22');
  assert.equal(resultado.total, 4);
  assert.equal(resultado.acertos, 3);
  assert.equal(resultado.pct, 75);
  assert.equal(simulados.length, 1);
  assert.equal(simulados[0], resultado);
});

test('registrarResultadoSimulado com 0 respostas não divide por zero', () => {
  const resultado = registrarResultadoSimulado([], 'sem-34', [], '2026-08-22');
  assert.equal(resultado.pct, 0);
});
