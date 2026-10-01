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

test('photo metadata stays hidden in scene notes and survives note/flag edits and backups', () => {
    const photos = [{ path: 'photos/a.webp', name: 'set reference.webp' }];
    const stored = review.setPhotos(review.toggle('Continuity note'), photos);
    const restored = JSON.parse(JSON.stringify({ adminNotes: stored })).adminNotes;
    assert.equal(review.isFlagged(restored), true);
    assert.equal(review.getNote(restored), 'Continuity note');
    assert.deepEqual(review.getPhotos(restored), photos);

    const edited = review.setNote(restored, 'Updated scene note');
    assert.equal(review.isFlagged(edited), true);
    assert.equal(review.getNote(edited), 'Updated scene note');
    assert.deepEqual(review.getPhotos(edited), photos);

    const unflagged = review.toggle(edited);
    assert.equal(review.isFlagged(unflagged), false);
    assert.equal(review.getNote(unflagged), 'Updated scene note');
    assert.deepEqual(review.getPhotos(unflagged), photos);

    const cleared = review.setPhotos(unflagged, []);
    assert.equal(review.getNote(cleared), 'Updated scene note');
    assert.deepEqual(review.getPhotos(cleared), []);
});

test('repeat notes normalize to multiples and explicit checkbox state takes precedence', () => {
    for (const note of ['x repeats', 'X Repeats ??', 'Liquid x repeat / check intollerance', 'Multiples']) {
        assert.equal(review.hasMultiples({ note }), true);
        assert.match(review.normalizeMultiplesText(note), /multiples/);
        assert.doesNotMatch(review.normalizeMultiplesText(note), /repeats?/i);
    }
    assert.equal(review.normalizeMultiplesText('Keep this detail / x repeats / check with makeup'),
        'Keep this detail / multiples / check with makeup');
    assert.equal(review.removeMultiplesText('PERSONALS (same as sc. 42 multiples)'), 'PERSONALS (same as sc. 42)');
    assert.equal(review.removeMultiplesText('multiples / check with makeup'), 'check with makeup');
    assert.equal(review.removeMultiplesText('multiples'), '');
    assert.equal(review.hasMultiples({ multiples: false, note: 'multiples' }), false);
    assert.equal(review.hasMultiples({ multiples: true, note: '' }), true);
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
