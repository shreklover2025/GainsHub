/* Shared validation: untrusted backups are normalized before entering the journal. */
(function (root) {
  'use strict';
  const record = value => value !== null && typeof value === 'object' && !Array.isArray(value);
  const text = (value, max) => typeof value === 'string' && value.length <= max;
  const exerciseName = name => name === 'Calf Raises' ? 'Standing Calf Raises' : name;
  function renameSessionExercises(session) {
    if (!Array.isArray(session.exercises)) return session;
    const exercises = new Map();
    for (const exercise of session.exercises) {
      const name = exerciseName(exercise.name);
      if (exercises.has(name)) exercises.get(name).sets.push(...exercise.sets);
      else exercises.set(name, {...exercise, name, sets: [...exercise.sets]});
    }
    return {...session, exercises: [...exercises.values()],
      ...(session.skippedExercises ? {skippedExercises: session.skippedExercises.map(exerciseName)} : {}),
      ...(session.ranges ? {ranges: session.ranges.map(e => ({...e, name: exerciseName(e.name)}))} : {})};
  }
  function validDate(value) {
    return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) &&
      !Number.isNaN(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
  }
  function normalizeSession(s) {
    if (!record(s) || !text(s.id, 200) || !s.id || !validDate(s.date) ||
        !text(s.routine, 200) || !s.routine.trim() || !Array.isArray(s.exercises) || s.exercises.length > 200 ||
        (s.notes !== undefined && !text(s.notes, 20000))) throw Error('Invalid workout details');
    const names = new Set();
    const exercises = s.exercises.map(e => {
      if (!record(e) || !text(e.name, 200) || !e.name.trim() || names.has(e.name) ||
          ['__proto__', 'constructor', 'prototype'].includes(e.name) || !Array.isArray(e.sets) || e.sets.length > 200)
        throw Error('Invalid or duplicate exercise');
      names.add(e.name);
      return {name: e.name, sets: e.sets.map(z => {
        if (!record(z) || typeof z.weight !== 'number' || !Number.isFinite(z.weight) || z.weight < 0 ||
            !Number.isInteger(z.reps) || z.reps < 1 || z.reps > 100) throw Error('Invalid weight or reps');
        return {weight: z.weight, reps: z.reps};
      })};
    });
    const result = {id: s.id, date: s.date, routine: s.routine, notes: s.notes || '', exercises};
    if (s.skippedExercises !== undefined) {
      if (!Array.isArray(s.skippedExercises) || s.skippedExercises.length > 200 ||
          s.skippedExercises.some(name => !text(name, 200) || !name.trim() || ['__proto__','constructor','prototype'].includes(name)))
        throw Error('Invalid skipped exercises');
      result.skippedExercises = [...new Set(s.skippedExercises.map(exerciseName))];
    }
    if (s.baseline === true) result.baseline = true;
    if (typeof s.updatedAt === 'string' && Number.isFinite(Date.parse(s.updatedAt))) result.updatedAt = s.updatedAt;
    if (s.ranges !== undefined) {
      if (!Array.isArray(s.ranges) || s.ranges.length > 200) throw Error('Invalid additional records');
      result.ranges = s.ranges.map(e => {
        if (!record(e) || !text(e.name, 200) || !Number.isFinite(e.weight) || e.weight < 0 ||
            !['string','number'].includes(typeof e.reps) || !['string','number'].includes(typeof e.sets) ||
            String(e.reps).length > 100 || String(e.sets).length > 100) throw Error('Invalid additional record');
        return {name:e.name, weight:e.weight, reps:String(e.reps), sets:String(e.sets)};
      });
    }
    return renameSessionExercises(result);
  }
  function parseBackup(obj) {
    if (!record(obj) || !Array.isArray(obj.sessions) || obj.sessions.length > 20000 ||
        (obj.version !== undefined && obj.version !== 1)) throw Error('Unsupported workout backup');
    const seen = new Set();
    return obj.sessions.map(s => {
      const clean = normalizeSession(s);
      if (seen.has(clean.id)) throw Error('Duplicate workout ID in backup');
      seen.add(clean.id);
      return clean;
    });
  }
  root.WorkoutData = {normalizeSession, parseBackup, validDate, exerciseName, renameSessionExercises};
})(globalThis);
