# ClassMana — Corrigir e ativar a Arena Online (API v9)

**Repositório único, branch `main`**, independente do Painel das Casas.

Jogo: https://drjcs2020.github.io/classmana-torneio-arco-e-flecha/

Servidor do torneio: https://script.google.com/macros/s/AKfycbzJ5MB-NWFLJKyh0kaj2Isaiv2H_KK32v8FNuKVltmKiEwpuEeHHNAJBbNfNlc-0jLkTw/exec

Planilha **existente**, que NÃO deve ser recriada:
https://docs.google.com/spreadsheets/d/1LLfPMMB7LMmRv8jeHqUHUpj3U-uX0j4Y6kW6lDtmREY/edit

## Problema identificado no navegador em 06/11/2026

A interface antiga dependia de dois canais problemáticos do Apps Script:

1. ContentService / JSONP: redireciona 302 para `script.googleusercontent.com`, que pode responder 404.
2. HtmlService carregado **dentro** de iframe no GitHub Pages: pode ser bloqueado por `X-Frame-Options` / `frame-ancestors`.

A API **v9** inverte a montagem: a página principal é o Apps Script e o **jogo (somente interface)** fica no iframe do Google. Assim, as leituras e as gravações usam `google.script.run`, sem JSONP e sem iframe externo de Apps Script.

Ao escolher um desafio online no GitHub Pages, o jogador é encaminhado automaticamente para a Arena Online; Casa, tipo de partida e aluno selecionado são mantidos. **Treino/robô continuam no GitHub Pages.**

## Publicação obrigatória (somente uma implantação, SEM nova branch)

O GitHub não atualiza sozinho a implantação pública do Apps Script. É necessário fazer uma única atualização pelo editor da conta proprietária do script.

1. Abra a planilha acima → **Extensões → Apps Script**.
2. Substitua o conteúdo de **`Code.gs`** pelo arquivo da `main`:
   https://github.com/drjcs2020/classmana-torneio-arco-e-flecha/blob/main/backend/Code.gs
3. Salve e clique em **Implantar → Gerenciar implantações → lápis da implantação já existente → Versão: Nova versão → Implantar**.
4. Mantenha **Executar como: eu** e **Quem tem acesso: qualquer pessoa**. Autorize quando solicitado. Não execute `setupOnce()`.
5. Abra diretamente a URL **/exec** acima. Com a v9 ativa, ela deve **abrir o jogo completo**, em vez de mostrar JSON.
6. No GitHub Pages, escolha uma Casa e **Desafiar colega**. A aplicação abrirá esse mesmo portal.

**Se a página /exec mostrar JSON ou erro de autorização, a v9 ainda NÃO está na implantação pública.** O código no GitHub não substitui essa etapa.

## Teste honesto (antes de declarar resolvido)

- QA local/CI: `node scripts/qa-static.mjs`, `node scripts/qa-backend.mjs`, `node scripts/qa-portal.mjs` (sem escritas reais). 
- QA remoto: `node scripts/qa-online.mjs` verifica HTML do portal público; só passa após a publicação da v9.
- Teste real em dois navegadores: perfil A01 abre desafio para A02; salva 5 flechas; A02 vê convite, aceita, joga 5 flechas; verificar **Desafios**, **Disparos**, **Ranking** na mesma planilha. Repetir com equipe e interclasses.

Não declare "desafios online funcionando" apenas com ping ou testes simulados.

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

## Verificações pendentes

- Confirmar implantação pública v9 e navegador real com google.script.run.
- Executar rodada completa entre dois estudantes reais supervisionados.
- Verificar escrita e leitura dos resultados sem duplicar convites.
