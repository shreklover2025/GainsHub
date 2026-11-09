/* One rest period follows the most recently completed exercise. */
let restDeadline=0,restInterval=null,restExercise=null;
function renderRest(){
 const remaining=Math.max(0,Math.ceil((restDeadline-Date.now())/1000));
 if(!remaining){clearInterval(restInterval);restInterval=null;restDeadline=0;restExercise=null}
 document.querySelectorAll('[data-rest-for]').forEach(panel=>{
  const active=remaining>0&&panel.dataset.restFor===restExercise;
  panel.hidden=!active;
  if(active)panel.querySelector('output').textContent=Math.floor(remaining/60)+':'+String(remaining%60).padStart(2,'0');
 });
}
function stopRest(){restDeadline=0;renderRest()}
function startRest(name){
 if(!name)return 0;
 restExercise=name;restDeadline=Date.now()+Number($('restSeconds').value)*1000;
 clearInterval(restInterval);renderRest();restInterval=setInterval(renderRest,250);
 return restDeadline;
}
function restTimerMarkup(name){
 return `<div class="exercise-rest" data-rest-for="${esc(name)}" hidden><div><span class="rest-label">Rest timer</span><output aria-live="off" aria-label="Rest remaining for ${esc(name)}">0:00</output></div><button class="ghost" data-rest-stop="${esc(name)}" aria-label="Stop rest timer for ${esc(name)}">Stop</button></div>`;
}
document.addEventListener('click',event=>{if(event.target.closest('[data-rest-stop]'))stopRest()});
