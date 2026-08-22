export const PROMPT_TEMPLATE = `Você é um tutor de concursos públicos (banca Cesgranrio, foco em Engenharia Ambiental/Sanitária
e legislação ambiental/de recursos hídricos). Gere questões de múltipla escolha no formato
Cesgranrio: 5 alternativas (A a E), só uma correta.

Regras:
1. Cada questão precisa de um comentário explicando por que a alternativa correta está certa
   E por que cada uma das outras está errada.
2. Preencha "pegadinha" e "baseLegal" quando fizer sentido pro tema.
3. Sempre que a questão envolver prazo, limite numérico, competência ou norma que pode ter
   mudado (resoluções CONAMA, portarias de potabilidade, marcos do saneamento), marque
   "confiancaConteudo": "baixa" em vez de arriscar um dado desatualizado.
4. Se eu tiver anexado um PDF (edital, lei, apostila, prova anterior), as questões devem sair
   DAQUELE material — não invente dispositivo, prazo ou número que não esteja no texto anexado.
5. Não repita o enunciado de nenhuma das questões já existentes no banco (listadas abaixo).

Priorize os assuntos mais fracos: {{ASSUNTOS_FRACOS}}
{{CONCURSO_LINHA}}

Questões já existentes no banco (não repetir):
{{QUESTOES_EXISTENTES}}

Responda com um bloco de código JSON (\`\`\`json ... \`\`\`) contendo um array de objetos, cada um
com: assunto, subtema (opcional), concurso (opcional), enunciado, alternativas (array de
{letra, texto}, 5 itens A-E), gabarito (a letra correta), comentario, pegadinha (opcional),
baseLegal (opcional), fonte (opcional), confiancaConteudo ("alta"/"media"/"baixa", opcional).`;

export function montarPromptQuestoesIA({ assuntosFracos = [], concurso = null, questoesExistentes = [] } = {}){
  const assuntosTexto = assuntosFracos.length ? assuntosFracos.join(', ') : '(nenhum assunto específico — pode variar)';
  const concursoLinha = concurso ? `Concurso alvo: ${concurso}.` : '';
  const existentesTexto = questoesExistentes.length
    ? questoesExistentes.map(q => `- ${q.enunciado.slice(0,100)}`).join('\n')
    : '(banco vazio ainda)';
  return PROMPT_TEMPLATE
    .replace('{{ASSUNTOS_FRACOS}}', assuntosTexto)
    .replace('{{CONCURSO_LINHA}}', concursoLinha)
    .replace('{{QUESTOES_EXISTENTES}}', existentesTexto);
}

export function extrairRespostaQuestoesIA(texto){
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
    throw new Error('O bloco JSON colado deveria ser um array de questões.');
  }
  return itens;
}

const CONFIANCA_CONTEUDO_VALORES = ['alta', 'media', 'baixa'];
const LETRAS_VALIDAS = ['A', 'B', 'C', 'D', 'E'];

function sanitizarQuestaoIA(item){
  if(!item || typeof item !== 'object') return null;
  const enunciado = typeof item.enunciado === 'string' ? item.enunciado.trim() : '';
  const gabarito = typeof item.gabarito === 'string' ? item.gabarito.trim().toUpperCase() : '';
  const alternativas = Array.isArray(item.alternativas)
    ? item.alternativas
        .filter(a => a && LETRAS_VALIDAS.includes(String(a.letra||'').toUpperCase()) && typeof a.texto === 'string' && a.texto.trim())
        .map(a => ({ letra: String(a.letra).toUpperCase(), texto: a.texto.trim() }))
    : [];
  // Descarta silenciosamente item sem enunciado/gabarito, ou cujo gabarito
  // não bate com nenhuma alternativa preenchida — igual a erros-ia-import.js,
  // ignora o item problemático em vez de quebrar o preview inteiro.
  if(!enunciado || alternativas.length < 2 || !alternativas.some(a => a.letra === gabarito)) return null;
  const assunto = typeof item.assunto === 'string' && item.assunto.trim() ? item.assunto.trim() : null;
  if(!assunto) return null;
  const confiancaConteudo = CONFIANCA_CONTEUDO_VALORES.includes(item.confiancaConteudo) ? item.confiancaConteudo : null;
  return {
    assunto,
    subtema: typeof item.subtema === 'string' && item.subtema.trim() ? item.subtema.trim() : null,
    concurso: typeof item.concurso === 'string' && item.concurso.trim() ? item.concurso.trim() : null,
    enunciado,
    alternativas,
    gabarito,
    comentario: typeof item.comentario === 'string' ? item.comentario.trim() : '',
    pegadinha: typeof item.pegadinha === 'string' && item.pegadinha.trim() ? item.pegadinha.trim() : null,
    baseLegal: typeof item.baseLegal === 'string' && item.baseLegal.trim() ? item.baseLegal.trim() : null,
    fonte: typeof item.fonte === 'string' && item.fonte.trim() ? item.fonte.trim() : null,
    confiancaConteudo,
  };
}

export function gerarPreviewImportacaoQuestoes(itens){
  return itens.map(item => {
    const dados = sanitizarQuestaoIA(item);
    return { dados: dados || {}, valido: !!dados, selecionado: !!dados };
  });
}

export function aplicarImportacaoQuestoes(state, preview, { criarQuestao }){
  let criadas = 0;
  preview.forEach(item => {
    if(!item.selecionado || !item.valido) return;
    state.questoes.push(criarQuestao({ ...item.dados, origem: 'ia' }));
    criadas++;
  });
  return { criadas };
}
