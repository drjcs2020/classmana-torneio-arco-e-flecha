# ClassMana — controle das 37 revisões
Repositório único de desenvolvimento: `main`. Nenhuma branch nova deve ser criada.

**Critério:** a presença de código não comprova funcionamento. Testes automáticos usam dados isolados; não devem contaminar estatísticas reais. Os itens sinalizados para validação final NÃO devem ser apresentados como concluídos.

| Nº | Requisito solicitado | Evidência ou verificação | Estado |
|---|---|---|---|
| 1 | Casa antes do nome | QA navegador desktop/celular | Implementado; conferir no QA |
| 2 | Voltar na seleção de nome | Controle vinculado e tela de Casas | Implementado; conferir no QA |
| 3 | Logotipo oficial legível | Imagem de 1300 px verificada no QA | Implementado; conferir no QA |
| 4 | Fidelidade à arte enviada | Asset preservado com fundo transparente | Implementado; conferir no QA |
| 5 | Padrão visual em todas as páginas | Revisão visual de todas as telas ainda necessária | PENDENTE de validação final |
| 6 | Evitar fundos azuis/marrons intrusivos | Interface revista; avaliação pedagógica pendente | PENDENTE de validação final |
| 7 | Seletores compactos e legíveis | QA de preparação desktop/celular | Implementado; conferir no QA |
| 8 | Preparação sem rolagem interna | QA de viewport | Implementado; conferir no QA |
| 9 | Iniciar Duelo proporcional | QA compara largura e altura | Implementado; conferir no QA |
| 10 | Sem tela antiga entre lobby e arena | Navegação direta testada | Implementado; conferir no QA |
| 11 | Três arcos GLB personalizados | Modelos carregam; qualidade visual final pendente | PENDENTE de validação final |
| 12 | Três flechas GLB personalizadas | Modelos carregam; qualidade visual final pendente | PENDENTE de validação final |
| 13 | Alvo suspenso sem cavalete | Suporte oculto no modo móvel | Implementado; conferir no QA |
| 14 | Carregar modelos 3D no PlayCanvas | QA testa assets e instanciação GLB | Implementado; conferir no QA |
| 15 | Mira circular alinhada | QA de projeção do ponteiro | Implementado; conferir no QA |
| 16 | Direção e velocidade do vento | HUD e estado de vento | Implementado; conferir no QA |
| 17 | Física balística com ponta descendente | Tangente da parábola aplicada à rotação | Implementado; conferir no QA |
| 18 | Aviso antes da rodada adversária | Validação temporal ponta a ponta pendente | PENDENTE de validação final |
| 19 | Persistência do aluno durante uma partida | Sessão preservada no retorno controlado | Implementado; conferir no QA |
| 20 | Encerrar sessão | Controle explícito | Implementado; conferir no QA |
| 21 | Jogar novamente retorna às opções | Fluxo de navegação | Implementado; conferir no QA |
| 22 | Impedir autodesafio | Validação no backend | Implementado; conferir no QA |
| 23 | Convites entregues e aceitos entre alunos | Teste isolado completo; teste real entre dois dispositivos pendente | PENDENTE de validação final |
| 24 | Contador real de desafios | Lista retornada da API | Implementado; conferir no QA |
| 25 | Sininho para novidades | Lógica CSS e atualizações | Implementado; conferir no QA |
| 26 | Separar desafios recebidos e propostos | Grupos independentes | Implementado; conferir no QA |
| 27 | Separar pendentes, recusados e concluídos | Cálculo por estado | Implementado; conferir no QA |
| 28 | Estatísticas de vitórias/derrotas/empates | Backend conclui e agrupa duelos | Implementado; conferir no QA |
| 29 | Música ambiente e efeitos do jogo | MP3, vento, acerto, erro, aplausos, vaias | Implementado; conferir no QA |
| 30 | Faixa Kulakovka fornecida pelo usuário | MP3 binário no repositório | Implementado; conferir no QA |
| 31 | Atualizar ou reabrir libera sessão anterior | QA de recarregamento | Implementado; conferir no QA |
| 32 | Botão Ranking entre modos e tamanho coerente | Arte e acesso real verificados | Implementado; conferir no QA |
| 33 | Identificação do aluno sem barra interna | QA de largura e altura | Implementado; conferir no QA |
| 34 | CONFIRMAR arqueiro proporcional | QA limita tamanho | Implementado; conferir no QA |
| 35 | Botão Ranking ornamental igual ao conjunto | SVG em azul/dourado | Implementado; conferir no QA |
| 36 | Ranking medieval com alto contraste | Screenshot e assertions | Implementado; conferir no QA |
| 37 | Voltar da arena grande no canto superior esquerdo | QA de posição e dimensão | Implementado; conferir no QA |

## Bloqueadores para declarar 37/37 concluído
- Conferir fidelidade artística e qualidade percebida dos três arcos e das três flechas, comparando o jogo às referências aprovadas.
- Exercitar duas contas/dispositivos independentes com desafio real e notificação, sem alterar dados de alunos em testes.
- Validar o intervalo de aviso de turno no duelo online com animação.
- Revisar as telas restantes em diferentes tamanhos e avaliar se o padrão visual foi respeitado.
- Verificar saída de áudio audível em navegador real (autoplay exige uma interação do usuário).
- Não chamar um teste simulado ou QA estático de partida online validada.

## Testes
- `node scripts/qa-static.mjs`
- `node scripts/qa-media.mjs`
- `node scripts/qa-duel-api.mjs` (apenas leitura, API publicada)
- `node scripts/qa-duel-endtoend.mjs` (SQLite temporário, nenhum dado real)
- `node scripts/qa-browser.mjs` (Playwright desktop e celular)

O GitHub Pages pode publicar atualizações automaticamente quando houver commits na `main`; a publicação não significa que o checklist inteiro esteja aprovado.
