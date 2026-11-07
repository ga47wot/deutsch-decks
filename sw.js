/* sw.js — Deutsch Decks service worker.
 * Bump CACHE_VERSION whenever app files or deck data change.
 */
"use strict";

const CACHE_VERSION = "dd-v1.4.2";
const CATALOGUE = "data/YGT_deck-index.json";
const BOOK_DIRS = {
  A2_1: "data/A2.1_flaschcards/",
  A2_2: "data/A2.2_flashcards/",
  B1_1: "data/B1.1_flashcards/",
};

const SHELL = [
  "./",
  "index.html",
  "css/app.css",
  "js/store.js",
  "js/srs.js",
  "js/tts.js",
  "js/decks.js",
  "js/study.js",
  "js/grammar.js",
  "js/browse.js",
  "js/app.js",
  "manifest.webmanifest",
  "icons/icon-192.png",
  "icons/icon-512.png",
  "icons/icon-maskable-512.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_VERSION);
    // cache: "reload" bypasses the HTTP cache so a new version never gets
    // filled with stale shell files (mixed old/new versions break the app)
    await cache.addAll(SHELL.map(u => new Request(u, { cache: "reload" })));
    // cache the catalogue plus every created deck it lists
    try {
      const res = await fetch(CATALOGUE, { cache: "no-cache" });
      if (res.ok) {
        await cache.put(CATALOGUE, res.clone());
        const cat = await res.json();
        const files = (cat.decks || [])
          .filter(d => d.status === "created" && d.file && BOOK_DIRS[d.book_id])
          .map(d => BOOK_DIRS[d.book_id] + d.file);
        await Promise.all(files.map(async (url) => {
          try {
            const r = await fetch(url, { cache: "no-cache" });
            if (r.ok) await cache.put(url, r);
          } catch (e) { /* deck stays uncached; app reports it */ }
        }));
      }
    } catch (e) { /* offline install of an already-cached app */ }
  })());
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(names.filter(n => n !== CACHE_VERSION).map(n => caches.delete(n)));
    await self.clients.claim();
  })());
});

self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") self.skipWaiting();
});

/* Cache-first for everything in scope; network fallback updates the cache.
 * Navigations fall back to the cached index.html when offline. */
self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET" || !req.url.startsWith(self.location.origin)) return;

  event.respondWith((async () => {
    const cache = await caches.open(CACHE_VERSION);
    const cached = await cache.match(req, { ignoreSearch: true });
    if (cached) return cached;
    try {
      const res = await fetch(req);
      if (res.ok && res.type === "basic") cache.put(req, res.clone());
      return res;
    } catch (e) {
      if (req.mode === "navigate") {
        const shell = await cache.match("index.html");
        if (shell) return shell;
      }
      return new Response("Offline and not cached.", { status: 503, statusText: "Offline" });
    }
  })());
});
