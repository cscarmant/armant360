/* Armant 360 · Chat oculto por enquanto (carregar por último)
   Tira o Chat do menu e dos atalhos, e manda #chat para o início. O código e as conversas guardadas
   não são apagados: para reativar, basta remover este arquivo do index.html. */
(function(){
'use strict';
if(typeof NAV==='undefined'||typeof render!=='function') return;
const tirar=()=>{for(let i=NAV.length-1;i>=0;i--){if(NAV[i][0]==='chat')NAV.splice(i,1);}};
tirar();
const prevRender=render;
render=function(){
 tirar();
 if(/^#chat(\/|$)/.test(location.hash)){const simples=!!(window.ArmantSimples&&window.ArmantSimples.ligado&&window.ArmantSimples.ligado());location.hash=simples?'#inicio':'#overview';return;}
 return prevRender();
};
})();
