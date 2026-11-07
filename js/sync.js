/* Conditional writes prevent newer devices from silently losing their edits. */
(function (root) {
  'use strict';
  async function readRows(cloud, userId) {
    const rows = [];
    for (let offset = 0; ; offset += 500) {
      const {data, error} = await cloud.from('workout_sessions').select('id,session,updated_at')
        .eq('user_id', userId).order('id').range(offset, offset + 499);
      if (error) throw error;
      rows.push(...data);
      if (data.length < 500) return rows;
    }
  }
  async function writeSession(cloud, userId, session, expectedVersion) {
    const timestamp = new Date(Math.max(Date.now(), (Date.parse(expectedVersion) || 0) + 1)).toISOString();
    const row = {id:session.id, user_id:userId, session, updated_at:timestamp};
    let result;
    if (expectedVersion) {
      result = await cloud.from('workout_sessions').update(row).eq('user_id', userId)
        .eq('id', session.id).eq('updated_at', expectedVersion).select('id,updated_at');
    } else {
      result = await cloud.from('workout_sessions').insert(row).select('id,updated_at');
    }
    if (result.error?.code === '23505') return {conflict:true};
    if (result.error) throw result.error;
    if (!result.data?.length) return {conflict:true};
    return {version:result.data[0].updated_at};
  }
  root.WorkoutSync = {readRows, writeSession};
})(globalThis);
