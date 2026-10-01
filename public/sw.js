// Alligator service worker: lets the installed app open without a network.
// Only the app's own files are handled. Requests to Soniox (and anything else
// on another origin) pass straight through and are never stored.
//
// Strategy: network first, so a published update shows up on the next load;
// the cached copy is used only when the network is unavailable.

const CACHE = "alligator-v1";
const SHELL = [
  "./",
  "index.html",
  "styles.css",
  "app.js",
  "pcm-worklet.js",
  "manifest.webmanifest",
  "fonts/fonts.css",
  "icons/icon.svg",
  "icons/icon-192.png",
  "icons/icon-512.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(SHELL)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);
  if (request.method !== "GET" || url.origin !== self.location.origin) return;
  if (url.pathname.includes("/api/")) return; // live server answers, never cached

  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response.ok) {
          const copy = response.clone();
          caches.open(CACHE).then((cache) => cache.put(request, copy));
        }
        return response;
      })
      .catch(() =>
        caches.match(request).then((hit) => hit || caches.match("index.html")),
      ),
  );
});
