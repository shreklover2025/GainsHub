/* Offer updates explicitly and preserve each open tab's draft before reloading. */
let appRegistration=null;
function preserveBeforeUpdate(){
 if(draftDirty)saveDraft();
 const active=document.querySelector('.tabs button.active');
 try{sessionStorage.setItem('gainshub-return-tab',active?.dataset.tab||'dashboard')}catch{}
}
async function setupUpdates(){
 if(!('serviceWorker' in navigator)||location.protocol==='file:')return;
 let controlled=!!navigator.serviceWorker.controller,reloading=false;
 navigator.serviceWorker.addEventListener('controllerchange',()=>{
  if(!controlled){controlled=true;return}
  if(reloading)return;
  try{preserveBeforeUpdate();reloading=true;location.reload()}
  catch(error){$('updateMessage').textContent='Update ready, but the draft could not be saved. Export a backup before reloading.';$('updateNotice').hidden=false}
 });
 try{
  appRegistration=await navigator.serviceWorker.register('./sw.js',{updateViaCache:'none'});
  const offer=()=>{
   if(!appRegistration.waiting||!navigator.serviceWorker.controller)return;
   $('updateMessage').textContent='Update available. Your unfinished workout will be saved before reloading.';
   $('updateNotice').hidden=false;$('updateApp').disabled=false;
  };
  offer();
  appRegistration.addEventListener('updatefound',()=>{
   const worker=appRegistration.installing;
   worker?.addEventListener('statechange',()=>{if(worker.state==='installed')offer()});
  });
  $('updateApp').onclick=()=>{
   try{
    preserveBeforeUpdate();$('updateApp').disabled=true;
    if(appRegistration.waiting)appRegistration.waiting.postMessage({type:'ACTIVATE_UPDATE'});
    else location.reload();
   }catch(error){$('updateMessage').textContent=error.message;$('updateApp').disabled=false}
  };
  navigator.serviceWorker.ready.then(()=>{$('offlineStatus').textContent='Ready to reopen offline on this device.'});
 }catch(error){$('offlineStatus').textContent='Offline setup failed. Reopen online to retry.';console.error(error)}
}
