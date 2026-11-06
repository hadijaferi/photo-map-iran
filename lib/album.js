function transaction(db, mode, operation) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction('album', mode);
    const request = operation(tx.objectStore('album'));
    tx.oncomplete = () => resolve(request.result);
    tx.onabort = () => reject(tx.error);
  });
}

export async function openAlbum() {
  const db = await new Promise((resolve, reject) => {
    const request = indexedDB.open('photo-map-iran', 1);
    request.onupgradeneeded = () => request.result.createObjectStore('album');
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  try {
    return {db, saved: await transaction(db, 'readonly', store => store.get('current'))};
  } catch (error) {
    db.close();
    throw error;
  }
}

export async function saveAlbum(db, title, photos, version) {
  let conflict = false;
  const records = photos.map(({blob, url, city, suggestion, sample, cover, province}) =>
    ({blob, url: sample ? url : undefined, city, suggestion, sample, cover, province}));
  await transaction(db, 'readwrite', store => {
    const current = store.get('current');
    current.onsuccess = () => {
      if ((current.result?.version ?? 0) !== version) {
        conflict = true;
        return;
      }
      store.put({title, records, version: version + 1}, 'current');
    };
    return current;
  });
  return !conflict;
}
