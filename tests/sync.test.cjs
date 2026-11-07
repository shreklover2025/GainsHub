const {test}=require('node:test');
const assert=require('node:assert/strict');
require('../js/sync.js');
const {fake}=require('./fake-cloud.cjs');
test('conditional updates reject stale edits and cannot cross account boundaries',async()=>{
 const rows=[{id:'s',user_id:'u1',updated_at:'2026-11-06T10:00:00.000Z',session:{notes:'remote'}}];const cloud=fake(rows);
 assert.equal((await WorkoutSync.writeSession(cloud,'u1',{id:'s',notes:'stale'},'2026-11-05T10:00:00.000Z')).conflict,true);
 assert.equal(rows[0].session.notes,'remote');
 assert.equal((await WorkoutSync.writeSession(cloud,'u2',{id:'s'},rows[0].updated_at)).conflict,true);
 const result=await WorkoutSync.writeSession(cloud,'u1',{id:'s',notes:'latest'},rows[0].updated_at);
 assert.ok(result.version);assert.equal(rows[0].session.notes,'latest');
});
test('duplicate insert is a conflict, not an overwrite',async()=>{
 const rows=[{id:'s',user_id:'u1',session:{notes:'keep'}}];
 assert.equal((await WorkoutSync.writeSession(fake(rows),'u1',{id:'s',notes:'overwrite'},null)).conflict,true);
 assert.equal(rows[0].session.notes,'keep');
});
test('download paginates past the API row limit and keeps user scope',async()=>{
 const rows=Array.from({length:1203},(_,i)=>({id:String(i).padStart(5,'0'),user_id:'u1'}));rows.push({id:'private',user_id:'other'});
 assert.equal((await WorkoutSync.readRows(fake(rows),'u1')).length,1203);
});
