const CACHE = "nexus-public-shell-v3";
self.addEventListener("install", (e) => {
  e.waitUntil(
    (async () => {
      const c = await caches.open(CACHE);
      await c.addAll(["/", "/icon.svg", "/manifest.webmanifest"]);
      const html = await (await c.match("/")).text();
      const assets = [...html.matchAll(/(?:src|href)="([^"]+)"/g)]
        .map((m) => m[1])
        .filter((url) => url.startsWith("/assets/"));
      await c.addAll(assets);
    })(),
  );
  self.skipWaiting();
});
self.addEventListener("activate", (e) =>
  e.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all([
          ...keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)),
          self.clients.claim(),
        ]),
      ),
  ),
);
self.addEventListener("fetch", (e) => {
  const u = new URL(e.request.url);
  if (
    u.origin !== location.origin ||
    e.request.method !== "GET" ||
    u.pathname.startsWith("/api") ||
    u.pathname.startsWith("/socket.io")
  )
    return;
  if (e.request.mode === "navigate") {
    e.respondWith(fetch(e.request).catch(() => caches.match("/")));
    return;
  }
  if (
    u.pathname.startsWith("/assets/") ||
    u.pathname === "/icon.svg" ||
    u.pathname === "/manifest.webmanifest"
  ) {
    e.respondWith(
      caches.open(CACHE).then(async (c) => {
        const hit = await c.match(e.request);
        if (hit) return hit;
        const res = await fetch(e.request);
        if (res.ok) c.put(e.request, res.clone());
        return res;
      }),
    );
  }
});
