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

export function aplicarRevisaoErro(erro, acertou, hojeIso){
  if(!Array.isArray(erro.revisoes)) erro.revisoes = [];
  if(erro.dataUltimaRevisao === hojeIso && erro.revisoes.length){
    // Já revisado hoje: apenas corrige o registro do dia, sem reavançar
    // intervalo/status/prioridade uma segunda vez no mesmo dia.
    erro.revisoes[erro.revisoes.length - 1].acertou = !!acertou;
    return erro;
  }
  erro.revisoes.push({ data: hojeIso, acertou: !!acertou });
  erro.dataUltimaRevisao = hojeIso;
  if(acertou){
    erro.intervaloRevisaoDias = proximoIntervalo(erro.intervaloRevisaoDias || 1);
    erro.proximaRevisao = addDaysIso(hojeIso, erro.intervaloRevisaoDias);
    const ultimasDuas = erro.revisoes.slice(-2);
    const duasSeguidasCorretas = ultimasDuas.length === 2 && ultimasDuas.every(r => r.acertou);
    if(duasSeguidasCorretas) erro.status = 'corrigido';
  } else {
    erro.intervaloRevisaoDias = 1;
    erro.proximaRevisao = addDaysIso(hojeIso, 1);
    erro.status = 'recorrente';
    erro.prioridade = subirPrioridade(erro.prioridade);
  }
  return erro;
}

export function estaPendenteRevisao(erro, hojeIso){
  return erro.status !== 'corrigido' && erro.proximaRevisao <= hojeIso;
}

export function filaErrosPendentes(erros, hojeIso){
  return erros
    .filter(e => estaPendenteRevisao(e, hojeIso))
    .sort((a, b) => a.proximaRevisao < b.proximaRevisao ? -1 : a.proximaRevisao > b.proximaRevisao ? 1 : 0);
}
