const {chromium}=require('playwright-core');
const assert=require('node:assert/strict');
const {createServer}=require('../tools/serve.cjs');
(async()=>{
 const server=createServer();await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));let browser;
 try{
  browser=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
  const page=await browser.newPage({viewport:{width:393,height:852}});const errors=[];page.on('pageerror',error=>errors.push(error.message));
  page.on('dialog',dialog=>dialog.accept());
  await page.goto('http://127.0.0.1:'+server.address().port);
  await page.evaluate(()=>{
   currentUser={id:'logger-test',email:'logger@example.invalid'};cloud=null;loadLocal();authUI();switchTab('logger');
   sessions=[{id:'prior',date:today(),routine:'Upper Body',exercises:[{name:'Barbell Bench Press',sets:[{weight:100,reps:8}]}]}];initDraft('Upper Body');
   window.setPayloads=[];window.replies=[];
   cloud={from(table){if(table!=='workout_sessions')throw Error('Wrong table');return{upsert(payload,options){window.setPayloads.push({payload,options});return new Promise(resolve=>window.replies.push(resolve))}}}};
  });
  const first=page.locator('[data-exercise-card]').first();const checkbox=first.locator('[data-complete]').first();
  assert.equal(await first.locator('.previous-set').textContent(),'100 × 8');
  await first.locator('[data-field="weight"]').fill('105');await first.locator('[data-field="reps"]').fill('9');
  await checkbox.check();
  assert.equal(await first.locator('[data-rest-for]').isVisible(),true);
  await first.locator('[data-rest-stop]').click();
  assert.equal(await first.locator('[data-rest-for]').isVisible(),false);
  assert.equal(await first.locator('.setrow').evaluate(row=>row.classList.contains('is-complete')),true);
  await first.locator('.check-spinner').waitFor({state:'visible'});
  assert.equal(await checkbox.getAttribute('aria-busy'),'true');
  const payload=await page.evaluate(()=>setPayloads[0]);
  assert.equal(payload.payload.user_id,'logger-test');assert.equal(payload.payload.session.kind,'live-workout');
  assert.deepEqual(payload.payload.session.exercises[0].sets,[{weight:105,reps:9}]);
  assert.equal(payload.options.onConflict,'user_id,id');
  await page.evaluate(()=>replies.shift()({error:null}));await page.waitForFunction(()=>pendingSetWrites.size===0);
  assert.equal(await first.locator('.check-spinner').isVisible(),false);assert.equal(await checkbox.isChecked(),true);
  await checkbox.uncheck();await page.evaluate(()=>replies.shift()({error:null}));await page.waitForFunction(()=>pendingSetWrites.size===0);
  await checkbox.check();await page.evaluate(()=>replies.shift()({error:{code:'42501',message:'RLS denied'}}));await page.waitForFunction(()=>pendingSetWrites.size===0);
  assert.equal(await checkbox.isChecked(),false);assert.equal(await first.locator('[data-field="weight"]').inputValue(),'105');
  assert.match(await page.locator('#setWriteError').textContent(),/permission/);
  assert.equal(await first.locator('.setrow').evaluate(row=>row.classList.contains('is-complete')),false);
  // Successful requests under 150 ms never show a spinner.
  await page.evaluate(()=>{cloud={from(){return{upsert(){return Promise.resolve({error:null})}}}}});
  await checkbox.check();await page.waitForFunction(()=>pendingSetWrites.size===0);
  assert.equal(await first.locator('.check-spinner').isVisible(),false);
  assert.equal(await first.locator('[data-rest-for]').isVisible(),true);
  await page.evaluate(()=>{restDeadline=Date.now()-1;renderRest()});
  assert.equal(await first.locator('[data-rest-for]').isVisible(),false);
  await checkbox.uncheck();await page.waitForFunction(()=>pendingSetWrites.size===0);
  await checkbox.check();await page.waitForFunction(()=>pendingSetWrites.size===0);
  assert.equal(await first.locator('[data-rest-for]').isVisible(),true);
  const second=page.locator('[data-exercise-card]').nth(1);
  await second.locator('[data-field="weight"]').fill('100');await second.locator('[data-field="reps"]').fill('8');
  await second.locator('[data-complete]').check();await page.waitForFunction(()=>pendingSetWrites.size===0);
  assert.equal(await first.locator('[data-rest-for]').isVisible(),false);
  assert.equal(await second.locator('[data-rest-for]').isVisible(),true);
  await second.getByRole('button',{name:'Done',exact:true}).click();
  assert.equal(await second.locator('[data-rest-for]').isVisible(),true);
  await second.locator('[data-rest-stop]').click();assert.equal(await second.locator('[data-rest-for]').isVisible(),false);
  await first.locator('.exercise-menu>summary').click();await first.locator('[data-menu-add]').click();
  assert.equal(await first.locator('.setrow').count(),2);
  await first.locator('.exercise-menu>summary').click();await first.locator('[data-menu-remove][data-set-index="1"]').click();
  assert.equal(await first.locator('.setrow').count(),1);
  await page.evaluate(()=>{cloud=null;resetWorkout('Upper Body');sessions=[]});
  for(const name of ['Pull-Ups','Chest Dips']){
   const card=page.locator('[data-exercise-card="'+name+'"]');
   await card.locator('[data-load-sign="-1"]').click();
   await card.locator('[data-field="weight"]').fill('40');await card.locator('[data-field="reps"]').fill('8');
   await card.locator('[data-complete]').check();
   assert.equal(await card.locator('[data-complete]').isChecked(),true);
   await card.getByRole('button',{name:'Done',exact:true}).click();
  }
  await page.locator('#save').click();
  assert.deepEqual(await page.evaluate(()=>sessions[0].exercises.map(exercise=>exercise.sets[0].weight)),[-40,-40]);
  assert.equal(await page.evaluate(()=>sessions[0].weightConvention),'signed-v1');
  await page.evaluate(()=>{
   if(progressionFor('Pull-Ups').last.exercise.sets[0].weight!==-40)throw Error('Signed history lost');
   $('chartExercise').value='Pull-Ups';$('metric').value='estimated';renderChart();
   if($('metric').value!=='top'||!$('chartDetail').textContent.includes('Negative = assistance'))throw Error('Signed chart uses invalid 1RM formula');
   switchTab('logger');
  });
  const pull=page.locator('[data-exercise-card="Pull-Ups"]');
  assert.equal(await pull.locator('[data-load-sign="-1"]').getAttribute('aria-pressed'),'true');
  await pull.locator('[data-load-sign="1"]').click();
  await pull.locator('[data-field="weight"]').fill('45');await pull.locator('[data-field="reps"]').fill('8');
  await pull.locator('[data-complete]').check();await page.locator('#save').click();
  assert.equal(await page.evaluate(()=>sessions.at(-1).exercises[0].sets[0].weight),45);
  assert.equal(await page.evaluate(()=>WorkoutData.normalizeSession(sessions.at(-1)).exercises[0].sets[0].weight),45);
  await page.locator('[data-history-id]').first().locator('summary').first().click();
  assert.match(await page.locator('#historyList').textContent(),/\+45 lb/);
  await page.locator('[data-tab="logger"]').click();
  for(const width of [320,393,768,1440]){
   await page.setViewportSize({width,height:900});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  }
  await page.setViewportSize({width:393,height:852});await first.scrollIntoViewIfNeeded();
  require('node:fs').mkdirSync('test-results',{recursive:true});await page.screenshot({path:'test-results/logger-dark.png'});
  assert.deepEqual(errors,[]);
  console.log('PASS: previous sets, optimistic completion, delayed spinner, SDK payload, RLS rollback, per-exercise rest timer stop/expiry/restart and transfer, menu actions, responsive logger.');
 }finally{if(browser)await browser.close();await new Promise(resolve=>server.close(resolve))}
})().catch(error=>{console.error(error);process.exitCode=1});
