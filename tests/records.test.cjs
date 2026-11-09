const {test}=require('node:test');
const assert=require('node:assert/strict');
require('../js/data.js');require('../js/records.js');
const workout=(id,date,name,sets)=>({id,date,routine:'Test',exercises:[{name,sets}]});
test('first logs and matching performance are not falsely celebrated as records',()=>{
 const current=workout('new','2026-11-06','Bench',[{weight:100,reps:8}]);
 assert.deepEqual(WorkoutRecords.findRecords(current,[]),[]);
 assert.deepEqual(WorkoutRecords.findRecords(current,[workout('old','2026-11-05','Bench',[{weight:100,reps:8}])]),[]);
});
test('recognizes higher load and more reps at the same load',()=>{
 const previous=workout('old','2026-11-05','Bench',[{weight:100,reps:8}]);
 const current=workout('new','2026-11-06','Bench',[{weight:100,reps:10},{weight:110,reps:6}]);
 assert.deepEqual(WorkoutRecords.findRecords(current,[previous]).map(record=>record.kind),['weight','reps']);
});
test('standing and seated records stay separate and legacy standing name is recognized',()=>{
 const standing=workout('old','2026-11-05','Calf Raises',[{weight:300,reps:15}]);
 const seated=workout('new','2026-11-06','Seated Calf Raises',[{weight:100,reps:15}]);
 assert.deepEqual(WorkoutRecords.findRecords(seated,[standing]),[]);
 const improved=workout('next','2026-11-06','Standing Calf Raises',[{weight:310,reps:15}]);
 assert.equal(WorkoutRecords.findRecords(improved,[standing])[0].kind,'weight');
});
test('less assistance is a record; more assistance is not',()=>{
 const previous=workout('old','2026-11-05','Assisted Pull-Ups',[{weight:40,reps:8}]);
 assert.match(WorkoutRecords.findRecords(workout('new','2026-11-06','Assisted Pull-Ups',[{weight:30,reps:8}]),[previous])[0].text,/Less assistance/);
 assert.deepEqual(WorkoutRecords.findRecords(workout('new','2026-11-06','Assisted Pull-Ups',[{weight:50,reps:8}]),[previous]),[]);
});
test('excluded records include self, deleted, baseline, and future workouts',()=>{
 const current=workout('new','2026-11-06','Bench',[{weight:100,reps:8}]);
 const future=workout('future','2026-11-07','Bench',[{weight:50,reps:8}]);
 const deleted={...future,id:'deleted',date:'2026-11-01',deleted:true};
 const baseline={...future,id:'baseline',date:'2026-11-01',baseline:true};
 assert.deepEqual(WorkoutRecords.findRecords(current,[current,future,deleted,baseline]),[]);
});
test('signed bodyweight records increase through assistance, bodyweight, and added load',()=>{
 for(const name of ['Assisted Pull-Ups','Chest Dips']){
  const older={...workout('old','2026-11-05',name,[{weight:-40,reps:8}]),weightConvention:'signed-v1'};
  const less={...workout('less','2026-11-06',name,[{weight:-25,reps:8}]),weightConvention:'signed-v1'};
  assert.equal(WorkoutRecords.findRecords(less,[older])[0].kind,'weight');
  const added={...less,id:'added',exercises:[{name,sets:[{weight:10,reps:8}]}]};
  assert.match(WorkoutRecords.findRecords(added,[older])[0].text,/Added load/);
 }
});
