/* FacturePro service worker.
   CACHE VERSION: facturepro-shell-v1
   Keep this name identical to SW_CACHE_NAME in lib/offline.ts.
   Bump the suffix on both sides when a release must drop cached files.
   The script is registered with updateViaCache: "none" and served Cache-Control: no-cache,
   so a new deploy replaces the worker instead of leaving users on an old shell.
   Never cache /api/* (Stripe checkout, subscription check, webhook) or this file. */
const CACHE = "facturepro-shell-v1";

const SHELL = ["/", "/manifest.webmanifest", "/icon-192.png", "/icon-512.png", "/icon.svg"];

function cacheable(req) {
  if (req.method !== "GET") return false;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return false;
  if (url.pathname === "/sw.js" || url.pathname.startsWith("/api/")) return false;
  if (url.search.includes("_rsc=") || url.search.includes("__next")) return false;
  if (req.headers.get("RSC") === "1") return false;
  if (req.headers.get("Next-Router-Prefetch") === "1") return false;
  return true;
}

async function precacheShell() {
  const cache = await caches.open(CACHE);
  let html = "";
  try {
    const res = await fetch(new Request("/", { cache: "no-store" }));
    if (res.ok) {
      html = await res.clone().text();
      await cache.put(new Request(new URL("/", self.location.origin).href), res);
    }
  } catch {
    /* filled later by runtime caching */
  }
  const urls = new Set(SHELL.filter((u) => u !== "/"));
  const re = /(?:src|href)="(\/_next\/static\/[^"]+)"/g;
  let match;
  while ((match = re.exec(html))) urls.add(match[1]);
  await Promise.all(
    [...urls].map(async (path) => {
      try {
        const res = await fetch(path);
        if (res.ok) await cache.put(path, res);
      } catch {
        /* skip a missing asset; don't fail the install */
      }
    })
  );
}

function offlineDocument() {
  const html = `<!doctype html><html lang="fr"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>FacturePro</title><body style="font-family:system-ui,sans-serif;background:#f8fafc;color:#0f172a;margin:0;padding:2.5rem 1.25rem"><main style="max-width:32rem;margin:0 auto"><h1 style="font-size:1.5rem">Mode hors ligne</h1><p>Le mode hors ligne est réservé à l'abonnement Pro. Ouvrez FacturePro une fois en ligne avec un compte Pro pour garder l'application sur cet appareil.</p><p style="color:#475569">Offline mode is part of the Pro plan. Open FacturePro once while online with a Pro account to keep the app on this device.</p></main></body></html>`;
  return new Response(html, { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" } });
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      try {
        await precacheShell();
      } catch {
        /* ignore */
      }
      await self.skipWaiting();
    })()
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((key) => key.startsWith("facturepro-") && key !== CACHE).map((key) => caches.delete(key)));
      await self.clients.claim();
    })()
  );
});

self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") self.skipWaiting();
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (!cacheable(req)) return;
  const url = new URL(req.url);
  const cacheKey = req.mode === "navigate" ? new Request(url.origin + url.pathname) : req;

  if (req.mode === "navigate") {
    event.respondWith(
      (async () => {
        const cache = await caches.open(CACHE);
        try {
          const fresh = await fetch(req);
          if (fresh.ok && fresh.type === "basic") await cache.put(cacheKey, fresh.clone());
          return fresh;
        } catch {
          const cached = (await cache.match(cacheKey)) || (await cache.match("/"));
          return cached || offlineDocument();
        }
      })()
    );
    return;
  }

  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE);
      if (url.pathname.startsWith("/_next/static/")) {
        const cached = await cache.match(req);
        if (cached) return cached;
      }
      try {
        const fresh = await fetch(req);
        if (fresh.ok && fresh.type === "basic") await cache.put(req, fresh.clone());
        return fresh;
      } catch {
        const cached = await cache.match(req);
        if (cached) return cached;
        if (req.destination === "document") return offlineDocument();
        return new Response("", { status: 504, statusText: "Offline" });
      }
    })()
  );
});
