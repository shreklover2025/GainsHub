const http=require('node:http');
const fs=require('node:fs');
const {chromium}=require('playwright-core');
const assert=require('node:assert/strict');
const {createServer}=require('../tools/serve.cjs');
(async()=>{
 let version=1,cssRequests=0,browser;
 const fallback=createServer();
 const server=http.createServer((req,res)=>{
  const path=new URL(req.url,'http://localhost').pathname;
  if(path==='/styles.css'){
   cssRequests++;res.writeHead(200,{'Content-Type':'text/css','Cache-Control':'public, max-age=3600'});
   return res.end(fs.readFileSync('styles.css','utf8')+`\n:root{--update-cache-test:version${version}}`);
  }
  if(path==='/sw.js'){
   res.writeHead(200,{'Content-Type':'text/javascript','Cache-Control':'no-store'});
   return res.end(fs.readFileSync('sw.js','utf8').replace(/gainshub-shell-v\d+/,'gainshub-shell-cache-test-'+version));
  }
  fallback.emit('request',req,res);
 });
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 try{
  browser=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
  const page=await browser.newPage({viewport:{width:393,height:852}});
  await page.goto('http://127.0.0.1:'+server.address().port);
  await page.waitForFunction(()=>navigator.serviceWorker.controller&&appRegistration);
  assert.equal(await page.evaluate(()=>getComputedStyle(document.documentElement).getPropertyValue('--update-cache-test').trim()),'version1');
  const initialRequests=cssRequests;version=2;
  await page.evaluate(()=>appRegistration.update());
  await page.waitForFunction(()=>appRegistration.waiting);
  assert.ok(cssRequests>initialRequests,'Update must fetch CSS again despite the one-hour browser cache');
  await Promise.all([page.waitForEvent('load'),page.locator('#updateApp').click()]);
  await page.waitForFunction(()=>getComputedStyle(document.documentElement).getPropertyValue('--update-cache-test').trim()==='version2');
  console.log('PASS: worker update replaces a stylesheet cached for one hour with the fresh version.');
 }finally{if(browser)await browser.close();await new Promise(resolve=>server.close(resolve))}
})().catch(error=>{console.error(error);process.exitCode=1});
