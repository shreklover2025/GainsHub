const {chromium}=require('playwright-core');
const assert=require('node:assert/strict');
const {createServer}=require('../tools/serve.cjs');
const {fake}=require('./fake-cloud.cjs');
(async()=>{
 const server=createServer();await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const url='http://127.0.0.1:'+server.address().port;
 let browser;
 try{
  browser=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
  const context=await browser.newContext({viewport:{width:390,height:844}});
  const page=await context.newPage();const errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  page.on('dialog',dialog=>dialog.accept());
  await page.goto(url);await page.waitForFunction(()=>document.querySelector('#totalSessions').textContent==='0');
  await page.getByRole('button',{name:'Guide',exact:true}).click();
  assert.equal(await page.locator('#guide').isVisible(),true);
  assert.match(await page.locator('#guide').innerText(),/Done and Skip today do not save a workout to History/);
  assert.equal(await page.locator('#dashboard').isVisible(),false);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  await page.locator('[data-tab="dashboard"]').click();
  await page.locator('[data-routine]').first().click();
  const weight=page.locator('#exerciseList [data-field="weight"]').first();
  const reps=page.locator('#exerciseList [data-field="reps"]').first();
  await weight.fill('135');await reps.fill('8');
  const firstExercise=page.locator('[data-exercise-card]').first();
  await firstExercise.getByRole('button',{name:'Done',exact:true}).click();
  assert.equal(await firstExercise.locator('.exercise-body').isVisible(),true);
  await page.locator('#exerciseList [data-complete]').first().check();
  await firstExercise.getByRole('button',{name:'Done',exact:true}).click();
  assert.equal(await firstExercise.locator('.exercise-body').isVisible(),false);
  assert.match(await firstExercise.locator('[data-done-summary]').textContent(),/1 set completed/);
  assert.equal(await page.locator('[data-exercise-card]').nth(1).locator('.exercise-body').isVisible(),true);
  await page.locator('#sessionNotes').fill('Recovered draft');
  await page.reload();await page.locator('[data-tab="logger"]').click();
  assert.equal(await firstExercise.locator('.exercise-body').isVisible(),false);
  await firstExercise.getByRole('button',{name:'Reopen',exact:true}).click();
  assert.equal(await firstExercise.locator('.exercise-body').isVisible(),true);
  assert.equal(await reps.inputValue(),'8');assert.equal(await weight.inputValue(),'135');
  assert.equal(await page.locator('#sessionNotes').inputValue(),'Recovered draft');
  assert.equal(await page.locator('#exerciseList [data-complete]').first().isChecked(),true);
  await firstExercise.getByRole('button',{name:'Done',exact:true}).click();
  await page.locator('#save').click();
  assert.equal(await page.locator('#totalSessions').textContent(),'1');
  assert.match(await page.locator('#historyList').innerText(),/135 lb × 8/);
  await page.locator('[data-tab="dashboard"]').click();await page.locator('[data-routine]').first().click();
  await page.locator('#useLast').click();assert.equal(await reps.inputValue(),'8');
  assert.equal(await page.locator('[data-reference="Barbell Bench Press"]').textContent(),'Reference: 135 lb');
  assert.equal(await page.locator('#exerciseList [data-complete]').first().isChecked(),false);
  const before=await page.evaluate(()=>sessions.length);
  await page.locator('[data-tab="history"]').click();
  await page.locator('#import').setInputFiles({name:'bad.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify({sessions:[{id:'bad',date:'2026-11-06',routine:'Test',exercises:[{name:'Test',sets:[{weight:'<img>',reps:8}]}]}]}))});
  assert.equal(await page.evaluate(()=>sessions.length),before);
  // Exercise the complete app's conflict flow against a deterministic in-memory API.
  await page.addScriptTag({content:fake.toString()});
  await page.evaluate(()=>{
   for(const routine of ['Lower — Squat Focus','Lower — Deadlift Focus']){
    resetWorkout(routine);
    draft['Calf Raises']=[{weight:'200',reps:'12',completed:true}];
    delete draft['Seated Calf Raises'];
    $('sessionNotes').value='Older draft';saveDraft();loadLocal();
    if(!document.querySelector('[data-reference="Seated Calf Raises"]'))throw Error('New exercise missing from restored lower-body draft');
    if(!draft['Standing Calf Raises'].some(set=>set.weight==='200'&&set.reps==='12'&&set.completed)||draft['Calf Raises']||$('sessionNotes').value!=='Older draft')throw Error('Routine rename lost draft entries');
    if(progressionFor('Standing Calf Raises').target!==15||progressionFor('Seated Calf Raises').target!==15)throw Error('Calf exercises must both target 15 reps');
    if(draft['Seated Calf Raises'][0].weight!=='')throw Error('New exercise should not assume a starting weight');
   }
   clearDraft();resetWorkout('Upper Body');$('useLast').click();
  });
  // History arrives after the logger is open and the user has begun entering sets.
  await page.evaluate(async()=>{
   cloud=null;currentUser={id:'delayed-history',email:'delayed@example.invalid'};loadLocal();
   resetWorkout('Upper Body');switchTab('logger');
   const hint=document.querySelector('[data-exercise-hint="Barbell Bench Press"]');
   if(!hint.textContent.includes('No previous saved sets'))throw Error('Missing empty history message');
   const input=document.querySelector('#exerciseList [data-field="reps"]');input.value='7';input.dispatchEvent(new Event('input'));input.focus();
   const row={id:'downloaded',user_id:currentUser.id,updated_at:new Date().toISOString(),session:{id:'downloaded',date:today(),routine:'Upper Body',notes:'',exercises:[{name:'Barbell Bench Press',sets:[{weight:175,reps:9}]}]}};
   cloud=fake([row]);const originalRead=WorkoutSync.readRows;let release;
   WorkoutSync.readRows=()=>new Promise(resolve=>{release=resolve});
   const syncing=syncCloud();
   if(hint.textContent.includes('LAST LOGGED'))throw Error('History displayed before download');
   release([row]);WorkoutSync.readRows=originalRead;await syncing;
   if(!hint.textContent.includes('LAST LOGGED')||!hint.textContent.includes('175 lb × 9'))throw Error('Delayed history did not refresh automatically');
   if(document.querySelector('#exerciseList [data-field="reps"]')!==input||input.value!=='7'||document.activeElement!==input)throw Error('History refresh disrupted active input');
   row.session.exercises[0].sets=[{weight:180,reps:8}];await syncCloud();
   if(!hint.textContent.includes('180 lb × 8'))throw Error('Later sync did not refresh last logged');
   row.session.deleted=true;await syncCloud();
   if(hint.textContent.includes('LAST LOGGED')||!hint.textContent.includes('No previous saved sets'))throw Error('Deleted workout stayed visible in last logged');
   currentUser={id:'second-person',email:'second@example.invalid'};loadLocal();
   if(document.querySelector('[data-exercise-hint="Barbell Bench Press"]').textContent.includes('LAST LOGGED'))throw Error('Previous account history leaked into logger');
  });
  await page.evaluate(async()=>{
   const workout={id:'shared',date:'2026-11-06',routine:'Upper Body',notes:'Remote edit',exercises:[{name:'Bench',sets:[{weight:150,reps:8}]}]};
   const rows=[{id:'shared',user_id:'test-user',updated_at:'2026-11-06T12:00:00.000Z',session:workout}];
   cloud=fake(rows);currentUser={id:'test-user',email:'test@example.invalid'};knownVersions={shared:'2026-11-06T10:00:00.000Z'};pendingWrites={};sessions=[workout];
   queueWrite({...workout,notes:'Device edit'});await syncCloud();
   await new Promise(resolve=>setTimeout(resolve,100));
   if(rows.find(r=>r.id==='shared').session.notes!=='Remote edit')throw Error('Remote overwritten');
   if(!sessions.some(s=>s.notes.includes('Device edit')))throw Error('Device edit lost');
   if(sessions.length!==2)throw Error('Expected both versions');
  });
  await page.waitForFunction(()=>!syncBusy);
  assert.match(await page.locator('#syncNotice').textContent(),/conflict/);
  await page.evaluate(async()=>{
   const workout={id:'open-edit',date:'2026-11-06',routine:'Upper Body',notes:'Original',exercises:[{name:'Barbell Bench Press',sets:[{weight:150,reps:8}]}]};
   const oldVersion='2026-11-06T10:00:00.000Z';
   const rows=[{id:workout.id,user_id:currentUser.id,updated_at:oldVersion,session:structuredClone(workout)}];
   cloud=fake(rows);knownVersions={[workout.id]:oldVersion};pendingWrites={};sessions=[workout];draftDirty=false;
   editSession(workout.id);
   rows[0].updated_at='2026-11-06T12:00:00.000Z';rows[0].session.notes='New remote edit';
   await syncCloud();
   $('sessionNotes').value='Unsaved open edit';saveDraft();$('save').click();
   await new Promise(resolve=>setTimeout(resolve,100));
   if(rows[0].session.notes!=='New remote edit')throw Error('Background sync let an open edit overwrite remote changes');
   if(!sessions.some(s=>s.notes.includes('Unsaved open edit')))throw Error('Open edit was lost');
   // A stale deletion must not delete a newer workout.
   knownVersions[workout.id]=oldVersion;cloudDelete(workout.id);
   await new Promise(resolve=>setTimeout(resolve,100));
   if(!sessions.some(s=>s.id===workout.id))throw Error('Conflicting deletion removed remote workout');
   if(rows[0].session.deleted)throw Error('Conflicting deletion reached cloud');
   $('sessionNotes').value='Account-specific unfinished workout';saveDraft();
   currentUser=null;loadLocal();
   if($('sessionNotes').value==='Account-specific unfinished workout')throw Error('Account draft leaked into guest');
   currentUser={id:'test-user',email:'test@example.invalid'};loadLocal();
   if($('sessionNotes').value!=='Account-specific unfinished workout')throw Error('Account draft did not restore');
   // A failed request keeps the outbox, then reconnect uploads it.
   const retryWorkout={...workout,id:'retry-workout',notes:'Saved through reconnect'};
   queueWrite(retryWorkout,null);cloud={from(){throw Error('Simulated network interruption')}};
   await syncCloud();
   if(!pendingWrites[retryWorkout.id]||!retryTimer)throw Error('Failed sync lost queue or did not schedule retry');
   cloud=fake(rows);window.dispatchEvent(new Event('online'));
   await new Promise(resolve=>setTimeout(resolve,100));
   if(pendingWrites[retryWorkout.id]||!rows.some(r=>r.id===retryWorkout.id))throw Error('Reconnect did not flush queue');
   // A response for the old account must never populate a newly selected guest view.
   const originalRead=WorkoutSync.readRows;let release;
   WorkoutSync.readRows=()=>new Promise(resolve=>{release=resolve});
   const syncing=syncCloud();currentUser=null;loadLocal();release(rows);await syncing;
   WorkoutSync.readRows=originalRead;
   if(sessions.some(s=>s.id==='retry-workout'))throw Error('In-flight response crossed account boundary');
  });
  // Return to guest mode so offline test does not require a real account.
  await page.evaluate(()=>{cloud=null;currentUser=null;loadLocal()});
  await page.evaluate(()=>navigator.serviceWorker.ready);
  await page.waitForFunction(()=>navigator.serviceWorker.controller!==null);
  await context.setOffline(true);await page.reload();
  await page.waitForFunction(()=>document.querySelector('#totalSessions').textContent==='1');
  await page.locator('[data-tab="guide"]').click();assert.equal(await page.locator('#guide').isVisible(),true);
  await page.locator('[data-tab="logger"]').click();assert.equal(await reps.inputValue(),'8');
  await page.locator('#exerciseList [data-complete]').first().check();await page.locator('#save').click();
  assert.equal(await page.locator('#totalSessions').textContent(),'2');
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  await page.setViewportSize({width:1440,height:1000});
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  assert.deepEqual(errors,[]);
  console.log('PASS: mobile/desktop layout, draft recovery, completed sets, use-last, invalid imports, conflict preservation, stale open edits, conflicting deletions, retry/reconnect, account isolation including in-flight responses, offline reload and saving.');
  await context.close();
 }finally{if(browser)await browser.close();await new Promise(resolve=>server.close(resolve))}
})().catch(error=>{console.error(error);process.exitCode=1});
