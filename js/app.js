
'use strict';
const ROUTINES={
'Upper Body':[['Barbell Bench Press',''],['Barbell Bent-Over Row',''],['Barbell Overhead Press',''],['Pull-Ups',''],['Chest Dips',''],['Barbell Incline Bench Press',''],['Cable Rows',''],['Dumbbell Lateral Raises','']],
'Lower — Squat Focus':[['Barbell Back Squat',''],['Romanian Deadlift',''],['Belt Squat Machine',''],['Standing Calf Raises',''],['Seated Calf Raises',''],['Leg Extensions',''],['Leg Curls','']],
'Lower — Deadlift Focus':[['Conventional Deadlift',''],['Barbell Bulgarian Split Squat',''],['Belt Squat Machine',''],['Standing Calf Raises',''],['Seated Calf Raises',''],['Leg Extensions',''],['Leg Curls','']]};
const isBaseline=s=>s?.baseline===true||s?.id==='baseline-2026-10-21';
let sessions=[];let currentUser=null;let cloud=null;let syncBusy=false;let syncAgain=false;
let knownVersions={};let draftDirty=false;let renderedRoutine='';let retryDelay=5000;let retryTimer;let syncNotice="";let pendingWrites={};let editingId=null;let editingOriginal=null;
const CONFIG=window.STRENGTH_CONFIG||{};
try{if(CONFIG.supabaseUrl&&CONFIG.supabasePublishableKey&&window.supabase){cloud=window.supabase.createClient(CONFIG.supabaseUrl,CONFIG.supabasePublishableKey)}}catch(err){console.error('Cloud setup error',err)}
function localKey(){return currentUser?'strength-tracker-user-'+currentUser.id:'strength-tracker-guest'}
function loadLocal(){
 $('saveConfirmation').hidden=true;
 cancelEditing();
 let cached=[];try{const a=JSON.parse(localStorage.getItem(localKey()));if(Array.isArray(a))cached=a}catch{}
 sessions=cached.filter(s=>!isBaseline(s)&&!s.deleted).map(WorkoutData.renameSessionExercises);
 try{knownVersions=JSON.parse(localStorage.getItem(localKey()+'-versions-v1'))||{}}catch{knownVersions={}}
 syncNotice='';
 const key=localKey()+'-outbox-v2';
 try{pendingWrites=JSON.parse(localStorage.getItem(key))||{}}catch{pendingWrites={}}
 pendingWrites=Object.fromEntries(Object.entries(pendingWrites).map(([id,session])=>[id,WorkoutData.renameSessionExercises(session)]));
 // One-time migration: retain genuine locally saved workouts for upload.
 if(localStorage.getItem(key)===null){pendingWrites=Object.fromEntries(sessions.map(s=>[s.id,{...s,revision:crypto.randomUUID()}]))}
 // Recover an interrupted local save from the durable outbox.
 const recovered=new Map(sessions.map(s=>[s.id,s]));
 for(const s of Object.values(pendingWrites)){if(s.deleted)recovered.delete(s.id);else if(!isBaseline(s))recovered.set(s.id,s)}
 sessions=[...recovered.values()];
 try{persist()}catch(error){status(error.message)}
 renderAll();restoreDraft();$('syncNotice').textContent=''
}

let draft={};let collapsedExercises=new Set();let skippedExercises=new Set();const $=id=>document.getElementById(id);const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));const allNames=[...new Set(Object.values(ROUTINES).flat().map(x=>x[0]))];
function writeLocal(key,value){
 try{localStorage.setItem(key,JSON.stringify(value))}catch(error){
  $('draftStatus').textContent='Device storage unavailable. Keep this page open and export a backup.';
  throw Error('Could not save on this device. Keep this page open and export a backup.');
 }
}
function persist(){
 writeLocal(localKey()+'-outbox-v2',pendingWrites);
 writeLocal(localKey(),sessions);
 writeLocal(localKey()+'-versions-v1',knownVersions);
 updateSyncBadge();
}
function queueWrite(session,baseVersion=knownVersions[session.id]||null){
 const existing=pendingWrites[session.id];
 pendingWrites[session.id]={...session,revision:crypto.randomUUID(),_baseVersion:existing?existing._baseVersion:baseVersion};
 persist()
}
function updateSyncBadge(){
 const count=Object.keys(pendingWrites).length;
 $('syncBadge').textContent=(navigator.onLine?'':'Offline · ')+(count?count+' change(s) '+(currentUser?'waiting to sync':'saved on this device'):'All saved on this device');
}
function saveDraft(){
 draftDirty=true;
 writeLocal(localKey()+'-draft-v1',{routine:$('routine').value,date:$('date').value,notes:$('sessionNotes').value,draft,editingId,editingOriginal,editingBaseVersion,collapsedExercises:[...collapsedExercises],skippedExercises:[...skippedExercises],liveWorkoutId,weightConvention:'signed-v1',savedAt:new Date().toISOString()});
 $('draftStatus').textContent='Unfinished workout saved on this device.';
 renderDraftLog();
 updateWorkoutAccount();
}
function restoreDraft(){
 draftDirty=false;resetWorkout(Object.keys(ROUTINES)[0]);
 try{
  const saved=JSON.parse(localStorage.getItem(localKey()+'-draft-v1'));
  if(!saved||!saved.draft||typeof saved.routine!=='string')return;
  if(![...$('routine').options].some(o=>o.value===saved.routine))$('routine').add(new Option(saved.routine,saved.routine));
  $('routine').value=saved.routine;$('date').value=saved.date;$('sessionNotes').value=saved.notes||'';
  liveWorkoutId=typeof saved.liveWorkoutId==='string'?saved.liveWorkoutId:crypto.randomUUID();
  draft=saved.draft;editingId=saved.editingId;editingOriginal=saved.editingOriginal;editingBaseVersion=saved.editingBaseVersion||null;draftDirty=true;
  const renamedDraft={};
  for(const [name,sets] of Object.entries(draft)){
   const renamed=WorkoutData.exerciseName(name);
   renamedDraft[renamed]=[...(renamedDraft[renamed]||[]),...sets.map(set=>({...set,weight:set.weight===''?'':String(WorkoutData.normalizeWeight(renamed,Number(set.weight),saved.weightConvention))}))];
  }
  draft=renamedDraft;
  Object.values(draft).forEach(sets=>sets.forEach(set=>{delete set._saving}));
  if(editingOriginal)editingOriginal=WorkoutData.renameSessionExercises(editingOriginal);
  // Older drafts predate routine additions. Merge new exercises without losing entered sets.
  const routineNames=(ROUTINES[saved.routine]||[]).map(([name])=>name);
  draft=Object.fromEntries([...new Set([...routineNames,...Object.keys(draft)])].map(name=>[
   name,Object.hasOwn(draft,name)?draft[name]:[{weight:'',reps:'',completed:false}]
  ]));
  collapsedExercises=new Set((Array.isArray(saved.collapsedExercises)?saved.collapsedExercises:[]).map(WorkoutData.exerciseName).filter(name=>draft[name]?.length&&draft[name].every(set=>set.completed)));
  skippedExercises=new Set((Array.isArray(saved.skippedExercises)?saved.skippedExercises:[]).map(WorkoutData.exerciseName).filter(name=>Object.hasOwn(draft,name)));
  setEditUI();renderExercises();$('draftStatus').textContent='Your unfinished workout was restored.';
 }catch(error){$('draftStatus').textContent='Could not restore the saved draft. Export your history before clearing device storage.'}
}
function clearDraft(){localStorage.removeItem(localKey()+'-draft-v1');draftDirty=false;$('draftStatus').textContent='';renderDraftLog()}
function startNew(routine){if(draftDirty&&!confirm('Discard the unfinished workout and start a new one?'))return;clearDraft();resetWorkout(routine);saveDraft()}

function renderAll(){updateReferences();renderHome();renderProgression();if(!$('history').classList.contains('hide'))renderHistory();if(!$('progress').classList.contains('hide'))renderChart()}
function status(message,email=null){
 const container=$('cloudStatus');container.textContent=message;
 if(email){
  const address=document.createElement('span');address.className='cloud-email';address.textContent=email;
  container.append(document.createTextNode(' '),address);
 }
}
function authUI(){const signed=!!currentUser;$('authInputs').classList.toggle('hide',signed);$('signIn').classList.toggle('hide',signed);$('signUp').classList.toggle('hide',signed);$('signOut').classList.toggle('hide',!signed);$('syncNow').classList.toggle('hide',!signed);updateWorkoutAccount();status(!cloud?'Cloud not configured yet — see README.':signed?'Signed in: '+currentUser.email+' · Cloud sync available':'Sign in or create an account to sync across devices.')}
function updateWorkoutAccount(){
 const label=currentUser?'Logging as '+(currentUser.email||'signed-in user'):'Logging as Guest · saved on this device only';
 $('workoutAccount').textContent=label;$('finishAccount').textContent=label;
}
function completeSet(set,name){return !!set.completed&&set.weight!==''&&set.reps!==''&&Number.isFinite(Number(set.weight))&&WorkoutData.validWeight(name,Number(set.weight))&&Number.isInteger(Number(set.reps))&&Number(set.reps)>=1&&Number(set.reps)<=100}
function workoutProgress(){
 const names=Object.keys(draft);
 const skipped=names.filter(name=>skippedExercises.has(name)).length;
 const done=names.filter(name=>!skippedExercises.has(name)&&draft[name].length&&draft[name].every(set=>completeSet(set,name))).length;
 return {total:names.length,done,skipped,remaining:names.length-done-skipped};
}
async function syncCloud(){
 if(!cloud||!currentUser)return;
 if(!navigator.onLine){updateSyncBadge();status('Offline. Saved workouts will sync when you reconnect.');return}
 if(syncBusy){syncAgain=true;return}
 clearTimeout(retryTimer);syncBusy=true;
 const userId=currentUser.id, cacheKey=localKey(), outbox=pendingWrites, versions=knownVersions;
 const active=()=>currentUser?.id===userId&&pendingWrites===outbox;
 status('Syncing…');
 try{
  const remote=await WorkoutSync.readRows(cloud,userId);
  if(!active())return;
  const remoteMap=new Map(remote.map(r=>[r.id,r]));
  for(const snapshot of Object.values(outbox)){
   if(!active())return;
   if(isBaseline(snapshot))continue;
   const row=remoteMap.get(snapshot.id);
   // A previous upload may have succeeded just before losing connectivity.
   if(row?.session?.revision===snapshot.revision){
    versions[snapshot.id]=row.updated_at;
    if(outbox[snapshot.id]?.revision===snapshot.revision)delete outbox[snapshot.id];
    persist();continue;
   }
   const payload={...snapshot};delete payload._baseVersion;
   const changed=row&&row.updated_at!==snapshot._baseVersion;
   const result=changed?{conflict:true}:await WorkoutSync.writeSession(cloud,userId,payload,snapshot._baseVersion);
   if(!active())return;
   if(result.conflict){
    // Persist the latest local edit as a separate workout before releasing its original ID.
    const latest=outbox[snapshot.id];
    if(latest&&!latest.deleted){
     const copy={...latest,id:'session-'+crypto.randomUUID(),revision:crypto.randomUUID(),_baseVersion:null,
      notes:(latest.notes||'')+'\nPreserved device copy: another device changed the original workout.'};
     outbox[copy.id]=copy;
     writeLocal(cacheKey+'-outbox-v2',outbox);
    }
    delete outbox[snapshot.id];
    syncNotice='A sync conflict was found. Device edits were preserved as a separate workout; conflicting deletions were cancelled. Review History.';
    syncAgain=true;
   }else{
    versions[snapshot.id]=result.version;
    if(outbox[snapshot.id]?.revision===snapshot.revision)delete outbox[snapshot.id];
    else if(outbox[snapshot.id])outbox[snapshot.id]._baseVersion=result.version;
   }
   persist();
  }
  const rows=await WorkoutSync.readRows(cloud,userId);
  if(!active())return;
  const merged=new Map();
  for(const row of rows){
   versions[row.id]=row.updated_at;
   if(row.session?.deleted||row.session?.kind==='live-workout'||isBaseline(row.session))continue;
   merged.set(row.id,WorkoutData.normalizeSession(row.session));
  }
  for(const s of Object.values(outbox)){if(s.deleted)merged.delete(s.id);else if(!isBaseline(s))merged.set(s.id,s)}
  sessions=[...merged.values()];persist();refreshSuggestedWeights();renderAll();retryDelay=5000;
  $('syncNotice').textContent=syncNotice;
  if(Object.keys(outbox).length)status('Changes waiting to sync…');
  else status('Synced '+new Date().toLocaleTimeString()+' ·',currentUser.email);
 }catch(error){
  if(active()){
   status('Sync failed. Changes remain on this device; retrying automatically. '+error.message);
   retryTimer=setTimeout(()=>void syncCloud(),retryDelay);retryDelay=Math.min(retryDelay*2,60000);
  }
  console.error(error);
 }finally{
  syncBusy=false;
  if(syncAgain){syncAgain=false;void syncCloud()}
 }
}
function cloudDelete(id){
 // Keep a deletion marker in the cloud so other devices cannot restore stale copies.
 queueWrite({id,deleted:true,updatedAt:new Date().toISOString()});
 sessions=sessions.filter(s=>s.id!==id);persist();renderAll();void syncCloud()
}
async function login(mode){if(!cloud){alert('Configure Supabase in config.js first.');return}const email=$('email').value.trim(),password=$('password').value;if(!email||!password){alert('Enter email and password');return}status('Connecting…');const res=mode==='signup'?await cloud.auth.signUp({email,password}):await cloud.auth.signInWithPassword({email,password});if(res.error){status(res.error.message);return}if(mode==='signup'&&!res.data.session){status('Check your email to confirm your account, then sign in.');return}await setUser(res.data.user)}
async function setUser(user){currentUser=user;$('saveConfirmation').hidden=true;loadLocal();authUI();if(user)await syncCloud()}
$('signIn').onclick=()=>login('signin');$('signUp').onclick=()=>login('signup');$('signOut').onclick=async()=>{if(cloud)await cloud.auth.signOut();currentUser=null;loadLocal();authUI()};$('syncNow').onclick=syncCloud;
async function boot(){
 authUI();loadLocal();
 if(cloud){
  // Subscribe synchronously; do not await Supabase calls inside the auth callback.
  cloud.auth.onAuthStateChange((event,session)=>{
   if(event==='SIGNED_OUT'||(session?.user&&session.user.id!==currentUser?.id)){
    setTimeout(()=>void setUser(session?.user||null),0);
   }
  });
  try{
   const {data}=await cloud.auth.getSession();
   if(data?.session?.user)await setUser(data.session.user);
  }catch(error){status('Account unavailable offline. Your device history is still saved.')}
 }
 void setupUpdates();
 try{const tab=sessionStorage.getItem('gainshub-return-tab');sessionStorage.removeItem('gainshub-return-tab');if(['dashboard','logger','history','progress','guide'].includes(tab))switchTab(tab)}catch{}
}
function today(){let d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`}
function switchTab(tab){document.querySelectorAll('main>section').forEach(x=>x.classList.toggle('hide',x.id!==tab));document.querySelectorAll('.tabs button').forEach(x=>x.classList.toggle('active',x.dataset.tab===tab));if(tab==='dashboard')renderHome();if(tab==='history')renderHistory();if(tab==='progress'){renderChart();renderProgression()}scrollTo(0,0)}
document.querySelectorAll('.tabs button').forEach(b=>b.addEventListener('click',()=>switchTab(b.dataset.tab)));
$('routine').innerHTML=Object.keys(ROUTINES).map(x=>`<option>${esc(x)}</option>`).join('');$('chartExercise').innerHTML=allNames.map(x=>`<option>${esc(x)}</option>`).join('');$('date').value=today();
function previousWeight(name){
 const last=latestExercise(name,editingId);
 const weight=last?.exercise.sets.at(-1)?.weight;
 return weight!==undefined&&Number.isFinite(Number(weight))&&WorkoutData.validWeight(name,Number(weight))?String(weight):'';
}
function initDraft(routine){stopRest();liveWorkoutId=crypto.randomUUID();draft={};collapsedExercises=new Set();skippedExercises=new Set();(ROUTINES[routine]||[]).forEach(([name])=>{draft[name]=[{weight:previousWeight(name),reps:'',completed:false,autoWeight:true}]});renderExercises()}
function refreshSuggestedWeights(){
 let changed=false;
 Object.entries(draft).forEach(([name,sets],exerciseIndex)=>sets.forEach((set,index)=>{
  if(!set.autoWeight||set.completed||set.reps!=='')return;
  const input=$('sets-'+exerciseIndex)?.querySelector('[data-field="weight"][data-index="'+index+'"]');
  if(input===document.activeElement)return;
  const weight=previousWeight(name);
  if(String(set.weight)===weight)return;
  set.weight=weight;set.loadSign=Number(weight)<0?-1:1;if(input)input.value=WorkoutData.signedLoad(name)&&weight!==''?Math.abs(Number(weight)):weight;updateLoadControls(name,index);updatePlateGuide(name,index);changed=true;
 }));
 if(changed&&draftDirty)saveDraft();
}
function renderExercises(){
 renderedRoutine=$('routine').value;
 $('exerciseList').innerHTML=Object.keys(draft).map((name,i)=>`<div class="card" data-exercise-card="${esc(name)}"><div class="exercise-header"><div class="exercise-title">${esc(name)}</div>${exerciseMenu(name)}</div><div class="exercise-context"><span class="pill" data-reference="${esc(name)}">${esc(referenceLabel(name))}</span><span class="mini muted" data-done-summary hidden></span><button class="ghost" data-reopen data-toggle-exercise="${esc(name)}" aria-controls="exercise-body-${i}" hidden>Reopen</button></div>${restTimerMarkup(name)}<div class="exercise-body" id="exercise-body-${i}"><small>${WorkoutData.signedLoad(name)?'Choose + for added weight or − for assistance, then enter the amount. 0 = bodyweight.':'Weight in lb · completed reps'}</small><div data-exercise-hint="${esc(name)}">${exerciseHint(name)}</div><div id="sets-${i}"></div><div class="row exercise-actions"><button class="secondary" data-add="${esc(name)}">+ Add set</button><button class="ghost" data-skip-exercise="${esc(name)}">Skip today</button><button data-toggle-exercise="${esc(name)}" aria-controls="exercise-body-${i}">Done</button></div></div></div>`).join('');
 Object.keys(draft).forEach(renderSets);
 document.querySelectorAll('[data-add]').forEach(b=>b.onclick=()=>{draft[b.dataset.add].push({weight:draft[b.dataset.add].at(-1)?.weight??'',reps:''});renderSets(b.dataset.add);saveDraft()})
 document.querySelectorAll('[data-toggle-exercise]').forEach(button=>button.onclick=()=>{
  const name=button.dataset.toggleExercise;
  if(collapsedExercises.has(name)||skippedExercises.has(name)){collapsedExercises.delete(name);skippedExercises.delete(name)}
  else{
   if(!draft[name].length||!draft[name].every(set=>completeSet(set,name))){
    alert('Complete and check off every set for this exercise first. Remove any unused sets.');return;
   }
   collapsedExercises.add(name);
  }
  updateExerciseCollapse(name);saveDraft();
  const card=button.closest('[data-exercise-card]');
  card.querySelector(collapsedExercises.has(name)?'[data-reopen]':'.exercise-body [data-toggle-exercise]').focus();
 });
 Object.keys(draft).forEach(updateExerciseCollapse);renderRest();
 document.querySelectorAll('[data-skip-exercise]').forEach(button=>button.onclick=()=>{
  const name=button.dataset.skipExercise;if(restExercise===name)stopRest();skippedExercises.add(name);collapsedExercises.delete(name);
  updateExerciseCollapse(name);saveDraft();button.closest('[data-exercise-card]').querySelector('[data-reopen]').focus();
 });
 updateWorkoutAccount();
}
function updateExerciseCollapse(name){
 const card=[...document.querySelectorAll('[data-exercise-card]')].find(card=>card.dataset.exerciseCard===name);
 if(!card)return;
 const skipped=skippedExercises.has(name),collapsed=collapsedExercises.has(name)||skipped;
 card.querySelector('.exercise-body').hidden=collapsed;
 card.querySelector('[data-reopen]').hidden=!collapsed;
 const summary=card.querySelector('[data-done-summary]');summary.hidden=!collapsed;
 summary.textContent=skipped?'Skipped today · not included':'Done · '+draft[name].length+' set'+(draft[name].length===1?'':'s')+' completed';
 card.querySelectorAll('[data-toggle-exercise]').forEach(button=>button.setAttribute('aria-expanded',String(!collapsed)));
}
function setEditUI(){
 $('loggerTitle').textContent=editingId?'Edit workout':'Log workout';
 $('save').textContent=editingId?'Finish & Save Changes':'Finish & Save Workout';
 $('cancelEdit').classList.toggle('hide',!editingId)
}
let editingBaseVersion=null;
function cancelEditing(){editingId=null;editingOriginal=null;editingBaseVersion=null;setEditUI()}
function resetWorkout(routine){cancelEditing();$('routine').value=routine;$('date').value=today();$('sessionNotes').value='';initDraft(routine)}
function editSession(id){
 const session=sessions.find(s=>s.id===id);if(!session)return;
 if(draftDirty&&!confirm('Replace your unfinished workout with this saved session?'))return;
 stopRest();liveWorkoutId=crypto.randomUUID();editingId=id;editingOriginal=JSON.parse(JSON.stringify(session));editingBaseVersion=knownVersions[id]||null;
 if(![...$('routine').options].some(o=>o.value===session.routine)){$('routine').add(new Option(session.routine,session.routine))}
 $('routine').value=session.routine;$('date').value=session.date;$('sessionNotes').value=session.notes||'';
 collapsedExercises=new Set();
 skippedExercises=new Set((session.skippedExercises||[]).map(WorkoutData.exerciseName));
 draft=Object.fromEntries(session.exercises.map(e=>[e.name,e.sets.map(z=>({...z,completed:true}))]));
 for(const [name] of ROUTINES[session.routine]||[]){if(!draft[name])draft[name]=[]}
 setEditUI();renderExercises();saveDraft();switchTab('logger')
}
$('cancelEdit').onclick=()=>{if(!confirm('Discard changes to this workout?'))return;clearDraft();resetWorkout(Object.keys(ROUTINES)[0]);switchTab('history')};
function renderSets(name){
 const el=$('sets-'+Object.keys(draft).indexOf(name));
 el.innerHTML=setRowsMarkup(name);
 draft[name].forEach((set,index)=>setRowState(set,el.querySelectorAll('.setrow')[index]));
 el.querySelectorAll('[data-field]').forEach(inp=>inp.oninput=()=>{const set=draft[name][+inp.dataset.index];if(inp.dataset.field==='weight'&&WorkoutData.signedLoad(name)){const sign=set.loadSign??(Number(set.weight)<0?-1:1);set.loadSign=sign;set.weight=inp.value===''?'':String(Math.abs(Number(inp.value))*sign);updateLoadControls(name,+inp.dataset.index)}else set[inp.dataset.field]=inp.value;set.autoWeight=false;updatePlateGuide(name,+inp.dataset.index);saveDraft()});
 el.querySelectorAll('[data-load-sign]').forEach(button=>button.onclick=()=>{
  const index=Number(button.dataset.setIndex),set=draft[name][index];
  if(set.completed||pendingSetWrites.size)return;
  set.loadSign=Number(button.dataset.loadSign);set.autoWeight=false;
  if(set.weight!=='')set.weight=String(Math.abs(Number(set.weight))*set.loadSign);
  updateLoadControls(name,index);saveDraft();
 });
 el.querySelectorAll('[data-complete]').forEach(input=>input.onchange=()=>void toggleLoggedSet(name,Number(input.dataset.complete),input));
 el.querySelectorAll('[data-remove]').forEach(b=>b.onclick=()=>{draft[name].splice(+b.dataset.remove,1);renderSets(name);saveDraft()});
 const menu=el.closest('[data-exercise-card]')?.querySelector('.exercise-menu');
 if(menu)menu.outerHTML=exerciseMenu(name);
}
$('routine').onchange=()=>{if(draftDirty&&!confirm('Change routine and replace the sets currently in this form?')){$('routine').value=renderedRoutine;return}initDraft($('routine').value);saveDraft()};initDraft($('routine').value);
$('save').onclick=()=>{
 const exercises=Object.entries(draft).filter(([name])=>!skippedExercises.has(name)).map(([name,sets])=>({name,sets:sets.filter(set=>completeSet(set,name)).map(s=>({weight:Number(s.weight),reps:Number(s.reps)}))})).filter(e=>e.sets.length);
 if(!exercises.length){alert('Check off at least one completed set with a weight and whole-number reps.');return}
 if(!$('date').value){alert('Choose a workout date.');return}
 const progress=workoutProgress();
 if(progress.remaining&&!confirm(progress.remaining+' exercise(s) still have unfinished sets. Save only checked sets and finish this workout?'))return;
 const session={...(editingOriginal||{}),id:editingId||'session-'+crypto.randomUUID(),date:$('date').value,routine:$('routine').value,notes:$('sessionNotes').value,exercises,weightConvention:'signed-v1',skippedExercises:[...skippedExercises],updatedAt:new Date().toISOString()};
 const records=WorkoutRecords.findRecords(session,sessions);
 const index=sessions.findIndex(s=>s.id===session.id);
 if(index<0)sessions.push(session);else sessions[index]=session;
 queueWrite(session,editingId?editingBaseVersion:null);renderAll();void syncCloud();clearDraft();resetWorkout(Object.keys(ROUTINES)[0]);switchTab('history');
 $('saveConfirmationText').textContent=session.routine+' · '+exercises.length+' exercises · '+exercises.reduce((count,e)=>count+e.sets.length,0)+' sets saved'+(session.skippedExercises.length?' · '+session.skippedExercises.length+' skipped':'')+'. '+(currentUser?'Saved on this device; check cloud status for sync confirmation.':'Saved on this device as Guest.');
 $('recordHighlights').innerHTML=records.length?'<h3>Personal records</h3><ul>'+records.map(record=>'<li><strong>'+esc(record.name)+'</strong> · '+esc(record.text)+'</li>').join('')+'</ul><p class="mini muted">Compared with your earlier saved history loaded on this device.</p>':'';
 $('saveConfirmation').hidden=false;$('saveConfirmation').scrollIntoView({block:'start'});
};
$('dismissConfirmation').onclick=()=>{$('saveConfirmation').hidden=true};

function latestExercise(name,excludeId=null){
 const ordered=sessions.filter(s=>!s.deleted&&!isBaseline(s)&&s.date<=today()&&s.id!==excludeId).slice().sort((a,b)=>b.date.localeCompare(a.date)||(b.updatedAt||'').localeCompare(a.updatedAt||''));
 for(const session of ordered){const e=session.exercises.find(e=>e.name===name&&e.sets?.length);if(e)return {session,exercise:e}}
 return null
}
function referenceLabel(name){
 const last=latestExercise(name,editingId);
 if(!last)return 'Reference: No previous workout';
 const weights=[...new Set(last.exercise.sets.map(set=>Number(set.weight)).filter(weight=>WorkoutData.validWeight(name,weight)))];
 if(!weights.length)return 'Reference: No previous weight';
 return 'Reference: '+weights.map(weight=>WorkoutData.signedLoad(name)&&weight>0?'+'+weight:weight).join(' / ')+' lb'+(/Dumbbell/.test(name)?' each':'');
}
function updateReferences(){
 document.querySelectorAll('[data-reference]').forEach(label=>{label.textContent=referenceLabel(label.dataset.reference)});
 // Update history independently so a background sync never replaces active set inputs.
 document.querySelectorAll('[data-exercise-hint]').forEach(container=>{
  const markup=exerciseHint(container.dataset.exerciseHint);
  if(container.innerHTML!==markup)container.innerHTML=markup;
 });
}
function progressionFor(name,excludeId=null){
 const last=latestExercise(name,excludeId);const target=/Calf Raises$/.test(name)?15:8;
 if(!last)return {kind:'new',target,text:'Log a session to get a suggestion.'};
 const sets=last.exercise.sets;
 const valid=sets.every(z=>WorkoutData.validWeight(name,Number(z.weight))&&Number.isInteger(Number(z.reps))&&Number(z.reps)>0);
 const sameLoad=valid&&sets.every(z=>Number(z.weight)===Number(sets[0].weight));
 const weight=Number(sets[0]?.weight);
 const ready=valid&&sets.length>=3&&sameLoad&&sets.every(z=>Number(z.reps)>=target);
 if(!ready){const reason=sets.length<3?'Fewer than 3 sets recorded. ':!sameLoad?'Mixed loads recorded. ':'';return {kind:'build',target,last,text:reason+'Keep building toward '+target+' reps on every working set before increasing.'}}
 if(WorkoutData.signedLoad(name))return {kind:'ready',target,last,text:weight<0?'Consider reducing assistance from '+Math.abs(weight)+' to '+Math.max(0,Math.abs(weight)-5)+' lb (enter '+Math.min(0,weight+5)+' lb).':weight===0?'Bodyweight target reached. Consider a small added load only if appropriate.':'Consider +'+(weight+5)+' lb added weight next time.'};
 let increment=/Dumbbell/.test(name)?2.5:/Squat|Deadlift/.test(name)&&!/Bulgarian/.test(name)?10:5;
 return {kind:'ready',target,last,text:'Consider '+(weight+increment)+' lb next time (+'+increment+' lb'+(/Dumbbell/.test(name)?' per dumbbell':' total')+').'}
}
function exerciseHint(name){
 const result=progressionFor(name,editingId);if(!result.last)return '<p class="mini muted">No previous saved sets for this exercise.</p>';
 const last=result.last;
 return `<div class="progression-hint ${result.kind==='ready'?'ready':''}"><small>LAST LOGGED · ${esc(last.session.date)}</small><div class="mini">${last.exercise.sets.map(z=>`${esc(WorkoutData.formatWeight(name,z.weight))} lb × ${esc(z.reps)}`).join(' · ')}</div><div class="mini">${esc(result.text)}</div></div>`
}
function renderProgression(){
 const names=[...new Set(sessions.filter(s=>!s.deleted&&!isBaseline(s)).flatMap(s=>s.exercises.map(e=>e.name)))];
 const results=names.map(name=>({name,...progressionFor(name)})).filter(r=>r.kind!=='new').sort((a,b)=>(b.kind==='ready')-(a.kind==='ready')||a.name.localeCompare(b.name));
 $('progressionList').innerHTML=results.length?results.map(r=>`<div class="exercise"><div class="row"><div class="exercise-title">${esc(r.name)}</div><span class="pill">${r.kind==='ready'?'Consider increasing':'Build reps'}</span></div><p class="mini muted">${esc(r.last.session.date)} · ${r.last.exercise.sets.map(z=>`${esc(z.weight)} lb × ${esc(z.reps)}`).join(' · ')}</p><div class="mini">${esc(r.text)}</div></div>`).join(''):'<div class="empty">Log your first workout to see progression suggestions.</div>'
}

function renderHome(){$('totalSessions').textContent=sessions.length;$('routineButtons').innerHTML=Object.keys(ROUTINES).map((r,i)=>`<button class="secondary" data-routine="${esc(r)}" style="display:block;width:100%;text-align:left;margin-bottom:9px"><span class="routine-number">0${i+1}</span><span class="routine-name">${esc(r)}</span><span class="routine-arrow" aria-hidden="true">↗</span></button>`).join('');document.querySelectorAll('[data-routine]').forEach(b=>b.onclick=()=>{startNew(b.dataset.routine);switchTab('logger')});$('recent').innerHTML=[...sessions].sort((a,b)=>b.date.localeCompare(a.date)).slice(0,4).map(s=>`<div class="session"><strong>${esc(s.date)}</strong> · ${esc(s.routine)}<div class="mini muted">${s.exercises.length} exercises with exact sets</div></div>`).join('')||'<div class="empty">Your journal starts here.<br>Choose a session above to log your first workout.</div>'}
function renderChart(){const name=$('chartExercise').value,signed=WorkoutData.signedLoad(name);for(const option of $('metric').options)option.disabled=signed&&option.value!=='top';if(signed)$('metric').value='top';const metric=$('metric').value;let data=sessions.flatMap(s=>s.exercises.filter(e=>e.name===name&&e.sets.length).map(e=>{let v=metric==='top'?Math.max(...e.sets.map(x=>x.weight)):metric==='volume'?e.sets.reduce((a,x)=>a+x.weight*x.reps,0):Math.max(...e.sets.map(x=>x.weight*(1+x.reps/30)));return{date:s.date,v}})).sort((a,b)=>a.date.localeCompare(b.date));const svg=$('chart');if(!data.length){svg.innerHTML='<text x="170" y="110" fill="#bfa4ad" text-anchor="middle" font-size="14">No logged data for this exercise yet</text>';$('chartDetail').textContent='Log a workout to start your chart.';return}const W=340,H=220,l=42,r=14,t=18,b=37;let min=Math.min(...data.map(d=>d.v)),max=Math.max(...data.map(d=>d.v));let pad=Math.max(1,(max-min)*.2);min=signed?min-pad:Math.max(0,min-pad);max+=pad;const X=i=>l+(data.length===1?(W-l-r)/2:i*(W-l-r)/(data.length-1));const Y=v=>t+(max-v)/(max-min)*(H-t-b);let path=data.map((d,i)=>`${i?'L':'M'}${X(i).toFixed(1)},${Y(d.v).toFixed(1)}`).join(' ');svg.innerHTML=`<line x1="${l}" y1="${H-b}" x2="${W-r}" y2="${H-b}" stroke="#64424c"/><line x1="${l}" y1="${t}" x2="${l}" y2="${H-b}" stroke="#64424c"/>${[0,.5,1].map(p=>`<text x="${l-7}" y="${Y(min+p*(max-min))+4}" text-anchor="end" fill="#bfa4ad" font-size="10">${Math.round(min+p*(max-min))}</text>`).join('')}<path d="${path}" stroke="#ff6861" stroke-width="3" fill="none"/>${data.map((d,i)=>`<circle cx="${X(i)}" cy="${Y(d.v)}" r="4" fill="#ffc2b8"/>`).join('')}<text x="${l}" y="${H-9}" fill="#bfa4ad" font-size="10">${esc(data[0].date)}</text><text x="${W-r}" y="${H-9}" text-anchor="end" fill="#bfa4ad" font-size="10">${esc(data.at(-1).date)}</text>`;$('chartDetail').textContent=`${data.length} recorded point(s) · Latest: ${Math.round(data.at(-1).v*10)/10} ${metric==='estimated'?'lb estimated 1RM':metric==='volume'?'lb total volume':'lb top weight'}. ${signed?'Negative = assistance; positive = added load. Bodyweight is not included. Volume and estimated 1RM need bodyweight and are unavailable here.':'Estimated 1RM is a rough formula, not a tested max.'}`}
$('historyRoutine').onchange=renderHistory;
$('chartExercise').onchange=renderChart;$('metric').onchange=renderChart;
$('export').onclick=()=>{const blob=new Blob([JSON.stringify({app:'Strength Tracker',version:1,sessions},null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=`strength-tracker-backup-${today()}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)};
$('import').onchange=async e=>{
 const file=e.target.files[0];if(!file)return;
 try{
  if(file.size>20*1024*1024)throw Error('Backup is too large (20 MB maximum)');
  const incoming=WorkoutData.parseBackup(JSON.parse(await file.text()));
  const ids=new Set(sessions.map(s=>s.id));
  const additions=incoming.filter(s=>!isBaseline(s)&&!ids.has(s.id));
  if(!additions.length){alert('No new workouts to import. Existing workout IDs are kept unchanged.');return}
  if(!confirm('Import '+additions.length+' new workouts? Existing workout IDs are kept unchanged.'))return;
  // Validate the entire file before changing any history.
  for(const session of additions){sessions.push(session);queueWrite(session)}
  persist();void syncCloud();renderAll();alert('Backup imported');
 }catch(error){alert('Could not import: '+error.message)}finally{e.target.value=''}
};
$('useLast').onclick=()=>{
 const last=[...sessions].filter(s=>s.routine===$('routine').value&&s.id!==editingId).sort((a,b)=>b.date.localeCompare(a.date)||(b.updatedAt||'').localeCompare(a.updatedAt||''))[0];
 if(!last){alert('No previous workout for this routine yet.');return}
 if(!confirm('Replace these sets with the previous workout? All copied sets start unchecked.'))return;
 const previous=new Map(last.exercises.map(e=>[e.name,e.sets]));
 for(const name of Object.keys(draft)){if(previous.has(name))draft[name]=previous.get(name).map(s=>({...s,completed:false}))}
 collapsedExercises.clear();
 skippedExercises.clear();
 renderExercises();saveDraft();
};
['date','sessionNotes'].forEach(id=>$(id).addEventListener('input',saveDraft));
window.addEventListener('online',()=>{updateSyncBadge();void syncCloud()});
window.addEventListener('offline',updateSyncBadge);
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible'){renderRest();void syncCloud();if(navigator.onLine)appRegistration?.update().catch(()=>{})}});
setInterval(()=>{if(document.visibilityState==='visible')void syncCloud()},60000);
window.addEventListener('error',event=>{if(event.message?.includes('Could not save on this device'))alert(event.message)});

void boot();
