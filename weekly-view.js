let selectedWeek = '';

function ensureSelectedWeek() {
    const weeks = WeeklySchedule.weeks(dbScenes);
    if (!weeks.includes(selectedWeek)) selectedWeek = weeks.includes(WeeklySchedule.monday(currentDay))
        ? WeeklySchedule.monday(currentDay) : weeks[0] || '';
    return weeks;
}
function weekOptions() {
    return ensureSelectedWeek().map(week => `<option value="${week}" ${week === selectedWeek ? 'selected' : ''}>${escapeHtml(WeeklySchedule.label(week))}</option>`).join('');
}
function openWeeklyView() {
    syncInputsToDb();
    selectedWeek = WeeklySchedule.monday(currentDay) || selectedWeek;
    ensureSelectedWeek();
    viewMode = 'weekly';
    renderApp();
    window.scrollTo({ top: 0, behavior: 'smooth' });
}
function changeWeek(value) {
    selectedWeek = value;
    renderApp();
}
function weeklySceneHTML(scene, printable = false) {
    return `<article class="weekly-scene">
        ${printable ? `<h3>${escapeHtml(scene.scena)}</h3>` : `<button type="button" class="weekly-scene-link" data-scene-id="${escapeHtml(scene.id)}" data-day="${escapeHtml(scene.data)}" onclick="jumpToScene(Number(this.dataset.sceneId), this.dataset.day)">${escapeHtml(scene.scena)} ↗</button>`}
        <div class="weekly-set">${escapeHtml(scene.set)}</div>
        <p class="weekly-synopsis">${escapeHtml(scene.sinossi)}</p>
        ${scene.cast ? `<div class="weekly-cast"><strong>🎭 Cast</strong> ${escapeHtml(scene.cast)}</div>` : ''}
        ${scene.extras ? `<div class="weekly-extras"><strong>👥 Extras</strong> ${escapeHtml(scene.extras)}</div>` : ''}
        ${(scene.props || []).length ? `<div class="weekly-props"><strong>📦 Props</strong>${renderGroupedProps(scene.props)}</div>` : ''}
    </article>`;
}
function weekColumnsHTML(printable = false, week = selectedWeek) {
    return WeeklySchedule.days(dbScenes, week).map(day => `<section class="weekly-day ${day.scenes.length ? '' : 'weekly-empty'}">
        <h2>${escapeHtml(day.label)} <small>${day.scenes.length} scene</small></h2>
        <div class="weekly-day-scenes">${day.scenes.map(scene => weeklySceneHTML(scene, printable)).join('') || '<p class="weekly-no-scenes">Nessuna scena</p>'}</div>
    </section>`).join('');
}
function renderWeeklyHTML() {
    const options = weekOptions();
    const unplaced = dbScenes.filter(s => !WeeklySchedule.date(s.data)).length;
    return `<section class="weekly-overview">
        <div class="weekly-toolbar"><h2>📅 Visione settimanale</h2>
            <label>Settimana <select onchange="changeWeek(this.value)">${options}</select></label>
            <button type="button" onclick="setViewMode('days')">← Vista giornaliera</button>
        </div>
        <p class="weekly-hint">Tutte le scene, nell’ordine del piano. Tocca il numero per aprire la scheda.${unplaced ? ` ${unplaced} scene senza data restano nella vista giornaliera.` : ''}</p>
        ${options ? `<div class="weekly-scroll"><div class="weekly-columns">${weekColumnsHTML()}</div></div>` : '<p>Nessuna settimana programmata.</p>'}
    </section>`;
}
function openWeeklyPDF() {
    syncInputsToDb();
    if (viewMode !== 'weekly') selectedWeek = WeeklySchedule.monday(currentDay) || selectedWeek;
    const options = weekOptions();
    if (!options) { showToast('Nessuna settimana programmata da esportare.'); return; }
    document.getElementById('weeklyPdfWeek').innerHTML = options;
    document.getElementById('weeklyPdfStatus').textContent = 'Cast, extras e props di tutta la settimana. Il carattere si adatta allo spazio disponibile.';
    document.getElementById('weeklyPdfDialog').showModal();
}
function weeklyPrintDocument(week = selectedWeek) {
    return `<!doctype html><html lang="it"><head><meta charset="utf-8"><title>Upgraded 2 — ${escapeHtml(WeeklySchedule.label(week))}</title>
    <style>
    @page { size: A3 landscape; margin: 8mm; }
    * { box-sizing: border-box; }
    html,body { margin: 0; padding: 0; color: #17233b; background: white; font-family: Arial, sans-serif; }
    .pdf-sheet { width: 404mm; height: 280mm; display: flex; flex-direction: column; --print-font: 12px; font-size: var(--print-font); line-height: 1.15; }
    header { display: flex; justify-content: space-between; align-items: baseline; gap: 10mm; margin-bottom: 3mm; font-size: 14px; }
    header h1 { margin: 0; font-size: 20px; }
    .weekly-columns { display: flex; flex: 1; min-height: 0; border: 1px solid #94a3b8; }
    .weekly-day { flex: 1; min-width: 0; display: flex; flex-direction: column; border-right: 1px solid #94a3b8; }
    .weekly-day:last-child { border: 0; }
    .weekly-empty { flex: .35; }
    .weekly-day h2 { margin: 0; padding: .4em; background: #e7edf8; font-size: 1.15em; overflow-wrap: anywhere; }
    .weekly-day h2 small { display: block; font-size: .8em; font-weight: normal; }
    .weekly-day-scenes { flex: 1; min-height: 0; }
    .weekly-scene { padding: .4em; border-bottom: 1px solid #a9b6c9; overflow-wrap: anywhere; }
    .weekly-scene h3 { color: #1e3a8a; font-size: 1.2em; margin: 0 0 .15em; }
    .weekly-set { font-weight: bold; }
    .weekly-synopsis { margin: .3em 0; }
    .weekly-cast, .weekly-extras, .weekly-props { margin-top: .25em; padding: .25em; }
    .weekly-cast { background: #eff6ff; color: #1e40af; }
    .weekly-extras { background: #f0fdf4; color: #166534; }
    .weekly-props { background: #fff4c6; color: #85400e; }
    .prop-group { margin-top: .25em; }
    .prop-group-name { display: inline; }
    .prop-group-items { display: inline; margin: 0; padding: 0; list-style: none; }
    .prop-group-items li { display: inline; }
    .prop-group-items li::before { content: ' • '; color: #a46519; }
    .weekly-no-scenes { padding: .4em; color: #64748b; }
    footer { padding-top: 2mm; font-size: 9px; color: #64748b; }
    @media print { body { print-color-adjust: exact; -webkit-print-color-adjust: exact; } }
    </style></head><body><main class="pdf-sheet"><header><h1>Upgraded 2 · PROPS</h1><span>${escapeHtml(WeeklySchedule.label(week))}</span></header>
    <div class="weekly-columns">${weekColumnsHTML(true, week)}</div><footer>↻ Multiples: più copie per i ciak · Le scene senza data non sono incluse.</footer></main></body></html>`;
}
async function prepareWeeklyPDF(week = selectedWeek) {
    const existing = document.getElementById('weeklyPrintFrame');
    if (existing) existing.remove();
    const frame = document.createElement('iframe');
    frame.id = 'weeklyPrintFrame';
    frame.title = 'Documento PDF settimanale';
    frame.setAttribute('aria-hidden', 'true');
    frame.style.cssText = 'position:fixed;left:-10000px;top:0;width:1600px;height:1100px;border:0;';
    const ready = new Promise(resolve => { frame.onload = resolve; });
    frame.srcdoc = weeklyPrintDocument(week);
    document.body.append(frame);
    await ready;
    const doc = frame.contentDocument;
    await doc.fonts.ready;
    const sheet = doc.querySelector('.pdf-sheet');
    const fits = size => {
        sheet.style.setProperty('--print-font', `${size}px`);
        return [...doc.querySelectorAll('.weekly-day-scenes, .weekly-day')].every(el => el.scrollHeight <= el.clientHeight && el.scrollWidth <= el.clientWidth);
    };
    // Measure the actual A3 layout. A single common font keeps every day comparable.
    let low = 1, high = 24;
    if (!fits(low)) throw new Error('Contenuto troppo grande per una sola pagina.');
    for (let i = 0; i < 16; i++) {
        const middle = (low + high) / 2;
        if (fits(middle)) low = middle; else high = middle;
    }
    const size = Math.floor(low * 10) / 10;
    fits(size);
    return { frame, fontSize: size };
}
async function printWeeklyPDF() {
    const button = document.getElementById('weeklyPdfPrint');
    button.disabled = true;
    try {
        const week = document.getElementById('weeklyPdfWeek').value;
        const { frame, fontSize } = await prepareWeeklyPDF(week);
        document.getElementById('weeklyPdfStatus').textContent = `Pronto: una pagina A3 orizzontale, carattere ${(fontSize * .75).toFixed(1)} pt. Nella finestra di stampa scegli “Salva come PDF”, scala 100%, senza intestazioni e piè di pagina del browser.`;
        frame.contentWindow.focus();
        frame.contentWindow.print();
    } catch (error) {
        document.getElementById('weeklyPdfStatus').textContent = `PDF non creato: ${error.message}`;
    } finally { button.disabled = false; }
}
