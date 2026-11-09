/* Logger UI and account-scoped, optimistic checkpoint writes through the public SDK. */
let liveWorkoutId=crypto.randomUUID();
const setWriteChains=new Map();
const pendingSetWrites=new Set();
function setRowState(set,row){
 if(!row)return;
 row.classList.toggle('is-complete',!!set.completed);
 row.classList.toggle('is-saving',set._saving===true);
 row.querySelector('[data-complete]').setAttribute('aria-busy',String(set._saving===true));
 row.querySelectorAll('[data-field]').forEach(input=>input.disabled=!!set.completed||row.querySelector('[data-complete]').disabled);
 row.querySelectorAll('[data-load-sign]').forEach(button=>button.disabled=!!set.completed||row.querySelector('[data-complete]').disabled);
}
function weightInputMarkup(name,set,index){
 const signed=WorkoutData.signedLoad(name),sign=Number(set.weight)<0?-1:set.loadSign===-1?-1:1;
 const input=`<input aria-label="${esc(name)} set ${index+1} weight" inputmode="decimal" type="number" min="0" step="0.5" placeholder="—" data-field="weight" data-index="${index}" value="${esc(set.weight===''?'':signed?Math.abs(Number(set.weight)):set.weight)}">`;
 if(!signed)return input;
 return `<div class="weight-control"><div class="load-sign-picker" role="group" aria-label="${esc(name)} set ${index+1} load type"><button type="button" data-load-sign="1" data-set-index="${index}" aria-label="Added weight for ${esc(name)} set ${index+1}" aria-pressed="${sign===1}">+</button><button type="button" data-load-sign="-1" data-set-index="${index}" aria-label="Assistance for ${esc(name)} set ${index+1}" aria-pressed="${sign===-1}">−</button></div>${input}</div>`;
}
function updateLoadControls(name,index){
 const set=draft[name]?.[index];if(!set||!WorkoutData.signedLoad(name))return;
 const row=$('sets-'+Object.keys(draft).indexOf(name))?.querySelectorAll('.setrow')[index];if(!row)return;
 const sign=Number(set.weight)<0?-1:set.loadSign===-1?-1:1;
 row.querySelector('[data-field="weight"]').value=set.weight===''?'':Math.abs(Number(set.weight));
 row.querySelectorAll('[data-load-sign]').forEach(button=>button.setAttribute('aria-pressed',String(Number(button.dataset.loadSign)===sign)));
}
function exerciseMenu(name){
 return `<details class="exercise-menu"><summary aria-label="Actions for ${esc(name)}">•••</summary><div class="exercise-menu-panel"><button data-menu-add="${esc(name)}">Add set</button><button data-menu-skip="${esc(name)}">Skip exercise</button>${(draft[name]||[]).map((set,index)=>`<button data-menu-remove="${esc(name)}" data-set-index="${index}">Remove set ${index+1}</button>`).join('')}</div></details>`;
}
function setRowsMarkup(name){
 const previous=latestExercise(name,editingId)?.exercise.sets||[];
 return `<div class="log-grid log-grid-head" aria-hidden="true"><span>SET</span><span>PREVIOUS</span><span>LB</span><span>REPS</span><span>✓</span></div>`+draft[name].map((set,index)=>{
  const last=previous[index];
  return `<div class="setrow log-grid ${set.completed?'is-complete':''}"><span class="set-number">${index+1}</span><span class="previous-set">${last?`${esc(WorkoutData.formatWeight(name,last.weight))} × ${esc(last.reps)}`:'—'}</span>${weightInputMarkup(name,set,index)}<input aria-label="${esc(name)} set ${index+1} reps" inputmode="numeric" type="number" min="1" max="100" placeholder="—" data-field="reps" data-index="${index}" value="${esc(set.reps)}"><label class="set-check"><input type="checkbox" data-complete="${index}" aria-label="${esc(name)} set ${index+1} completed" ${set.completed?'checked':''}><span class="check-glyph" aria-hidden="true">✓</span><span class="check-spinner" aria-hidden="true"></span></label></div>`;
 }).join('');
}
function showSetError(message){
 const banner=$('setWriteError');banner.textContent=message;banner.hidden=!message;
}
async function toggleLoggedSet(name,index,input){
 const set=draft[name]?.[index];if(!set)return;
 const completed=input.checked,previous=set.completed||false;
 if(completed&&!completeSet({...set,completed:true},name)){
  input.checked=previous;showSetError('Enter a valid weight and 1–100 whole-number reps before completing the set.');return;
 }
 const row=input.closest('.setrow');
 set.completed=completed;setRowState(set,row);showSetError('');
 try{saveDraft()}catch(error){set.completed=previous;input.checked=previous;setRowState(set,row);showSetError(error.message);return}
 const restToken=completed?startRest(name):0;
 if(!cloud||!currentUser){return} // Guests retain the same local draft behavior.
 if(!navigator.onLine){$('draftStatus').textContent='Offline · set saved on this device. Finish & Save Workout queues the session for sync.';return}
 const userId=currentUser.id,draftId=liveWorkoutId,client=cloud,token=crypto.randomUUID();
 const active=()=>currentUser?.id===userId&&liveWorkoutId===draftId&&draft[name]?.[index]===set;
 const snapshot={kind:'live-workout',weightConvention:'signed-v1',draftId,routine:$('routine').value,date:$('date').value,
  exercises:Object.entries(draft).filter(([exercise])=>!skippedExercises.has(exercise)).map(([exercise,sets])=>({name:exercise,sets:sets.filter(set=>completeSet(set,exercise)).map(s=>({weight:Number(s.weight),reps:Number(s.reps)}))})).filter(e=>e.sets.length)};
 pendingSetWrites.add(token);row.querySelectorAll('input, [data-load-sign]').forEach(field=>field.disabled=true);$('save').disabled=true;
 const timer=setTimeout(()=>{if(active()){set._saving=true;setRowState(set,row)}},150);
 const chainKey=userId+':'+draftId;
 const previousWrite=setWriteChains.get(chainKey)||Promise.resolve();
 const request=previousWrite.catch(()=>{}).then(async()=>{
  if(!active())return;
  const query=client.from('workout_sessions').upsert({user_id:userId,id:'live-'+draftId,session:snapshot,updated_at:new Date().toISOString()},{onConflict:'user_id,id'});
  const {error}=await (typeof query.abortSignal==='function'?query.abortSignal(AbortSignal.timeout(15000)):query);
  if(error)throw error;
 });
 setWriteChains.set(chainKey,request);
 try{
  await request;
  if(active())$('draftStatus').textContent='Set checkpoint synced · finish and save to add the workout to History.';
 }catch(error){
  if(active()){
   if(restToken&&restDeadline===restToken)stopRest();
   set.completed=previous;input.checked=previous;setRowState(set,row);
   try{saveDraft()}catch{}
   showSetError('Set not synced. Completion was undone; your weight and reps are kept. '+(error.code==='42501'?'Your account does not have permission to save this set.':error.message||'Check your connection and try again.'));
  }
 }finally{
  clearTimeout(timer);pendingSetWrites.delete(token);
  if(setWriteChains.get(chainKey)===request)setWriteChains.delete(chainKey);
  if(active()){set._saving=false;row.querySelectorAll('input').forEach(field=>field.disabled=false);setRowState(set,row)}
  $('save').disabled=pendingSetWrites.size>0;
 }
}
document.addEventListener('click',event=>{
 const button=event.target.closest('[data-menu-add],[data-menu-skip],[data-menu-remove]');if(!button)return;
 const name=button.dataset.menuAdd||button.dataset.menuSkip||button.dataset.menuRemove;
 if(pendingSetWrites.size){showSetError('Wait for the current set to finish syncing before changing exercise rows.');return}
 const card=button.closest('[data-exercise-card]');
 if(button.hasAttribute('data-menu-add'))card.querySelector('[data-add]').click();
 else if(button.hasAttribute('data-menu-skip'))card.querySelector('[data-skip-exercise]').click();
 else{draft[name].splice(Number(button.dataset.setIndex),1);renderSets(name);saveDraft()}
 const menu=card.querySelector('.exercise-menu');menu.open=false;
});
document.addEventListener('click',event=>{
 if(!pendingSetWrites.size||!event.target.closest('[data-add],[data-toggle-exercise],[data-skip-exercise]'))return;
 event.preventDefault();event.stopImmediatePropagation();showSetError('Wait for the current set to finish syncing before changing this exercise.');
},true);
