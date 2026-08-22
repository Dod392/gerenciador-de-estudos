export function criarSessao({ fila, tempoAlvoMin, modo, filtroAssunto = null, filtroConcurso = null }){
  return {
    id: String(Date.now()) + Math.random().toString(36).slice(2,7),
    iniciadaEm: new Date().toISOString(),
    tempoAlvoMin,
    modo,
    filtroAssunto,
    filtroConcurso,
    fila,
    indice: 0,
    confiancaAtual: null,
    revelado: false,
    aguardandoDesambiguacao: false,
    respostas: [],
    combo: 0,
    melhorCombo: 0,
  };
}

export function itemAtual(sessao){
  if(!sessao || sessao.indice >= sessao.fila.length) return null;
  return sessao.fila[sessao.indice];
}

export function sessaoTerminada(sessao){
  return !sessao || sessao.indice >= sessao.fila.length;
}

export function revelarResposta(sessao){
  sessao.revelado = true;
  return sessao;
}

export function registrarResposta(sessao, { acertou, emMs = 0 }){
  const item = itemAtual(sessao);
  if(!item) return sessao;
  sessao.respostas.push({ refId: item.refId, tipo: item.tipo, confianca: sessao.confiancaAtual, acertou: !!acertou, emMs });
  if(acertou){
    sessao.combo += 1;
    if(sessao.combo > sessao.melhorCombo) sessao.melhorCombo = sessao.combo;
  } else {
    sessao.combo = 0;
  }
  sessao.indice += 1;
  sessao.revelado = false;
  sessao.confiancaAtual = null;
  sessao.aguardandoDesambiguacao = false;
  return sessao;
}

export function pularItem(sessao){
  // Pular não conta como erro nem como acerto — não mexe em combo/respostas.
  sessao.indice += 1;
  sessao.revelado = false;
  sessao.confiancaAtual = null;
  sessao.aguardandoDesambiguacao = false;
  return sessao;
}

export function errosCorrigidosHoje(erros, hojeIso){
  return erros.filter(e => e.status === 'corrigido' && e.dataUltimaRevisao === hojeIso).length;
}
