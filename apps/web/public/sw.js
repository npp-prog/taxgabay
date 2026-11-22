// TaxGabay service worker: offline access to guides and calculators.
// Static assets: cache-first. Pages: network-first, falling back to cache.
const VERSION = "v5";
const CACHE = `taxgabay-${VERSION}`;
const PRECACHE = [
  "/",
  "/calculators",
  "/calculators/income-tax",
  "/calculators/percentage-tax",
  "/calculators/vat",
  "/calculators/penalty",
  "/guides",
  "/business-guide",
  "/practice",
  "/practice/freelance-designer",
  "/guides/1701q",
  "/guides/1701",
  "/guides/1701a",
  "/guides/2551q",
  "/guides/2550q",
  "/guides/1601c",
  "/guides/0619e",
  "/guides/1601eq",
  "/guides/1604c",
  "/guides/1604e",
  "/guides/1702q",
  "/guides/1702-rt",
  "/guides/1706",
  "/guides/1707",
  "/guides/1800",
  "/guides/1801",
  "/guides/2000-ot",
  "/guides/1905",
  "/calculators/corporate",
  "/calculators/withholding-compensation",
  "/calculators/ewt",
  "/calculators/estate",
  "/calculators/donors",
  "/calculators/cgt",
  "/calculators/dst",
  "/life-events",
  "/learn",
  "/learn/glossary",
  "/learn/faq",
  "/issuances",
  "/manifest.webmanifest",
  "/icon.svg",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((c) => Promise.allSettled(PRECACHE.map((u) => c.add(u))))
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
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(
      caches.match(req).then(
        (hit) =>
          hit ||
          fetch(req).then((res) => {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(req, copy));
            return res;
          }),
      ),
    );
    return;
  }

  if (req.mode === "navigate" || req.headers.get("accept")?.includes("text/html")) {
    event.respondWith(
      fetch(req)
        .then((res) => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(req, copy));
          }
          return res;
        })
        .catch(() => caches.match(req).then((hit) => hit || caches.match("/"))),
    );
  }
});

// Web push reminders (payload: { title, body, url }).
self.addEventListener("push", (event) => {
  let data = { title: "TaxGabay reminder", body: "You have a BIR deadline coming up.", url: "/calendar" };
  try {
    if (event.data) data = { ...data, ...event.data.json() };
  } catch {
    /* plain-text payload: keep defaults */
  }
  event.waitUntil(self.registration.showNotification(data.title, { body: data.body, icon: "/icon.svg", data: { url: data.url } }));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = new URL(event.notification.data?.url || "/calendar", self.location.origin).href;
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
      const open = list.find((c) => c.url === url);
      return open ? open.focus() : self.clients.openWindow(url);
    }),
  );
});
