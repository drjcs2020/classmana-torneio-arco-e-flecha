# ClassMana — Ativar os desafios online (sem PIN)

Este jogo é independente do Painel das Casas, disponível em:
https://drjcs2020.github.io/classmana-torneio-arco-e-flecha/

**A planilha existente é mantida**:
https://docs.google.com/spreadsheets/d/1LLfPMMB7LMmRv8jeHqUHUpj3U-uX0j4Y6kW6lDtmREY/edit

## Correção do erro 302/404 — API v8 com ponte HTML (06/11/2026)

O Google Apps Script ContentService devolve HTTP 302 para script.googleusercontent.com.
Um defeito do próprio Google pode fazer a segunda etapa responder HTTP 404,
mesmo quando a planilha funciona e os testes por Node passam.

**O jogo recebeu uma alternativa em HTMLService (sem redirect ContentService)**:
respostas GET e POST por iframe e postMessage com ID aleatório, origem do
portal validada e confirmação de gravação. O antigo JSONP permanece apenas
como alternativa quando o servidor ainda não estiver na v8.

**ATENÇÃO:** o GitHub Pages não publica o Google Apps Script. O arquivo
backend/Code.gs no GitHub já está na v8, mas é necessário atualizar a
implantação do Apps Script para a correção chegar ao servidor.

Apenas uma atualização da implantação existente:
1. Abra a planilha e depois **Extensões → Apps Script**.
2. No editor, substitua o arquivo `Code.gs` pelo arquivo atualizado
   https://github.com/drjcs2020/classmana-torneio-arco-e-flecha/blob/main/backend/Code.gs
3. Salve e escolha **Implantar → Gerenciar implantações → Editar (lápis)**.
4. Escolha **Nova versão → Implantar**, sem trocar a URL /exec.
5. No jogo, a conexão HTML deve funcionar sem o redirecionamento JSONP.

*Não execute setupOnce, não crie outra planilha e não gere um segundo deployment.*

Os testes em memória cobrem chamadas de ponte, login, convites e resultados.
A confirmação na implantação pública depende da etapa acima.

## Referência de implantação

A versão antiga exigia PIN. A interface atual não exige mais senha nem PIN.
Se a v8 ainda não foi publicada, atualize a implantação **sem criar outra planilha**:

1. Abra a planilha acima, depois **Extensões → Apps Script**.
2. Substitua o conteúdo de `Code.gs` pelo código atualizado em
   https://github.com/drjcs2020/classmana-torneio-arco-e-flecha/blob/main/backend/Code.gs
3. Salve. **Não execute `setupOnce`**; no novo fluxo não é necessário.
4. Clique **Implantar → Gerenciar implantações**. Edite a implantação web existente.
5. Em Versão, escolha **Nova versão**, mantenha **Executar como eu** e **Acesso: qualquer pessoa** e implante.
6. A URL `/exec` normalmente permanece a mesma quando a implantação existente é atualizada.
   O endereço público já está em `online-config.js`.
7. Verifique [a implantação pública com `?action=ping`](https://script.google.com/macros/s/AKfycbzJ5MB-NWFLJKyh0kaj2Isaiv2H_KK32v8FNuKVltmKiEwpuEeHHNAJBbNfNlc-0jLkTw/exec?action=ping). A resposta deve conter `"api":8` quando a v8 estiver publicada.
   Uma versão anterior será recusada pelo jogo para evitar erro de PIN.

## Como os alunos jogam

1. Escolhem sua **Casa** e **nome** em listas suspensas, sem qualquer senha.
2. Escolhem **treino**, **robô**, **colega da mesma turma**, **outra equipe** ou **outra turma**.
3. Em desafios de equipe, escolhem equipe própria, local da disputa, turma/equipe adversária e o representante.
4. Escolhem o circuito de distância:
   - Aprendiz: 10, 35, 65, 100, 150 metros;
   - Aventureiro: 20, 45, 75, 110, 150 metros;
   - Lendário: 30, 60, 90, 120, 150 metros.
5. Jogam cinco flechas. A pontuação é recalculada pelo servidor e salva na planilha.
6. O adversário encontra o convite em **Meus desafios**, podendo **aceitar ou recusar** dias depois.
7. Se aceitar, vê a reprodução dos cinco tiros gravados e joga a própria rodada. O resultado é salvo e alimenta o ranking.

Os dois participantes da mesma partida recebem a **mesma sequência** de distâncias, vento e deslocamento do alvo.

## Segurança e regras de uso

**Seleção de nome não autentica um aluno.** Qualquer pessoa com acesso ao jogo pode
escolher outro nome. Os registros são persistentes, mas **não constituem prova
de identidade nem são antifraude**. Para competição escolar, supervisione o uso
em sala e revise os resultados antes de premiar alunos ou equipes.

Não torne a planilha pública, não divulgue tokens de acesso e não compartilhe
as antigas credenciais do professor com alunos. As colunas antigas de PIN foram
preservadas apenas para compatibilidade da planilha, mas não são utilizadas
pela API atual. Para o futuro, uma autenticação escolar sem senha (conta
gerenciada pela escola) seria necessária para impedir falsificação de identidade.

Treinos e partidas contra robô não alteram o ranking oficial. A classificação
individual agrega desafios concluídos; a de equipes considera disputas entre
equipes; a de turmas considera interclasses.

## Testes antes do uso em sala

- Confirme `"api":8` no endpoint após publicar. **Se aparecer `"api":7`, a ponte HTML ainda não está no servidor.**
- Faça uma rodada como A01 no circuito Aprendiz e salve cinco flechas.
- Em outro navegador, selecione A02: o convite deve aparecer.
- Aceite, conclua os cinco tiros e verifique as abas Desafios, Disparos e Ranking.
- Repita com circuito Lendário: os disparos devem ir de 30 m a 150 m.
- Verifique que a mesma sequência foi usada nos dois lados da disputa.
- No GitHub Actions, acompanhe **Verificar API online do torneio**: o teste só fica verde depois de implantar a API v7 na URL /exec existente.

**Importante:** o Apps Script público foi confirmado na v7 nos testes anteriores; a ponte HTML exige v8 e sua publicação precisa ser confirmada. O GitHub Pages não atualiza o Apps Script.
