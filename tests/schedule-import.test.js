const test = require('node:test');
const assert = require('node:assert/strict');
const { parseCSV, sceneKey, guessColumns, buildPlan, exportCSV } = require('../schedule-import.js');

const scene = (id, scena, data) => ({ id, scena, data, sortOrder: id - 1,
    set: 'INT. STUDIO', sinossi: 'A scene', cast: 'Ana', extras: '2x Guests', adminNotes: 'Keep this note',
    props: [{ text: 'Ana: phone', status: 'yellow', note: 'Specific costume', customField: 'preserve' }] });
const fixtures = () => [scene(1, 'sc.1', '16 Ott'), scene(2, 'sc.46 pt1', '16 Ott'),
    scene(3, 'sc.46 pt2', '19 Ott'), scene(4, 'sc.74', 'Da programmare')];
const planFor = (text, scenes = fixtures(), options = {}) => {
    const csv = parseCSV(text);
    return buildPlan(scenes, csv, { ...guessColumns(csv.headers), ...options });
};

test('CSV handles Excel BOM/sep, CRLF, quoted delimiters, escaped quotes and multiline cells', () => {
    const csv = parseCSV('\uFEFFsep=;\r\nSC#;Data;Descrizione\r\n1;20 Ott;"A; B, ""C""\r\nD"\r\n;;;\r\n'.replace(';;;', ';;'));
    assert.equal(csv.separator, ';');
    assert.deepEqual(csv.rows[0].cells, ['1', '20 Ott', 'A; B, "C"\nD']);
    assert.equal(csv.rows.length, 1);
    assert.deepEqual(guessColumns(csv.headers), { sceneColumn: 0, dateColumn: 1, renameColumn: -1 });
    assert.equal(parseCSV('Scene,Date,Set\n1,20 Ott,"Cafe, bar"').rows[0].cells[2], 'Cafe, bar');
    assert.equal(parseCSV('Scene\tDate\n1\t20 Ott').separator, '\t');
});

test('malformed or empty CSV cannot prepare a partial update', () => {
    for (const text of ['', 'Scena;Data', 'Scena;Data\n1', 'Scena;Data\n1;20 Ott;extra',
        'Scena;Data\n1;"not closed', 'Scena;Data\n1;"20"oops', 'Scena;Data\n1;Bad"quote']) {
        assert.throws(() => parseCSV(text));
    }
    assert.throws(() => parseCSV('a;b\n' + '1;2\n'.repeat(5001)), /5.000/);
});

test('matching ignores common number formatting but never collapses parts or suffixes', () => {
    assert.equal(sceneKey(' SC.046 pt. 2 '), sceneKey('46 parte 2'));
    assert.equal(sceneKey('Scene 008A'), sceneKey('8a'));
    assert.notEqual(sceneKey('46'), sceneKey('46 pt1'));
    assert.notEqual(sceneKey('46 pt1'), sceneKey('46 pt2'));
    assert.notEqual(sceneKey('8A'), sceneKey('8'));
});

test('reorders scheduled days/scenes, keeps unlisted scenes and all independent prop data', () => {
    const scenes = fixtures(), before = JSON.stringify(scenes);
    const plan = planFor('Scena;Data\n46 pt2;20 Ott\n1;19 Ott', scenes);
    assert.deepEqual(plan.errors, []);
    assert.deepEqual(plan.scenes.map(s => [s.scena, s.data]), [
        ['sc.46 pt2', '20 Ott'], ['sc.1', '19 Ott'], ['sc.46 pt1', '16 Ott'], ['sc.74', 'Da programmare']]);
    for (const next of plan.scenes) {
        const old = scenes.find(s => s.id === next.id);
        const stable = s => Object.fromEntries(Object.entries(s).filter(([k]) => !['data', 'sortOrder'].includes(k)));
        assert.deepEqual(stable(next), stable(old));
    }
    assert.equal(JSON.stringify(scenes), before);
    plan.scenes[0].props[0].note = 'new';
    assert.equal(scenes[2].props[0].note, 'Specific costume');
});

test('missing-scene policy is explicit and unscheduled stays last, even if first in CSV', () => {
    const plan = planFor('Scena;Data\n74;da programmare\n46 pt2;16 ott', fixtures(), { missingPolicy: 'unscheduled' });
    assert.deepEqual(plan.scenes.map(s => s.id), [3, 4, 1, 2]);
    assert.equal(plan.scenes[0].data, '16 Ott');
    assert.equal(plan.summary.omitted, 2);
    assert.ok(plan.scenes.slice(1).every(s => s.data === 'Da programmare'));
});

test('CSV order is respected within a day and omitted scenes follow in original order', () => {
    const plan = planFor('Scena;Data\n46 pt2;16 Ott\n74;20 Ott\n1;16 Ott');
    assert.deepEqual(plan.scenes.map(s => s.id), [3, 1, 2, 4]);
});

test('unknown, ambiguous, repeated, blank-date or colliding scenes block the whole plan', () => {
    for (const text of ['Scena;Data\n99;16 Ott', 'Scena;Data\n46;16 Ott',
        'Scena;Data\n1;16 Ott\nsc.01;19 Ott', 'Scena;Data\n1;',
        'Scena;Data;Nuova scena\n1;16 Ott;74', 'Scena;Data;Nuova scena\n1;16 Ott;sc.']) {
        const result = planFor(text);
        assert.ok(result.errors.length);
        assert.equal(result.scenes, undefined);
    }
    assert.ok(planFor('Scena;Data\n1;20 Ott', [...fixtures(), scene(99, 'SC.01', '19 Ott')]).errors.length);
    assert.ok(planFor('Scena;Data\n1;20 Ott', fixtures(), { dateColumn: 0 }).errors.length);
    assert.ok(planFor('Scena;Data\n1;20 Ott', fixtures(), { sceneColumn: -1 }).errors.length);
});

test('explicit renumbering, including swaps, retains each scene identity and contents', () => {
    const plan = planFor('Scena;Data;Nuova scena\n1;16 Ott;46 pt1\n46 pt1;16 Ott;1');
    assert.deepEqual(plan.errors, []);
    assert.equal(plan.scenes[0].id, 1);
    assert.equal(plan.scenes[0].scena, 'sc.46 pt1');
    assert.equal(plan.scenes[1].id, 2);
    assert.equal(plan.scenes[1].scena, 'sc.1');
    assert.equal(plan.summary.renamed, 2);
});

test('downloaded template roundtrips without changes and escapes spreadsheet formulas', () => {
    const scenes = fixtures();
    scenes[0].set = 'A; "B"\nC';
    const csv = exportCSV(scenes);
    assert.ok(csv.startsWith('\uFEFF'));
    const plan = planFor(csv, scenes);
    assert.deepEqual(plan.errors, []);
    assert.equal(plan.summary.changed, 0);
    assert.deepEqual(plan.scenes, scenes);
    assert.match(exportCSV([scene(1, 'sc.1', '=DANGEROUS()')]), /"'=DANGEROUS\(\)"/);
});
