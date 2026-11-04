# ClassMana • Torneio das Três Casas — Arena V3

## Executar

**Site:** https://drjcs2020.github.io/classmana-torneio-arco-e-flecha/

O GitHub Pages distribui os arquivos estáticos da arena, sem precisar rodar Python. Selecione uma das Casas, escolha um arqueiro ou convidado, selecione treino, robô adaptativo ou desafio por link, e use o mouse/toque para mirar e soltar a flecha.

## Arte e motores

- Três cenários oficiais **importados de `Batalha-dos-Monstros-V2.5`** para `arena/assets/` no mesmo repositório.
- Castelos e brasões do Painel das Casas continuam no diretório `assets/images/` existente.
- Motor PlayCanvas carregado como módulo ES com WebGL no navegador; a câmera, o arco recurvo, a mira circular, as cordas, o alvo, o suporte e as flechas projetadas são construídos como objetos e malhas curvas na cena. Fallback ilustrado permanece jogável sem CDN/WebGL.
- O arco muda de acabamento por Casa; **uma flecha única vermelha/branca/preta é compartilhada**.

## Estado real e limites

Esta versão é uma **arena jogável melhorada**, não a entrega final de um produto comercial. Ainda há trabalho de modelagem refinada, personagens com esqueleto e animações, otimização visual, FX sonoros e integração backend.

O multiplayer está em **desafios assíncronos por link**, sem validação de identidade. Os links podem ser alterados, por isso não são adequados como pontuações oficiais. O ranking funciona apenas por navegador via `localStorage`. **GitHub Pages não possui servidor de partidas**, logo não pode oferecer placar geral síncrono sem um serviço adicional com autenticação e banco de dados. Nenhum resultado altera XP, HP, Mana ou moedas pedagógicas.

## Integridade de código

`game-v3.js` controla as rodadas e as interações. `scene-v3.js` contém o motor visual 3D com fallback. `v3.css` substitui a estética antiga de fundo azul.

No futuro os GLBs produzidos na ferramenta de modelagem poderão substituir os modelos dinâmicos presentes em `scene-v3.js` quando tiverem sido **exportados e disponibilizados dentro do repositório**. Eles ainda não estão hospedados no GitHub nesta versão.


## Desafios entre alunos (modos disponíveis)

- **Mesma turma / mesma Casa:** escolha seu arqueiro e outro colega do mesmo 4º A, 4º B ou 4º C. O próprio aluno não pode ser selecionado como adversário.
- **Casa rival:** escolha um estudante de uma Casa diferente da sua.
- Nos dois casos, cada participante realiza **cinco disparos**, em momentos diferentes. O primeiro aluno termina, toca em **Copiar desafio** e envia o link ao colega. O segundo abre o link destinado a ele, joga e pode compartilhar o resultado.
- **Limites atuais:** não há partida em tempo real, login de identidade verificada, envio de notificações, banco de dados online ou ranking geral sincronizado. Os dados transmitidos por links podem ser editados e não servem como comprovação oficial de campeonato.

