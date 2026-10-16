import baseWorker from './v022-entry.js';
import { brainReadClient } from './brain-read-ui.js';

function brainScriptResponse(){
  return new Response(brainReadClient,{
    headers:{
      'content-type':'application/javascript; charset=utf-8',
      'cache-control':'no-store'
    }
  });
}

async function withBrainUi(request,env,ctx){
  const url=new URL(request.url);
  if(url.pathname==='/brain-read.js') return brainScriptResponse();

  const response=await baseWorker.fetch(request,env,ctx);
  if(request.method!=='GET'||url.pathname!=='/') return response;
  const type=response.headers.get('content-type')||'';
  if(!type.includes('text/html')) return response;

  const html=await response.text();
  if(html.includes('/brain-read.js')) return new Response(html,response);
  const injected=html.replace('</body>','<script src="/brain-read.js" defer></script></body>');
  const headers=new Headers(response.headers);
  headers.delete('content-length');
  headers.set('cache-control','no-store');
  return new Response(injected,{status:response.status,statusText:response.statusText,headers});
}

export default {
  fetch(request,env,ctx){return withBrainUi(request,env,ctx)},
  scheduled(controller,env,ctx){return baseWorker.scheduled(controller,env,ctx)}
};
