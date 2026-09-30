(function (root, factory) {
    if (typeof module === 'object' && module.exports) module.exports = factory();
    else root.SceneReview = factory();
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
    'use strict';
    // Keep the flag with the scene in the existing persisted adminNotes field.
    // This also survives server-generated IDs, schedule imports and JSON backups.
    // Older clients see a readable heading; current editors display only the note.
    const marker = '🚩 DA RIVEDERE\n';
    const photosMarker = '\n[[SCENE_PHOTOS_V1]]\n';

    function splitStored(stored) {
        const value = typeof stored === 'string' ? stored : '';
        const index = value.lastIndexOf(photosMarker);
        if (index < 0) return { content: value, photos: [] };
        try {
            const photos = JSON.parse(value.slice(index + photosMarker.length));
            if (!Array.isArray(photos)) return { content: value, photos: [] };
            return { content: value.slice(0, index), photos };
        } catch (_) { return { content: value, photos: [] }; }
    }

    function pack(content, photos) {
        const metadata = Array.isArray(photos) ? photos.filter(photo => photo && typeof photo.path === 'string' && photo.path) : [];
        return metadata.length ? content + photosMarker + JSON.stringify(metadata) : content;
    }

    const isFlagged = notes => splitStored(notes).content.startsWith(marker);
    const getNote = notes => {
        const content = splitStored(notes).content;
        return content.startsWith(marker) ? content.slice(marker.length) : content;
    };
    const setNote = (stored, note) => {
        const { content, photos } = splitStored(stored);
        return pack((content.startsWith(marker) ? marker : '') + String(note ?? ''), photos);
    };
    const toggle = stored => {
        const { content, photos } = splitStored(stored);
        const next = content.startsWith(marker) ? content.slice(marker.length) : marker + content;
        return pack(next, photos);
    };
    const getPhotos = stored => splitStored(stored).photos;
    const setPhotos = (stored, photos) => pack(splitStored(stored).content, photos);
    return { isFlagged, getNote, setNote, toggle, getPhotos, setPhotos };
});
