// Mapa de domínio por assunto: proporção de erros corrigidos vs. recorrentes
// vs. novos, calculada de dados reais (status do Erro) — não de tempo gasto.
export function mapaDominioPorAssunto(erros){
  const porAssunto = {};
  erros.forEach(e => {
    if(!porAssunto[e.assunto]) porAssunto[e.assunto] = { assunto: e.assunto, corrigidos: 0, recorrentes: 0, novos: 0, total: 0 };
    const grupo = porAssunto[e.assunto];
    grupo.total++;
    if(e.status === 'corrigido') grupo.corrigidos++;
    else if(e.status === 'recorrente') grupo.recorrentes++;
    else grupo.novos++;
  });
  return Object.values(porAssunto)
    .map(g => ({ ...g, percentualDominio: g.total ? Math.round((g.corrigidos / g.total) * 100) : 0 }))
    .sort((a, b) => b.total - a.total);
}

const SESSAO_MINIMA_ITENS = 5;
const SESSAO_MINIMA_MINUTOS = 8;

// Só conta pra sequência se a sessão foi real — abrir o app não basta.
// agoraMs é injetado (não Date.now() interno) pra ficar testável.
export function sessaoContaParaSequencia(sessao, agoraMs){
  if(!sessao) return false;
  if(sessao.respostas.length >= SESSAO_MINIMA_ITENS) return true;
  const inicioMs = new Date(sessao.iniciadaEm).getTime();
  const minutos = (agoraMs - inicioMs) / 60000;
  return minutos >= SESSAO_MINIMA_MINUTOS;
}

function diffDias(dataA, dataB){
  const a = new Date(dataA + 'T00:00:00');
  const b = new Date(dataB + 'T00:00:00');
  return Math.round((b - a) / 86400000);
}

// Sequência própria do Treino (separada da sequência de dias estudados já
// existente no app, que continua intacta) — com folga semanal automática.
// semanaId é injetado pelo chamador (o app já tem sua própria noção de
// semana); este módulo só precisa saber quando ela mudou.
export function atualizarSequencia(sequencia, hojeIso, semanaId, sessaoContou){
  if(!sessaoContou) return sequencia;
  const seq = { ...sequencia };
  if(seq.semanaRef !== semanaId){
    seq.semanaRef = semanaId;
    seq.folgasUsadasNaSemana = 0;
  }
  if(seq.ultimoDiaValido === hojeIso) return seq; // idempotente no mesmo dia
  const gap = seq.ultimoDiaValido ? diffDias(seq.ultimoDiaValido, hojeIso) : 1;
  if(gap <= 1){
    seq.atual += 1;
  } else if(gap === 2 && seq.folgasUsadasNaSemana < 1){
    seq.folgasUsadasNaSemana += 1;
    seq.atual += 1;
  } else {
    seq.atual = 1;
  }
  seq.ultimoDiaValido = hojeIso;
  if(seq.atual > seq.melhor) seq.melhor = seq.atual;
  return seq;
}

// Simulado relâmpago: 10 questões, uma vez por semana, resultado guardado.
export function simuladoDisponivel(simuladosSemanais, semanaId){
  return !(simuladosSemanais || []).some(s => s.semanaId === semanaId);
}

export function montarFilaSimulado(questoesDisponiveis, assuntosCriticos, limite = 10){
  const criticas = questoesDisponiveis.filter(q => assuntosCriticos.includes(q.assunto));
  const outras = questoesDisponiveis.filter(q => !assuntosCriticos.includes(q.assunto));
  return [...criticas, ...outras].slice(0, limite);
}

export function registrarResultadoSimulado(simuladosSemanais, semanaId, respostas, hojeIso){
  const acertos = respostas.filter(r => r.acertou).length;
  const resultado = {
    semanaId, data: hojeIso, total: respostas.length, acertos,
    pct: respostas.length ? Math.round((acertos / respostas.length) * 100) : 0,
  };
  simuladosSemanais.push(resultado);
  return resultado;
}
