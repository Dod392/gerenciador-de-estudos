# Decisões — Tela Treino

Registro de decisões tomadas durante a execução do plano `docs/superpowers/specs/2026-08-22-tela-treino-design.md`. Decisões explicitamente pedidas pelo usuário antes de começar, e decisões conservadoras tomadas sozinho quando o plano não cobria algo (regra: escolher a opção que não muda comportamento de tela existente).

## Decisões do usuário (2026-08-22, antes da Fase 1)

- **Navegação mobile:** Treino entra como 4ª aba fixa em `MOBILE_PRIMARY` (Hoje / Treino / Planejamento / Desempenho), em vez de substituir uma das 3 existentes.
- **Ritmo de execução:** as 5 fases do plano rodam em sequência, sem pausa para aprovação entre elas. Cada fase só avança pra próxima com `node --test` inteiro verde (testes existentes + os novos da fase). Se uma fase quebrar teste existente, corrigir antes de avançar.
- **Regra geral para decisões não cobertas pelo plano:** escolher a opção mais conservadora (que não muda comportamento de tela existente), registrar aqui, e continuar sem parar para perguntar.

## Decisões tomadas durante a execução

### Fase 1

- **Merge pro `main` ao fim de cada fase, não só no fim das 5.** Mantém o app publicado (GitHub Pages) incrementalmente atualizado e evita um branch de feature gigante divergindo do `main` por várias fases. Reavaliar se alguma fase deixar o app num estado intermediário ruim de publicar sozinho (não é o caso da Fase 1 — o loop de revisão já funciona sem banco de questões).
- **"Sair" da sessão zera `state.treinoSessao` imediatamente** (não fica "retomável"). Retomada automática cobre o caso involuntário (fechar o app/trocar de aba no meio); "Sair" é o usuário decidindo explicitamente encerrar, e replicar a mesma sessão como se nada tivesse acontecido pareceu mais confuso do que útil. Se isso incomodar no uso real, é fácil reverter (não zerar em "Sair", só em "Terminar").
- **Ícones:** o plano não especificou nomes exatos de ícone. `eye` e `x-circle` não existem no set `ICONES` do app — usei `lightbulb` pra "Revelar resposta" e os caracteres literais ✓/✗ pra "Acertei"/"Errei" (mesmo padrão já usado no código antigo que foi removido).
- **"Pular" não mexe no combo** (nem zera, nem mantém incrementando) — o plano dizia só "não conta como erro nem acerto", sem detalhar o combo; tratei como neutro (não é claramente um "erro" que devesse zerar).
- **Card "Revisões" em Hoje perdeu o "de hoje" do título** — like agora é só um botão (Treinar agora / Continuar treino / Revisões em dia), o nome mais genérico "Revisões" cobre os 3 estados sem soar estranho.

### Fase 2

- **`chutei + errou` e `achei_que_sabia + errou` mapeiam determinística para `falha_memorizacao`/`erro_conceitual`** — só `sabia + errou` pede o toque extra de desambiguação, seguindo a leitura literal do plano (que só menciona desambiguação nesse caso).
- **`sabia + errou` sem desambiguação informada** (chamada defensiva, ex.: estado corrompido) cai em `confusao_conceitos` por padrão — o plano não definiu um fallback explícito; escolhido por ser o valor citado primeiro no texto do plano.
- **`tipoErro` só é reclassificado em erros, nunca em acertos** — mesmo um acerto no chute (`confianca:'chutei'`) não mexe em `erro.tipoErro`, já que classificar "tipo de erro" num acerto não faz sentido semântico.
- **Botões de confiança e de desambiguação usam estilo neutro** (sem cor ok/bad) — o plano não especificou tratamento visual pra esse tap, e são escolhas neutras (nenhuma "certa"), diferente de Acertei/Errei que são binários com carga positiva/negativa.

### Fase 3

- **CRUD manual do banco de questões vive dentro da própria tela Treino** (modal aberto pelo botão "Banco de questões (N)" na entrada), não em Configurações nem em aba própria — o plano descreve Treino como "onde estudar por questões acontece dentro do app", então gerenciar o banco fica junto.
- **"Registrar no caderno de erros" a partir de uma questão errada reaproveita o modal de erro já existente** (`erroModalAberto`), navegando pra aba Erros com `dadosIniciais` pré-preenchidos, em vez de duplicar o formulário dentro do Treino — é literalmente "o padrão que já existe hoje", como o plano pediu. Isso exigiu estender o modal de erro pra aceitar `dadosIniciais` opcional (mudança aditiva, não quebra o fluxo normal de "Novo erro").
- **`selecionarPorFraqueza` é uma heurística simples** (nunca respondida → menor % de acerto → resposta mais antiga), baseada só nas estatísticas da própria questão — não é o cálculo de domínio por assunto que a Fase 5 (`treino-progresso.js`) vai construir. Pode ser substituída/reforçada quando esse módulo existir.
- **Questão tem 2 passos pra avançar (Confirmar → Continuar), diferente do Erro (1 toque, Acertei/Errei já avança).** Necessário pra dar tempo do usuário clicar "Registrar no caderno de erros" ainda vendo o feedback, antes de sair do item.
- **Formulário de alternativa fixo em 5 campos (A-E), vazios são ignorados** — cobre o "2 a 5; formato Cesgranrio = 5" do modelo de dados sem precisar de UI dinâmica de adicionar/remover campo.

### Fase 4

- **"Assuntos mais fracos" no prompt usa uma heurística simples** (assuntos com mais erros pendentes, top 5), já que `treino-progresso.js` (Fase 5, domínio por assunto de verdade) ainda não existe. Reavaliar quando esse módulo existir.
- **Linha de "concurso alvo" no prompt fica vazia por padrão** — o app não tem um conceito de "concurso principal único" (só uma lista `state.concursos`), então não há um valor natural pra preencher automaticamente sem adivinhar.
- **Schema de questão pra IA usa os mesmos nomes de campo do modelo interno** (assunto, enunciado, alternativas, gabarito...), diferente do schema de erros (que traduz pra tema/o_que_errei) — seguindo literalmente o pedido do plano de usar "o schema da seção 3.1".
- **Questão importada por IA sempre grava `origem:'ia'`**, mesmo que a resposta da IA tente mandar outro valor no campo — a origem reflete o canal de importação real do app, não é algo que a IA deveria poder declarar.
- **Import por arquivo reaproveita o mesmo pipeline do "colar"** (lê o arquivo pro mesmo textarea, mesmo botão Analisar) em vez de um caminho de código separado — menos duplicação, mesmo comportamento de validação/preview nos dois casos.

### Fase 5

- **`state.sequencia` é uma sequência própria do Treino, separada da sequência de dias estudados que já existia no app** (`calcularSequencia`, baseada em checkins/sessoes, usada em Dashboard/Desempenho) — essa continua intocada, conforme a restrição global de não mudar comportamento de tela existente. As duas sequências podem divergir (ex.: estudar sem abrir o Treino conta na antiga mas não na nova) — isso é esperado, não é bug.
- **A checagem de sequência (`checarSequenciaTreino`) é chamada em vários pontos** (cada resposta que pode terminar a sessão, Sair, Terminar) em vez de um único lugar — como a função pura é idempotente por dia, chamar de novo não tem custo, e isso garante que a sequência já apareça atualizada na própria tela de fechamento, e não só depois de clicar Terminar.
- **Resultado do simulado só é gravado ao clicar "Terminar" (fechamento completo)**, nunca ao "Sair" no meio — abandonar um simulado não consome a vaga da semana, dá pra tentar de novo.
- **"Assuntos críticos" do simulado reaproveita `calcularAssuntoMaisCritico`** (o mesmo cálculo já usado no Caderno de Erros), em vez de duplicar lógica de detecção de fraqueza dentro de `treino-progresso.js`.
- **Mapa de domínio por assunto fica num `<details>` fechado por padrão** na entrada do Treino, seguindo o mesmo padrão de "Avançado" já usado em Configurações — não compete visualmente com o fluxo principal de "Começar".
- **Simulado exige um mínimo de 3 questões no banco pra ficar disponível** (não as 10 ideais do plano) — número arbitrário, escolhido pra não bloquear completamente quem tem um banco pequeno, mas ainda impedir um "simulado" de 1 questão.
