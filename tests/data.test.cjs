const {test}=require('node:test');
const assert=require('node:assert/strict');
require('../js/data.js');
const sample=()=>({id:'s1',date:'2026-11-06',routine:'Upper Body',notes:'test',exercises:[{name:'Bench',sets:[{weight:100,reps:8}]}]});
test('backup round trip retains real workout data and strips unexpected properties',()=>{
 const s=sample();s.unexpected='unsafe';s.ranges=[{name:'Legacy',weight:50,reps:'8–10',sets:'unspecified'}];
 const [result]=WorkoutData.parseBackup({version:1,sessions:[s]});
 assert.equal(result.unexpected,undefined);assert.deepEqual(result.exercises,s.exercises);assert.deepEqual(result.ranges,s.ranges);
});
test('rejects invalid nested data before importing any workouts',()=>{
 for(const modify of [s=>s.date='2026-02-30',s=>s.exercises[0].sets[0].weight='<img>',s=>s.exercises[0].sets[0].reps=1.5,s=>s.exercises[0].sets[0].reps=101,s=>s.exercises[0].name='__proto__',s=>s.exercises.push(s.exercises[0])]){
  const bad=sample();modify(bad);assert.throws(()=>WorkoutData.parseBackup({sessions:[sample(),bad]}));
 }
 assert.throws(()=>WorkoutData.parseBackup({version:2,sessions:[]}));
 assert.throws(()=>WorkoutData.parseBackup({sessions:[sample(),sample()]}));
});
test('retains HTML-looking notes as plain data for escaped rendering',()=>{
 const s=sample();s.notes='<script>alert(1)</script>';assert.equal(WorkoutData.normalizeSession(s).notes,s.notes);
});
test('renames legacy calf history without losing sets or sync metadata',()=>{
 const s=sample();s.revision='pending-revision';s._baseVersion='cloud-version';
 s.exercises=[{name:'Calf Raises',sets:[{weight:200,reps:15}]},{name:'Standing Calf Raises',sets:[{weight:210,reps:15}]},{name:'Seated Calf Raises',sets:[{weight:90,reps:15}]}];
 const renamed=WorkoutData.renameSessionExercises(s);
 assert.equal(renamed.revision,s.revision);assert.equal(renamed._baseVersion,s._baseVersion);
 assert.deepEqual(renamed.exercises.map(e=>e.name),['Standing Calf Raises','Seated Calf Raises']);
 assert.equal(renamed.exercises[0].sets.length,2);
 assert.equal(WorkoutData.parseBackup({sessions:[s]})[0].exercises[0].name,'Standing Calf Raises');
 assert.equal(s.exercises[0].name,'Calf Raises');
});
test('skipped exercises survive backups and invalid skip metadata is rejected',()=>{
 const s=sample();s.skippedExercises=['Calf Raises','Seated Calf Raises'];
 assert.deepEqual(WorkoutData.parseBackup({sessions:[s]})[0].skippedExercises,['Standing Calf Raises','Seated Calf Raises']);
 for(const bad of [[{}],['__proto__'],'Bench']){s.skippedExercises=bad;assert.throws(()=>WorkoutData.parseBackup({sessions:[s]}))}
});
