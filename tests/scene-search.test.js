const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const SceneReview = require('../scene-review.js');

// Exercise the actual inline functions without starting the app or accessing Supabase.
const html = fs.readFileSync(path.join(__dirname, '../index.html'), 'utf8');
const searchSource = html.slice(html.indexOf('    function matchesSearch('), html.indexOf('    function countPendingProps('));
const context = vm.createContext({ isAdmin: false, SceneReview, PropRepeat: require('../prop-repeat.js') });
vm.runInContext(searchSource, context);
const search = (scenes, q) => Array.from(context.searchScenes(scenes, q));
const labels = scenes => scenes.map(s => s.scena);
const scene = (scena, extra = {}) => ({ scena, set: '', sinossi: '', cast: '', extras: '', props: [], ...extra });

const numericFixtures = () => [
    scene('sc.90', { sinossi: '3 people enter' }),
    scene('sc.31'), scene('sc.3 pt2'), scene('sc.3'), scene('sc.35'), scene('sc.3 pt1'),
    scene('sc.80', { cast: 'Actor 3' }),
    scene('sc.70', { props: [{ text: '3 cartelline', note: 'private detail' }] })
];

test('query 3 prioritizes exact scene, parts, prefixes and then incidental field matches', () => {
    const result = labels(search(numericFixtures(), '3'));
    assert.deepEqual(result, ['sc.3', 'sc.3 pt1', 'sc.3 pt2', 'sc.31', 'sc.35', 'sc.90', 'sc.80', 'sc.70']);
});

test('sc.3 and case/spacing aliases have the same results, retaining less relevant matches', () => {
    const fixtures = numericFixtures();
    const expected = labels(search(fixtures, '3'));
    for (const q of ['sc.3', 'sc 3', 'SC.3', 'sc3', '  SC .  3  ']) {
        assert.deepEqual(labels(search(fixtures, q)), expected, q);
    }
    assert.ok(expected.indexOf('sc.3') < expected.indexOf('sc.31'));
});

test('sc.46 matches and naturally orders all parts, even when no unsplit scene exists', () => {
    const fixtures = [scene('sc.460'), scene('sc.46 pt3'), scene('sc.46 pt10'),
        scene('sc.46 pt2'), scene('sc.99', { sinossi: '46 passengers' }), scene('sc.46 pt1')];
    const parts = ['sc.46 pt1', 'sc.46 pt2', 'sc.46 pt3', 'sc.46 pt10'];
    assert.deepEqual(labels(search(fixtures, 'sc.46')), [...parts, 'sc.460', 'sc.99']);
    assert.deepEqual(labels(search([...fixtures, scene('sc.46')], 'sc.46')),
        ['sc.46', ...parts, 'sc.460', 'sc.99']);
});

test('cartelline still finds all five relevant scenes in original full-text order', () => {
    const fixtures = [scene('sc.31', { sinossi: 'Porta le cartelline' }),
        scene('sc.3', { props: [{ text: 'Cartelline rosse' }] }),
        scene('sc.20', { set: 'Deposito cartelline' }),
        scene('sc.40', { cast: 'Addetto cartelline' }),
        scene('sc.50', { extras: '2 addetti alle cartelline' }), scene('sc.60')];
    assert.deepEqual(search(fixtures, 'cartelline'), fixtures.slice(0, 5));
    assert.deepEqual(search(fixtures, ' CARTELLINE '), fixtures.slice(0, 5));
    assert.deepEqual(search(fixtures, 'cartelline rosse'), [fixtures[1]]);
});

test('full-text result membership, order, Admin note visibility and source data remain intact', () => {
    const fixtures = numericFixtures().concat([
        scene('sc.98', { adminNotes: SceneReview.toggle('Private 3 wardrobe') }),
        scene('sc.97', { props: [{ text: 'Phone', note: 'Private 3 costume' }] })
    ]);
    const snapshot = JSON.stringify(fixtures);
    context.isAdmin = false;
    assert.deepEqual(search(fixtures, ''), fixtures);
    assert.deepEqual(search(fixtures, 'actor 3'), [fixtures[6]]);
    assert.deepEqual(search(fixtures, 'sc.3 pt2'), [fixtures[2]]);
    assert.deepEqual(search(fixtures, 'missing phrase'), []);
    assert.equal(search(fixtures, '3').length, 8);
    context.isAdmin = true;
    assert.deepEqual(labels(search(fixtures, '3')).slice(-2), ['sc.98', 'sc.97']);
    assert.deepEqual(labels(search(fixtures, 'private 3')), ['sc.98', 'sc.97']);
    context.isAdmin = false;
    assert.deepEqual(search(fixtures, 'private 3'), []);
    assert.equal(JSON.stringify(fixtures), snapshot);
});

test('scene result renderers use ranked search, while the prop checklist keeps its existing filter', () => {
    const body = name => html.slice(html.indexOf('    function ' + name + '(')).split('\n    function ')[0];
    // Stub rendering to assert the order reaching the cards, without testing the helper alone.
    Object.assign(context, {
        dbScenes: numericFixtures(), searchQuery: 'sc.3', currentDay: '16 Ott', isEditorMode: false,
        UNSCHEDULED_DAY: 'Da programmare', escapeHtml: String,
        renderSceneCard: s => `<result>${s.scena}</result>`
    });
    vm.runInContext(body('renderDaysHTML'), context);
    const result = context.renderDaysHTML();
    assert.ok(result.indexOf('<result>sc.3</result>') < result.indexOf('<result>sc.31</result>'));
    assert.ok(result.includes('<result>sc.90</result>'));
    context.dbScenes = numericFixtures().map(s => ({ ...s, adminNotes: SceneReview.toggle('Review') }));
    context.isAdmin = true;
    vm.runInContext(body('renderReviewScenesHTML'), context);
    const review = context.renderReviewScenesHTML();
    assert.ok(review.indexOf('🚩 sc.3</strong>') < review.indexOf('🚩 sc.31</strong>'));
    assert.match(body('renderShoppingListHTML'), /items = items\.filter/);
});
