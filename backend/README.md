# ClassMana — Ativação do torneio online (Google Sheets + Apps Script)

## Situação

O banco Google Sheets exclusivo **já foi criado**:
https://docs.google.com/spreadsheets/d/1LLfPMMB7LMmRv8jeHqUHUpj3U-uX0j4Y6kW6lDtmREY/edit

Ele contém 78 estudantes em IDs abreviados, turmas, equipes oficiais, tabelas de desafios, disparos, sessões e placar. O banco é privado; **não compartilhe a planilha com acesso público**.

## Ativação única pelo professor (necessária)

Estas ações não são automatizadas pelo GitHub Pages e precisam ser feitas na conta Google proprietária da planilha.

1. Abra a planilha, clique **Extensões → Apps Script**.
2. Apague o código de exemplo e cole **todo** o conteúdo de `Code.gs` desta pasta. Salve.
3. Na lista de funções, selecione `setupOnce` e clique **Executar**. Autorize o script na conta Google proprietária. Ele gera PINs aleatórios para os 78 alunos e armazena apenas os códigos iniciais na aba privada **Credenciais_professor**. Não compartilhe essa aba. Novas execuções não substituem códigos já emitidos.
4. No Apps Script, clique **Implantar → Nova implantação → Tipo: Aplicativo da Web**.
5. Configure **Executar como: eu** e **Quem tem acesso: qualquer pessoa**. Esse acesso é à API, não à planilha. O servidor exige PIN/token para consultar desafios pessoais ou registrar pontuações. Copie a URL HTTPS terminada em `/exec`.
6. No GitHub, edite `arena/online-config.js`, substituindo `ONLINE_API_URL = ''` pela URL copiada. É uma URL pública, não é senha. Mantenha as credenciais apenas na planilha.
7. Abra o site `/arena/` e recarregue com Ctrl+F5. A faixa de perfil deverá indicar conexão online. O aluno escolhe sua turma, seu código e o PIN inicial fornecido pelo professor.

### Teste funcional obrigatório

- Entre como A01 e A02 em dois navegadores diferentes (PINs da aba privada).
- A01 cria um desafio **mesma turma** para A02, atira cinco flechas e confirma o resultado na planilha.
- A02 entra em outro navegador: deve aparecer **1 desafio pendente**. A02 aceita ou recusa.
- Se aceitar, os cinco tiros de A01 são reproduzidos visualmente enquanto A02 faz seus próprios disparos. Os resultados são comparados no servidor.
- Verifique abas `Desafios`, `Disparos`, `Ranking` e o painel de classificação do jogo. Repita para equipe e interclasses.
- Desconecte os navegadores, reabra e confirme que os resultados permanecem na planilha.

## Regras do serviço

- **Mesma turma:** duas pessoas diferentes do mesmo 4º A, B ou C.
- **Entre equipes:** membros de equipes diferentes, mesmo que sejam de turmas diferentes.
- **Interclasses:** duas turmas diferentes.
- Cada pessoa atira **5 flechas**. A pontuação máxima individual é **50**.
- O primeiro arqueiro joga e o resultado fica armazenado. O destinatário vê a notificação ao abrir sua conta, aceita ou recusa. Se aceitar, o jogo reproduz os disparos originais (robô visual) e permite jogar; não é necessário o primeiro aluno estar online.
- Resultado oficial e histórico são salvos nas abas do Google Sheets. Ranking de equipe utiliza apenas duelos entre equipes; ranking de turma utiliza apenas duelos interclasses; ranking individual utiliza todos os desafios concluídos.
- Treino livre e robô de treinamento são locais e **não contam para o ranking oficial**, para impedir pontuações ilimitadas de treino. O jogo não altera os XP/HP do ClassMana pedagógico.

## Segurança e limites

- A planilha não deve ser publicada na web nem compartilhada com alunos. O Apps Script executa como dono e valida PIN, sessão, limites e pontuação.
- Nunca coloque senhas, PINs ou chaves de conta Google no GitHub ou em páginas web. O código `online-config.js` contém apenas o URL do endpoint.
- Tokens de sessão são gerados com `crypto.getRandomValues` no navegador, e apenas seus hashes são salvos no servidor. O PIN é enviado somente via POST.
- Os cinco disparos são recalculados no servidor a partir do desvio em relação ao alvo, vento e força; uma planilha não deve aceitar scores brutos informados pelo navegador. Entretanto, **não é proteção antifraude absoluta**: um navegador adulterado ainda pode falsificar mira e força. Para competição com premiações reais, é necessário validar a física/telemetria com camadas antifraude adicionais.
- Google Apps Script possui cotas de execuções e latência. Não é adequado para milhares de jogadores simultâneos; para três turmas, testar carga antes de liberar em sala.
- PINs iniciais devem ser entregues aos alunos individualmente pelo professor. O jogo usa apenas IDs e apelidos abreviados.

## Arquivos

- `Code.gs`: API Google Apps Script.
- `../online-config.js`: URL pública do serviço, inicialmente vazia.
- `../online-client.js`: login, listagem, criação, aceitação/recusa, envio e ranking.
- `../game-v3.js`: jogo e reprodução dos cinco tiros do adversário.
- `../teams.js`: mapeamento das equipes oficiais.

**Importante:** o serviço online não está ativo enquanto `ONLINE_API_URL` estiver vazio. Uma planilha existente e um código pronto não substituem a publicação/autorização do Apps Script.