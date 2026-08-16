# Gerenciador de Estudos — Redesign UX/UI (spec addendum)

This is a redesign round on top of the shipped MVP (`docs/superpowers/specs/2026-08-15-gerenciador-de-estudos-design.md`
and `docs/superpowers/plans/2026-08-15-gerenciador-de-estudos-plan.md`, both already implemented and deployed to
GitHub Pages). It changes the shell, navigation, and visual system — **not** the data model, storage format, or
spaced-repetition logic.

## Scope (this round only)

1. Desktop sidebar navigation (collapsible).
2. A real Dashboard as the new home/landing screen.
3. Use full screen width on desktop (today: a centered 480px column, rest empty).
4. Reorganize existing screens into the new structure.
5. Visual overhaul to a "modern SaaS" finish.

**Explicitly out of scope for this round** (do not implement or plan for): PDF import, study session timer,
automatic planning reorganization (incl. automatic day-by-day session assignment), subassuntos, error-type
classification.

## Problems being fixed

- Centered narrow column, rest of a desktop monitor empty.
- Home opened on Export Markdown/JSON — backup UI buried the actual daily-use content.
- Bottom tab bar took the full screen width on desktop (no sidebar).
- "Semana" screen was just a target-setting form, no visualization of what actually happened.
- "Desempenho" screen was nearly empty (one bar chart, one list).
- Prototype look: near-identical background/card/border colors, no visual hierarchy.

## Design tokens

Single accent variable drives every highlight, button, and chart series — changing `--accent` re-themes the
whole app in one line, including chart colors (charts read `--accent` via `getComputedStyle` at render time,
not a hardcoded hex).

```css
--bg:        #0b0d11   /* page background, darkest */
--surface:   #14171d   /* sidebar / topbar */
--card:      #1a1e26   /* card background — visibly lighter than bg */
--border:    #2a2f3a   /* visible border, distinct from card */
--fg:        #e8eaed   --muted: #9aa0a6
--accent:    #4f9dde   --accent-fg: #06121c
--ok:        #3ecf8e   --warn: #e0a83e   --bad: #e05a4f   /* unchanged from MVP */

--space-1:4px --space-2:8px --space-3:12px --space-4:16px --space-6:24px --space-8:32px
--radius-sm:8px --radius:12px --radius-lg:16px
--text-xs:12px --text-sm:13px --text-base:14px --text-lg:16px --text-xl:20px --text-2xl:28px
font-weight: 400 body / 650 headings & big numbers
--shadow-sm: 0 1px 2px rgba(0,0,0,.35)   --shadow: 0 4px 16px rgba(0,0,0,.4)
```

## Confirmed decisions

1. **Charts:** Chart.js via CDN (`cdn.jsdelivr.net`), superseding the MVP's "no external libraries" constraint
   for this round only. To preserve offline/installed-PWA behavior, the Chart.js URL is added to the service
   worker's precache list.
2. **Planejamento week grid:** shows **realized** activity per day (SEG..DOM), derived entirely from existing
   `checkins` data — not a new "planned session per weekday" data model. Manual per-day subject assignment is
   deferred to a future round.
3. **Service worker cache-busting:** the reported bug ("phone kept serving the old version after deploy") gets
   a real fix, not just a version-string bump — see Task 2.

## Navigation structure

**Desktop (≥900px):** fixed left sidebar, collapsible to icon-only. Items, in order: Dashboard, Hoje,
Planejamento, Mapa de Conteúdo, Caderno de Erros, Desempenho, Configurações.

**Mobile (<900px):** bottom nav keeps only Hoje / Planejamento / Desempenho + a "Mais" button opening a sheet
with Dashboard, Mapa, Caderno de Erros, Configurações. Mobile still lands on Hoje by default (1-tap check-in
stays the mobile priority); desktop lands on Dashboard.

## Dashboard (new home)

Header: `{dias} dias até a prova` (existing `diasAte`).

KPI row: horas hoje · horas na semana · questões feitas · % de acerto · revisões pendentes · dias
consecutivos · % do cronograma concluído.

2-column grid below (1 column on mobile): horas estudadas por dia da semana (Chart.js bar) · desempenho por
disciplina (list + progress bar) · assuntos com pior desempenho · "o que estudar hoje" (existing revisão
queue) · check-in do dia (existing 3 buttons, moved here).

## Screen-by-screen changes

| Screen | Change |
|---|---|
| Hoje | Backup UI removed (moved to Configurações); checkin + detail form + revisão fila stay, restyled |
| Semana → **Planejamento** | Renamed; adds a realized-per-day SEG..DOM grid above the existing target form |
| Mapa de Conteúdo | Restyled into responsive card grid, logic unchanged |
| Caderno de Erros | Restyled into responsive card grid, logic unchanged |
| Desempenho | Adds: melhores assuntos (mirrors existing piores), evolução no tempo (new weekly-bucketed chart), total questões/horas; existing hand-rolled SVG bar chart replaced by Chart.js |
| **Dashboard** (new) | See above |
| **Configurações** (new) | "Dados e Backup" — hosts the Export/Import UI moved from Hoje |

**Preserved unchanged:** spaced repetition (1/2/7/21 days), `graduarAcerto`/`graduarErro`, Mapa status/concurso
cycling, `localStorage` key/shape, JSON backup format (`estadoValido` unchanged — old exports still import),
PWA installability, GitHub Pages deploy.
