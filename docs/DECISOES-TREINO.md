# Decisões — Tela Treino

Registro de decisões tomadas durante a execução do plano `docs/superpowers/specs/2026-08-22-tela-treino-design.md`. Decisões explicitamente pedidas pelo usuário antes de começar, e decisões conservadoras tomadas sozinho quando o plano não cobria algo (regra: escolher a opção que não muda comportamento de tela existente).

## Decisões do usuário (2026-08-22, antes da Fase 1)

- **Navegação mobile:** Treino entra como 4ª aba fixa em `MOBILE_PRIMARY` (Hoje / Treino / Planejamento / Desempenho), em vez de substituir uma das 3 existentes.
- **Ritmo de execução:** as 5 fases do plano rodam em sequência, sem pausa para aprovação entre elas. Cada fase só avança pra próxima com `node --test` inteiro verde (testes existentes + os novos da fase). Se uma fase quebrar teste existente, corrigir antes de avançar.
- **Regra geral para decisões não cobertas pelo plano:** escolher a opção mais conservadora (que não muda comportamento de tela existente), registrar aqui, e continuar sem parar para perguntar.

## Decisões tomadas durante a execução

(preenchido conforme a implementação avança)
