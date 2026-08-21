# Caderno de Erros — Fluxo Questão-a-Questão Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Dar ao modal "Registrar estudo" (tipo Questões) um modo alternativo "questão por questão", onde o usuário marca acertou/errou uma questão de cada vez em vez de digitar só os totais no final — e, ao errar, oferecer um clique só pra registrar um esqueleto de erro no Caderno de Erros, sem sair do fluxo da questão.

**Architecture:** Sem módulo novo/testável — a lógica (contar itens de uma lista, montar os dados de um erro) é simples o bastante pra ficar direto no `index.html`, seguindo o mesmo padrão já usado por outros "drafts" de UI do app (`metaAssuntosDraft` em Planejamento: uma variável de módulo que acumula uma lista de trabalho, sem `saveState` a cada item, só no final). O botão "Registrar no caderno de erros" chama `criarErro(state, dados)` diretamente — a mesma função já usada pelo formulário completo de Novo Erro — sem abrir nenhum modal por cima do modal de registro (o app não tem hoje um padrão de modal empilhado, e abrir a aba Erros pra isso violaria o "sem sair do fluxo da questão" do pedido original).

**Tech Stack:** JavaScript vanilla, sem build step, sem dependência nova. Sem testes automatizados (mesmo padrão do resto da UI deste arquivo — não há framework de teste pra `index.html`/DOM neste projeto).

**Spec:** Definida em conversa (brainstorming architectural path), com base no pedido original do usuário ("Integração com sessões de estudo por questões") e numa exploração do código atual do modal "Registrar estudo" e do fluxo de timer (`sessaoEmAndamento`). Depende do schema do Erro já mergeado em `main` pelos dois planos anteriores (`2026-08-19-caderno-erros-modelo-repeticao.md`, `2026-08-19-caderno-erros-export-import-ia.md`).

## Global Constraints

- Não abrir nenhum modal por cima do modal "Registrar estudo" — o registro de erro é uma ação de um clique só (chama `criarErro` direto), não um formulário.
- O modo "questão por questão" é opt-in (toggle), com "Só totais" continuando como comportamento padrão — nada muda pra quem não usar o modo novo.
- `criarErro` já cuida de todos os defaults do schema (`status`, `proximaRevisao`, `precisaCompletar`, etc.) — este plano só monta o objeto `dados` de entrada, nunca duplica essa lógica.
- Todo texto de usuário interpolado em HTML passa por `escapeHtml()`.
- Trocar de "questão por questão" pra "só totais" com questões já registradas na sessão exige confirmação (`confirmarAcao`) antes de descartar.

---

## Task 1: Modo "questão por questão" — contagem, sem registro de erro ainda

**Files:**
- Modify: `index.html` — declaração de estado (~linha 3191-3194), `registroModalHtml` (~linha 3639-3645), `attachHojeHandlers` (handlers do modal de registro, ~linhas 3816-3889).

**Interfaces:**
- Produces: `sessaoQuestoesDraft` (variável de módulo, `null | { itens: [{correta: boolean}], fonte: string|null, erroPendente: null }` — o campo `erroPendente` já existe no shape desde já, mas só a Task 2 o usa).

- [ ] **Step 1: Declarar a variável de estado**

Modify `index.html` — old:

```js
  let registroAberto = null;
  let iniciarAberto = null;
  let timerIntervalId = null;
  let sessaoEditando = null;
```

New:

```js
  let registroAberto = null;
  let iniciarAberto = null;
  let timerIntervalId = null;
  let sessaoEditando = null;
  let sessaoQuestoesDraft = null; // { itens: [{correta}], fonte, erroPendente } — modo "questão por questão" do registro de estudo
```

- [ ] **Step 2: Toggle + UI de contagem no bloco `data-tipo-fields="questoes"`**

Modify `index.html` — old:

```html
          <div data-tipo-fields="questoes">
            <div class="row">
              <div><label>Questões</label><input type="number" id="registro-questoes"></div>
              <div><label>Acertos</label><input type="number" id="registro-acertos"></div>
            </div>
            <small class="muted" id="registro-calculo">Preencha questões pra calcular</small>
          </div>
```

New:

```html
          <div data-tipo-fields="questoes">
            <div class="mapa-filtros-botoes" style="margin-bottom:8px;">
              <button type="button" class="mapa-filtro-btn ${!sessaoQuestoesDraft?'active':''}" id="registro-questoes-modo-totais">Só totais</button>
              <button type="button" class="mapa-filtro-btn ${sessaoQuestoesDraft?'active':''}" id="registro-questoes-modo-unidade">Questão por questão</button>
            </div>
            ${!sessaoQuestoesDraft ? `
              <div class="row">
                <div><label>Questões</label><input type="number" id="registro-questoes"></div>
                <div><label>Acertos</label><input type="number" id="registro-acertos"></div>
              </div>
              <small class="muted" id="registro-calculo">Preencha questões pra calcular</small>
            ` : (() => {
              const total = sessaoQuestoesDraft.itens.length;
              const acertos = sessaoQuestoesDraft.itens.filter(i => i.correta).length;
              return `
                <label>Fonte/Banca (opcional, vale pra sessão toda)</label>
                <input type="text" id="registro-questoes-fonte" placeholder="ex: CESPE 2023" value="${escapeHtml(sessaoQuestoesDraft.fonte || '')}">
                <small class="muted">${total} questão${total===1?'':'ões'} respondida${total===1?'':'s'} — ${acertos} certa${acertos===1?'':'s'}</small>
                <div class="row">
                  <button type="button" class="ok" id="registro-questoes-acertei">${icone('check-circle')} Acertei</button>
                  <button type="button" class="bad" id="registro-questoes-errei">${icone('alert-triangle')} Errei</button>
                </div>
              `;
            })()}
          </div>
```

- [ ] **Step 3: Handlers do toggle e dos botões Acertei/Errei**

Modify `index.html` — old:

```js
    document.getElementById('registro-cancelar')?.addEventListener('click', () => {
      registroAberto = null;
      render();
    });
    document.getElementById('registro-backdrop')?.addEventListener('click', (e) => {
      if(e.target.id !== 'registro-backdrop') return;
      if(registroAberto?.minutosPreenchidos != null && !confirmarAcao('Você tem uma sessão cronometrada aguardando registro. Fechar sem salvar descarta esse tempo. Continuar?')) return;
      registroAberto = null;
      render();
    });
```

New:

```js
    document.getElementById('registro-cancelar')?.addEventListener('click', () => {
      registroAberto = null;
      sessaoQuestoesDraft = null;
      render();
    });
    document.getElementById('registro-backdrop')?.addEventListener('click', (e) => {
      if(e.target.id !== 'registro-backdrop') return;
      if(registroAberto?.minutosPreenchidos != null && !confirmarAcao('Você tem uma sessão cronometrada aguardando registro. Fechar sem salvar descarta esse tempo. Continuar?')) return;
      registroAberto = null;
      sessaoQuestoesDraft = null;
      render();
    });
    document.getElementById('registro-questoes-modo-totais')?.addEventListener('click', () => {
      if(sessaoQuestoesDraft && sessaoQuestoesDraft.itens.length && !confirmarAcao('Isso descarta as questões já registradas nesta sessão. Continuar?')) return;
      sessaoQuestoesDraft = null;
      render();
    });
    document.getElementById('registro-questoes-modo-unidade')?.addEventListener('click', () => {
      if(!sessaoQuestoesDraft) sessaoQuestoesDraft = { itens: [], fonte: null, erroPendente: null };
      render();
    });
    document.getElementById('registro-questoes-fonte')?.addEventListener('input', (e) => {
      sessaoQuestoesDraft.fonte = e.target.value;
      renderPreservandoFoco();
    });
    document.getElementById('registro-questoes-acertei')?.addEventListener('click', () => {
      sessaoQuestoesDraft.itens.push({ correta: true });
      render();
    });
    document.getElementById('registro-questoes-errei')?.addEventListener('click', () => {
      sessaoQuestoesDraft.itens.push({ correta: false });
      render();
    });
```

- [ ] **Step 4: `registro-salvar` lê a contagem do draft quando ele existir**

Modify `index.html` — old:

```js
      const dados = { tipo, assunto, minutos, obs: document.getElementById('registro-obs').value };
      if(tipo === 'questoes'){
        dados.questoes = Number(document.getElementById('registro-questoes').value) || 0;
        dados.acertos = Number(document.getElementById('registro-acertos').value) || 0;
      } else if(tipo === 'teoria'){
        dados.paginas = Number(document.getElementById('registro-paginas').value) || null;
        dados.concluida = document.getElementById('registro-concluida').checked;
      } else if(tipo === 'revisao'){
        dados.dificuldade = document.getElementById('registro-dificuldade').value || null;
      } else if(tipo === 'anki'){
        dados.cartoes = Number(document.getElementById('registro-cartoes').value) || null;
      }
      registrarSessao(state, hojeISO(), dados);
      concluirAtividadeDiaPorAssunto(state, semanaAtualId(), hojeISO(), dados.assunto);
      saveState(state);
      registroAberto = null;
      render();
    });
```

New:

```js
      const dados = { tipo, assunto, minutos, obs: document.getElementById('registro-obs').value };
      if(tipo === 'questoes'){
        if(sessaoQuestoesDraft){
          dados.questoes = sessaoQuestoesDraft.itens.length;
          dados.acertos = sessaoQuestoesDraft.itens.filter(i => i.correta).length;
        } else {
          dados.questoes = Number(document.getElementById('registro-questoes').value) || 0;
          dados.acertos = Number(document.getElementById('registro-acertos').value) || 0;
        }
      } else if(tipo === 'teoria'){
        dados.paginas = Number(document.getElementById('registro-paginas').value) || null;
        dados.concluida = document.getElementById('registro-concluida').checked;
      } else if(tipo === 'revisao'){
        dados.dificuldade = document.getElementById('registro-dificuldade').value || null;
      } else if(tipo === 'anki'){
        dados.cartoes = Number(document.getElementById('registro-cartoes').value) || null;
      }
      registrarSessao(state, hojeISO(), dados);
      concluirAtividadeDiaPorAssunto(state, semanaAtualId(), hojeISO(), dados.assunto);
      saveState(state);
      registroAberto = null;
      sessaoQuestoesDraft = null;
      render();
    });
```

- [ ] **Step 5: Verificar manualmente no browser**

Run: `npx --yes serve .` (se não estiver rodando)

Checklist manual:
1. Abrir "Registrar estudo" com tipo "Questões" — o toggle "Só totais" / "Questão por questão" aparece, "Só totais" ativo por padrão, campos numéricos como antes.
2. Clicar "Questão por questão" — os campos numéricos somem, aparece o campo "Fonte/Banca" e os botões "Acertei"/"Errei" com o contador "0 questões respondidas — 0 certas".
3. Clicar "Acertei" duas vezes e "Errei" uma vez — o contador deve mostrar "3 questões respondidas — 2 certas".
4. Clicar "Salvar registro" — confirmar no Console que `state.sessoes` ganhou uma entrada `tipo:'questoes'` com `questoes:3, acertos:2`, e que `sessaoQuestoesDraft` voltou a `null`.
5. Repetir o fluxo, mas clicar "Só totais" no meio (com questões já registradas) — deve pedir confirmação antes de descartar.
6. Confirmar que o modo "Só totais" (sem nunca tocar no toggle) continua funcionando exatamente como antes.

- [ ] **Step 6: Commit**

```bash
git add index.html
git commit -m "feat(hoje): modo questao por questao no registro de estudo, com contagem ao vivo"
```

---

## Task 2: Registrar no Caderno de Erros direto do fluxo da questão

**Files:**
- Modify: `index.html` — `registroModalHtml` (bloco do modo "unidade" criado na Task 1), `attachHojeHandlers` (handler de `registro-questoes-errei` da Task 1, mais os handlers novos).

**Interfaces:**
- Consumes: `criarErro(state, dados)` (já existente em `index.html`, inalterado desde os planos anteriores).

- [ ] **Step 1: Revelar um mini-formulário de erro ao marcar "Errei"**

Modify `index.html` — old (dentro do bloco do modo "unidade", dentro do IIFE que monta o retorno):

```js
                <div class="row">
                  <button type="button" class="ok" id="registro-questoes-acertei">${icone('check-circle')} Acertei</button>
                  <button type="button" class="bad" id="registro-questoes-errei">${icone('alert-triangle')} Errei</button>
                </div>
              `;
            })()}
          </div>
```

New:

```js
                ${!sessaoQuestoesDraft.erroPendente ? `
                  <div class="row">
                    <button type="button" class="ok" id="registro-questoes-acertei">${icone('check-circle')} Acertei</button>
                    <button type="button" class="bad" id="registro-questoes-errei">${icone('alert-triangle')} Errei</button>
                  </div>
                ` : `
                  <div class="erro-form-erro" style="margin-top:var(--space-2);">
                    <label>O que você errou (opcional)</label>
                    <textarea id="registro-questoes-oque" placeholder="Ex: confundi outorga com licenciamento">${escapeHtml(sessaoQuestoesDraft.erroPendente.oQueErrei || '')}</textarea>
                    <div class="row">
                      <button type="button" id="registro-questoes-pular">Pular</button>
                      <button type="button" class="primary" id="registro-questoes-registrar-erro">Registrar no caderno de erros</button>
                    </div>
                  </div>
                `}
              `;
            })()}
          </div>
```

- [ ] **Step 2: "Errei" passa a revelar o mini-formulário; handlers do textarea, Pular e Registrar**

Modify `index.html` — old:

```js
    document.getElementById('registro-questoes-errei')?.addEventListener('click', () => {
      sessaoQuestoesDraft.itens.push({ correta: false });
      render();
    });
```

New:

```js
    document.getElementById('registro-questoes-errei')?.addEventListener('click', () => {
      sessaoQuestoesDraft.itens.push({ correta: false });
      sessaoQuestoesDraft.erroPendente = { oQueErrei: '' };
      render();
    });
    document.getElementById('registro-questoes-oque')?.addEventListener('input', (e) => {
      sessaoQuestoesDraft.erroPendente.oQueErrei = e.target.value;
      renderPreservandoFoco();
    });
    document.getElementById('registro-questoes-pular')?.addEventListener('click', () => {
      sessaoQuestoesDraft.erroPendente = null;
      render();
    });
    document.getElementById('registro-questoes-registrar-erro')?.addEventListener('click', () => {
      const assunto = registroAberto.assunto || resolverAssuntoBusca('registro-assunto-busca', 'registro-assunto');
      const oQueErrei = (sessaoQuestoesDraft.erroPendente.oQueErrei || '').trim() || 'Errei sem detalhar o motivo — completar depois';
      criarErro(state, {
        assunto,
        disciplinaId: assunto,
        origem: 'questao_prova',
        fonte: sessaoQuestoesDraft.fonte || null,
        oQueErrei,
      });
      saveState(state);
      sessaoQuestoesDraft.erroPendente = null;
      alert('Erro registrado no Caderno de Erros! Complete a explicação quando puder.');
      render();
    });
```

- [ ] **Step 3: Verificar manualmente no browser**

Checklist manual:
1. No modo "Questão por questão", clicar "Errei" — o mini-formulário aparece ("O que você errou" + "Pular"/"Registrar no caderno de erros"), os botões Acertei/Errei somem enquanto ele estiver aberto.
2. Clicar "Registrar no caderno de erros" sem digitar nada — deve criar um erro no Console (`state.erros` ganha uma entrada nova) com `oQueErrei: 'Errei sem detalhar o motivo — completar depois'`, `origem: 'questao_prova'`, `assunto` igual ao assunto escolhido no topo do modal, `precisaCompletar: true`, `status: 'novo'`. O alerta de confirmação aparece, e os botões Acertei/Errei voltam.
3. Repetir preenchendo o campo "O que você errou" antes de clicar "Registrar" — o `oQueErrei` do novo erro deve ser exatamente o texto digitado.
4. Se preencheu "Fonte/Banca" no topo antes, o `fonte` do erro criado deve bater com esse valor; se deixou em branco, `fonte` deve ser `null`.
5. Clicar "Pular" em vez de "Registrar" — nenhum erro novo deve aparecer em `state.erros`, e os botões Acertei/Errei voltam.
6. Ir na aba Caderno de Erros e confirmar que o(s) erro(s) criado(s) aparece(m) na lista, com o badge "Explicação pendente".
7. Terminar a sessão e clicar "Salvar registro" — confirmar que `state.sessoes` grava a contagem certa (incluindo as questões erradas, registradas ou não no caderno) e que isso não duplica nem interfere nos erros já criados no Caderno de Erros.

- [ ] **Step 4: Commit**

```bash
git add index.html
git commit -m "feat(hoje): botao Registrar no caderno de erros direto no fluxo questao a questao"
```
