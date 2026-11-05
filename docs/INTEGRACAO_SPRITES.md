# ClassMana — Integração das artes aprovadas
## Estado real
O motor PlayCanvas, pontuação, mira, ventos, sons e três circuitos continuam no jogo existente. As seguintes peças foram integradas ao código, com modo de compatibilidade até os PNGs chegarem ao repositório:
- `sprite-hud.js`: barra de força arrastável, ligada a disparo real; força por segurar o mouse sobe e desce; pausa com congelamento do tempo do alvo móvel; brasões por Casa.
- `sprite-hud.css`: sobreposição modular de logo, painel de vento, distância, flechas, medidor de força e controles sem fundos pastéis.
- `scene-v3.js`: mantém o arco 3D, mira e alvo, mas desliga as geometrias rudimentares de gramado e postes quando o novo cenário está disponível.

## Ativação das artes (ainda NÃO feita)
O ZIP `ClassMana_Integracao_Visual_01.zip` contém 52 sprites de HUD, 15 sprites de botão e 4 fundos ilustrados. Envie **esse ZIP sem extrair** para a raiz deste repositório usando GitHub > Add file > Upload files. O workflow Pages descompacta os arquivos automaticamente e habilita a arte nova se e somente se eles carregarem.

Não colocar arquivos SVG ou PNG falsos no lugar das artes aprovadas. **Não declarar os cenários como 3D nativo**: os fundos são imagens 2D separadas, e o arco, a mira e o alvo continuam sendo entidades tridimensionais do PlayCanvas. Os 4 cenários do kit foram recortados de uma montagem de 1671x941 (aprox. 835x465 px cada); a dimensão 1920x1080 dos WEBP é interpolada, não nitidez 1080p nativa. Para definição realmente alta, é preciso gerar cada reino separadamente em alta resolução.

Desafios e ranking online: dependem de uma URL real de Apps Script /exec em `online-config.js` e backend atualizado. Não publicar credenciais no repositório.
