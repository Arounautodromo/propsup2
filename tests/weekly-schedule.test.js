const test = require('node:test');
const assert = require('node:assert/strict');
const W = require('../weekly-schedule');
test('production dates, explicit years and invalid dates', () => {
    for (const date of ['19 Ott', ' 19 OTTOBRE 2026 ', '2026-10-19']) assert.equal(W.monday(date), '2026-10-19');
    for (const date of ['Da programmare', '', '31 Nov', '29 Feb 2026', '2026-13-01', '0 Ott']) assert.equal(W.date(date), null);
    assert.equal(W.date('29 Feb 2028').toISOString(), '2028-02-29T00:00:00.000Z');
});
test('Monday to Sunday, month/year boundaries and only scheduled weeks', () => {
    assert.equal(W.monday('25 Ott'), '2026-10-19');
    assert.equal(W.monday('01 Nov'), '2026-10-26');
    assert.equal(W.monday('01 Gen 2027'), '2026-12-28');
    assert.deepEqual(W.weeks([{data:'01 Nov'}, {data:'19 Ott'}, {data:'25 Ott'}, {data:'Da programmare'}]), ['2026-10-19','2026-10-26']);
    assert.deepEqual(W.days([], '2026-12-28').map(d => d.key), ['2026-12-28','2026-12-29','2026-12-30','2026-12-31','2027-01-01','2027-01-02','2027-01-03']);
});
test('keeps all scenes, props and schedule order without mutating source', () => {
    const scenes = [{id:3,data:'19 Ott',props:[{text:'Ana: bag'}]}, {id:1,data:'19 Ott'}, {id:2,data:'25 Ott'}, {id:4,data:'Da programmare'}];
    const before = JSON.stringify(scenes);
    const days = W.days(scenes, '2026-10-19');
    assert.equal(days.length, 7);
    assert.deepEqual(days[0].scenes.map(s=>s.id), [3,1]);
    assert.equal(days[6].scenes[0], scenes[2]);
    assert.equal(days[0].scenes[0].props[0].text, 'Ana: bag');
    assert.equal(JSON.stringify(scenes), before);
});
