import app from './v0217-entry.js';
import { APP_VERSION, canonicalAppPage } from './v022-ui.js';

function json(body,status=200,headers={}){
  return new Response(JSON.stringify(body),{
    status,
    headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store',...headers}
  });
}

function html(body){
  return new Response(body,{
    status:200,
    headers:{
      'content-type':'text/html; charset=utf-8',
      'cache-control':'no-store, no-cache, must-revalidate',
      pragma:'no-cache',
      expires:'0'
    }
  });
}

function publicVersion(value){
  return String(value).replace(/0\.(?:9|10|11|12|13|14|15|16|17|18|19|20|21)(?:\.\d+)?/g,APP_VERSION);
}

export default{
  async fetch(request,env,ctx){
    const url=new URL(request.url);

    if(request.method==='GET'&&(url.pathname==='/'||url.pathname==='/app')){
      return html(canonicalAppPage());
    }

    const response=await app.fetch(request,env,ctx);

    if(url.pathname==='/api/health'&&response.ok){
      const body=await response.json().catch(()=>null);
      if(!body||typeof body!=='object')return response;
      return json({
        ...body,
        version:APP_VERSION,
        canonicalShell:true,
        canonicalScreens:['dashboard','games','picks','tools'],
        survivorActive:false,
        uiRuntimePolling:false,
        legacyUiInjection:false,
        consolidationPhase:'canonical-ui'
      },response.status,response.headers);
    }

    if(request.method==='GET'&&url.pathname==='/sw.js'&&response.ok){
      return new Response(publicVersion(await response.text()),{
        status:response.status,
        headers:response.headers
      });
    }

    return response;
  },

  scheduled(controller,env,ctx){
    return app.scheduled(controller,env,ctx);
  }
};
