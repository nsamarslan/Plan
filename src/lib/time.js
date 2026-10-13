// Time helpers. A day's schedule is stored as minutes from local midnight
// ("Minutes"); a calendar day is a local "YYYY-MM-DD" string ("DateKey").
export const DAY_MIN = 24 * 60;
export const MIN_MS = 60_000;
const pad = (n) => String(n).padStart(2, '0');
export function dateKey(d) {
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
export function parseDateKey(key) {
    const [y, m, d] = key.split('-').map(Number);
    return new Date(y, m - 1, d);
}
export function addDays(key, n) {
    const d = parseDateKey(key);
    d.setDate(d.getDate() + n);
    return dateKey(d);
}
/** Whole days from a to b (b - a), DST-safe. */
export function daysBetween(a, b) {
    const da = parseDateKey(a);
    const db = parseDateKey(b);
    return Math.round((Date.UTC(db.getFullYear(), db.getMonth(), db.getDate()) -
        Date.UTC(da.getFullYear(), da.getMonth(), da.getDate())) /
        86_400_000);
}
/** 0 = Sunday … 6 = Saturday */
export function weekday(key) {
    return parseDateKey(key).getDay();
}
/** Local timestamp (ms) of `min` minutes after midnight on `key`. */
export function msAt(key, min) {
    const d = parseDateKey(key);
    d.setMinutes(min);
    return d.getTime();
}
export function minutesOfDay(d) {
    return d.getHours() * 60 + d.getMinutes() + d.getSeconds() / 60;
}
export function fmt(min) {
    const m = ((Math.round(min) % DAY_MIN) + DAY_MIN) % DAY_MIN;
    return `${pad(Math.floor(m / 60))}:${pad(m % 60)}`;
}
export function parseHM(s) {
    const m = /^(\d{1,2}):(\d{2})$/.exec(s.trim());
    if (!m)
        return null;
    const h = Number(m[1]);
    const mm = Number(m[2]);
    if (h > 23 || mm > 59)
        return null;
    return h * 60 + mm;
}
export function fmtDuration(min) {
    const m = Math.max(0, Math.round(min));
    if (m < 60)
        return `${m} dk`;
    const h = Math.floor(m / 60);
    const r = m % 60;
    return r ? `${h} sa ${r} dk` : `${h} sa`;
}
/** mm:ss for countdowns under an hour, h:mm:ss above. */
export function fmtClock(totalSec) {
    const s = Math.max(0, Math.floor(totalSec));
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    return h ? `${h}:${pad(m)}:${pad(sec)}` : `${pad(m)}:${pad(sec)}`;
}
export const WEEKDAYS_SHORT = ['Paz', 'Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt'];
export const WEEKDAYS_LONG = ['Pazar', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi'];
/** Monday-first order for pickers. */
export const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0];
export const ALL_DAYS = [0, 1, 2, 3, 4, 5, 6];
const MONTHS = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];
export function fmtDateLong(key) {
    const d = parseDateKey(key);
    return `${d.getDate()} ${MONTHS[d.getMonth()]} ${WEEKDAYS_LONG[d.getDay()]}`;
}
