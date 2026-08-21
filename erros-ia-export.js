export const PROMPT_TEMPLATE = `Você é um tutor de concursos públicos (foco em Engenharia Ambiental/Sanitária e legislação
ambiental/de recursos hídricos). Vou te passar uma lista de erros registrados no meu caderno
de erros, em JSON. Para cada item:

1. Preencha regra_correta, pegadinha e como_reconhecer de forma curta e direta (uma frase
   cada, sem enrolação).
2. Se o tema envolver prazo, limite numérico, competência ou norma que pode ter mudado
   (resoluções CONAMA, portarias de potabilidade, marcos do saneamento), marque
   "confianca_explicacao": "baixa" em vez de arriscar um dado desatualizado.
3. Depois de cobrir os itens individuais, identifique PADRÕES entre os erros (ex: confusão
   recorrente entre dois conceitos específicos, mesmo tipo_erro se repetindo) e sugira, em
   até 3 novos objetos, erros "consolidados" que resumem o padrão — só se isso realmente
   ajudar a memorização, não crie erro novo por criar.
4. Sugira prioridade (baixa/media/alta/critica) para cada item com base em quão recorrente
   e quão cobrado esse tema costuma ser.

Responda em duas partes:
1. Um resumo curto em português, em texto normal, com os padrões que você notou.
2. Um bloco de código JSON (\`\`\`json ... \`\`\`) com um array de objetos, cada um contendo pelo
   menos "id" (repita o id original para atualizar um existente, ou omita para um erro novo
   sugerido) e os campos que você preencheu/alterou. Não repita campos que não mudaram.

Erros:
{{ERROS_JSON}}`;

function mapearErroParaJsonIA(erro){
  return {
    id: erro.id,
    tema: erro.assunto,
    subtema: erro.subtema,
    disciplina: erro.disciplinaId,
    concurso: erro.concurso,
    tipo_erro: erro.tipoErro,
    o_que_errei: erro.oQueErrei,
    regra_correta: erro.regraCorreta,
    pegadinha: erro.pegadinha,
    como_reconhecer: erro.comoReconhecer,
    explicacao_pendente: erro.precisaCompletar,
    confianca_explicacao: erro.confiancaExplicacao,
    prioridade: erro.prioridade,
    status: erro.status,
    origem_questao: erro.fonte,
    data_registro: erro.criadoEm,
    data_ultima_revisao: erro.dataUltimaRevisao,
    proxima_revisao: erro.proximaRevisao,
    intervalo_revisao_dias: erro.intervaloRevisaoDias,
    revisoes: erro.revisoes,
  };
}

export function selecionarErrosParaExportar(erros){
  return erros.filter(e => e.precisaCompletar || e.status === 'recorrente');
}

export function montarPromptIA(erros){
  const selecionados = selecionarErrosParaExportar(erros).map(mapearErroParaJsonIA);
  return PROMPT_TEMPLATE.replace('{{ERROS_JSON}}', JSON.stringify(selecionados, null, 2));
}
