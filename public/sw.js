// Visito service worker: makes the app installable and shows a friendly
// page when there is no internet. It stores ONLY that offline page — never
// pages, data or anything personal; everything else always goes to the network.
const CACHE = "visito-offline-v1";
const OFFLINE = "/offline.html";

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((c) => c.add(OFFLINE))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.mode !== "navigate") return; // assets and API: browser as usual
  event.respondWith(fetch(event.request).catch(() => caches.match(OFFLINE)));
});
