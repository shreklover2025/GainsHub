/* Simulates the subset of Supabase used by conditional writes; no network calls. */
function fake(rows){
 return {from(table){
  if(table!=='workout_sessions')throw Error('Unexpected table');
  let operation='read',payload,filters=[],start=0,end=499;
  const q={
   select(){return q},order(){return q},range(a,b){start=a;end=b;return q},
   eq(k,v){filters.push([k,v]);return q},
   update(v){operation='update';payload=v;return q},insert(v){operation='insert';payload=v;return q},
   then(resolve,reject){
    const matching=()=>rows.filter(r=>filters.every(([k,v])=>r[k]===v));let result;
    if(operation==='read')result={data:matching().sort((a,b)=>a.id.localeCompare(b.id)).slice(start,end+1),error:null};
    if(operation==='update'){const found=matching();found.forEach(r=>Object.assign(r,payload));result={data:found,error:null}}
    if(operation==='insert'){
     if(rows.some(r=>r.id===payload.id&&r.user_id===payload.user_id))result={data:null,error:{code:'23505'}};
     else{rows.push({...payload});result={data:[payload],error:null}}
    }
    return Promise.resolve(result).then(resolve,reject);
   }
  };return q;
 }};
}
module.exports={fake};
