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
