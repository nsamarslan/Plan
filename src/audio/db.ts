// Imported audio files live in IndexedDB on each device (they are too big to sync).

export type AudioKind = 'music' | 'voice';

export interface AudioFile {
  id: string;
  name: string;
  kind: AudioKind;
  type: string;
  size: number;
  addedAt: number;
  blob: Blob;
}

export type AudioMeta = Omit<AudioFile, 'blob'>;

const DB = 'plan-audio';
const STORE = 'files';

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: 'id' });
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function tx<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await open();
  return new Promise((resolve, reject) => {
    const t = db.transaction(STORE, mode);
    const req = fn(t.objectStore(STORE));
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function addAudio(file: File, kind: AudioKind): Promise<AudioMeta> {
  const rec: AudioFile = {
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

export async function listAudio(): Promise<AudioMeta[]> {
  try {
    const all = await tx<AudioFile[]>('readonly', (s) => s.getAll() as IDBRequest<AudioFile[]>);
    return all.map(({ blob: _blob, ...m }) => m).sort((a, b) => a.addedAt - b.addedAt);
  } catch {
    return [];
  }
}

export async function getAudio(id: string): Promise<AudioFile | undefined> {
  try {
    return await tx<AudioFile | undefined>('readonly', (s) => s.get(id) as IDBRequest<AudioFile | undefined>);
  } catch {
    return undefined;
  }
}

export async function deleteAudio(id: string): Promise<void> {
  await tx('readwrite', (s) => s.delete(id));
}
