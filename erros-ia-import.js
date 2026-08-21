import { TIPO_ERRO_LABEL, PRIORIDADE_ORDEM } from './erros-ia-modelo.js';

const CONFIANCA_VALORES = ['alta', 'media', 'baixa'];

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
    throw new Error('O bloco JSON colado é inválido: ' + e.message);
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

const CAMPOS_TEXTO_COAGIVEIS = [
  'assunto', 'subtema', 'disciplinaId', 'concurso',
  'oQueErrei', 'regraCorreta', 'pegadinha', 'comoReconhecer', 'fonte',
];

function sanitizarValoresIA(dados){
  const resultado = { ...dados };
  if('tipoErro' in resultado && !(resultado.tipoErro in TIPO_ERRO_LABEL)){
    delete resultado.tipoErro;
  }
  if('prioridade' in resultado && !PRIORIDADE_ORDEM.includes(resultado.prioridade)){
    delete resultado.prioridade;
  }
  if('confiancaExplicacao' in resultado && resultado.confiancaExplicacao !== null && !CONFIANCA_VALORES.includes(resultado.confiancaExplicacao)){
    delete resultado.confiancaExplicacao;
  }
  CAMPOS_TEXTO_COAGIVEIS.forEach(campo => {
    if(campo in resultado && resultado[campo] !== null && typeof resultado[campo] !== 'string'){
      resultado[campo] = String(resultado[campo]);
    }
  });
  return resultado;
}

function flashcardsValidos(item){
  return Array.isArray(item.flashcards) ? item.flashcards.filter(f => f && f.frente && f.verso) : [];
}

export function gerarPreviewImportacao(itens, errosExistentes){
  return itens.map(item => {
    const existente = item.id ? errosExistentes.find(e => e.id === item.id) : null;
    const dados = sanitizarValoresIA(mapearCamposIA(item));
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
      const aindaPendente = recalcularExplicacaoPendente(erro);
      if(!aindaPendente){
        (erro.flashcardIds||[]).forEach(fcId => {
          const fc = state.flashcards.find(f => f.id === fcId);
          if(fc) fc.precisaCompletar = false;
        });
      }
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
