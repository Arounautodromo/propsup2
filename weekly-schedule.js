(function (root, factory) {
    if (typeof module === 'object' && module.exports) module.exports = factory();
    else root.WeeklySchedule = factory();
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
    // Dates without a year belong to this production's 2026 schedule.
    const PRODUCTION_YEAR = 2026;
    const months = ['gen', 'feb', 'mar', 'apr', 'mag', 'giu', 'lug', 'ago', 'set', 'ott', 'nov', 'dic'];
    const DAY = 86400000;
    function date(value) {
        const text = String(value || '').trim().toLowerCase();
        const iso = text.match(/^(\d{4})-(\d{2})-(\d{2})$/);
        const local = text.match(/^(\d{1,2})\s+([a-z]+)\.?(?:\s+(\d{4}))?$/);
        if (!iso && !local) return null;
        const year = iso ? +iso[1] : +(local[3] || PRODUCTION_YEAR);
        const month = iso ? +iso[2] - 1 : months.indexOf(local[2].slice(0, 3));
        const day = iso ? +iso[3] : +local[1];
        const result = new Date(Date.UTC(year, month, day));
        return month >= 0 && result.getUTCFullYear() === year && result.getUTCMonth() === month && result.getUTCDate() === day ? result : null;
    }
    const key = date => date.toISOString().slice(0, 10);
    function monday(value) {
        const parsed = date(value);
        return parsed ? key(new Date(+parsed - ((parsed.getUTCDay() + 6) % 7) * DAY)) : null;
    }
    function weeks(scenes) {
        return [...new Set(scenes.map(s => monday(s.data)).filter(Boolean))].sort();
    }
    function days(scenes, start) {
        const first = date(start);
        if (!first) return [];
        return Array.from({ length: 7 }, (_, i) => {
            const day = new Date(+first + i * DAY);
            const dayKey = key(day);
            return { key: dayKey, label: day.toLocaleDateString('it-IT', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' }),
                scenes: scenes.filter(s => { const parsed = date(s.data); return parsed && key(parsed) === dayKey; }) };
        });
    }
    function label(start) {
        const week = days([], start);
        return week.length ? `${week[0].label} – ${week[6].label} ${week[6].key.slice(0, 4)}` : '';
    }
    return { date, monday, weeks, days, label };
});
