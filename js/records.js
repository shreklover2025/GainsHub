/* Personal records compare completed sets with earlier saved workouts only. */
(function(root){
 'use strict';
 function findRecords(session,history){
  session=WorkoutData.renameSessionExercises(session);history=history.map(WorkoutData.renameSessionExercises);
  const previous=history.filter(s=>s.id!==session.id&&!s.deleted&&!s.baseline&&s.id!=='baseline-2026-10-21'&&
   (s.date<session.date||(s.date===session.date&&(!s.updatedAt||!session.updatedAt||s.updatedAt<session.updatedAt))));
  const results=[];
  for(const exercise of session.exercises){
   const name=WorkoutData.exerciseName(exercise.name);
   const older=previous.flatMap(s=>s.exercises.filter(e=>WorkoutData.exerciseName(e.name)===name).flatMap(e=>e.sets));
   if(!older.length||!exercise.sets.length)continue;
   const assisted=WorkoutData.signedLoad(name);
   const oldBest=Math.max(...older.map(s=>s.weight));
   const newBest=Math.max(...exercise.sets.map(s=>s.weight));
   if(newBest>oldBest){
    results.push({name,kind:'weight',text:assisted&&newBest<=0?'Less assistance: '+Math.abs(newBest)+' lb (previous '+Math.abs(oldBest)+' lb)':assisted?'Added load: +'+newBest+' lb (previous '+oldBest+' lb)':'Highest weight: '+newBest+' lb (previous '+oldBest+' lb)'});
   }
   const weights=[...new Set(exercise.sets.map(s=>s.weight))];
   for(const weight of weights){
    const oldSets=older.filter(s=>s.weight===weight);if(!oldSets.length)continue;
    const oldReps=Math.max(...oldSets.map(s=>s.reps));
    const newReps=Math.max(...exercise.sets.filter(s=>s.weight===weight).map(s=>s.reps));
    if(newReps>oldReps)results.push({name,kind:'reps',text:newReps+' reps at '+weight+' lb'+(assisted?(weight<0?' (assistance)':weight>0?' (added)':' (bodyweight)'):'')+' (previous '+oldReps+' reps)'});
   }
  }
  return results;
 }
 root.WorkoutRecords={findRecords};
})(globalThis);
