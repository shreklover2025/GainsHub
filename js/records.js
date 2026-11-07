/* Personal records compare completed sets with earlier saved workouts only. */
(function(root){
 'use strict';
 function findRecords(session,history){
  const previous=history.filter(s=>s.id!==session.id&&!s.deleted&&!s.baseline&&s.id!=='baseline-2026-10-21'&&
   (s.date<session.date||(s.date===session.date&&(!s.updatedAt||!session.updatedAt||s.updatedAt<session.updatedAt))));
  const results=[];
  for(const exercise of session.exercises){
   const name=WorkoutData.exerciseName(exercise.name);
   const older=previous.flatMap(s=>s.exercises.filter(e=>WorkoutData.exerciseName(e.name)===name).flatMap(e=>e.sets));
   if(!older.length||!exercise.sets.length)continue;
   const assisted=name==='Assisted Pull-Ups';
   const oldBest=assisted?Math.min(...older.map(s=>s.weight)):Math.max(...older.map(s=>s.weight));
   const newBest=assisted?Math.min(...exercise.sets.map(s=>s.weight)):Math.max(...exercise.sets.map(s=>s.weight));
   if(assisted?newBest<oldBest:newBest>oldBest){
    results.push({name,kind:'weight',text:assisted?'Less assistance: '+newBest+' lb (previous '+oldBest+' lb)':'Highest weight: '+newBest+' lb (previous '+oldBest+' lb)'});
   }
   const weights=[...new Set(exercise.sets.map(s=>s.weight))];
   for(const weight of weights){
    const oldSets=older.filter(s=>s.weight===weight);if(!oldSets.length)continue;
    const oldReps=Math.max(...oldSets.map(s=>s.reps));
    const newReps=Math.max(...exercise.sets.filter(s=>s.weight===weight).map(s=>s.reps));
    if(newReps>oldReps)results.push({name,kind:'reps',text:newReps+' reps at '+weight+' lb'+(assisted?' assistance':'')+' (previous '+oldReps+' reps)'});
   }
  }
  return results;
 }
 root.WorkoutRecords={findRecords};
})(globalThis);
