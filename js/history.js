/* Compact history; presentation state is separate from saved workout data. */
let historyOwner=null;
let expandedHistory=new Set();
function historyDate(date,monthOnly=false){
 const [year,month,day]=date.split('-').map(Number);
 return new Intl.DateTimeFormat(undefined,monthOnly?{month:'long',year:'numeric'}:{month:'short',day:'numeric',year:'numeric'})
  .format(new Date(year,month-1,monthOnly?1:day,12));
}
function historyTable(session){
 const exercises=session.exercises.filter(exercise=>exercise.sets.length);
 if(!exercises.length)return '<p class="mini muted">No individual sets recorded.</p>';
 return `<table class="history-table"><caption class="visually-hidden">${esc(session.routine)} on ${esc(session.date)} — recorded sets</caption><thead><tr><th scope="col">Exercise</th><th scope="col">Set</th><th scope="col">Weight</th><th scope="col">Reps</th></tr></thead>${exercises.map(exercise=>`<tbody>${exercise.sets.map((set,index)=>`<tr>${index===0?`<th scope="rowgroup" rowspan="${exercise.sets.length}">${esc(exercise.name)}${exercise.name==='Assisted Pull-Ups'?'<small>Assistance</small>':exercise.name==='Chest Dips'?'<small>Added load</small>':/Dumbbell/.test(exercise.name)?'<small>Per dumbbell</small>':''}</th>`:''}<td>${index+1}</td><td>${esc(set.weight)} lb</td><td>${esc(set.reps)}</td></tr>`).join('')}</tbody>`).join('')}</table>`;
}
function renderHistory(){
 const owner=currentUser?.id||'guest';
 if(historyOwner!==owner){historyOwner=owner;expandedHistory.clear();$('historyRoutine').value=''}
 const selected=$('historyRoutine').value;
 const routines=[...new Set(sessions.map(session=>session.routine))].sort((a,b)=>a.localeCompare(b));
 $('historyRoutine').innerHTML='<option value="">All routines</option>'+routines.map(routine=>`<option value="${esc(routine)}">${esc(routine)}</option>`).join('');
 $('historyRoutine').value=routines.includes(selected)?selected:'';
 const filtered=sessions.filter(session=>!$('historyRoutine').value||session.routine===$('historyRoutine').value)
  .slice().sort((a,b)=>b.date.localeCompare(a.date)||(b.updatedAt||'').localeCompare(a.updatedAt||'')||a.id.localeCompare(b.id));
 const groups=new Map();
 for(const session of filtered){const month=session.date.slice(0,7);if(!groups.has(month))groups.set(month,[]);groups.get(month).push(session)}
 $('historyCount').textContent=filtered.length+' saved workout'+(filtered.length===1?'':'s');
 $('historyList').innerHTML=[...groups].map(([month,workouts])=>`<div class="history-month" data-month="${esc(month)}"><h3 class="history-month-title">${esc(historyDate(workouts[0].date,true))}</h3>${workouts.map(session=>{
  const exercises=session.exercises.filter(exercise=>exercise.sets.length);
  const sets=exercises.reduce((count,exercise)=>count+exercise.sets.length,0);
  return `<details class="card history-card" data-history-id="${esc(session.id)}" ${expandedHistory.has(session.id)?'open':''}><summary class="history-summary"><span class="history-routine">${esc(session.routine)}</span><span class="history-meta"><time datetime="${esc(session.date)}">${esc(historyDate(session.date))}</time> · ${exercises.length} exercise${exercises.length===1?'':'s'} · ${sets} set${sets===1?'':'s'}</span><span class="history-toggle"><span class="history-show">View workout</span><span class="history-hide">Hide workout</span><span aria-hidden="true" class="history-chevron">⌄</span></span></summary><div class="history-body">${historyTable(session)}${session.ranges?.length?`<details class="history-legacy"><summary>Additional records (set counts unspecified)</summary>${session.ranges.map(exercise=>`<p class="mini">${esc(exercise.name)}: ${esc(exercise.weight)} lb × ${esc(exercise.reps)}; sets ${esc(exercise.sets)}</p>`).join('')}</details>`:''}${session.notes?`<div class="history-notes"><h4>Notes</h4><p>${esc(session.notes)}</p></div>`:''}${session.skippedExercises?.length?`<p class="mini muted">Skipped today: ${session.skippedExercises.map(esc).join(', ')}</p>`:''}<div class="row history-actions"><button class="secondary" data-edit="${esc(session.id)}">Edit</button><button class="danger" data-delete="${esc(session.id)}">Delete</button></div></div></details>`;
 }).join('')}</div>`).join('')||'<div class="card empty">'+(sessions.length?'No workouts for this routine.':'No workouts yet.<br>Your saved sessions will appear here.')+'</div>';
 document.querySelectorAll('[data-history-id]').forEach(details=>details.addEventListener('toggle',()=>{
  if(!details.isConnected)return;
  if(details.open)expandedHistory.add(details.dataset.historyId);else expandedHistory.delete(details.dataset.historyId);
 }));
 document.querySelectorAll('#historyList [data-edit]').forEach(button=>button.onclick=()=>editSession(button.dataset.edit));
 document.querySelectorAll('#historyList [data-delete]').forEach(button=>button.onclick=()=>{
  if(confirm('Delete this workout?')){expandedHistory.delete(button.dataset.delete);cloudDelete(button.dataset.delete)}
 });
}
