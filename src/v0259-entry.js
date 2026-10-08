import baseWorker from './v022-entry.js';

export default {
  fetch(request,env,ctx){return baseWorker.fetch(request,env,ctx)},
  scheduled(controller,env,ctx){return baseWorker.scheduled(controller,env,ctx)}
};
