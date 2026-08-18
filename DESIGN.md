---
name: Vade Mecum — Gerenciador de Estudos
colors:
  primary: "#b8863a"
  bg: "#0d1712"
  surface: "#152019"
  card: "#1b2921"
  fg: "#ece7d8"
  muted: "#8a9186"
  accent: "#b8863a"
  accentFg: "#0d1712"
  ok: "#3f7a52"
  warn: "#c99a3f"
  bad: "#b5482f"
  border: "#2c3a30"
typography:
  xs:
    fontFamily: "'IBM Plex Sans', system-ui, sans-serif"
    fontSize: 12px
  sm:
    fontFamily: "'IBM Plex Sans', system-ui, sans-serif"
    fontSize: 13px
  base:
    fontFamily: "'IBM Plex Sans', system-ui, sans-serif"
    fontSize: 14px
  lg:
    fontFamily: "'IBM Plex Sans', system-ui, sans-serif"
    fontSize: 16px
  xl:
    fontFamily: "'IBM Plex Sans', system-ui, sans-serif"
    fontSize: 20px
  2xl:
    fontFamily: "'IBM Plex Sans', system-ui, sans-serif"
    fontSize: 28px
  display:
    fontFamily: "'Source Serif 4', Georgia, serif"
    fontWeight: 600
  data:
    fontFamily: "'IBM Plex Mono', ui-monospace, monospace"
    fontWeight: 500
rounded:
  sm: 8px
  md: 12px
  lg: 16px
spacing:
  1: 4px
  2: 8px
  3: 12px
  4: 16px
  6: 24px
  8: 32px
---

## Overview

Gerenciador de Estudos is a single-file, offline-first PWA (`index.html`, vanilla JS, no build step) for planning and tracking study sessions for Brazilian public-exam preparation (concursos). All data lives in `localStorage` — nothing is sent to a server, and history is never deleted except through the explicit, double-confirmed "Zona de perigo" flow in Configurações.

**"Vade Mecum" is the visual identity**, named for the dark, cloth-bound multi-legislation compendium every Brazilian concurseiro owns and carries — this app's actual subject matter (PNMA, SNUC, CONAMA, PNRH, and the rest of the environmental-law syllabus behind the Transpetro/INEA exams it was built for). The identity deliberately avoids the generic "dark SaaS dashboard" look (neutral near-black + a single tech-blue accent) in favor of choices grounded in that object: a green-black "book cover" background, a brass/gold "spine lettering" accent instead of tech-blue, and a rubber-stamp motif for anything the user has fully mastered.

Dark ("book cover closed") is the default and primary target, matching real usage — most study happens in the evening. Light ("open page") is a fully supported second theme via `[data-theme="light"]` on `<html>`, toggled from Configurações → Preferências → Tema escuro — not a decorative afterthought, its own palette above passes contrast in its own right. Always reference colors as `var(--token)`, never a hardcoded hex, for anything touching page background or body text, so both themes stay correct automatically.

## Colors

- `--bg` / `--surface` / `--card` step from page background → panel → card. Dark: ink-green book-cloth, darkest to lightest. Light: aged paper, lightest to whitest (the card is the brightest surface, like a page under direct light).
- `--fg` is primary text, `--muted` is secondary/label text — graphite-gray with a faint green cast in dark mode, warm sepia-gray in light mode.
- `--accent` (brass/gold) marks the active nav item, primary buttons, links, progress fills — the "gold foil lettering on the spine." `--accent-fg` is the text color placed *on top of* an accent-filled surface; always pair them, never hardcode a text color on an accent background. The light-theme accent is a deliberately darker bronze than the dark-theme gold, so it still passes contrast on the paper background.
- `--ok` / `--warn` / `--bad` are semantic status colors, chosen for a specific real-world referent rather than generic traffic-light hues: `--ok` is rubber-stamp green ("aprovado"), `--warn` is aged-gold amber, `--bad` is sealing-wax red ("correção"). Light-theme values are darker/more saturated than dark-theme ones so they pass contrast on a pale card.
- `--border` is the only border color in the system — do not introduce a second gray.
- The `--status-*` tokens (Mapa de Conteúdo's não-iniciado/em-andamento/revisão/concluído badges) are intentionally theme-invariant — self-contained badge colors paired with a fixed text color chosen for that specific badge, not page-background-dependent.

## Typography

Three roles, deliberately not the same family doing double duty:
- **Display** (`Source Serif 4`, 600 weight) — every `h1`/`h2`/`h3`: screen titles and card headers. Carries the "law book" gravitas; used only for headings, never body copy or dense UI text.
- **Body** (`IBM Plex Sans`) — everything else: labels, buttons, table cells, form inputs. Chosen for its technical/documentary character (designed for IBM's own documentation) and because a dense data app needs a sans body face for legibility at 12–14px.
- **Data** (`IBM Plex Mono`, `.stat-value`) — every KPI/stat number, evoking legal-citation precision ("Art. 5º, §2º"). Reused directly wherever a number is the hero of a card; never applied to prose.

## Signature element: the selo (stamp)

The one memorable, restrained risk. When content in Mapa de Conteúdo reaches **dominado** (mastered) or an entry in Caderno de Erros reaches grau **corrigido**, its badge (`.selo`) renders as a rotated, double-ringed outline stamp in `--ok` — transparent fill, `IBM Plex Mono`, uppercase, letter-spaced — instead of the filled pill used for every other badge in the app. It reads as ink stamped onto the page, not a status chip. Used *only* for these two "fully done" states — applying it more broadly would dilute it into decoration.

## Spacing & shape

8px-based spacing scale (`--space-1` 4px … `--space-8` 32px) drives padding, gaps, and margins — pick the nearest token instead of a raw pixel value. Three radii: `--radius-sm` (8px, inputs/buttons/small badges), `--radius` (12px, the default `.card` radius), `--radius-lg` (16px, modals and sheets). Tap targets are 48px minimum (`--tap`) everywhere touch/click matters.

## Components

- **Card** (`.card`): background `--card`, 1px `--border`, `--radius`, `--shadow-sm`. The base container for nearly every section on every screen.
- **Stat card** (`.stat-card` inside `.card`): uppercase `.stat-label`, large monospace `.stat-value`, optional icon top-right, optional `.stat-sub` caption.
- **Buttons**: full-width by default, `.primary` (accent/gold fill) for the one main action per view, `.ok`/`.bad` for semantic actions. Text on any filled button is `var(--accent-fg)`, never hardcoded.
- **Selo** (`.selo`): see Signature element above — reserve for "fully mastered/corrected," don't reuse as a generic badge style.
- **Toggle switch** (`.switch`): the only checkbox-as-switch pattern in the app (Configurações → Preferências).
- **Table** (`table.data`): wrap in `.table-wrap` for horizontal scroll on narrow screens instead of letting a table overflow the page.
- **Empty state** (`.empty-state`): icon + message + optional action, used whenever a list/table has zero rows.
- **Two-column layout** (`.grid-hoje`): 2fr/1fr on desktop, single column under 900px — the standard "main content + sidebar summary" split.

## Adding a new screen

1. Reuse existing component classes (above) before writing new CSS.
2. Any new color must be a `var(--token)` reference — add to both `:root` and `:root[data-theme="light"]` if a genuinely new semantic color is needed, never hardcode hex.
3. Headings use the display face automatically (`h1`/`h2`/`h3`); don't override with body/mono unless it's a numeric stat.
4. Any chart (Chart.js) must read colors via `corVar('--token')` at creation time, not a literal hex, so it repaints on theme toggle.
5. Any user-facing date must go through `formatarData()` and respect `state.preferencias.formatoData`.
6. Any destructive/critical action must go through `confirmarAcao()` — except truly irreversible ones (wiping all data), which additionally require a native `confirm()` that preference can't skip.
7. Don't reach for `.selo` as a generic "success" badge — it's reserved for "fully mastered/corrected" so it stays meaningful.
