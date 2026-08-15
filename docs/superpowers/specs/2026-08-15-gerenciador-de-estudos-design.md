# Gerenciador de Estudos — Design

## Contexto e objetivo

App pessoal de acompanhamento de estudos para concurso, para um engenheiro
ambiental/sanitarista preparando dois concursos:

- **Transpetro 2026** (Eng. Ambiental) — prova em 29/11/2026, banca Cesgranrio.
- **INEA-RJ** (Eng. Sanitarista).

Rotina de estudo: 2h30/dia em casa + até 2h extras num trem, sem sinal
garantido, uso majoritariamente no celular e com uma mão.

O app não ensina nem gera conteúdo (isso já existe em outro lugar). Ele só
registra o que foi estudado, controla a repetição espaçada dos erros,
compara meta x realizado da semana, e mostra o que está atrasado e onde
estão os buracos.

## Restrições (não-negociáveis)

- HTML+CSS+JS sem framework, sem build, sem npm, sem bibliotecas externas.
  O núcleo do app é um `index.html` autocontido; os únicos arquivos extras
  tolerados são os exigidos pelo PWA (manifest, service worker, ícones —
  ver seção PWA).
- Dados em `localStorage`, no navegador do dispositivo em uso. Uso
  principal é o celular (Android, no trem); o PC é só ambiente de
  desenvolvimento.
- Mobile-first de verdade: layout de uma coluna, alvo de toque grande o
  bastante pro polegar, nada que dependa de hover ou de tela larga.
  Referência de teste: viewport de 390px de largura.
- Registrar o check-in do dia precisa caber em 1 toque (ver seção Telas).
- MVP em uma sessão de implementação. Sem features especulativas.

## Arquitetura

- `index.html` com `<style>` e `<script>` embutidos — a lógica do app
  inteira vive aqui, sem separação em múltiplos arquivos JS/CSS.
- Estado = um objeto JS único em memória (`state`), persistido no
  `localStorage` sob a chave `estudos_v1` a cada mutação, via uma função
  `save()` chamada ao final de toda ação que altera `state`.
- Navegação: barra inferior fixa com 5 abas (Hoje / Erros / Mapa / Semana /
  Desempenho), alcançável com o polegar. Trocar de aba atualiza
  `state.telaAtual` e chama `render()`.
- Renderização: cada tela tem uma função `render<Tela>()` que gera HTML via
  template strings e substitui o conteúdo do container principal. Sem
  virtual DOM, sem framework — event delegation simples para os handlers.
- Sem roteamento por URL/hash: a aba ativa é só estado em memória (não
  precisa sobreviver a um refresh manual da página).
- CSS mobile-first desde a base: nenhuma media query "desktop-first" a
  desfazer; larguras fluidas, botões com área de toque ≥44px, uma coluna
  única do topo ao rodapé.

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
      concurso: "transpetro" | "inea" | "ambos",
      atualizadoEm: "2026-08-15"       // YYYY-MM-DD da última mudança de status
    }
    // pré-populado com os 17 assuntos abaixo
  ],
  planejamento: [
    {
      semanaId: "2026-08-10",          // segunda-feira da semana (YYYY-MM-DD)
      assuntosAlvo: ["CONAMA 357", "PNRS"],
      diasAlvo: 6,
      horasAlvo: 15
    }
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

## Planejamento semanal (meta x realizado)

Semana = semana calendário, segunda a domingo; `semanaId` é a data da
segunda-feira daquela semana. Uma meta é global à semana (não por
assunto): número de dias-alvo, horas-alvo, e uma lista de assuntos-alvo
(sem hora individual por assunto — mantém o check-in diário simples, sem
precisar registrar múltiplos assuntos por dia).

- **Dias realizados** = nº de `checkins` na semana com `status != "nao"`.
- **Horas realizadas** = soma de `minutos` dos `checkins` da semana; se um
  checkin não tem `minutos` preenchido, usa 150 quando `status == "base"`
  (a base é sempre 2h30) e 0 quando `status == "minimo"` (duração do
  mínimo não é padronizada, então sem detalhe preenchido não soma horas —
  limitação assumida do MVP).
- **Assuntos tocados** = união de `checkins[].assunto` da semana com os
  assuntos de `conteudo` cujo `atualizadoEm` caiu dentro da semana (ou
  seja, teve o status alterado no Mapa de Conteúdo naquela semana).
- **O que ficou pra trás** = assuntos de `assuntosAlvo` que não estão em
  "assuntos tocados", mais o quanto faltou de dias e de horas
  (`max(0, alvo - realizado)` para cada um).

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

### 4. Semana (planejamento semanal)
- Mostra a semana atual: dias realizados/alvo, horas realizadas/alvo, e a
  lista de assuntos-alvo com indicador tocado/não tocado.
- Se não existe meta para a semana atual, mostra estado vazio com CTA
  "Definir meta da semana".
- Form de definir/editar meta: seleção múltipla de assuntos (a partir de
  `conteudo`), campo dias-alvo, campo horas-alvo. Salvar cria ou
  atualiza o `planejamento` daquele `semanaId`.

### 5. Desempenho
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
  status por assunto, meta x realizado da semana atual (dias, horas,
  assuntos que ficaram pra trás), e desempenho (% por assunto, 5 piores)
  — pronto para colar num chat de IA e pedir diagnóstico/plano.
- **Exportar JSON**: dump cru de `state` para arquivo, como backup real /
  transferência entre dispositivos.
- **Importar JSON**: substitui `state` inteiro pelo conteúdo de um arquivo
  JSON previamente exportado, com confirmação antes de sobrescrever.

`localStorage` é local ao navegador/dispositivo — o que é registrado no
celular não aparece no PC e vice-versa, não há sincronização automática.
A tela Hoje traz um aviso curto e permanente sobre isso, e o Export/Import
JSON é o caminho oficial de backup e de transferência entre dispositivos.

## PWA (instalável, offline)

Escopo mínimo para "Adicionar à tela inicial" funcionar de verdade no
Android e o app abrir offline depois de instalado:

- `manifest.json`: nome, ícone(s), `display: standalone`,
  `start_url` e `scope` relativos (`.` / `./`) para funcionar tanto em
  `localhost` quanto sob o subcaminho de um GitHub Pages de projeto
  (`usuario.github.io/repo/`).
- `sw.js`: service worker simples, estratégia cache-first para os
  arquivos estáticos do app (`index.html`, `manifest.json`, ícones).
  Sem sincronização em background, sem push — só cache pra abrir offline.
- 1–2 ícones PNG (ex. 192px e 512px) para o ícone da tela inicial.
- `index.html` registra o service worker (`navigator.serviceWorker.register`)
  e referencia o manifest via `<link rel="manifest">`.
- Isso torna o projeto multi-arquivo (`index.html` + `manifest.json` +
  `sw.js` + ícones), mas continua sem backend/build/npm/framework — só
  arquivos estáticos servidos juntos.
- Limitação assumida: service worker exige `http(s)` (localhost ou GitHub
  Pages); abrindo `index.html` direto via `file://` no PC, o app funciona
  normalmente mas sem cache offline nem prompt de instalação.

## Publicação (GitHub Pages)

Depois do MVP validado localmente (servidor estático simples, ex.
`python -m http.server` ou extensão Live Server, para o service worker
funcionar):

1. Criar repositório no GitHub, push do conteúdo do projeto.
2. Habilitar GitHub Pages apontando pra branch/pasta do projeto.
3. Como o site fica em `usuario.github.io/nome-do-repo/` (subcaminho, não
   raiz), `start_url`/`scope` do manifest e o caminho de registro do
   service worker precisam ser relativos — já contemplado na seção PWA
   acima — para não quebrar nesse subcaminho.
4. URL final é aberta e testada no celular (Chrome Android): confirmar
   prompt de instalação, funcionamento offline, e que o app abre em modo
   standalone (sem barra de endereço) depois de instalado.

## Fora de escopo

- Geração de questões, flashcards ou conteúdo didático.
- Sincronização automática entre dispositivos (o Export/Import JSON é o
  mecanismo manual para isso).
- Login, backend, contas de usuário.
- Push notifications, background sync.
- Roteamento por URL, histórico de navegação do browser.

## Testes

Sem framework de testes (sem build). Verificação manual funcional,
cobrindo:
- Check-in do dia em 1 toque, idempotência ao re-tocar no mesmo dia.
- Transições de grau no Caderno de Erros (acertei sobe, errei sempre vai
  pra `deficiencia`/1 dia).
- Persistência: recarregar a página mantém o estado salvo.
- Export Markdown reflete o estado atual; Export/Import JSON faz round-trip
  sem perda de dados.
- Layout em viewport de 390px de largura: uma coluna, sem overflow
  horizontal, alvos de toque acessíveis com o polegar.
- Meta x realizado: criar meta da semana, registrar checkins/mudanças de
  status dentro e fora da semana, confirmar que dias/horas/assuntos
  tocados calculam certo e que itens fora da semana não contam.
- PWA: manifest válido, service worker registra e cacheia, prompt de
  "Adicionar à tela inicial" aparece no Chrome Android, app abre offline
  depois de instalado.
- Após publicar no GitHub Pages: app carrega no subcaminho do projeto sem
  referências quebradas (manifest, ícones, service worker).
