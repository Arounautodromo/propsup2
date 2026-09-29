/* CSV parsing and schedule planning. No DOM access or server writes. */
(function (root) {
    'use strict';
    const UNSCHEDULED = 'Da programmare';
    const clean = value => String(value ?? '').trim().replace(/\s+/g, ' ');
    const headerKey = value => clean(value).toLowerCase().normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, '');

    function sceneKey(value) {
        return clean(value).toLowerCase().replace(/^(?:scena|scene|sc)\.?\s*/, '')
            .replace(/(?:parte|part|pt)\.?\s*(\d+)/g, 'pt$1')
            .replace(/\s+/g, '').replace(/^0+(?=\d)/, '');
    }

    function parseCSV(input, separator = 'auto') {
        let text = String(input).replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n');
        const directive = text.match(/^sep=([;,\t])\n/i);
        if (directive) {
            if (separator === 'auto') separator = directive[1];
            text = text.slice(directive[0].length);
        }
        text = text.replace(/^\n+/, '');
        if (separator === 'auto') {
            const counts = new Map([[';', 0], [',', 0], ['\t', 0]]);
            let quoted = false;
            for (let i = 0; i < text.length; i++) {
                if (text[i] === '"') {
                    if (quoted && text[i + 1] === '"') { i++; continue; }
                    quoted = !quoted;
                } else if (!quoted) {
                    if (text[i] === '\n') break;
                    if (counts.has(text[i])) counts.set(text[i], counts.get(text[i]) + 1);
                }
            }
            const best = [...counts].sort((a, b) => b[1] - a[1])[0];
            if (!best[1]) throw new Error('Servono almeno due colonne. Controlla il separatore del CSV.');
            separator = best[0];
        }
        if (![',', ';', '\t'].includes(separator)) throw new Error('Separatore non valido.');

        const records = [];
        let cells = [], value = '', quoted = false, closed = false, line = 1, startLine = 1;
        const finishCell = () => { cells.push(value.trim()); value = ''; closed = false; };
        const finishRow = () => {
            finishCell();
            if (cells.some(cell => cell !== '')) records.push({ line: startLine, cells });
            if (cells.length > 100 || records.length > 5001) throw new Error('Il CSV supera il limite di 5.000 righe o 100 colonne.');
            cells = [];
        };
        for (let i = 0; i < text.length; i++) {
            const char = text[i];
            if (quoted) {
                if (char === '"') {
                    if (text[i + 1] === '"') { value += '"'; i++; }
                    else { quoted = false; closed = true; }
                } else { value += char; if (char === '\n') line++; }
            } else if (char === separator) finishCell();
            else if (char === '\n') { finishRow(); line++; startLine = line; }
            else if (closed) {
                if (!/\s/.test(char)) throw new Error(`Riga ${line}: carattere inatteso dopo le virgolette.`);
            } else if (char === '"') {
                if (value.trim()) throw new Error(`Riga ${line}: virgolette non valide. Esporta nuovamente il CSV.`);
                value = ''; quoted = true;
            } else value += char;
        }
        if (quoted) throw new Error(`Riga ${startLine}: virgolette non chiuse.`);
        finishRow();
        if (records.length < 2) throw new Error('Il CSV deve contenere una riga di intestazioni e almeno una scena.');
        const headers = records.shift().cells;
        if (headers.length < 2) throw new Error('Seleziona il separatore corretto per leggere le colonne.');
        const wrong = records.find(row => row.cells.length !== headers.length);
        if (wrong) throw new Error(`Riga ${wrong.line}: ${wrong.cells.length} colonne invece di ${headers.length}. Controlla il CSV o il separatore.`);
        return { headers, rows: records, separator };
    }

    function guessColumns(headers) {
        const aliases = {
            sceneColumn: ['scena', 'scene', 'sc', 'scenenumber', 'numeroscena', 'scenaattuale', 'vecchiascena'],
            dateColumn: ['data', 'dataripresa', 'datariprese', 'datadiripresa', 'shootdate', 'shootingdate', 'date', 'giorno'],
            renameColumn: ['nuovascena', 'nuovonumero', 'nuovanumerazione', 'newscene', 'newscenenumber']
        };
        return Object.fromEntries(Object.entries(aliases).map(([key, names]) => {
            const matches = headers.map((header, index) => names.includes(headerKey(header)) ? index : -1).filter(index => index >= 0);
            return [key, matches.length === 1 ? matches[0] : -1];
        }));
    }

    function buildPlan(current, csv, options) {
        const { sceneColumn, dateColumn, renameColumn = -1, missingPolicy = 'keep' } = options;
        const errors = [];
        const columns = [sceneColumn, dateColumn, ...(renameColumn === -1 ? [] : [renameColumn])];
        if (columns.some(index => !Number.isInteger(index) || index < 0 || index >= csv.headers.length)) {
            return { errors: ['Scegli le colonne Scena e Data.'] };
        }
        if (new Set(columns).size !== columns.length) return { errors: ['Ogni campo deve usare una colonna diversa.'] };
        if (!['keep', 'unscheduled'].includes(missingPolicy)) return { errors: ['Scelta per le scene assenti non valida.'] };
        if (!current.length) return { errors: ['Non ci sono scene da aggiornare. Aggiungile prima in Admin.'] };

        const byScene = new Map(), days = new Map();
        current.forEach((scene, index) => {
            const key = sceneKey(scene.scena);
            if (!byScene.has(key)) byScene.set(key, []);
            byScene.get(key).push(index);
            const day = clean(scene.data);
            if (day) days.set(day.toLowerCase(), day);
        });
        days.set(UNSCHEDULED.toLowerCase(), UNSCHEDULED);
        const matched = new Map();
        csv.rows.forEach(row => {
            const label = clean(row.cells[sceneColumn]), key = sceneKey(label);
            const matches = byScene.get(key) || [];
            if (!key || matches.length !== 1) {
                errors.push(`Riga ${row.line}: ${label || '(scena vuota)'} — ${matches.length > 1 ? 'più scene del sito hanno questo numero' : 'scena non trovata'}. Usa il numero attuale completo, incluse le parti; aggiungi eventuali nuove scene in Admin.`);
                return;
            }
            const index = matches[0];
            if (matched.has(index)) { errors.push(`Riga ${row.line}: ${label} compare più di una volta nel CSV.`); return; }
            const day = clean(row.cells[dateColumn]);
            if (!day) { errors.push(`Riga ${row.line}: manca la data di ${label}. Usa una data o «${UNSCHEDULED}».`); return; }
            if (!days.has(day.toLowerCase())) days.set(day.toLowerCase(), day);
            const rename = renameColumn === -1 ? '' : clean(row.cells[renameColumn]);
            if (rename && !sceneKey(rename)) { errors.push(`Riga ${row.line}: il nuovo numero di scena è vuoto.`); return; }
            const nextLabel = rename && sceneKey(rename) !== key
                ? 'sc.' + rename.replace(/^(?:scena|scene|sc)\.?\s*/i, '') : current[index].scena;
            matched.set(index, { data: days.get(day.toLowerCase()), scena: nextLabel });
        });
        if (errors.length) return { errors };

        const remaining = current.map((_, index) => index).filter(index => !matched.has(index));
        // CSV days and scenes first; omitted scenes follow within their day in their original order.
        const groups = new Map();
        [...matched.keys(), ...remaining].forEach(index => {
            const change = matched.get(index);
            const data = change ? change.data : (missingPolicy === 'unscheduled' ? UNSCHEDULED : current[index].data);
            if (!groups.has(data)) groups.set(data, []);
            groups.get(data).push({ index, scene: { ...JSON.parse(JSON.stringify(current[index])), ...(change || {}), data } });
        });
        const order = [...groups.keys()].filter(day => day !== UNSCHEDULED);
        if (groups.has(UNSCHEDULED)) order.push(UNSCHEDULED);
        const arranged = order.flatMap(day => groups.get(day));
        const finalKeys = new Set();
        arranged.forEach(({ scene }) => {
            const key = sceneKey(scene.scena);
            if (finalKeys.has(key)) errors.push(`Il numero ${scene.scena} risulterebbe assegnato a più scene. Correggi la rinumerazione.`);
            finalKeys.add(key);
        });
        if (errors.length) return { errors };
        const preview = arranged.map(({ index, scene }, position) => {
            const before = current[index];
            return { before, after: scene, oldPosition: index + 1, newPosition: position + 1,
                listed: matched.has(index), dateChanged: before.data !== scene.data,
                renamed: before.scena !== scene.scena, moved: index !== position };
        });
        return { errors: [], scenes: arranged.map(({ scene }, index) => ({ ...scene, sortOrder: index })), preview,
            summary: { listed: matched.size, omitted: remaining.length,
                dates: preview.filter(row => row.dateChanged).length,
                renamed: preview.filter(row => row.renamed).length,
                moved: preview.filter(row => row.moved).length,
                changed: preview.filter(row => row.dateChanged || row.renamed || row.moved).length } };
    }

    function exportCSV(scenes) {
        const quote = value => {
            let text = String(value ?? '');
            // Keep spreadsheet applications from evaluating user-entered labels as formulas.
            if (/^[\s]*[=+@-]/.test(text)) text = "'" + text;
            return '"' + text.replace(/"/g, '""') + '"';
        };
        return '\uFEFF' + [['Scena', 'Data', 'Nuova scena', 'Set'],
            ...scenes.map(scene => [scene.scena, scene.data, '', scene.set])]
            .map(row => row.map(quote).join(';')).join('\r\n') + '\r\n';
    }

    const api = { parseCSV, sceneKey, guessColumns, buildPlan, exportCSV };
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    else root.ScheduleImport = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
