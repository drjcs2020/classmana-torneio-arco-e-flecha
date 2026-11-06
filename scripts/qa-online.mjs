/**
 * Healthcheck da Arena Online v9. Não usa ContentService/JSONP (o Google
 * retorna 302/404 intermitentes). Não modifica planilha nem cria desafios.
 * A rota /exec ou /exec?play=1 precisa entregar HTMLService executável.
 */
import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';
const raw=readFileSync('online-config.js','utf8');
const matched=raw.match(/^\s*export\s+const\s+ONLINE_API_URL\s*=\s*['"]([^'"]+)['"]/m);
assert(matched,'ONLINE_API_URL ausente');
const base=matched[1];
assert(/^https:\/\/script\.google\.com\/macros\/s\/[-\w]+\/exec$/.test(base),'URL deve ser /exec');
const url=base+'?play=1&healthcheck=1&_='+Date.now();
const ctrl=new AbortController();
const timer=setTimeout(()=>ctrl.abort(),30000);
try{
 const res=await fetch(url,{signal:ctrl.signal,redirect:'follow',headers:{'User-Agent':'ClassMana-portal-v9-healthcheck/1.0'}});
 const type=res.headers.get('content-type')||'';
 const body=await res.text();
 if(!res.ok)throw Error('HTTP '+res.status);
 if(/accounts\.google\.com|ServiceLogin/i.test(res.url))throw Error('A implantação não está pública: redirecionou para login Google.');
 if(!/text\/html/i.test(type))throw Error('IMPLANTAÇÃO DESATUALIZADA: a rota /exec?play=1 deve retornar uma página HTML da Arena Online v9, mas retornou '+type+'. Atualize backend/Code.gs na implantação existente.');
 if(body.length<150)throw Error('A página HTML do Apps Script veio vazia.');
 if(/Authorization is required|Sign in with Google|You need permission/i.test(body))throw Error('Apps Script exige autorização para acessar a implantação.');
 console.log('OK: a implantação /exec?play=1 retornou HTML (status '+res.status+', '+body.length+' bytes).');
 console.log('A disputa entre 2 alunos depende de teste complementar no navegador com google.script.run.');
}catch(err){
 console.error('FALHA ARENA ONLINE: '+(err?.message||err));
 process.exitCode=1;
}finally{clearTimeout(timer)}
