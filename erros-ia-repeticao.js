import { subirPrioridade } from './erros-ia-modelo.js';

const SEQUENCIA_INTERVALOS = [1, 3, 7, 14, 30];

function addDaysIso(iso, dias){
  const d = new Date(iso + 'T00:00:00');
  d.setDate(d.getDate() + dias);
  return d.toISOString().slice(0, 10);
}

function proximoIntervalo(atual){
  const idx = SEQUENCIA_INTERVALOS.indexOf(atual);
  if(idx === -1 || idx === SEQUENCIA_INTERVALOS.length - 1) return SEQUENCIA_INTERVALOS[SEQUENCIA_INTERVALOS.length - 1];
  return SEQUENCIA_INTERVALOS[idx + 1];
}

export function aplicarRevisaoErro(erro, acertou, hojeIso, { confianca } = {}){
  if(!Array.isArray(erro.revisoes)) erro.revisoes = [];
  if(erro.dataUltimaRevisao === hojeIso && erro.revisoes.length){
    // Já revisado hoje (ex.: dois flashcards do mesmo Erro revisados
    // separadamente): corrige o registro do dia sem reavançar intervalo/
    // status/prioridade de novo — EXCETO quando o resultado piora (era
    // acerto, agora é erro), caso em que reprocessa pro lado seguro
    // (reseta intervalo, marca recorrente, sobe prioridade) pra não deixar
    // o agendamento desatualizado como se ainda estivesse tudo certo.
    const registroDeHoje = erro.revisoes[erro.revisoes.length - 1];
    const eraAcerto = registroDeHoje.acertou;
    registroDeHoje.acertou = !!acertou;
    registroDeHoje.confianca = confianca || null;
    if(eraAcerto && !acertou){
      erro.intervaloRevisaoDias = 1;
      erro.proximaRevisao = addDaysIso(hojeIso, 1);
      erro.status = 'recorrente';
      erro.prioridade = subirPrioridade(erro.prioridade);
    }
    return erro;
  }
  erro.revisoes.push({ data: hojeIso, acertou: !!acertou, confianca: confianca || null });
  erro.dataUltimaRevisao = hojeIso;
  if(acertou){
    // Acerto no chute não é domínio — regra explícita do método de estudo:
    // sorte não pode virar "aprendido". Mantém o agendamento como se não
    // tivesse avançado (intervalo curto, não conta pra virar "corrigido"),
    // mesmo registrando o acerto de verdade no histórico de revisões.
    if(confianca === 'chutei'){
      erro.intervaloRevisaoDias = 1;
      erro.proximaRevisao = addDaysIso(hojeIso, 1);
    } else {
      erro.intervaloRevisaoDias = proximoIntervalo(erro.intervaloRevisaoDias || 1);
      erro.proximaRevisao = addDaysIso(hojeIso, erro.intervaloRevisaoDias);
      const ultimasDuas = erro.revisoes.slice(-2);
      const duasSeguidasCorretas = ultimasDuas.length === 2 && ultimasDuas.every(r => r.acertou);
      if(duasSeguidasCorretas) erro.status = 'corrigido';
    }
  } else {
    erro.intervaloRevisaoDias = 1;
    erro.proximaRevisao = addDaysIso(hojeIso, 1);
    erro.status = 'recorrente';
    erro.prioridade = subirPrioridade(erro.prioridade);
  }
  return erro;
}

// Cruza confiança (tap antes de revelar a resposta) com o resultado pra
// classificar tipoErro sozinho, sem depender do usuário escolher na mão.
// Só se aplica a erros — um acerto não precisa de classificação de erro.
// 'sabia' + errou é ambíguo por natureza (pode ser confusão entre
// conceitos ou leitura errada do enunciado) — depende do toque extra de
// desambiguação (2º parâmetro); sem ele, cai no valor mais comum
// (confusão entre conceitos).
export function deduzirTipoErro(confianca, acertou, desambiguacao){
  if(acertou) return null;
  if(confianca === 'chutei') return 'falha_memorizacao';
  if(confianca === 'achei_que_sabia') return 'erro_conceitual';
  if(confianca === 'sabia') return desambiguacao === 'li_errado' ? 'falha_interpretacao' : 'confusao_conceitos';
  return null;
}

export function estaPendenteRevisao(erro, hojeIso){
  return erro.status !== 'corrigido' && erro.proximaRevisao <= hojeIso;
}

export function filaErrosPendentes(erros, hojeIso){
  return erros
    .filter(e => estaPendenteRevisao(e, hojeIso))
    .sort((a, b) => a.proximaRevisao < b.proximaRevisao ? -1 : a.proximaRevisao > b.proximaRevisao ? 1 : 0);
}
