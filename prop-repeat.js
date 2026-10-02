(function (root, factory) {
    if (typeof module === 'object' && module.exports) module.exports = factory();
    else root.PropRepeat = factory();
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
    'use strict';
    // Use the existing persisted prop note field: no new schema or prop IDs needed.
    // The readable header survives backups/imports; editors display only the note.
    const marker = '↻ A RIPETERE\n';
    const isRepeated = note => typeof note === 'string' && note.startsWith(marker);
    const getNote = note => isRepeated(note) ? note.slice(marker.length) : (note || '');
    const setRepeated = (note, repeated) => (repeated ? marker : '') + getNote(note);
    return { isRepeated, getNote, setRepeated };
});
