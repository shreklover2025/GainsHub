/* Gym-specific loading rules. Totals include the unloaded bar/machine weight. */
(function(root){
 'use strict';
 const standardPlates=Object.freeze([45,25,10,5,2.5]);
 const with35=new Set(['Barbell Back Squat','Romanian Deadlift','Conventional Deadlift','Barbell Bulgarian Split Squat','Barbell Bent-Over Row','Barbell Overhead Press']);
 const barbells=['Barbell Bench Press','Barbell Incline Bench Press',...with35];
 const profiles=Object.fromEntries(barbells.map(name=>[name,Object.freeze({base:45,sides:2,equipment:'bar',plates:Object.freeze(with35.has(name)?[45,35,25,10,5,2.5]:[...standardPlates])})]));
 profiles['Seated Calf Raises']=Object.freeze({base:60,sides:2,equipment:'machine',plates:standardPlates});
 profiles['Belt Squat Machine']=Object.freeze({base:68,sides:2,equipment:'machine',plates:standardPlates});
 function combination(amount,plates){
  const ticks=Math.round(amount/2.5);
  const best=Array(ticks+1).fill(Infinity),choice=Array(ticks+1).fill(0);best[0]=0;
  for(let sum=1;sum<=ticks;sum++)for(const plate of plates){
   const units=plate/2.5;
   if(units<=sum&&best[sum-units]+1<best[sum]){best[sum]=best[sum-units]+1;choice[sum]=plate}
  }
  const counts=new Map();
  for(let sum=ticks;sum>0;){const plate=choice[sum];if(!plate)throw Error('Unreachable plate load');counts.set(plate,(counts.get(plate)||0)+1);sum-=plate/2.5}
  return plates.filter(plate=>counts.has(plate)).map(plate=>({weight:plate,count:counts.get(plate)}));
 }
 function plan(name,value){
  const profile=profiles[name];if(!profile||value===''||value===null||value===undefined)return null;
  const total=Number(value);if(!Number.isFinite(total))return null;
  if(total<profile.base)return {kind:'below-base',profile,total,minimum:profile.base};
  const step=profile.sides*2.5,units=(total-profile.base)/step;
  if(units>10000)return {kind:'too-large',profile,total};
  if(Math.abs(units-Math.round(units))>1e-8){
   return {kind:'inexact',profile,total,lower:profile.base+Math.floor(units)*step,upper:profile.base+Math.ceil(units)*step};
  }
  const perSide=Math.round(units)*2.5;
  return {kind:'exact',profile,total,perSide,plates:combination(perSide,profile.plates)};
 }
 function describe(plates){
  const parts=plates.map(({weight,count})=>count+' x '+weight+' lb plate'+(count===1?'':'s'));
  if(parts.length<2)return parts[0]||'No plates needed';
  if(parts.length===2)return parts.join(' and ');
  return parts.slice(0,-1).join(', ')+', and '+parts.at(-1);
 }
 root.PlateLoading={profiles:Object.freeze(profiles),plan,describe};
})(globalThis);

function plateGuideMarkup(name,weight,index){
 const plan=PlateLoading.plan(name,weight);
 if(!plan)return '';
 const id='plate-guide-'+Object.keys(draft).indexOf(name)+'-'+index;
 if(plan.kind==='below-base')return `<div class="plate-guide plate-guide-warning" id="${id}">Minimum total: ${plan.minimum} lb, including the ${plan.profile.equipment} starting weight.</div>`;
 if(plan.kind==='too-large')return `<div class="plate-guide plate-guide-warning" id="${id}">Weight exceeds the plate guide’s calculation range.</div>`;
 if(plan.kind==='inexact')return `<div class="plate-guide plate-guide-warning" id="${id}">This total cannot be loaded evenly with your gym’s plates. Nearest totals: <strong>${plan.lower} lb</strong> or <strong>${plan.upper} lb</strong>.</div>`;
 return `<div class="plate-guide" id="${id}"><strong>${plan.profile.base} lb ${plan.profile.equipment==='bar'?'bar':'machine starting weight'} + ${plan.perSide} lb per side</strong><span>Each side: <b>${PlateLoading.describe(plan.plates)}</b></span></div>`;
}
function updatePlateGuide(name,index){
 const parent=$('sets-'+Object.keys(draft).indexOf(name));
 const target=parent?.querySelector('[data-plate-for="'+index+'"]');
 if(target)target.innerHTML=plateGuideMarkup(name,draft[name][index].weight,index);
}
