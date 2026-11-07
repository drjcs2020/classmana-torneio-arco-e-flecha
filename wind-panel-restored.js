/* Reposiciona o indicador já existente sem alterar velocidade nem física do vento. */
const stage=document.getElementById('stage');
const wind=document.getElementById('wind');
if(stage&&wind){stage.appendChild(wind);wind.classList.add('cm-wind-restored');}
