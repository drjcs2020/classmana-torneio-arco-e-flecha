# 🏹 ClassMana — Arena de Arco e Flecha (V2)

**Abrir no navegador:** https://drjcs2020.github.io/classmana-torneio-arco-e-flecha/

Jogo hospedado dentro do repositório do Painel das Casas. O painel original permanece intacto. Usamos os brasões e as imagens de castelo existentes em `assets/images/`.

## Jogar

1. Entre no endereço acima.
2. Selecione uma das Casas: 4º A — Águia Dourada; 4º B — Leão de Fogo; 4º C — Dragão de Esmeralda.
3. Escolha seu código de arqueiro ou **Arqueiro convidado**.
4. Selecione treinamento, robô fácil/médio/difícil ou desafio por link entre Casas.
5. Segure e arraste para mirar; solte para disparar. São cinco flechas por rodada.

A arena desenha um castelo, arco, flecha e alvo mesmo sem dependência de servidor. Usa **PlayCanvas Engine 2.23.3 via CDN** como evolução gráfica 3D quando disponível; caso contrário, preserva uma arena 2D jogável. O navegador precisa de acesso à internet para carregar a versão 3D do engine e as fontes externas.

## Duelo entre alunos

O desafiante seleciona um colega de outra Casa, conclui cinco flechas e compartilha o link exibido ao final. O destinatário abre o link e joga sua rodada. A segunda rodada compara as duas pontuações. Essa modalidade dispensa um servidor local, porém **não autentica alunos e não grava um resultado compartilhado em um banco de dados remoto**. Links podem ser modificados, portanto não são adequados como resultados oficiais de campeonato.

## Ranking

O placar dessa versão é salvo **somente no navegador usado** (localStorage) e não é um ranking geral online. Uma competição real entre celulares ou computadores com ranking global precisa de backend hospedado, autenticação e permissões de gravação seguras. GitHub Pages sozinho serve arquivos estáticos; não cria um banco de dados de partidas. Nenhum ponto deste jogo altera XP, HP ou recursos pedagógicos do ClassMana.

## Estrutura

- `index.html` — navegação, Casas, arena, placar e instruções
- `style.css` — identidade medieval, castelos, brasões e layout responsivo
- `roster.js` — códigos e apelidos abreviados dos 78 arqueiros, derivados do Painel
- `scene.js` — cena 2D funcional e aprimoramento 3D com PlayCanvas
- `game.js` — pontuação, vento, dificuldade adaptativa, desafios por link e classificação local

**Privacidade:** não inclui notas escolares, relatórios de conduta nem nomes completos. A seleção de apelidos públicos não é prova de identidade.

**Estado de testes:** verificação de sintaxe JavaScript e integridade dos caminhos realizada. Teste visual com navegador externo e ativação efetiva do CDN precisam ser confirmados no site publicado.

## Versão com desafios registrados em planilha (novembro de 2026)

O modo online foi preparado com login individual por PIN, notificações automáticas ao entrar, desafios assíncronos (mesma turma, entre equipes e interclasses), aceitação/recusa, reprodução visual dos cinco disparos originais e placar compartilhado via Google Sheets.

- **Banco criado:** https://docs.google.com/spreadsheets/d/1LLfPMMB7LMmRv8jeHqUHUpj3U-uX0j4Y6kW6lDtmREY/edit
- **Serviço e instruções de implantação:** [backend/README.md](./backend/README.md)
- **Código servidor:** [backend/Code.gs](./backend/Code.gs)
- **Frontend:** `online-client.js`, `online-config.js`, `teams.js`, `game-v3.js`.

**IMPORTANTE: O placar online não está ativo enquanto `online-config.js` tiver `ONLINE_API_URL = ''`.**
É necessário executar `setupOnce` no Apps Script, autorizar a conta do professor, implantar como aplicativo da Web e preencher a URL `/exec` no arquivo de configuração. Não confunda os rankings locais de treino com o torneio oficial. Os duelos online serão registrados e classificados no servidor; o treino e robô ficam fora do ranking oficial.

As credenciais são geradas na aba privada `Credenciais_professor`. A planilha deve permanecer privada. O repositório ainda está hospedado em `Painel-das-Casas-Classmana/arena`; migrá-lo para um repositório próprio exige a criação daquele repositório pelo proprietário.
