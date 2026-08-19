export const TIPO_ERRO_LABEL = {
  chute: 'Chute',
  erro_conceitual: 'Erro conceitual',
  confusao_conceitos: 'Confusão entre conceitos',
  falha_memorizacao: 'Falha de memorização',
  falha_interpretacao: 'Falha de interpretação',
};

export const PRIORIDADE_ORDEM = ['critica', 'alta', 'media', 'baixa'];

const TIPO_ERRO_MIGRACAO = { conteudo: 'erro_conceitual', interpretacao: 'falha_interpretacao', distracao: 'chute' };

export function migrarErroParaSchemaIA(erro, flashcardsDoErro = []){
  if('status' in erro) return erro; // já migrado
  erro.subtema = erro.subtema ?? null;
  erro.concurso = erro.concurso ?? null;
  erro.tipoErro = TIPO_ERRO_MIGRACAO[erro.tipoErro] || erro.tipoErro || 'erro_conceitual';
  erro.regraCorreta = erro.explicacao ?? '';
  delete erro.explicacao;
  erro.comoReconhecer = erro.comoReconhecer ?? null;
  erro.confiancaExplicacao = erro.confiancaExplicacao ?? null;
  erro.status = 'novo';
  erro.dataUltimaRevisao = null;
  erro.proximaRevisao = flashcardsDoErro.length
    ? flashcardsDoErro.reduce((min, f) => f.proximaRevisao < min ? f.proximaRevisao : min, flashcardsDoErro[0].proximaRevisao)
    : erro.criadoEm;
  erro.intervaloRevisaoDias = 1;
  erro.revisoes = [];
  return erro;
}

export function recalcularExplicacaoPendente(erro){
  // pegadinha e comoReconhecer são campos opcionais no formulário — só
  // regraCorreta é exigido para considerar a explicação completa.
  const completo = !!(erro.regraCorreta && erro.regraCorreta.trim());
  erro.precisaCompletar = !completo;
  return erro.precisaCompletar;
}

export function subirPrioridade(prioridade){
  const idx = PRIORIDADE_ORDEM.indexOf(prioridade);
  if(idx <= 0) return PRIORIDADE_ORDEM[0];
  return PRIORIDADE_ORDEM[idx - 1];
}

export function calcularAssuntoMaisCritico(erros){
  const peso = { critica: 4, alta: 3, media: 2, baixa: 1 };
  const pontosPorAssunto = {};
  erros.forEach(e => {
    if(e.status === 'corrigido') return;
    const errosNaRevisao = (e.revisoes || []).filter(r => !r.acertou).length;
    const pontos = (peso[e.prioridade] || 1) * (1 + errosNaRevisao);
    pontosPorAssunto[e.assunto] = (pontosPorAssunto[e.assunto] || 0) + pontos;
  });
  let assunto = null, max = 0;
  Object.entries(pontosPorAssunto).forEach(([nome, pontos]) => { if(pontos > max){ max = pontos; assunto = nome; } });
  return assunto ? { assunto, pontos: max } : null;
}
