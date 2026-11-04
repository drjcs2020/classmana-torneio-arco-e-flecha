/**
 * ClassMana Arena — regras visuais do percurso (sem qualquer senha ou backend local).
 * O cálculo de obstrução equivalente também existe no Apps Script.
 */
export const CIRCUITS=Object.freeze({
 iniciante:Object.freeze([10,35,65,100,150]),
 avancado:Object.freeze([20,45,75,110,150]),
 lendario:Object.freeze([30,60,90,120,150])
});
export const LEVELS=Object.freeze({
 iniciante:{title:'Trilha do Aprendiz',feature:'Distâncias crescentes — alvo fixo',icon:'🌱',wind:.80},
 avancado:{title:'Trilha dos Ventos',feature:'Alvo móvel em trilho horizontal',icon:'🏹',wind:1.05},
 lendario:{title:'Trilha dos Guardiões',feature:'Alvo móvel + escudos-obstáculos',icon:'🛡️',wind:1.23}
});
const cap=(x,a,b)=>Math.max(a,Math.min(b,x));
/** Offset X em fração da largura da cena; Y também é fração da altura. */
/** Deslocamento medido EM RAIOS DO ALVO, independente do tamanho da tela. */
export function targetMotion(level,index,seconds){
 const t=cap(Number(seconds)||0,0,120);
 if(level==='avancado')return {x:2.05*Math.sin(t*1.35+index*1.11),y:0};
 if(level==='lendario')return {x:2.60*Math.sin(t*1.61+index*1.11),y:.36*Math.sin(t*.83+index*1.14)};
 return {x:0,y:0};
}
/** Mesmo tempo aproximado de voo adotado no servidor e na cena PlayCanvas. */
export function flightSeconds(distance,power){
 return .43+.42*Math.pow(Math.max(10,distance)/80,.56)+.13*(1-power);
}
/** Posição do escudo, medida em raios do alvo (X e Y). */
export function obstacleAt(level,index,seconds){
 if(level!=='lendario')return null;
 const t=cap(Number(seconds)||0,0,120);
 return {x:.67*Math.sin(t*2.2+index*1.31),y:.17*Math.cos(t*1.37+index*.71),width:.28,height:.60};
}
/** dx,dy são impactos já compensados pela queda e pelo vento, em raios do alvo. */
export function obstacleBlocks(level,index,seconds,dx,dy){
 const o=obstacleAt(level,index,seconds);
 return !!o&&Math.abs(dx-o.x)<o.width&&Math.abs(dy-o.y)<o.height;
}
export function distanceDifficulty(distance){return Math.pow(Math.max(10,Number(distance)||10)/30,.55)}
