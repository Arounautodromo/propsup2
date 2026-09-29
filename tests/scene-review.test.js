const test = require('node:test');
const assert = require('node:assert/strict');
const review = require('../scene-review.js');
const schedule = require('../schedule-import.js');

test('flag toggles preserve empty, multiline and legacy notes exactly', () => {
    for (const note of ['', '  Check costumes\nSecond line\n', '🚩 A literal flag', '<b>Check</b>']) {
        assert.equal(review.isFlagged(note), false);
        const flagged = review.toggle(note);
        assert.equal(review.isFlagged(flagged), true);
        assert.equal(review.getNote(flagged), note);
        assert.equal(review.toggle(flagged), note);
    }
    assert.equal(review.getNote(null), '');
    assert.equal(review.getNote(undefined), '');
});

test('editing or clearing a note keeps its flag through the existing RPC JSON fields', () => {
    const flagged = review.toggle('Original note');
    for (const text of ['New note', '']) {
        const persisted = JSON.parse(JSON.stringify({ adminNotes: review.setNote(flagged, text) }));
        assert.equal(review.isFlagged(persisted.adminNotes), true);
        assert.equal(review.getNote(persisted.adminNotes), text);
        assert.equal(review.toggle(persisted.adminNotes), text);
    }
    assert.equal(review.setNote('Unflagged', 'Edit'), 'Edit');
});

test('JSON backup and schedule date/number changes preserve flags, notes and props', () => {
    const original = [{id: 1, scena: 'sc.1', data: '16 Ott', adminNotes: review.toggle('Check bouquet'),
        props: [{text: 'Bouquet', status: 'yellow', note: 'Costumes'}]},
        {id: 2, scena: 'sc.2', data: '17 Ott', adminNotes: 'Ordinary note', props: []}];
    const restored = JSON.parse(JSON.stringify(original));
    const csv = schedule.parseCSV('Scena;Data;Nuova scena\n1;20 Ott;3\n2;21 Ott;4');
    const plan = schedule.buildPlan(restored, csv, schedule.guessColumns(csv.headers));
    assert.deepEqual(plan.errors, []);
    const changed = plan.scenes.find(s => s.id === 1);
    assert.equal(review.isFlagged(changed.adminNotes), true);
    assert.equal(review.getNote(changed.adminNotes), 'Check bouquet');
    assert.equal(changed.data, '20 Ott');
    assert.deepEqual(changed.props, original[0].props);
    assert.equal(review.isFlagged(plan.scenes.find(s => s.id === 2).adminNotes), false);
    assert.deepEqual(restored, original);
});
