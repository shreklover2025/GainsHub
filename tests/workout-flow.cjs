const {chromium}=require('playwright-core');
const assert=require('node:assert/strict');
const {createServer}=require('../tools/serve.cjs');
(async()=>{
 const server=createServer();await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const url='http://127.0.0.1:'+server.address().port;
 let browser;
 try{
  browser=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
  const context=await browser.newContext({viewport:{width:390,height:844}});
  const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
  let acceptDialogs=true;
  page.on('dialog',dialog=>acceptDialogs?dialog.accept():dialog.dismiss());
  await page.goto(url);await page.locator('[data-routine]').first().click();
  assert.match(await page.locator('#workoutAccount').textContent(),/Guest/);
  await page.evaluate(()=>{
   cloud=null;currentUser={id:'alice',email:'alice@example.invalid'};loadLocal();authUI();switchTab('logger');
   sessions=[{id:'previous',date:'2020-01-01',routine:'Upper Body',exercises:[{name:'Barbell Bench Press',sets:[{weight:100,reps:8}]}]}];
   persist();
  });
  assert.match(await page.locator('#workoutAccount').textContent(),/alice@example.invalid/);
  assert.match(await page.locator('#finishAccount').textContent(),/alice@example.invalid/);
  const first=page.locator('[data-exercise-card]').first();
  await first.locator('[data-field="weight"]').fill('110');await first.locator('[data-field="reps"]').fill('9');
  await first.locator('[data-complete]').check();
  assert.match(await page.locator('#workoutProgress').textContent(),/1 of 8 exercises done/);
  // Skip is reversible, even when completed sets have already been entered.
  await first.getByRole('button',{name:'Skip today'}).click();
  assert.match(await page.locator('#workoutProgress').textContent(),/0 of 8 exercises done · 1 skipped/);
  await first.getByRole('button',{name:'Reopen'}).click();
  assert.equal(await first.locator('[data-field="weight"]').inputValue(),'110');
  assert.equal(await first.locator('[data-complete]').isChecked(),true);
  await first.getByRole('button',{name:'Done',exact:true}).click();
  await page.locator('[data-exercise-card]').nth(1).getByRole('button',{name:'Skip today'}).click();
  await page.locator('#sessionNotes').fill('Preserve across updates');
  await page.reload();
  await page.evaluate(()=>{cloud=null;currentUser={id:'alice',email:'alice@example.invalid'};loadLocal();authUI();switchTab('logger')});
  assert.match(await page.locator('#workoutProgress').textContent(),/1 of 8 exercises done · 1 skipped/);
  assert.equal(await first.locator('.exercise-body').isVisible(),false);
  assert.equal(await page.locator('#sessionNotes').inputValue(),'Preserve across updates');
  await page.locator('[data-exercise-card]').nth(1).getByRole('button',{name:'Reopen'}).click();
  await page.locator('[data-exercise-card]').nth(1).getByRole('button',{name:'Skip today'}).click();
  // Finish button remains in view at either end of a long workout.
  for(const y of [0,10000]){
   await page.evaluate(y=>scrollTo(0,y),y);
   const bounds=await page.locator('#save').boundingBox();assert.ok(bounds.y>=0&&bounds.y+bounds.height<844);
  }
  acceptDialogs=false;await page.locator('#save').click();
  assert.equal(await page.evaluate(()=>sessions.length),1);
  assert.equal(await page.locator('#saveConfirmation').isVisible(),false);
  acceptDialogs=true;
  for(let i=2;i<8;i++)await page.locator('[data-exercise-card]').nth(i).getByRole('button',{name:'Skip today'}).click();
  assert.match(await page.locator('#workoutProgress').textContent(),/1 of 8 exercises done · 7 skipped · Ready to save/);
  await page.locator('#save').click();
  assert.equal(await page.locator('#saveConfirmation').isVisible(),true);
  assert.match(await page.locator('#saveConfirmationText').textContent(),/1 exercises · 1 sets saved · 7 skipped/);
  assert.match(await page.locator('#recordHighlights').textContent(),/Highest weight: 110 lb/);
  const saved=await page.evaluate(()=>sessions.find(s=>s.id!=='previous'));
  assert.equal(saved.exercises.length,1);assert.equal(saved.skippedExercises.length,7);assert.equal(saved.skippedExercises[0],'Barbell Bent-Over Row');
  assert.match(await page.locator('#historyList').textContent(),/Skipped today: Barbell Bent-Over Row/);
  assert.equal(await page.evaluate(()=>WorkoutData.normalizeSession(sessions.find(s=>s.id!=='previous')).skippedExercises[0]),'Barbell Bent-Over Row');
  // A real service-worker update must preserve a guest draft without closing all tabs.
  await page.evaluate(()=>{currentUser=null;loadLocal();authUI();startNew('Upper Body');switchTab('logger')});
  await first.locator('[data-field="weight"]').fill('125');await first.locator('[data-field="reps"]').fill('7');
  await first.locator('[data-complete]').check();await first.getByRole('button',{name:'Done',exact:true}).click();
  await page.locator('[data-exercise-card]').nth(1).getByRole('button',{name:'Skip today'}).click();
  await page.locator('#sessionNotes').fill('Update keeps this draft');
  await page.evaluate(()=>navigator.serviceWorker.ready);
  await page.waitForFunction(()=>navigator.serviceWorker.controller&&appRegistration);
  // A distinct script URL on the same scope installs a waiting worker using the real lifecycle.
  await page.evaluate(()=>navigator.serviceWorker.register('./sw.js?update-test=1',{scope:'./',updateViaCache:'none'}));
  await page.waitForFunction(()=>appRegistration.waiting!==null);
  await page.locator('#updateApp').waitFor({state:'visible'});
  await Promise.all([page.waitForEvent('load'),page.locator('#updateApp').click()]);
  await page.waitForFunction(()=>!document.querySelector('#logger').classList.contains('hide'));
  assert.equal(await page.locator('#sessionNotes').inputValue(),'Update keeps this draft');
  assert.match(await page.locator('#workoutProgress').textContent(),/1 of 8 exercises done · 1 skipped/);
  assert.equal(await first.locator('.exercise-body').isVisible(),false);
  await first.getByRole('button',{name:'Reopen'}).click();assert.equal(await first.locator('[data-field="weight"]').inputValue(),'125');
  const finish=await page.locator('#save').boundingBox();assert.ok(finish.y>=0&&finish.y+finish.height<844,JSON.stringify(finish));
  require('node:fs').mkdirSync('test-results',{recursive:true});
  await page.screenshot({path:'test-results/workout-mobile.png'});
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,JSON.stringify(await page.evaluate(()=>[...document.querySelectorAll('body *')].filter(el=>el.getBoundingClientRect().right>innerWidth+1).map(el=>({tag:el.tagName,id:el.id,class:el.className,right:el.getBoundingClientRect().right})).slice(0,15))));
  await page.setViewportSize({width:1440,height:1000});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  assert.deepEqual(errors,[]);
  console.log('PASS: progress, skip/reopen and draft recovery, active account, fixed finish button, save confirmation and records, skipped backup data, real waiting-worker update with draft preservation.');
  await context.close();
 }finally{if(browser)await browser.close();await new Promise(resolve=>server.close(resolve))}
})().catch(error=>{console.error(error);process.exitCode=1});
