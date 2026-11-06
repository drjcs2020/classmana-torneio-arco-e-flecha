# ClassMana — reconstrução sem PIN (2026-11-06)

**Repositório único:** `drjcs2020/classmana-torneio-arco-e-flecha`; branch `main`. Não criar branches sucessivas para manter contexto. A versão anterior permanece preservada na raiz e a reconstrução pode ser acessada em `/rebuild/` durante a validação.

## Contrato que não pode ser alterado
- **Alunos NÃO usam PIN, senha ou código.** Selecionam somente a Casa e o nome numa lista.
- 4º A Águia Dourada; 4º B Leão de Fogo; 4º C Dragão de Esmeralda.
- Modos: robô, treino, colega da mesma turma, outra equipe, duelo interclasses.
- Desafio assíncrono: criador escolhe adversário → servidor grava convite → criador dispara cinco flechas → servidor grava e deixa convite pendente → adversário entra depois, aceita/recusa e assiste à reconstituição da rodada → dispara cinco flechas → vencedor e rankings oficiais salvos online.
- Torneio é **independente do Painel das Casas**. NÃO alterar XP/HP/Ouro dos alunos no ClassMana principal.
- Usar planilha existente e implantação do Apps Script, sem duplicar planilhas ou executar `setupOnce`.
- Interface colorida de fantasia, contraste alto, sem painéis marrons que ocultem a paisagem. Alvo e arco devem estar visíveis, cursor e mira precisam coincidir.
- Evitar propaganda de conclusão sem teste comprovado.

## Arquivos novos
- `rebuild/index.html`: páginas de escolha de Casa, arqueiro, modo, preparação, arena, resultados, convites, ranking.
- `rebuild/style.css`: tema fantasia, texto contrastante e campos legíveis.
- `rebuild/api.js`: cliente HTTP para API v8 via HTMLService/PostMessage, fallback JSONP/iframe, POST com confirmação idempotente.
- `rebuild/app.js`: orquestração de partidas assíncronas, convites, identificação por nome e placares.
- `rebuild/arena.js`: cena 3D PlayCanvas, alvo, arco deslocado à direita e cursor único.
- `scripts/qa-rebuild-browser.mjs`: teste end-to-end com dois alunos simulados, sem gravar na planilha real.

## Backend existente
- `backend/Code.gs`, API v8, em `online-config.js` (URL /exec já conhecida).
- Último check real da API v8, consulta de lista e ranking e POST de perfil inexistente (falha esperada) passou em Chromium; isso NÃO equivale a criar um desafio real.
- No recomeço, o transporte possui fallback e confirma cada gravação antes de mudar o estado da partida.

## Testes e critérios para publicar como página principal
1. `node --check rebuild/{api,app,arena}.js`.
2. `node scripts/qa-rebuild-browser.mjs` a partir do servidor local e com Playwright instalado; precisa passar **sem PIN** em criar convite → enviar cinco flechas → abrir como segundo aluno → aceitar → mais cinco flechas → concluir.
3. Verificar rota `/rebuild/` carregando sem erros, tanto desktop quanto dispositivos móveis.
4. Verificar que o backend público ainda retorna `api:8`.
5. Confirmar, com dados autorizados, uma disputa real salva no Google Sheets. Não registrar desafios fictícios entre alunos reais só para teste.

**Aviso:** selecionar nome sem PIN é conveniente, mas não prova identidade. Resultados oficiais exigem supervisão do professor.
