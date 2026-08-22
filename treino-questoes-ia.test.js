import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  montarPromptQuestoesIA, extrairRespostaQuestoesIA,
  gerarPreviewImportacaoQuestoes, aplicarImportacaoQuestoes,
} from './treino-questoes-ia.js';

function questaoIAValida(overrides){
  return {
    assunto: 'PNRH',
    enunciado: 'Qual é o instrumento X da PNRH?',
    alternativas: [
      { letra: 'A', texto: 'Um' }, { letra: 'B', texto: 'Dois' }, { letra: 'C', texto: 'Três' },
    ],
    gabarito: 'B',
    comentario: 'B está certa porque...',
    ...overrides,
  };
}

test('montarPromptQuestoesIA inclui assuntos fracos, concurso e questões existentes no texto', () => {
  const prompt = montarPromptQuestoesIA({
    assuntosFracos: ['PNRH', 'PNRS'],
    concurso: 'Transpetro',
    questoesExistentes: [{ enunciado: 'Já existe essa aqui' }],
  });
  assert.ok(prompt.includes('PNRH, PNRS'));
  assert.ok(prompt.includes('Transpetro'));
  assert.ok(prompt.includes('Já existe essa aqui'));
});

test('montarPromptQuestoesIA sem assuntos/concurso/banco não quebra e usa textos padrão', () => {
  const prompt = montarPromptQuestoesIA();
  assert.ok(prompt.includes('nenhum assunto específico'));
  assert.ok(prompt.includes('banco vazio ainda'));
});

test('extrairRespostaQuestoesIA extrai o array do bloco ```json', () => {
  const texto = 'Aqui vão as questões:\n```json\n[{"assunto":"PNRH"}]\n```\n';
  const itens = extrairRespostaQuestoesIA(texto);
  assert.deepEqual(itens, [{ assunto: 'PNRH' }]);
});

test('extrairRespostaQuestoesIA lança erro claro sem bloco ```json', () => {
  assert.throws(() => extrairRespostaQuestoesIA('resposta sem json nenhum'), /não consegui encontrar/i);
});

test('extrairRespostaQuestoesIA lança erro claro com JSON malformado', () => {
  assert.throws(() => extrairRespostaQuestoesIA('```json\n{quebrado\n```'), /inválido/i);
});

test('extrairRespostaQuestoesIA exige que o bloco seja um array', () => {
  assert.throws(() => extrairRespostaQuestoesIA('```json\n{"nao":"array"}\n```'), /array/i);
});

test('gerarPreviewImportacaoQuestoes marca questão válida como selecionada', () => {
  const preview = gerarPreviewImportacaoQuestoes([questaoIAValida()]);
  assert.equal(preview.length, 1);
  assert.equal(preview[0].valido, true);
  assert.equal(preview[0].selecionado, true);
  assert.equal(preview[0].dados.assunto, 'PNRH');
  assert.equal(preview[0].dados.gabarito, 'B');
});

test('gerarPreviewImportacaoQuestoes descarta item sem enunciado', () => {
  const item = questaoIAValida({ enunciado: '' });
  const preview = gerarPreviewImportacaoQuestoes([item]);
  assert.equal(preview[0].valido, false);
  assert.equal(preview[0].selecionado, false);
});

test('gerarPreviewImportacaoQuestoes descarta item cujo gabarito não bate com nenhuma alternativa', () => {
  const item = questaoIAValida({ gabarito: 'Z' });
  const preview = gerarPreviewImportacaoQuestoes([item]);
  assert.equal(preview[0].valido, false);
});

test('gerarPreviewImportacaoQuestoes descarta item com menos de 2 alternativas preenchidas', () => {
  const item = questaoIAValida({ alternativas: [{ letra: 'A', texto: 'Só uma' }] });
  const preview = gerarPreviewImportacaoQuestoes([item]);
  assert.equal(preview[0].valido, false);
});

test('gerarPreviewImportacaoQuestoes descarta item sem assunto', () => {
  const item = questaoIAValida({ assunto: '' });
  const preview = gerarPreviewImportacaoQuestoes([item]);
  assert.equal(preview[0].valido, false);
});

test('gerarPreviewImportacaoQuestoes ignora confiancaConteudo com enum inválido em vez de quebrar', () => {
  const item = questaoIAValida({ confiancaConteudo: 'extrema' });
  const preview = gerarPreviewImportacaoQuestoes([item]);
  assert.equal(preview[0].valido, true, 'o resto da questão continua válido');
  assert.equal(preview[0].dados.confiancaConteudo, null);
});

test('gerarPreviewImportacaoQuestoes aceita confiancaConteudo válido', () => {
  const item = questaoIAValida({ confiancaConteudo: 'baixa' });
  const preview = gerarPreviewImportacaoQuestoes([item]);
  assert.equal(preview[0].dados.confiancaConteudo, 'baixa');
});

test('gerarPreviewImportacaoQuestoes ignora alternativa com letra fora de A-E em vez de quebrar', () => {
  const item = questaoIAValida({ alternativas: [
    { letra: 'A', texto: 'Um' }, { letra: 'X', texto: 'Inválida' }, { letra: 'B', texto: 'Dois' },
  ]});
  const preview = gerarPreviewImportacaoQuestoes([item]);
  assert.equal(preview[0].valido, true);
  assert.equal(preview[0].dados.alternativas.length, 2, 'a alternativa com letra inválida é descartada, não quebra o item');
});

test('aplicarImportacaoQuestoes só cria as marcadas como selecionadas e válidas', () => {
  const state = { questoes: [] };
  const criarQuestao = (dados) => ({ id: 'q-fake', ...dados, estatistica:{respondida:0,acertos:0,ultimaResposta:null}, cooldownAte:null, erroIds:[] });
  const preview = [
    { dados: questaoIAValida(), valido: true, selecionado: true },
    { dados: questaoIAValida({ assunto: 'PNRS' }), valido: true, selecionado: false },
    { dados: {}, valido: false, selecionado: true },
  ];
  const resultado = aplicarImportacaoQuestoes(state, preview, { criarQuestao });
  assert.equal(resultado.criadas, 1);
  assert.equal(state.questoes.length, 1);
  assert.equal(state.questoes[0].origem, 'ia');
  assert.equal(state.questoes[0].assunto, 'PNRH');
});
