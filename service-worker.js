const CACHE_NAME = "multesquadra-v7-calendar-url-repair";
const APP_SHELL = [
    "./",
    "./index.html",
    "./runtime-config.js",
    "./style.css",
    "./app.js",
    "./birthdays.js",
    "./birthdays.css",
    "./history.js",
    "./next-match.js",
    "./standings-data.js",
    "./customization-lab.js",
    "./customization-lab.css",
    "./manifest.json",
    "./assets/icon.svg",
    "./vendor/html2canvas.min.js"
];

self.addEventListener("install", event => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => cache.addAll(APP_SHELL.map(url => new Request(url, { cache: "reload" }))))
    );
});

self.addEventListener("message", event => {
    if (event.data?.type === "SKIP_WAITING") self.skipWaiting();
});

self.addEventListener("activate", event => {
    event.waitUntil(
        caches.keys()
            .then(keys => Promise.all(
                keys
                    .filter(key => (key.startsWith("multefc-") || key.startsWith("multesquadra-")) && key !== CACHE_NAME)
                    .map(key => caches.delete(key))
            ))
            .then(() => self.clients.claim())
    );
});

// Cache solo dell'interfaccia locale: i dati Supabase restano sempre separati.
self.addEventListener("fetch", event => {
    const request = event.request;
    const url = new URL(request.url);

    if (request.method === "GET" && request.destination === "image" && url.hostname === "b2-content.tuttocampo.it") {
        event.respondWith(
            caches.match(request).then(cached => cached || fetch(request).then(response => {
                if (response.ok || response.type === "opaque") {
                    event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.put(request, response.clone())));
                }
                return response;
            }))
        );
        return;
    }

    if (request.method !== "GET" || url.origin !== self.location.origin) {
        return;
    }

    if (request.mode === "navigate") {
        event.respondWith(
            fetch(request, { cache: "no-cache" })
                .then(response => {
                    if (!response.ok) throw new Error("Pagina non disponibile");
                    const copy = response.clone();
                    event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.put("./index.html", copy)));
                    return response;
                })
                .catch(() => caches.match("./index.html"))
        );
        return;
    }

    // CSS e JavaScript con ?v= devono essere aggiornati online: la cache
    // resta solo il fallback se manca la connessione, senza bloccare le novità.
    if (url.searchParams.has("v")) {
        event.respondWith(
            fetch(request, { cache: "no-cache" })
                .then(response => {
                    if (response.ok) {
                        caches.open(CACHE_NAME)
                            .then(cache => cache.put(request, response.clone()));
                    }
                    return response;
                })
                .catch(() => caches.match(request, { ignoreSearch: true }))
        );
        return;
    }

    event.respondWith(
        caches.match(request)
            .then(cached => cached || fetch(request))
    );
});







