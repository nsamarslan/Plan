// Imported audio files live in IndexedDB on each device (they are too big to sync).
const DB = 'plan-audio';
const STORE = 'files';
function open() {
    return new Promise((resolve, reject) => {
        const req = indexedDB.open(DB, 1);
        req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: 'id' });
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
    });
}
async function tx(mode, fn) {
    const db = await open();
    return new Promise((resolve, reject) => {
        const t = db.transaction(STORE, mode);
        const req = fn(t.objectStore(STORE));
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
    });
}
export async function addAudio(file, kind) {
    const rec = {
        id: `a${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
        name: file.name.replace(/\.[a-z0-9]+$/i, ''),
        kind,
        type: file.type || 'audio/mpeg',
        size: file.size,
        addedAt: Date.now(),
        blob: file,
    };
    await tx('readwrite', (s) => s.put(rec));
    const { blob: _blob, ...meta } = rec;
    return meta;
}
export async function listAudio() {
    try {
        const all = await tx('readonly', (s) => s.getAll());
        return all.map(({ blob: _blob, ...m }) => m).sort((a, b) => a.addedAt - b.addedAt);
    }
    catch {
        return [];
    }
}
export async function getAudio(id) {
    try {
        return await tx('readonly', (s) => s.get(id));
    }
    catch {
        return undefined;
    }
}
export async function deleteAudio(id) {
    await tx('readwrite', (s) => s.delete(id));
}
