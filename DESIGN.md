---
version: alpha
name: Lumen
description: Sistema de design do Gerenciador de Estudos — interface clara, densa e organizada para acompanhamento de estudo de concurso.
colors:
  primary: "#6246E8"
  primary-hover: "#5238D6"
  primary-soft: "#EFEBFF"
  on-primary: "#FFFFFF"
  neutral: "#F5F6FA"
  surface: "#FFFFFF"
  surface-sunken: "#F0F1F7"
  outline: "#E5E7F0"
  outline-strong: "#CBCFDE"
  on-surface: "#14161C"
  on-surface-muted: "#5A6478"
  success: "#05805A"
  success-soft: "#E3F5EE"
  error: "#C81E2C"
  error-soft: "#FCE9EA"
  warning: "#A9640B"
  warning-soft: "#FDF1DF"
  subject-1: "#6246E8"
  subject-2: "#0E8F9E"
  subject-3: "#C2410C"
  subject-4: "#1D6FD6"
  subject-5: "#9333A8"
  subject-6: "#4D7C0F"
typography:
  display-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 34px
    fontWeight: 700
    lineHeight: 1.1
    letterSpacing: -0.025em
  headline-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 20px
    fontWeight: 700
    lineHeight: 1.25
    letterSpacing: -0.02em
  headline-sm:
    fontFamily: Plus Jakarta Sans
    fontSize: 16px
    fontWeight: 600
    lineHeight: 1.3
    letterSpacing: -0.01em
  data-lg:
    fontFamily: Inter
    fontSize: 28px
    fontWeight: 700
    lineHeight: 1
    letterSpacing: -0.03em
    fontFeature: "'tnum' 1"
  data-md:
    fontFamily: Inter
    fontSize: 18px
    fontWeight: 600
    lineHeight: 1
    letterSpacing: -0.02em
    fontFeature: "'tnum' 1"
  body-md:
    fontFamily: Inter
    fontSize: 15px
    fontWeight: 400
    lineHeight: 1.55
  body-sm:
    fontFamily: Inter
    fontSize: 13px
    fontWeight: 400
    lineHeight: 1.5
  label-caps:
    fontFamily: Inter
    fontSize: 11px
    fontWeight: 600
    lineHeight: 1
    letterSpacing: 0.07em
  caption:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: 400
    lineHeight: 1.4
rounded:
  none: 0px
  sm: 8px
  md: 12px
  lg: 16px
  full: 9999px
spacing:
  xs: 4px
  sm: 8px
  md: 12px
  lg: 16px
  xl: 24px
  2xl: 32px
  3xl: 48px
  card-padding: 20px
  page-margin-mobile: 16px
  page-margin-desktop: 32px
  content-max: 1180px
  sidebar-width: 240px
  bottom-nav-height: 56px
  touch-target: 44px
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-primary}"
    typography: "{typography.body-md}"
    rounded: "{rounded.sm}"
    padding: 12px
    height: 44px
  button-primary-hover:
    backgroundColor: "{colors.primary-hover}"
  button-secondary:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.on-surface}"
    typography: "{typography.body-md}"
    rounded: "{rounded.sm}"
    padding: 12px
    height: 44px
  button-soft:
    backgroundColor: "{colors.primary-soft}"
    textColor: "{colors.primary}"
    typography: "{typography.body-sm}"
    rounded: "{rounded.sm}"
    padding: 10px
    height: 40px
  card:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.on-surface}"
    rounded: "{rounded.md}"
    padding: "{spacing.card-padding}"
  card-nested:
    backgroundColor: "{colors.surface-sunken}"
    rounded: "{rounded.sm}"
    padding: "{spacing.md}"
  input:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.on-surface}"
    typography: "{typography.body-md}"
    rounded: "{rounded.sm}"
    padding: 12px
    height: 44px
  nav-item:
    backgroundColor: transparent
    textColor: "{colors.on-surface-muted}"
    typography: "{typography.body-sm}"
    rounded: "{rounded.sm}"
    padding: 10px
  nav-item-active:
    backgroundColor: "{colors.primary-soft}"
    textColor: "{colors.primary}"
  chip:
    backgroundColor: "{colors.surface-sunken}"
    textColor: "{colors.on-surface-muted}"
    typography: "{typography.caption}"
    rounded: "{rounded.full}"
    padding: 6px
  progress-track:
    backgroundColor: "{colors.surface-sunken}"
    rounded: "{rounded.full}"
    height: 6px
  progress-fill:
    backgroundColor: "{colors.primary}"
    rounded: "{rounded.full}"
---

# Lumen — Gerenciador de Estudos

## Overview

Painel de estudo para um engenheiro adulto preparando concurso público (Transpetro, INEA). Ele abre o app várias vezes por dia, boa parte delas no celular durante deslocamento, e precisa de duas respostas rápidas: **o que estudar agora** e **como está o ritmo em relação à meta**.

A personalidade é **clara, organizada e densa** — a de um painel de controle bem arrumado, não a de um caderno. A referência de sensação são painéis de estudo modernos: fundo claro levemente frio, cartões brancos flutuando sobre ele, um violeta como cor de ação, e informação suficiente na tela para que o usuário não precise navegar para saber onde está.

Tema **claro exclusivo**. Não há alternador de tema — um só conjunto de decisões de contraste para validar e manter.

A regra que governa tudo: **a tela precisa parecer cheia porque tem informação, não porque tem enfeite**. Densidade vem de listar as matérias, os horários, as revisões e os erros — nunca de ilustração, gradiente ou cartão decorativo.

## Colors

Base fria e clara, cartões brancos, violeta como único motor de interação.

- **Neutral (#F5F6FA):** fundo da página. Levemente azulado, nunca branco puro — é o contraste entre ele e o cartão branco que faz o cartão existir.
- **Surface (#FFFFFF):** cartões e superfícies de conteúdo.
- **Surface-sunken (#F0F1F7):** trilhas de progresso, campos aninhados, blocos rebaixados dentro de cartões.
- **Outline (#E5E7F0):** borda de 1px em cartões, combinada com sombra suave.
- **On-surface (#14161C):** texto primário. Quase preto, com viés azul, nunca `#000`.
- **On-surface-muted (#5A6478):** rótulos, metadados, unidades, navegação inativa. Único nível secundário de texto do sistema — não criar um terceiro, mais claro que isso reprova em contraste.
- **Primary (#6246E8):** violeta. Ação primária, item de navegação ativo, preenchimento de progresso, links.
- **Primary-soft (#EFEBFF):** fundo tingido para navegação ativa, chips selecionados e botões suaves. Só recebe texto em `primary`.
- **Success / Error / Warning:** exclusivamente semânticos — acerto e erro em questões, meta cumprida, revisão atrasada. Cada um tem variante `-soft` para usar como fundo de selo, com o tom escuro como texto por cima.

**Cores de disciplina (subject-1 a subject-6).** As matérias recebem código de cor fixo. Isso é funcional: permite reconhecer a matéria de relance numa lista longa, e é o que dá legibilidade a painéis de estudo densos.

Regra estrita: cor de disciplina aparece **apenas** como ponto de 8px, barra vertical de 3px à esquerda do item, ou texto de rótulo. Nunca como fundo de cartão, nunca em botão, nunca em gráfico de desempenho. A atribuição matéria→cor é fixa e idêntica em todas as telas.

## Typography

Duas famílias, com papéis separados e sem sobreposição.

- **Plus Jakarta Sans** nos títulos. Dá o ar contemporâneo e levemente amigável dos painéis de estudo modernos sem cair em fonte arredondada infantil. Três níveis apenas: `display-lg`, `headline-md`, `headline-sm`.
- **Inter** em todo o resto — corpo, rótulos, navegação e, principalmente, dados.

Todo valor numérico usa **algarismos tabulares** (`font-variant-numeric: tabular-nums`), sem exceção. Sem isso o cronômetro treme e colunas de números desalinham entre linhas.

A assinatura tipográfica é o contraste entre número e rótulo: valor grande em Inter com tracking negativo (-0.03em) sob um rótulo em caixa alta a 11px com tracking positivo (+0.07em). Esse par aparece em todo indicador do app.

Carregar as duas fontes com `display=swap` e subset latino. Três pesos apenas: 400, 600, 700. Nenhum itálico na interface.

## Layout

Grade de **4px**. Toda margem, padding e gap vem da escala de espaçamento — nenhum valor avulso.

**Desktop (≥ 1024px):** barra lateral fixa de 240px. O conteúdo ocupa toda a largura restante, com `max-width: 1180px` centralizado **dentro dessa área**, não na viewport inteira. A centralização na viewport é o que hoje produz a faixa vazia entre barra lateral e cartões, e é o primeiro defeito a corrigir.

**Tablet (768–1023px):** barra lateral colapsa para 64px, só ícones.

**Mobile (< 768px):** barra lateral some e dá lugar a **navegação inferior fixa** com cinco destinos — Hoje, Planejamento, Mapa, Erros, Desempenho. Dashboard e Configurações vão para um menu no cabeçalho. Grids passam a coluna única. A tela inicial no mobile é **Hoje**.

O layout mobile é o caso principal. Funciona sem vazamento a partir de 360px, respeita `env(safe-area-inset-bottom)`, área tocável mínima de 44×44px, nunca produz rolagem horizontal.

## Elevation & Depth

Em fundo claro, a profundidade vem de **sombra suave combinada com borda de 1px** — as duas juntas. A borda define a aresta; a sombra separa do fundo.

- **Cartão em repouso:** `border: 1px solid outline` + `box-shadow: 0 1px 2px rgba(20,22,28,0.04), 0 4px 12px rgba(20,22,28,0.04)`.
- **Cartão interativo em hover:** mesma borda, sombra `0 2px 4px rgba(20,22,28,0.05), 0 8px 20px rgba(20,22,28,0.07)`. Nada cresce nem se desloca.
- **Modal e menu:** `0 12px 32px rgba(20,22,28,0.14)`.

Sombra é sempre neutra e sem cor. Não existe sombra violeta, glow, gradiente de fundo de cartão nem `backdrop-filter`.

## Shapes

Cantos generosos, um valor por tipo de elemento:

- **Cartões e contêineres:** 12px (`rounded.md`)
- **Botões, campos, itens de navegação:** 8px (`rounded.sm`)
- **Modais e folhas:** 16px (`rounded.lg`)
- **Chips, selos, barras de progresso, avatar:** `rounded.full`

Sem exceções e sem misturar raios diferentes dentro do mesmo componente.

## Components

**Botões.** Uma única ação primária violeta por tela. O resto é secundário (branco com borda) ou suave (fundo `primary-soft`, texto violeta) — este último é o certo para ações repetidas em lista, como um "Estudar" ao lado de cada matéria. Altura 44px. Rótulo em voz ativa dizendo o que acontece: "Iniciar sessão", "Registrar erro" — nunca "Enviar" ou "OK".

**Cartões de indicador (KPI).** Estrutura fixa: `label-caps` no topo, valor em `data-lg`, `caption` de contexto no rodapé. Sem ícone dentro — o rótulo já identifica. Quatro por linha no desktop, dois no mobile.

**Ícones.** Conjunto único: **Lucide**, inline como SVG, `stroke-width: 1.75`, 20px na navegação e 16px inline. Herdam a cor do texto ao redor; ícone de navegação ativo herda `primary`.

Nenhum emoji na interface, em nenhuma circunstância — título, botão, estado vazio ou mensagem de erro. Hoje há emoji em praticamente todo elemento do app; todos devem ser substituídos. É o marcador mais imediato de protótipo inacabado.

**Listas de matéria.** É o componente central do app e o que mais aproxima dos painéis de referência. Cada linha traz: barra vertical de 3px na cor da disciplina, nome da matéria, chip com o tópico, duração planejada, duração cumprida e um botão suave à direita. Densidade alta, altura de linha compacta, divisor de 1px entre itens.

**Barras de progresso.** Trilha `surface-sunken` de 6px, preenchimento violeta, cantos totalmente arredondados. O percentual vai ao lado em `data-md` — nunca dentro da barra.

**Gráficos.** Uma série por gráfico, barras ou linha em violeta, grade horizontal em `outline` apenas. Sem legenda quando há série única, sem gradiente sob a linha, sem eixo com valores fracionários inventados. **Sem dado no período, o gráfico não é renderizado** — entra o estado vazio.

**Estados vazios.** Nunca exibem zeros. Indicador sem dado mostra `—` e uma legenda curta explicando o que gera aquele número. Blocos maiores mostram uma frase começando por verbo e **uma única** ação. Sem ilustração, sem emoji, sem exclamação.

**Voz.** Frases curtas, caixa de sentença, verbo na frente. O app não comemora, não se desculpa e não fala em primeira pessoa. Erro diz o que aconteceu e o que fazer.

**Movimento.** Apenas `opacity` e `transform`, 150ms, `ease-out`. Nada de mola, salto ou escala. `prefers-reduced-motion: reduce` desliga tudo.

## Do's and Don'ts

- **Do** manter uma única ação primária violeta por tela.
- **Don't** usar emoji como ícone em nenhum lugar da interface.
- **Do** usar cor de disciplina apenas como ponto, barra lateral fina ou rótulo.
- **Don't** usar cor de disciplina como fundo de cartão ou cor de botão.
- **Do** usar algarismos tabulares em todo número que muda.
- **Don't** renderizar gráfico, eixo ou barra quando não há dado no período.
- **Do** exibir `—` em vez de `0` quando o valor ainda não existe.
- **Don't** repetir o mesmo indicador em mais de um lugar da mesma tela.
- **Do** combinar borda de 1px com sombra suave e neutra em todo cartão.
- **Don't** usar sombra colorida, gradiente ou glow em qualquer superfície.
- **Do** validar cada par de cores em 4.5:1 para texto e 3:1 para ícones e bordas de controle.
- **Don't** implementar tema escuro ou alternador de tema.
- **Do** desenhar cada tela primeiro em 360px de largura.
- **Don't** exceder três pesos tipográficos ou usar itálico na UI.
- **Don't** centralizar texto corrido — alinhamento à esquerda em todo o app.
