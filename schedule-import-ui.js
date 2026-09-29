(function () {
    'use strict';
    const element = id => document.getElementById(id);
    const dialog = element('scheduleDialog');
    let session = null, csv = null, plan = null, text = '', reading = false, saving = false, readToken = 0;

    function download(content, filename, type) {
        const url = URL.createObjectURL(new Blob([content], { type }));
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        try { link.click(); }
        finally { link.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000); }
    }

    function showErrors(messages) {
        const box = element('scheduleErrors');
        box.classList.toggle('hidden', !messages.length);
        box.innerHTML = messages.length ? '<ul>' + messages.slice(0, 50)
            .map(message => `<li>${escapeHtml(message)}</li>`).join('') + '</ul>' +
            (messages.length > 50 ? `<p>Altri ${messages.length - 50} errori: correggi il file e ricaricalo.</p>` : '') : '';
    }

    function updateControls() {
        element('scheduleFields').disabled = reading || saving;
        element('scheduleClose').disabled = saving;
        element('scheduleCancel').disabled = saving;
        element('scheduleDownload').disabled = saving;
        element('scheduleApply').disabled = reading || saving || !plan || !!plan.errors.length || !plan.summary?.changed;
    }

    function close() {
        if (saving) return;
        dialog.close();
    }

    function open() {
        if (!isAdmin || dialog.open) return;
        if (isDirty) { showToast('Salva le modifiche in Admin prima di importare il piano.', true); return; }
        if (dataVersion === null || !dbScenes.length) { showToast('Carica le scene del sito prima di importare il piano.', true); return; }
        session = { scenes: JSON.parse(JSON.stringify(dbScenes)), fingerprint: JSON.stringify(dbScenes), version: dataVersion };
        csv = null; plan = null; text = ''; reading = false;
        element('scheduleFile').value = '';
        element('scheduleSeparator').value = 'auto';
        element('scheduleMissing').value = 'keep';
        element('scheduleMapping').classList.add('hidden');
        element('schedulePreview').classList.add('hidden');
        element('scheduleStatus').textContent = '';
        showErrors([]);
        updateControls();
        dialog.showModal();
    }

    function parseFile() {
        csv = null; plan = null;
        element('scheduleMapping').classList.add('hidden');
        element('schedulePreview').classList.add('hidden');
        showErrors([]);
        try {
            const separator = element('scheduleSeparator').value;
            csv = ScheduleImport.parseCSV(text, separator === 'tab' ? '\t' : separator);
            const guesses = ScheduleImport.guessColumns(csv.headers);
            [['scheduleSceneColumn', 'sceneColumn'], ['scheduleDateColumn', 'dateColumn'], ['scheduleRenameColumn', 'renameColumn']]
                .forEach(([id, key]) => {
                    const select = element(id);
                    select.innerHTML = `<option value="-1">${key === 'renameColumn' ? 'Non rinumerare' : 'Scegli una colonna…'}</option>` +
                        csv.headers.map((header, index) => `<option value="${index}">${index + 1}. ${escapeHtml(header || '(senza nome)')}</option>`).join('');
                    select.value = String(guesses[key]);
                });
            element('scheduleMapping').classList.remove('hidden');
            element('scheduleStatus').textContent = `${csv.rows.length} righe lette. Controlla le colonne e l'anteprima.`;
            renderPreview();
        } catch (error) { showErrors([error.message]); }
        updateControls();
    }

    async function readFile(event) {
        const file = event.target.files[0];
        if (!file || saving) return;
        const token = ++readToken;
        plan = null; csv = null; text = '';
        element('scheduleMapping').classList.add('hidden');
        element('schedulePreview').classList.add('hidden');
        element('scheduleStatus').textContent = '';
        showErrors([]);
        if (!/\.(csv|tsv)$/i.test(file.name) || file.size > 2 * 1024 * 1024) {
            showErrors(['Scegli un file CSV o TSV di massimo 2 MB. Da Excel usa «Salva con nome → CSV UTF-8».']);
            updateControls();
            return;
        }
        reading = true;
        element('scheduleStatus').textContent = 'Lettura del file…';
        updateControls();
        try {
            const bytes = new Uint8Array(await file.arrayBuffer());
            let decoded;
            if (bytes[0] === 0xff && bytes[1] === 0xfe) decoded = new TextDecoder('utf-16le').decode(bytes);
            else if (bytes[0] === 0xfe && bytes[1] === 0xff) decoded = new TextDecoder('utf-16be').decode(bytes);
            else {
                try { decoded = new TextDecoder('utf-8', { fatal: true }).decode(bytes); }
                catch (_) { decoded = new TextDecoder('windows-1252').decode(bytes); }
            }
            if (token !== readToken || !session) return;
            text = decoded;
            parseFile();
        } catch (_) {
            if (token === readToken) {
                element('scheduleStatus').textContent = '';
                showErrors(['Non riesco a leggere il file. Esportalo nuovamente come CSV e riprova.']);
            }
        } finally {
            if (token === readToken) { reading = false; updateControls(); }
        }
    }

    function renderPreview() {
        if (!session || !csv || saving) return;
        plan = ScheduleImport.buildPlan(session.scenes, csv, {
            sceneColumn: Number(element('scheduleSceneColumn').value),
            dateColumn: Number(element('scheduleDateColumn').value),
            renameColumn: Number(element('scheduleRenameColumn').value),
            missingPolicy: element('scheduleMissing').value
        });
        showErrors(plan.errors);
        element('schedulePreview').classList.toggle('hidden', !!plan.errors.length);
        if (!plan.errors.length) {
            const s = plan.summary;
            element('scheduleSummary').textContent = `${s.listed} scene nel CSV · ${s.omitted} assenti dal CSV · ${s.dates} date modificate · ${s.renamed} scene rinumerate · ${s.moved} posizioni modificate.` +
                (s.changed ? '' : ' Il piano coincide con quello attuale.');
            const cell = (before, after, changed) => `<td${changed ? ' class="schedule-changed"' : ''}>${changed ? `<span class="schedule-before">Prima: ${escapeHtml(before)}</span>` : ''}${escapeHtml(after)}</td>`;
            element('scheduleRows').innerHTML = plan.preview.map(row => '<tr>' +
                cell(row.oldPosition, row.newPosition, row.moved) +
                cell(row.before.scena, row.after.scena, row.renamed) +
                cell(row.before.data, row.after.data, row.dateChanged) +
                `<td>${row.listed ? '📄 CSV' : '📌 Conservata dal sito'}</td></tr>`).join('');
        }
        updateControls();
    }

    async function apply() {
        if (!isAdmin || !session || !plan || plan.errors.length || !plan.summary.changed || reading || saving) return;
        if (isDirty || dataVersion !== session.version || JSON.stringify(dbScenes) !== session.fingerprint) {
            plan = null;
            showErrors(['I dati locali sono cambiati. Chiudi l’importazione e aprila di nuovo per aggiornare l’anteprima.']);
            updateControls();
            return;
        }
        saving = true;
        showErrors([]);
        element('scheduleStatus').textContent = 'Salvataggio del piano in corso…';
        updateControls();
        try {
            download(JSON.stringify(session.scenes, null, 2),
                `backup_prima_del_piano_${new Date().toISOString().replace(/[:.]/g, '-')}.json`, 'application/json');
            const saved = await sendScenes(plan.scenes, { allowEmpty: false, force: false });
            applySaved(saved.scenes, saved.version);
            currentDay = getAvailableDays()[0] || '';
            viewMode = 'days'; searchQuery = '';
            element('searchInput').value = '';
            renderApp();
            saving = false;
            close();
            showToast('✅ Piano aggiornato e pubblicato. Backup scaricato.');
        } catch (error) {
            element('scheduleStatus').textContent = '';
            if (error.code === 'CONFLICT') {
                plan = null;
                showErrors(['Il sito è stato aggiornato da un altro dispositivo. Chiudi questa finestra, ricarica la pagina e importa di nuovo il CSV per controllare le nuove differenze.']);
            } else {
                showErrors(['Salvataggio non confermato. Controlla la connessione e riprova; se il sito è stato aggiornato nel frattempo, ti verrà chiesto di ricaricare.']);
            }
        } finally { saving = false; updateControls(); }
    }

    element('scheduleDownload').addEventListener('click', () => {
        if (isAdmin && session && !saving) download(ScheduleImport.exportCSV(session.scenes), 'piano_di_lavorazione.csv', 'text/csv;charset=utf-8');
    });
    element('scheduleFile').addEventListener('change', readFile);
    element('scheduleSeparator').addEventListener('change', () => { if (text && session && !saving) parseFile(); });
    ['scheduleSceneColumn', 'scheduleDateColumn', 'scheduleRenameColumn', 'scheduleMissing']
        .forEach(id => element(id).addEventListener('change', renderPreview));
    element('scheduleApply').addEventListener('click', apply);
    element('scheduleClose').addEventListener('click', close);
    element('scheduleCancel').addEventListener('click', close);
    dialog.addEventListener('cancel', event => { if (saving) event.preventDefault(); });
    dialog.addEventListener('close', () => {
        readToken++; session = null; csv = null; plan = null; text = ''; reading = false;
        // Do not retain the file or scene notes in a closed importer.
        element('scheduleFile').value = '';
        element('scheduleRows').replaceChildren();
    });
    window.addEventListener('beforeunload', event => { if (saving) { event.preventDefault(); event.returnValue = ''; } });
    window.ScheduleImportUI = { open };
})();
