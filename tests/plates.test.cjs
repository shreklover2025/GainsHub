const {test}=require('node:test');
const assert=require('node:assert/strict');
require('../js/plates.js');
test('bench examples show exact counts on each side, excluding 35 lb plates',()=>{
 const a=PlateLoading.plan('Barbell Bench Press',225),b=PlateLoading.plan('Barbell Bench Press',205);
 assert.equal(a.perSide,90);assert.equal(PlateLoading.describe(a.plates),'2 x 45 lb plates');
 assert.equal(b.perSide,80);assert.equal(PlateLoading.describe(b.plates),'1 x 45 lb plate, 1 x 25 lb plate, and 1 x 10 lb plate');
});
test('35 lb plates are restricted to the six specified barbell exercises',()=>{
 const allowed=['Barbell Back Squat','Romanian Deadlift','Conventional Deadlift','Barbell Bulgarian Split Squat','Barbell Bent-Over Row','Barbell Overhead Press'];
 for(const [name,profile] of Object.entries(PlateLoading.profiles))assert.equal(profile.plates.includes(35),allowed.includes(name),name);
 const sixtyPerSide=PlateLoading.plan('Romanian Deadlift',165);
 assert.deepEqual(sixtyPerSide.plates,[{weight:35,count:1},{weight:25,count:1}]);
});
test('machine totals include starting resistance and split added load evenly',()=>{
 assert.equal(PlateLoading.plan('Seated Calf Raises',150).perSide,45);
 assert.equal(PlateLoading.plan('Belt Squat Machine',248).perSide,90);
 assert.equal(PlateLoading.plan('Seated Calf Raises',60).plates.length,0);
 assert.equal(PlateLoading.plan('Belt Squat Machine',68).plates.length,0);
});
test('blank, unconfigured, invalid and unreachable weights are explicit',()=>{
 assert.equal(PlateLoading.plan('Barbell Bench Press',''),null);
 assert.equal(PlateLoading.plan('Standing Calf Raises',200),null);
 assert.equal(PlateLoading.plan('Barbell Bench Press',NaN),null);
 assert.equal(PlateLoading.plan('Barbell Bench Press',40).kind,'below-base');
 const odd=PlateLoading.plan('Barbell Bench Press',207.5);assert.equal(odd.kind,'inexact');assert.equal(odd.lower,205);assert.equal(odd.upper,210);
 assert.equal(PlateLoading.plan('Barbell Bench Press',1e9).kind,'too-large');
});
test('all exact plans reconstruct the requested total and only use allowed plates',()=>{
 for(const [name,profile] of Object.entries(PlateLoading.profiles))for(let extra=0;extra<=600;extra+=5){
  const target=profile.base+extra,plan=PlateLoading.plan(name,target);
  assert.equal(plan.kind,'exact');
  assert.equal(plan.plates.reduce((sum,p)=>sum+p.weight*p.count,0)*2+profile.base,target);
  assert.ok(plan.plates.every(p=>profile.plates.includes(p.weight)&&p.count>0));
 }
});
