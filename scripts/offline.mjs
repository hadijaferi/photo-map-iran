import {createHash} from 'node:crypto';
import {readFile, readdir, writeFile} from 'node:fs/promises';
import path from 'node:path';

const paths = (await readdir('out', {recursive:true, withFileTypes:true}))
  .filter(entry => entry.isFile() && !entry.name.startsWith('.'))
  .map(entry => path.relative('out', path.join(entry.parentPath, entry.name)))
  .sort();
const hash = createHash('sha256');
for (const file of paths) hash.update(await readFile(path.join('out', file)));
const version = 'photo-map-' + hash.digest('hex').slice(0,16);
const resources = ['./', './album/', ...paths.map(file => './'+file)];

await writeFile('out/sw.js', `
const version = ${JSON.stringify(version)};
const scope = self.registration.scope;
const resources = ${JSON.stringify(resources)}.map(file => new URL(file, scope).href);

self.addEventListener('install', event => {
  event.waitUntil(caches.open(version).then(cache => cache.addAll(resources)));
});
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys
    .filter(key => key.startsWith('photo-map-') && key !== version)
    .map(key => caches.delete(key)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET' || !request.url.startsWith(scope)) return;
  event.respondWith(caches.open(version).then(async cache => {
    if (request.mode === 'navigate') {
      try { return await fetch(request); }
      catch { return await cache.match(request, {ignoreSearch:true}) ?? Response.error(); }
    }
    return await cache.match(request) ?? fetch(request);
  }));
});
`);
await writeFile('out/.nojekyll', '');
