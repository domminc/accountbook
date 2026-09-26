// 오프라인 입력용 서비스 워커.
// - 로그인한 동안 거래 입력 화면(/transactions/new)과 그 화면에 필요한 정적 파일을 받아 둔다.
// - 인터넷이 없을 때 페이지를 열면 받아 둔 입력 화면을 보여준다. 입력한 거래는 화면 쪽에서 기기에 저장했다가 올린다.
// - 로그인 화면으로 가면(로그아웃·세션 만료) 받아 둔 화면을 지운다.
const PAGES = "ab-pages-v1";
const STATIC = "ab-static-v1";
const OFFLINE_PAGE = "/transactions/new";
// 마지막으로 받아 둔 화면을 지운 때 (로그아웃·세션 만료). 그보다 먼저 시작한 받아 두기는 저장하지 않는다
let clearedAt = 0;

self.addEventListener("install", () => self.skipWaiting());

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      for (const key of await caches.keys()) if (key !== PAGES && key !== STATIC) await caches.delete(key);
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "warm") event.waitUntil(warm());
});

/** 입력 화면과 그 화면이 쓰는 /_next/static 파일을 받아 둔다. 지난 배포의 파일은 지운다. */
async function warm() {
  const startedAt = Date.now();
  try {
    const res = await fetch(OFFLINE_PAGE, { credentials: "same-origin", cache: "no-store" });
    if (!res.ok || new URL(res.url).pathname !== OFFLINE_PAGE) return;
    const html = await res.clone().text();
    const assets = [...new Set(html.match(/\/_next\/static\/[^"'\s\\)]+/g) ?? [])];
    const staticCache = await caches.open(STATIC);
    const keep = new Set();
    for (const path of assets) {
      const url = new URL(path, self.location.origin).href;
      keep.add(url);
      if (await staticCache.match(url)) continue;
      try {
        const asset = await fetch(url);
        if (asset.ok) await staticCache.put(url, asset);
      } catch {
        // 하나 못 받아도 나머지는 계속
      }
    }
    for (const req of await staticCache.keys()) if (!keep.has(req.url)) await staticCache.delete(req);
    // 받는 사이에 로그아웃했으면 저장하지 않는다
    if (clearedAt >= startedAt) return;
    await (await caches.open(PAGES)).put(OFFLINE_PAGE, res);
  } catch {
    // 연결이 없으면 다음 기회에
  }
}

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(caches.match(req, { cacheName: STATIC }).then((hit) => hit ?? fetch(req)));
    return;
  }

  if (req.mode === "navigate") event.respondWith(navigate(req, url));
});

async function navigate(req, url) {
  try {
    const res = await fetch(req);
    const path = new URL(res.url || req.url).pathname;
    if (path === "/login" || path === "/signup") {
      clearedAt = Date.now();
      await caches.delete(PAGES);
    }
    return res;
  } catch {
    const page = await caches.match(OFFLINE_PAGE, { cacheName: PAGES });
    if (page) {
      // 다른 화면은 열 수 없으니 입력 화면으로 보낸다
      return url.pathname === OFFLINE_PAGE && !url.search ? page : Response.redirect(new URL(OFFLINE_PAGE, url.origin).href, 303);
    }
    return new Response(
      '<!doctype html><html lang="ko"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">' +
        '<title>가계부</title><body style="font-family:system-ui,sans-serif;padding:2rem;line-height:1.6">' +
        "<h1>인터넷 연결이 없어요</h1><p>연결되면 다시 열어 주세요. 한 번 연결된 상태로 앱을 열어 두면, 다음부터는 연결이 없어도 거래를 입력할 수 있어요.</p>",
      { status: 503, headers: { "content-type": "text/html; charset=utf-8" } },
    );
  }
}
