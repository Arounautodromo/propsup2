(function (root, factory) {
    if (typeof module === 'object' && module.exports) module.exports = factory();
    else root.SceneReview = factory();
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
    'use strict';
    // Keep the flag with the scene in the existing persisted adminNotes field.
    // This also survives server-generated IDs, schedule imports and JSON backups.
    // Older clients see a readable heading; current editors display only the note.
    const marker = '🚩 DA RIVEDERE\n';
    const isFlagged = notes => typeof notes === 'string' && notes.startsWith(marker);
    const getNote = notes => isFlagged(notes) ? notes.slice(marker.length) : (notes || '');
    const setNote = (stored, note) => (isFlagged(stored) ? marker : '') + note;
    const toggle = notes => isFlagged(notes) ? getNote(notes) : marker + (notes || '');
    return { isFlagged, getNote, setNote, toggle };
});
