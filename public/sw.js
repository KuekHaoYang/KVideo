const LEGACY_CACHE_PREFIXES = ['video-cache-'];

self.addEventListener('install', () => {
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys()
            .then((cacheNames) => Promise.all(
                cacheNames
                    .filter((cacheName) => LEGACY_CACHE_PREFIXES.some((prefix) => cacheName.startsWith(prefix)))
                    .map((cacheName) => caches.delete(cacheName))
            ))
            .then(() => self.clients.claim())
    );
});
