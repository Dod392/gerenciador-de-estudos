# Tela Hoje — Redesign e Registro Funcional — Design Spec

## Objetivo

A tela Hoje deixa de ser um formulário de check-in e passa a ser o centro operacional do
estudo diário: ao abrir, o usuário vê o que precisa estudar hoje, quanto já estudou, o que
falta, e consegue registrar uma atividade (com ou sem cronômetro) sem sair da tela. Todo
registro deve alimentar automaticamente Hoje, Dashboard e Desempenho — o usuário nunca digita
o mesmo dado duas vezes.

## Fora de escopo

Importação de PDF, planejamento automático, IA, banco remoto, autenticação, redesign de
Mapa de Conteúdo/Caderno de Erros/Configurações, mudanças estruturais em Dashboard/Desempenho
além de consumir os novos dados de sessão.

## Modelo de dados (aditivo, retrocompatível)

`state.checkins`, `state.erros`, `state.conteudo`, `state.planejamento`, `estadoValido()` e o
formato de export/import **não mudam**. Dois campos novos, ambos opcionais na leitura (backups
antigos continuam válidos; `loadState`/`importarJSON` preenchem o valor padrão quando ausente):

```js
state.sessoes = [
  {
    id, data,                    // 'YYYY-MM-DD'
    tipo,                        // 'questoes' | 'teoria' | 'revisao' | 'anki'
    assunto,                     // string | null
    minutos,                     // number
    questoes, acertos,           // number | null — só tipo='questoes'; erros/aproveitamento são DERIVADOS, não guardados
    paginas, concluida,          // number|null, boolean|null — só tipo='teoria'
    dificuldade,                 // 'facil'|'media'|'dificil'|null — só tipo='revisao'
    cartoes,                     // number|null — só tipo='anki'
    obs,                         // string
    criadoEm,                    // ISO datetime, auditoria
  }
]
state.sessaoEmAndamento = null | { assunto, tipo, origem, inicioEm }  // inicioEm = ISO datetime
```

`sessoes` é um log granular de atividades (múltiplas por dia, cada uma com seu assunto/tipo).
`checkins` continua sendo o registro agregado de 1 linha/dia usado por Fechamento do dia,
sequência de dias estudados e cronograma semanal — **não é substituído**. Registrar uma sessão
soma seus minutos ao `checkins` do dia (criando a linha se não existir, com `status:null` até o
usuário escolher Fechamento do dia), o que já é suficiente para `horasNoDia`, `horasPorDiaDaSemana`,
`horasRealizadasNaSemana`, `diasRealizadosNaSemana`, `calcularSequencia`, `diasEstudados` e
`totalHorasEstudadas` refletirem sessões sem precisar mudar essas funções (todas já tratam
`status !== 'nao'` e `minutos` numérico corretamente com `status:null`).

Só a repartição **por assunto** (Desempenho, "Desempenho por disciplina" do Dashboard, evolução
semanal) precisa enxergar `sessoes` diretamente, porque `checkins` só guarda 1 assunto por dia e
o usuário pode registrar assuntos diferentes no mesmo dia. `agregarPorAssunto` e `evolucaoSemanal`
ganham um segundo parâmetro opcional `sessoes` (default `[]`, retrocompatível) e os 5 call sites
existentes passam `state.sessoes`.

## Tela Hoje — estrutura

1. **Cabeçalho**: "Hoje, {dia da semana} {dia} de {mês}" + "{X} dias para a prova" (sem nome de
   concurso — não existe no modelo de dados) + barra de progresso `estudado hoje / 2,5h` (2,5h é
   a mesma meta-base "2h30" já usada em todo o app para status `base`).
2. **Próxima atividade** (card em destaque): primeiro item atrasado do plano da semana, senão
   primeiro pendente, senão primeira revisão da fila, senão estado vazio (positivo se havia plano
   e foi cumprido; convite a planejar se não há plano). Ação: "Iniciar estudo" (cronômetro) e
   "Registrar" (formulário direto, sem cronômetro).
3. **Plano de hoje**: lista compacta derivada de `plano.assuntosAlvo` da semana atual, estado por
   item (`pendente`/`atrasada`/`concluida`, calculado a partir de `assuntosTocadosNaSemana` +
   toque hoje via `conteudo.atualizadoEm` ou `sessoes`/`checkins` de hoje). Cada item pendente tem
   "Iniciar" e "Registrar". Estado vazio com CTA pra Planejamento.
4. **Revisões de hoje**: fila de erros vencidos (`filaRevisao`), reaproveitando `cardErro()` tal
   como já existe (Acertei/Errei), sem alterar essa função compartilhada. Estado vazio dedicado.
5. **Resumo do dia**: tira compacta com Planejado (2,5h), Estudado (`horasNoDia` já somando
   sessões), Atividades concluídas/total (do Plano de hoje), Questões (soma de `sessoes` tipo
   questões + `checkin` de hoje).
6. **"+ Registrar estudo"**: ação global pra registrar uma atividade fora do plano.
7. **Cronômetro**: ao clicar "Iniciar", grava `state.sessaoEmAndamento` (persistido — sobrevive a
   fechar/recarregar a aba) e mostra um contador ao vivo. "Finalizar" calcula os minutos
   decorridos e abre o formulário de registro do tipo correspondente, pré-preenchido.
8. **Formulário de registro** (usado por "Registrar" e por "Finalizar"): seletor de tipo
   (Questões/Teoria/Revisão/Anki) + campos específicos por tipo, com Erros e Aproveitamento
   calculados ao vivo pra tipo Questões. Salvar chama `registrarSessao`, que atualiza `sessoes` e
   o `checkins` de hoje — Dashboard e Desempenho refletem o novo dado no próximo render, sem
   nenhuma tela ser reescrita.
9. **Fechamento do dia**: os 3 botões atuais (Meta cumprida / Fiz o mínimo / Não consegui
   estudar), mesmos valores internos `base`/`minimo`/`nao`, mesmo formulário "detalhar"
   (`hoje-minutos`/`hoje-assunto`/`hoje-questoes`/`hoje-acertos`/`hoje-obs`) — comportamento e ids
   preservados sem alteração.

## Fora de escopo desta rodada (dentro do próprio recurso de registro)

Rascunho/recuperação de formulário fechado sem salvar; edição/exclusão de sessões já
registradas; notificação push quando o cronômetro passa de X minutos; múltiplos cronômetros
simultâneos (só 1 sessão em andamento por vez, `state.sessaoEmAndamento` é singular).
