const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const html = fs.readFileSync(path.join(__dirname, '../index.html'), 'utf8');
const context = vm.createContext({ PropRepeat: require('../prop-repeat.js'), escapeHtml: value => String(value).replace(/</g, '&lt;') });
vm.runInContext(html.slice(html.indexOf('    const PROP_CAST_ORDER'), html.indexOf('    function renderSceneCard(')), context);
const rank = context.propCharacterRank;
const prop = text => ({text, status:'yellow', note:'Keep note'});

test('all supplied cast IDs sort ahead of unlisted roles and background', () => {
    const names = ['Ana Santos', 'Antonio Cruz', 'Elena Moreau', 'Claire Dupont', 'Suzette', 'Raphael Castillo',
        'Patrick Onassis', 'Javier', 'David', 'Giacomo', 'Ronnie', 'Viv', 'Dr Mustafa Kamal', 'Priest', 'Marcus Webb',
        'Amy', 'Nonni', 'Astrid', 'Maria', 'Attendant (JFK desk)', 'Violetta', 'Reporter', 'Spanish Suit', 'Brat',
        'News Anchor SC 8', 'Pierre', 'NZ Curator', 'Reporter #1', 'Reporter #2', 'Biennale Press', 'Stunt Coordinator',
        'Unlisted role', 'Background'];
    assert.deepEqual([...names].reverse().sort((a,b)=>rank(a)-rank(b)), names);
});

test('existing aliases, case, whitespace, shared groups and background typo are recognized', () => {
    for (const [short, full] of [[' ANA ', 'Ana Santos'], ['antonio','Antonio Cruz'], ['Elena','Elena Moreau'],
        ['Claire','Claire Dupont'], ['Raphael','Raphael Castillo'], ['Patrick','Patrick Onassis'],
        ['Dr. Kamal','Dr Mustafa Kamal'], ['Mustafa Kamal','Dr Mustafa Kamal'], ['Marcus Web','Marcus Webb'],
        ['News Anchor SC. 8','News Anchor SC 8'], ['backgorund','Background']]) assert.equal(rank(short),rank(full));
    assert.equal(rank('Elena, younger rockstars'),rank('Elena'));
    assert.equal(rank('Antonio, Ana'),rank('Ana'));
    assert.ok(rank('Mario')>rank('Maria'));
    assert.ok(rank('Mario')<rank('Backgorund'));
});

test('public groups follow cast order without changing items, metadata or source array', () => {
    const props=[prop('Background: umbrellas'),prop('Driver: keys'),prop('Antonio: phone'),prop('Ana: bouquet'),
        prop('Ana: passport'),prop('Claire Dupont: bag'),prop('Backgorund: camera'),prop('Loose item')];
    const before=JSON.stringify(props);
    const rendered=context.renderGroupedProps(props);
    const groups=[...rendered.matchAll(/class="prop-group-name">([^<]+)/g)].map(m=>m[1]);
    assert.deepEqual(groups,['Ana','Antonio','Claire Dupont','Driver','Background','Backgorund']);
    assert.ok(rendered.indexOf('<li>bouquet')<rendered.indexOf('<li>passport'));
    assert.ok(rendered.indexOf('<li>Loose item')<rendered.indexOf('<li>umbrellas'));
    assert.equal(JSON.stringify(props),before);
});

test('editor puts new blank fields first, preserving original row indices and same-character order', () => {
    const props=[prop('Background: umbrellas'),prop('Antonio: phone'),prop('Ana: bouquet'),prop('Ana: passport'),prop('Driver: keys'),prop('')];
    const sorted=props.map((prop,index)=>({prop,index})).sort((a,b)=>context.propEditorRank(a.prop)-context.propEditorRank(b.prop)||a.index-b.index);
    assert.deepEqual(sorted.map(p=>p.index),[5,2,3,1,4,0]);
    assert.deepEqual(sorted.map(p=>p.prop.note),Array(6).fill('Keep note'));
});
