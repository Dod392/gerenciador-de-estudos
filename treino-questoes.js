const COOLDOWN_DIAS_PADRAO = 14;

export function criarQuestao(dados){
  return {
    id: 'q-' + String(Date.now()) + Math.random().toString(36).slice(2,7),
    assunto: dados.assunto,
    subtema: dados.subtema || null,
    concurso: dados.concurso || null,
    enunciado: dados.enunciado,
    alternativas: dados.alternativas || [],
    gabarito: dados.gabarito,
    comentario: dados.comentario || '',
    pegadinha: dados.pegadinha || null,
    baseLegal: dados.baseLegal || null,
    fonte: dados.fonte || null,
    origem: dados.origem || 'manual',
    confiancaConteudo: dados.confiancaConteudo || null,
    criadoEm: dados.criadoEm || new Date().toISOString().slice(0, 10),
    estatistica: { respondida: 0, acertos: 0, ultimaResposta: null },
    cooldownAte: null,
    erroIds: [],
  };
}

export function atualizarQuestao(questoes, id, dados){
  const questao = questoes.find(q => q.id === id);
  if(!questao) return null;
  Object.assign(questao, dados);
  return questao;
}

export function excluirQuestao(questoes, id){
  const idx = questoes.findIndex(q => q.id === id);
  if(idx === -1) return false;
  questoes.splice(idx, 1);
  return true;
}

export function estaEmCooldown(questao, hojeIso){
  return !!(questao.cooldownAte && questao.cooldownAte > hojeIso);
}

export function questoesDisponiveis(questoes, hojeIso, { assunto, concurso } = {}){
  return questoes.filter(q => {
    if(estaEmCooldown(q, hojeIso)) return false;
    if(assunto && q.assunto !== assunto) return false;
    if(concurso && q.concurso && q.concurso !== concurso) return false;
    return true;
  });
}

export function registrarRespostaQuestao(questao, acertou, hojeIso, cooldownDias = COOLDOWN_DIAS_PADRAO){
  if(!questao.estatistica) questao.estatistica = { respondida: 0, acertos: 0, ultimaResposta: null };
  questao.estatistica.respondida = (questao.estatistica.respondida || 0) + 1;
  if(acertou) questao.estatistica.acertos = (questao.estatistica.acertos || 0) + 1;
  questao.estatistica.ultimaResposta = hojeIso;
  const d = new Date(hojeIso + 'T00:00:00');
  d.setDate(d.getDate() + cooldownDias);
  questao.cooldownAte = d.toISOString().slice(0, 10);
  return questao;
}

// Ordena questões disponíveis priorizando as menos dominadas: nunca
// respondidas primeiro, depois menor % de acerto, depois há mais tempo sem
// aparecer. Não é agendamento SRS — só a ordem de seleção dentro do que já
// passou pelo filtro de cooldown.
export function selecionarPorFraqueza(questoesDisp){
  return [...questoesDisp].sort((a, b) => {
    const respA = a.estatistica?.respondida || 0;
    const respB = b.estatistica?.respondida || 0;
    if(respA === 0 && respB === 0) return 0;
    if(respA === 0) return -1;
    if(respB === 0) return 1;
    const pctA = (a.estatistica.acertos || 0) / respA;
    const pctB = (b.estatistica.acertos || 0) / respB;
    if(pctA !== pctB) return pctA - pctB;
    return (a.estatistica.ultimaResposta || '').localeCompare(b.estatistica.ultimaResposta || '');
  });
}

export function questoesParaItensFila(questoes){
  return questoes.map(q => ({ tipo: 'questao', refId: q.id, assunto: q.assunto }));
}
