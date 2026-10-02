const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const PropRepeat = require('../prop-repeat.js');
const schedule = require('../schedule-import.js');
const html = fs.readFileSync(path.join(__dirname, '../index.html'), 'utf8');
const context = vm.createContext({ PropRepeat, escapeHtml: value => String(value).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/"/g,'&quot;') });
vm.runInContext(html.slice(html.indexOf('    function parseProps('), html.indexOf('    let dbScenes')), context);
vm.runInContext(html.slice(html.indexOf('    const PROP_CAST_ORDER'), html.indexOf('    function renderSceneCard(')), context);

test('repeat flag is reversible and preserves legacy, empty and multiline notes', () => {
    for (const note of ['', ' Keep whitespace\nSecond line\n', '↻ Ordinary note']) {
        assert.equal(PropRepeat.isRepeated(note),false);
        const marked = PropRepeat.setRepeated(note,true);
        assert.equal(PropRepeat.isRepeated(marked),true);
        assert.equal(PropRepeat.getNote(marked),note);
        assert.equal(PropRepeat.setRepeated(marked,true),marked);
        assert.equal(PropRepeat.setRepeated(marked,false),note);
    }
    assert.equal(PropRepeat.getNote(undefined),'');
    assert.equal(PropRepeat.isRepeated(null),false);
});

test('existing parseProps, JSON backup and CSV reorder/renumber retain repeat independently', () => {
    const props=[{text:'Ana: TISSUE',status:'yellow',note:PropRepeat.setRepeated('Costumes',true)},
        {text:'Ana: RING',status:'green',note:'Keep ring note'}];
    const parsed=JSON.parse(JSON.stringify(context.parseProps(JSON.parse(JSON.stringify(props)))));
    assert.deepEqual(parsed,props);
    assert.equal(PropRepeat.isRepeated(context.parseProps(['Legacy prop'])[0].note),false);
    const scenes=[{id:1,scena:'sc.1',data:'16 Ott',props:parsed},{id:2,scena:'sc.2',data:'17 Ott',props:[]}];
    const csv=schedule.parseCSV('Scena;Data;Nuova scena\n2;18 Ott;3\n1;19 Ott;4');
    const plan=schedule.buildPlan(scenes,csv,schedule.guessColumns(csv.headers));
    assert.deepEqual(plan.errors,[]);
    assert.deepEqual(plan.scenes.find(s=>s.id===1).props,props);
});

test('public marker belongs only to the checked record and never exposes its private note', () => {
    const props=[{text:'Ana: TISSUE',note:PropRepeat.setRepeated('Private note',true)},
        {text:'Ana: TISSUE',note:''},{text:'Ronnie: <RING>',note:''}];
    const before=JSON.stringify(props);
    const rendered=context.renderGroupedProps(props);
    assert.equal((rendered.match(/class="prop-repeat-icon"/g)||[]).length,1);
    assert.match(rendered,/title="A ripetere — più copie per i ciak"/);
    assert.match(rendered,/onclick="showToast/);
    assert.ok(!rendered.includes('Private note'));
    assert.ok(rendered.includes('&lt;RING>'));
    assert.equal(JSON.stringify(props),before);
});
