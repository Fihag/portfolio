/* ============================================================
 * 数字航海 - Service Worker
 * Network-first: 在线时永远拉取最新文件，离线时回退到缓存。
 * 仅在同源 (http/https) 下生效，file:// 本地打开时不注册。
 * ============================================================ */

const CACHE_NAME = 'navigation-adventure-v1';
const PRECACHE = ['./', './index.html', './style.css', './script.js', './icon.svg', './manifest.webmanifest'];

self.addEventListener('install', function (event) {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(function (cache) { return cache.addAll(PRECACHE); })
      .catch(function () {})
  );
  self.skipWaiting();
});

self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys()
      .then(function (keys) {
        return Promise.all(
          keys.filter(function (k) { return k !== CACHE_NAME; })
            .map(function (k) { return caches.delete(k); })
        );
      })
      .then(function () { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function (event) {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;
  event.respondWith(
    fetch(req)
      .then(function (res) {
        if (res && res.status === 200 && (res.type === 'basic' || res.type === 'default')) {
          const copy = res.clone();
          caches.open(CACHE_NAME).then(function (cache) { cache.put(req, copy); }).catch(function () {});
        }
        return res;
      })
      .catch(function () {
        return caches.match(req).then(function (cached) { return cached || caches.match('./index.html'); });
      })
  );
});
