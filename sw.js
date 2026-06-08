const CACHE = "snake-v1";
const ASSETS = [
  "snake.html",
  "index.html",
  "ranking.html",
  "estadisticas.html",
  "usuarios.json",
  "icon.svg",
  "icon-192.png",
  "icon-512.png",
  "manifest.json"
];

self.addEventListener("install", (e) => {
  self.skipWaiting();
  e.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(ASSETS))
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    )
  );
});

self.addEventListener("fetch", (e) => {
  const { request } = e;
  if (request.method !== "GET") return;
  if (request.url.includes("usuarios.json")) {
    e.respondWith(
      fetch(request).catch(() => caches.match(request))
    );
    return;
  }
  e.respondWith(
    caches.match(request).then((cached) => cached || fetch(request).catch(() => cached))
  );
});
