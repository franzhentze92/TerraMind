/* TerraMind Campo PWA — shell cache only; never touches IndexedDB */
const CACHE_SHELL = 'terramind-campo-shell-v1'

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_SHELL).then((cache) =>
      cache.addAll(['/', '/index.html', '/favicon.svg', '/manifest.webmanifest']),
    ),
  )
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_SHELL).map((k) => caches.delete(k))),
    ),
  )
  self.clients.claim()
})

self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET') return

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(() => caches.match('/index.html')),
    )
    return
  }

  if (request.url.includes('/campo') || request.destination === 'document') {
    event.respondWith(
      caches.match(request).then((cached) => cached ?? fetch(request)),
    )
  }
})
