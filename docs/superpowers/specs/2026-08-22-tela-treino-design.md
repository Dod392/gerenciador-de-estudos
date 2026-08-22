# Plano de implementação — Tela "Treino"

Documento de planejamento para o Claude Code. Escrito depois de ler o código atual (`index.html`, `erros-ia-*.js`), rodar a suíte de testes (43 passando) e navegar o app publicado. Contém decisões já tomadas com justificativa — o Claude Code deve executar, não redecidir, mas pode e deve apontar se algo aqui conflitar com o código real que ele encontrar.

> **Nota de verificação (2026-08-22):** este documento foi conferido contra o código real antes de virar plano de execução. Duas correções:
> - §1: `iniciarSessaoRevisaoErros` está em index.html:1666, não :1643 (drift de linha, comportamento confere).
> - §2.2: a "lacuna" já foi fechada numa sessão anterior — `filaFlashcardsRevisao` foi substituída por `filaRevisoesPendentes`, que já lê `filaErrosPendentes` (curva do Erro), e "Revisões de hoje" em Hoje já usa essa fila. A Fase 1 não precisa corrigir esse bug de novo — só precisa trocar a lista item-a-item por um botão "Treinar agora (N pendentes)" que abre a tela Treino, como o resto do §2.2 já pedia.
>
> **Decisões tomadas com o usuário antes de começar:**
> - Navegação mobile: `MOBILE_PRIMARY` (barra fixa do celular) ganha Treino como **4ª aba fixa** (Hoje / Treino / Planejamento / Desempenho), sem remover nenhuma das 3 existentes.
> - Execução: as 5 fases rodam em sequência, sem pausa para aprovação entre elas. Cada fase só avança com `node --test` inteiro verde (43 testes existentes + os novos da fase). Decisão não coberta por este documento → escolher a opção mais conservadora (a que não muda comportamento de tela existente), registrar em `docs/DECISOES-TREINO.md` e continuar.

---

## 1. O problema que esta tela resolve

O app hoje tem todas as peças de um sistema de estudo sério, mas o **loop de estudo em si não tem casa própria**. A sessão de revisão existe (`iniciarSessaoRevisaoErros`, index.html:1666) e já chama a engine de repetição correta (`aplicarRevisaoErro`), mas vive escondida num modal dentro do Caderno de Erros, sem noção de tempo, sem fechamento, sem nada que faça o usuário querer abrir de novo amanhã.

O uso real é: **sessões curtas no celular, em trajeto (trem/metrô/ônibus), muitas vezes sem sinal, com uma mão só.** A tela precisa ser desenhada para isso, não para desktop.

O objetivo não é "gamificar" no sentido de pontos e troféus. É construir o lugar onde estudar por questões acontece dentro do app, com o mínimo de fricção e o máximo de recuperação ativa.

---

## 2. Decisões tomadas (e por quê)

### 2.1 Tela nova, engine velha

Criar uma tela de primeiro nível chamada **"Treino"**, na navegação principal, entre "Hoje" e "Planejamento". Na barra fixa do celular (`MOBILE_PRIMARY`), Treino entra como 4ª aba fixa (ver nota de verificação acima).

**Não criar sistema de agendamento novo.** A tela consome `window.ErrosIA.filaErrosPendentes()` e grava via `window.ErrosIA.aplicarRevisaoErro()` — a engine já existe, está testada e foi decidida em conversa anterior como a fonte única de agendamento no nível do Erro. Qualquer lógica nova de "quando revisar" seria um segundo sistema competindo com esse; não fazer.

O modal de revisão atual dentro do Caderno de Erros deve ser **removido** e substituído por um botão que navega para o Treino já com a fila filtrada. Duas portas para a mesma coisa é o tipo de dívida que a gente já decidiu não acumular.

### 2.2 Isso fecha a lacuna que ficou aberta

`filaRevisoesPendentes` já lê `filaErrosPendentes(state.erros, hojeISO())` em Hoje/Dashboard/notificações/relatório (corrigido numa sessão anterior — ver nota de verificação). O que falta é só o **card virar um botão grande "Treinar agora (N pendentes)"** que abre a tela Treino, em vez da lista item-a-item atual. Uma mudança pontual de UI, não uma refatoração de dados.

### 2.3 Gamificação: o que entra e o que fica de fora

A pesquisa sobre o Duolingo é útil principalmente como aviso do que **não** copiar. As críticas documentadas: leaderboards por XP fazem o usuário refazer as lições mais fáceis para farmar pontos ("XP grinding"), e o loop de baixa dificuldade produz "a ilusão de domínio em vez de memória durável". Para concurso isso é veneno — o objetivo não é engajamento, é acertar prova em 29/11.

**Fica de fora, decidido:** XP genérico, níveis, leaderboard (é usuário único), corações/vidas (punir prática é contraproducente), loja/avatar, notificação culpando por streak perdido.

**Entra:**

- **Métrica principal = "erros corrigidos"**, não atividade. A engine já marca `status: 'corrigido'` após dois acertos seguidos. Esse é o número que aparece grande no fechamento da sessão e no topo da tela. É impossível farmar: só sobe quando um ponto fraco realmente virou ponto forte, e volta atrás se ele errar de novo (`status: 'recorrente'`).
- **Sequência de dias (já existe no app), com duas correções:** (a) só conta o dia se a sessão foi real — mínimo de 5 itens respondidos **ou** 8 minutos, não basta abrir o app; (b) **um dia de folga por semana** que não quebra a sequência (consumido automaticamente, mostrado como "folga usada"). O motivo é prático: sequência quebrada é a principal causa de abandono, e o custo de perder um dia legítimo (prova, plantão, doença) não deve ser perder o hábito inteiro.
- **Combo dentro da sessão** (acertos seguidos), efêmero, sem persistir nem virar ranking. Serve de feedback imediato, não de placar.
- **Mapa de domínio por assunto** — barra por assunto calculada de dados reais (corrigidos vs. recorrentes vs. novos), não de tempo gasto. É o "progresso" visual, e é honesto.
- **Simulado relâmpago semanal** — 10 questões dos assuntos mais críticos, disponível uma vez por semana, com resultado guardado. É o "boss fight": dá fechamento e mede transferência para o formato de prova.

### 2.4 O tap de confiança — a decisão mais importante deste plano

Antes de revelar a resposta, o usuário toca em **como se sentiu**: `Chutei` · `Achei que sabia` · `Sabia`. Só depois disso o botão de revelar libera.

Isso não é enfeite. Faz três coisas de uma vez:

1. **Força a tentativa antes da resposta** — a regra número um do método dele ("nunca entregue a resposta antes da tentativa") passa a ser estrutural, não disciplina.
2. **Classifica o tipo de erro sozinho.** Cruzando confiança × resultado, o app preenche `tipoErro` sem perguntar: `sabia + errou` → confusão entre conceitos ou falha de interpretação (um toque para desambiguar); `chutei + errou` → falha de memorização / erro conceitual; `achei que sabia + errou` → erro conceitual. Hoje esse campo depende de o usuário escolher na mão, e por isso fica genérico.
3. **`chutei + acertou` NÃO conta como domínio.** O agendamento não avança (mantém intervalo em 1 dia) mesmo com acerto. Isso é regra explícita do método de estudo dele e é exatamente o que a repetição espaçada ingênua erra: sorte vira "aprendido".

Implementar como: `aplicarRevisaoErro(erro, acertou, hojeIso, { confianca })` — parâmetro **opcional** no fim, para não quebrar as chamadas existentes nem os 43 testes atuais. Quando `confianca === 'chutei' && acertou`, registra a revisão mas não avança `intervaloRevisaoDias` nem `proximaRevisao`.

### 2.5 Intercalação (interleaving) por padrão

A fila não agrupa por assunto. Regra: **nunca três itens seguidos do mesmo assunto**, embaralhando dentro da janela de prioridade. Existe um toggle "focar em um assunto" para quando ele quiser prática massada de propósito (véspera de tópico específico), mas o padrão é intercalado.

Uma ressalva honesta que vale registrar: a evidência de intercalação e prática espaçada é forte na literatura educacional ampla, mas revisões sistemáticas em domínios específicos ainda apontam número pequeno de estudos e resultados mistos. Não é motivo para não usar — é motivo para não prometer números.

### 2.6 Banco de questões: estrutura nova, agendamento não

Hoje o estado (`seedState`, index.html:811) **não tem questões como entidade** — só contagem agregada dentro de `sessoes`. Para "estudar por questões" acontecer dentro do app, precisa de `state.questoes`.

**Decisão de escopo:** a questão **não** ganha agendamento SRS próprio. O Erro continua sendo a única unidade de repetição espaçada (decisão anterior, mantida). A questão tem apenas: estatística de acerto, e um **cooldown** (não repetir a mesma questão por N dias — sugestão: 14). Errar uma questão cria ou vincula um Erro, e é o Erro que volta na fila.

### 2.7 PDF e IA externa: onde cada um entra

O usuário perguntou sobre subir PDF. A recomendação, depois de olhar a arquitetura:

**Não implementar leitura de PDF dentro do app.** Motivos concretos: o app é estático (GitHub Pages, sem backend), a CSP é restrita, e adicionar `pdf.js` via CDN resolveria apenas *extrair texto* — não gera questão nenhuma. Para virar questão, o texto precisa passar por uma IA de qualquer jeito. E as IAs de chat já leem PDF nativamente muito melhor do que qualquer extração local faria.

**O caminho certo é o que já funciona no Caderno de Erros, replicado:** o usuário joga o PDF (edital, lei, apostila, prova anterior) direto no chat da IA junto com um prompt que o app gera, e cola a resposta de volta. O padrão de export/import já existe, está testado (`erros-ia-export.js`, `erros-ia-import.js`) e o usuário já entende o fluxo.

**O que vale implementar além do copiar/colar:** importar de **arquivo** (`<input type="file">` + `FileReader`, aceitar `.json` e `.txt`). Sem biblioteca, sem CDN, sem CSP nova. Resolve o caso real de um lote grande de questões que é chato de passar pela área de transferência do celular.

Portanto, três portas de entrada de questão: **manual** (uma a uma), **colar resposta da IA**, **importar arquivo**. Nenhuma delas depende de rede em tempo de uso.

### 2.8 Offline de verdade

Trem e metrô perdem sinal. A tela Treino tem que funcionar 100% offline: fila montada de dados locais, respostas gravadas em `localStorage`, sync com Firestore quando voltar o sinal (o `agendarSyncNuvem()` já existente cobre isso). **Verificar `sw.js`**: os módulos ES novos precisam entrar na lista de cache do service worker, senão a tela quebra offline. Isso é fácil de esquecer e caro de descobrir depois — colocar como item de aceite.

**Sessão interrompida deve ser retomável.** Persistir `state.treinoSessao` a cada item respondido. Se ele fechar o app no meio (chegou a estação), ao voltar aparece "Continuar treino (7 de 15)".

---

## 3. Modelo de dados

### 3.1 Nova entidade: questão

```js
{
  id: 'q-...',
  assunto: 'PNRH',                 // casa com state.conteudo[].assunto
  subtema: 'Competências dos Comitês' | null,
  concurso: 'Transpetro' | 'INEA' | null,
  enunciado: 'texto...',
  alternativas: [                   // 2 a 5; formato Cesgranrio = 5
    { letra: 'A', texto: '...' },
  ],
  gabarito: 'C',
  comentario: 'por que C está certa e por que as outras não',
  pegadinha: '...' | null,
  baseLegal: 'Lei 9.433/97, art. 38' | null,
  fonte: 'Cesgranrio 2023' | null,
  origem: 'manual' | 'ia' | 'arquivo',
  confiancaConteudo: 'alta' | 'media' | 'baixa' | null,  // IA sinaliza quando envolve prazo/número que pode ter mudado
  criadoEm: 'YYYY-MM-DD',
  estatistica: { respondida: 0, acertos: 0, ultimaResposta: null },
  cooldownAte: null,                // ISO; não entra na fila antes disso
  erroIds: [],                      // erros gerados a partir desta questão
}
```

Guardar em `state.questoes = []`. Atualizar `estadoValido()` para validar o array novo **sem derrubar estados antigos que não o tenham** (ausente = `[]`, tratar em `normalizarCamposNovos`).

### 3.2 Sessão de treino (persistida)

```js
state.treinoSessao = {
  id, iniciadaEm, tempoAlvoMin,
  modo: 'misto' | 'revisao' | 'questoes',
  filtroAssunto: null, filtroConcurso: null,
  fila: [{ tipo: 'erro'|'questao'|'flashcard', refId }],
  indice: 0,
  confiancaAtual: null,
  revelado: false,
  respostas: [{ refId, tipo, confianca, acertou, emMs }],
  combo: 0, melhorCombo: 0,
}
```

### 3.3 Campos novos no Erro

Nenhum campo novo obrigatório. `revisoes[]` passa a aceitar `{ data, acertou, confianca }` — `confianca` opcional, ausente nos registros antigos. Não migrar nada.

### 3.4 Sequência de dias

```js
state.sequencia = { atual: 0, melhor: 0, ultimoDiaValido: null, folgasUsadasNaSemana: 0, semanaRef: null }
```

---

## 4. Arquitetura de arquivos

Seguir o padrão já estabelecido: **não inchar o `index.html`**. Lógica nova em módulos ES nativos, testados com `node --test`, agregados como os de erro.

```
treino-fila.js         — montagem e intercalação da fila
treino-sessao.js       — máquina de estado da sessão, confiança × resultado → tipoErro
treino-questoes.js     — CRUD do banco, cooldown, seleção por fraqueza
treino-questoes-ia.js  — prompt de exportação + parser de importação (espelha erros-ia-export/import)
treino-progresso.js    — domínio por assunto, sequência de dias, folga semanal
treino.js              — agregador, expõe window.Treino (espelha erros-ia.js)
+ um .test.js para cada
```

Render da tela e listeners ficam em `index.html`, seguindo a convenção de comentário de seção já usada. Adicionar os módulos novos ao `sw.js`.

---

## 5. A tela

### 5.1 Entrada (antes de começar)

Compacta, cabe sem rolar no celular. Mostra: **quantos itens pendentes** e **o gargalo de hoje** ("PNRH — 4 pendentes, 2 recorrentes"). Escolhas: tempo (**5 / 10 / 15 / 25 min**, ou "fila toda"), modo (**Misto** por padrão, ou só Revisão / só Questões), e filtro opcional de concurso. Um botão grande: **Começar**. Se houver sessão interrompida, ela aparece acima de tudo como "Continuar treino (7 de 15)".

### 5.2 Durante (tela cheia, uma mão)

Barra de progresso fina no topo (itens e tempo). Conteúdo no meio. **Ações na metade inferior da tela** — zona do polegar, alvos de 48px+, sem depender de teclado.

**Item do tipo Erro** (recuperação ativa):
1. Mostra só o gatilho: assunto, subtema, `enunciadoResumo`. Nunca a resposta.
2. Pergunta fixa: *"Qual é a regra aqui?"* — ele responde mentalmente.
3. Tap de confiança: `Chutei` · `Achei que sabia` · `Sabia`. **Revelar só habilita depois disso.**
4. Revela `regraCorreta`, `pegadinha`, `comoReconhecer`, `baseLegal`.
5. `Acertei` / `Errei` → grava via `aplicarRevisaoErro(erro, acertou, hoje, { confianca })`.
6. Se `sabia + errou`: um toque extra para desambiguar ("confundi com outro conceito" / "li errado o enunciado") → grava `tipoErro`.

**Item do tipo Questão** (formato de prova):
1. Enunciado + alternativas (A–E), toque para marcar.
2. Tap de confiança antes de confirmar.
3. Confirma → feedback imediato, comentário, pegadinha, base legal.
4. Se errou: botão **"Registrar no caderno de erros"** já pré-preenchido com assunto, fonte, enunciado e `tipoErro` deduzido — o padrão que já existe hoje em "Registrar estudo".

**Item do tipo Flashcard**: material de apoio do Erro, sem agendamento próprio (decisão anterior mantida). Frente → revelar → `Lembrei` / `Não lembrei`.

Sempre visível e sem confirmação: **Pular** (não conta como erro nem como acerto) e **Sair** (salva e fecha).

### 5.3 Fechamento

Nunca corta no meio de um item — ao bater o tempo, termina o item atual e fecha. Resumo em uma tela:

- **Erros corrigidos hoje: N** (a métrica que importa, em destaque)
- Itens revisados, % de acerto, melhor combo
- **Assuntos que continuam frágeis** — no máximo 3, com o motivo ("errou de novo depois de 3 dias")
- Quando cada coisa volta ("4 voltam amanhã, 2 em 3 dias")
- Sequência de dias atualizada (ou "folga usada")
- Botão: **+5 minutos** · **Terminar**

Sem confete. O fechamento é informação útil, não recompensa.

---

## 6. Fluxo de criação de questões pela IA

Espelha exatamente o que já existe no Caderno de Erros — mesma UX, mesmo formato, mesmas proteções de parsing.

**Exportar:** botão "Gerar questões com IA" abre modal com prompt pronto e botão Copiar. O prompt é montado a partir do contexto real: assuntos mais fracos (do `treino-progresso.js`), concurso alvo, banca (Cesgranrio), e o que já existe no banco (para não repetir). Texto do prompt deve incluir, no mínimo:

- formato Cesgranrio, 5 alternativas, uma correta
- comentário obrigatório explicando por que cada distrator está errado
- `pegadinha` e `baseLegal` quando houver
- **marcar `confiancaConteudo: "baixa"` sempre que envolver prazo, limite numérico, competência ou norma que pode ter mudado** (mesma salvaguarda do Caderno de Erros — CONAMA, potabilidade, marco do saneamento)
- responder com um bloco ```json contendo o array no schema da seção 3.1
- instrução explícita de que o usuário pode anexar PDF (edital, lei, prova anterior) e as questões devem sair **daquele material**, sem inventar dispositivo que não está lá

**Importar:** textarea (colar) **ou** seletor de arquivo `.json`/`.txt`. Parsing extrai o primeiro bloco ```json. Preview obrigatório antes de aplicar, com checkbox por questão. Reaproveitar as proteções que já existem em `erros-ia-import.js`: descartar item sem `enunciado`/`gabarito`, validar que `gabarito` existe entre as alternativas, ignorar campo com enum inválido em vez de quebrar o registro. Nada é gravado sem confirmação. Registrar em `state.historicoImportacoes` com `tipo: 'questoes_ia'`.

---

## 7. Execução em fases

Cada fase entrega algo usável e testado. Não começar a seguinte sem a anterior fechada.

**Fase 1 — Fundação da tela.** Criar `treino-fila.js` + `treino-sessao.js` + testes. Tela Treino na navegação (desktop e 4ª aba mobile), entrada/durante/fechamento, consumindo **só erros pendentes** (sem banco de questões ainda). Remover o modal antigo de revisão do Caderno de Erros e apontar para a tela nova. "Revisões de hoje" em Hoje vira botão "Treinar agora (N pendentes)".
*Entrega: o loop de revisão já fica melhor do que hoje, mesmo sem questões.*

**Fase 2 — Confiança e classificação automática.** Tap de confiança, `aplicarRevisaoErro` com parâmetro opcional, regra `chutei + acertou` não avança intervalo, dedução de `tipoErro`. Testes cobrindo cada combinação confiança × resultado.
*Entrega: a qualidade do dado do Caderno de Erros sobe sozinha.*

**Fase 3 — Banco de questões.** `state.questoes`, `treino-questoes.js`, CRUD manual, cooldown, entrada de questão na fila intercalada, "Registrar no caderno de erros" a partir de questão errada.
*Entrega: estudar por questões passa a acontecer dentro do app.*

**Fase 4 — Importação por IA.** `treino-questoes-ia.js`, export do prompt, import por colar e por arquivo, preview com checkbox.
*Entrega: encher o banco deixa de ser trabalho manual.*

**Fase 5 — Progresso e ritmo.** `treino-progresso.js`: mapa de domínio por assunto, sequência com sessão mínima e folga semanal, simulado relâmpago semanal.
*Entrega: o retorno de longo prazo, depois que já existe dado real para mostrar.*

---

## 8. Critérios de aceite

- A fila nunca traz três itens seguidos do mesmo assunto no modo intercalado.
- Revelar a resposta é impossível antes do tap de confiança.
- `chutei + acertou` registra a revisão mas **não** avança `intervaloRevisaoDias` nem `proximaRevisao`.
- Fechar o app no meio da sessão e reabrir oferece continuar exatamente de onde parou.
- Tela funciona inteira **com a rede desligada** (testar com DevTools offline), incluindo primeiro carregamento a partir do service worker — módulos novos presentes no `sw.js`.
- Nenhuma importação de questão grava sem confirmação no preview; JSON malformado mostra mensagem clara e não quebra a tela.
- Sequência de dias não sobe se a sessão teve menos de 5 itens ou menos de 8 minutos.
- Todos os alvos de toque na área de resposta têm ao menos 48px e ficam na metade inferior em telas de até 430px de largura.
- Suíte `node --test` verde, incluindo os 43 testes existentes (nenhuma quebra de assinatura).
- Nenhuma tela existente (Hoje, Dashboard, Desempenho, Planejamento, Mapa) muda de comportamento além do card "Revisões de hoje" descrito na seção 2.2.

---

## 9. Não-objetivos (registrar para não voltar à discussão)

- Sem XP, níveis, leaderboard, corações, moedas, avatar ou loja.
- Sem notificação de culpa por sequência perdida.
- Sem leitura de PDF dentro do app (seção 2.7).
- Sem chamada automática de API de IA — o fluxo é copiar/colar, por decisão anterior.
- Sem agendamento SRS próprio para questão ou flashcard — o Erro é a única unidade de repetição.
- Sem refatorar as 5.700 linhas existentes do `index.html`.
