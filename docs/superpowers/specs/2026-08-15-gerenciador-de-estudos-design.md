# Gerenciador de Estudos — Design

## Contexto e objetivo

App pessoal de acompanhamento de estudos para concurso, para um engenheiro
ambiental/sanitarista preparando dois concursos:

- **Transpetro 2026** (Eng. Ambiental) — prova em 29/11/2026, banca Cesgranrio.
- **INEA-RJ** (Eng. Sanitarista).

Rotina de estudo: 2h30/dia em casa + até 2h extras num trem, sem sinal
garantido, uso majoritariamente no celular e com uma mão.

O app não ensina nem gera conteúdo (isso já existe em outro lugar). Ele só
registra o que foi estudado, controla a repetição espaçada dos erros, e
mostra o que está atrasado e onde estão os buracos.

## Restrições (não-negociáveis)

- Arquivo único `index.html` (HTML+CSS+JS embutidos). Sem backend, sem build,
  sem npm, sem bibliotecas externas.
- Dados em `localStorage`, no navegador do dispositivo em uso.
- Mobile-first, otimizado para uso com uma mão, offline.
- Registrar o check-in do dia precisa caber em 1 toque (ver seção Telas).
- MVP em uma sessão de implementação. Sem features especulativas.

## Arquitetura

- Um único `index.html`. `<style>` e `<script>` embutidos, sem separação em
  múltiplos arquivos (evita o problema de abrir no celular via file://).
- Estado = um objeto JS único em memória (`state`), persistido no
  `localStorage` sob a chave `estudos_v1` a cada mutação, via uma função
  `save()` chamada ao final de toda ação que altera `state`.
- Navegação: barra inferior fixa com 4 abas (Hoje / Erros / Mapa /
  Desempenho), alcançável com o polegar. Trocar de aba atualiza
  `state.telaAtual` e chama `render()`.
- Renderização: cada tela tem uma função `render<Tela>()` que gera HTML via
  template strings e substitui o conteúdo do container principal. Sem
  virtual DOM, sem framework — event delegation simples para os handlers.
- Sem roteamento por URL/hash: a aba ativa é só estado em memória (não
  precisa sobreviver a um refresh manual da página).

## Modelo de dados

```js
// localStorage["estudos_v1"]
{
  meta: {
    provaData: "2026-11-29",
    cicloInicio: "2026-08-15"
  },
  checkins: [
    {
      data: "2026-08-15",           // YYYY-MM-DD, uma entrada por dia
      status: "base" | "minimo" | "nao",
      minutos: 150,                  // opcional
      assunto: "PNMA (6.938/81)",    // opcional, do mesmo vocabulário de `conteudo`
      questoes: 20,                  // opcional
      acertos: 14,                   // opcional
      obs: "texto curto"             // opcional
    }
  ],
  erros: [
    {
      id: "uuid-ou-timestamp",
      assunto: "CONAMA 357",         // do mesmo vocabulário de `conteudo`
      oQueErrei: "texto",
      regraCorreta: "texto",
      grau: "erro_novo" | "reforcado" | "corrigido" | "deficiencia",
      proximaRevisao: "2026-08-17",  // YYYY-MM-DD
      criadoEm: "2026-08-15"
    }
  ],
  conteudo: [
    {
      assunto: "PNMA (6.938/81)",
      status: "nao_iniciado" | "estudado" | "revisado" | "dominado",
      concurso: "transpetro" | "inea" | "ambos"
    }
    // pré-populado com os 17 assuntos abaixo
  ]
}
```

`conteudo` é seedado na primeira execução (quando não há dado salvo) com:
PNMA (6.938/81), SNUC (9.985/00), LC 140/2011, PNRH, CONAMA 357, CONAMA 430,
PNRS, NBR 10004, licenciamento ambiental, abastecimento de água, tratamento
de água, qualidade da água, tratamento de esgoto, poluição hídrica,
efluentes, resíduos sólidos, Português, Inglês — todos como
`nao_iniciado` / `ambos` por padrão, editáveis depois.

O campo `assunto` em `checkins` e `erros` é um `<select>` alimentado pela
lista de `conteudo.assunto` (+ opção "outro" com campo livre), para que a
tela Desempenho consiga agregar corretamente por assunto.

## Regra de repetição espaçada

- Item novo no Caderno de Erros → `grau = "erro_novo"`,
  `proximaRevisao = hoje + 2 dias`.
- Ao revisar, botão **[errei]** → `grau = "deficiencia"`,
  `proximaRevisao = hoje + 1 dia` (sempre, independente do grau anterior).
- Ao revisar, botão **[acertei]** → sobe um grau na sequência
  `deficiencia (1d) → erro_novo (2d) → reforcado (7d) → corrigido (21d)`;
  em `corrigido`, permanece `corrigido` e reagenda +21 dias.
- A fila de revisão (tela Hoje e tela Caderno de Erros) mostra itens com
  `proximaRevisao <= hoje`, ordenados por `proximaRevisao` ascendente
  (mais atrasado primeiro).

## Telas

### 1. Hoje
- Contagem regressiva em dias até 29/11/2026.
- Três botões de status sempre visíveis — **Base 2h30** / **Mínimo** /
  **Não estudei** — tocar em um já grava o check-in do dia (1 toque).
  Tocar de novo no dia troca o status já registrado (idempotente por data).
- Abaixo dos botões, um link "+ detalhar" opcional expande um mini-form
  com minutos, assunto (select), questões, acertos e observação curta —
  preenchido à parte, sem bloquear o check-in básico.
- Lista "revisar hoje": itens de `erros` com `proximaRevisao <= hoje`,
  com acesso direto aos botões `[acertei]`/`[errei]`.

### 2. Caderno de Erros
- Lista de `erros` ordenada por `proximaRevisao` ascendente (atrasados no
  topo, com indicação visual de atraso).
- Cada card mostra assunto, grau atual, data da próxima revisão, e os
  botões `[acertei]` / `[errei]`.
- Form curto para adicionar novo item: assunto (select), o que errei,
  regra correta. Grau inicial sempre `erro_novo`.

### 3. Mapa de Conteúdo
- Lista dos assuntos de `conteudo`. Tocar no status cicla
  `nao_iniciado → estudado → revisado → dominado → nao_iniciado`.
- Tag de concurso (Transpetro / INEA / ambos) editável por toque, com cor
  ou ícone distinto por status para leitura rápida do "buraco de
  cobertura".

### 4. Desempenho
- Gráfico de barras em SVG puro (sem lib): % de acerto por assunto,
  calculado agregando `questoes`/`acertos` de todos os `checkins` que
  referenciam aquele assunto.
- Dias estudados (checkins com `status != "nao"`) vs. dias corridos desde
  `meta.cicloInicio` até hoje.
- Os 5 assuntos com pior % de acerto (somente assuntos com `questoes > 0`
  registradas).

## Export / Import

Três ações, acessíveis por um botão/menu simples (não é uma 5ª tela):

- **Exportar Markdown**: gera um snapshot completo em texto —
  dias estudados vs. ciclo, fila de revisão atrasada, mapa de conteúdo com
  status por assunto, e desempenho (% por assunto, 5 piores) — pronto para
  colar num chat de IA e pedir diagnóstico/plano.
- **Exportar JSON**: dump cru de `state` para arquivo, como backup real /
  transferência entre dispositivos.
- **Importar JSON**: substitui `state` inteiro pelo conteúdo de um arquivo
  JSON previamente exportado, com confirmação antes de sobrescrever.

## Fora de escopo

- Geração de questões, flashcards ou conteúdo didático.
- Sincronização entre dispositivos (o Export/Import JSON é o mecanismo
  manual para isso).
- Login, backend, contas de usuário.
- PWA/instalação como app (o uso é abrir o arquivo `index.html` direto).
- Roteamento por URL, histórico de navegação do browser.

## Testes

Sem framework de testes (arquivo único, sem build). Verificação manual
funcional, cobrindo:
- Check-in do dia em 1 toque, idempotência ao re-tocar no mesmo dia.
- Transições de grau no Caderno de Erros (acertei sobe, errei sempre vai
  pra `deficiencia`/1 dia).
- Persistência: recarregar a página mantém o estado salvo.
- Export Markdown reflete o estado atual; Export/Import JSON faz round-trip
  sem perda de dados.
- Uso em viewport mobile estreito (ex.: 360px de largura).
