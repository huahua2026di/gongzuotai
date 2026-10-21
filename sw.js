// 离线包：把整个 APP 存进手机，之后断网、电脑关机、在外面都能打开。
// 只在 https 正规网址下生效（局域网 http 浏览器不允许，会自动跳过）。
var CACHE = 'wb-gongzuotai-v1';
var ASSETS = [
  './',
  './index.html',
  './icon-180.png',
  './manifest.json'
];

self.addEventListener('install', function (e) {
  e.waitUntil(
    caches.open(CACHE).then(function (c) {
      // 单个失败不影响整体，避免任一资源 404 导致整个安装失败
      return Promise.all(ASSETS.map(function (u) {
        return c.add(u).catch(function () {});
      }));
    }).then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.map(function (k) {
        if (k !== CACHE) return caches.delete(k);
      }));
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET') return;
  var url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // 云备份之类的外部请求不管

  // 页面：先用缓存秒开，同时后台悄悄拉新版（下次打开生效）
  if (req.mode === 'navigate') {
    e.respondWith(
      caches.match('./index.html').then(function (hit) {
        var net = fetch(req).then(function (res) {
          if (res && res.ok) {
            var copy = res.clone();
            caches.open(CACHE).then(function (c) { c.put('./index.html', copy); });
          }
          return res;
        }).catch(function () { return hit; });
        return hit || net;
      })
    );
    return;
  }

  // 其它资源：有缓存就用缓存，没有再联网
  e.respondWith(
    caches.match(req).then(function (hit) {
      return hit || fetch(req).then(function (res) {
        if (res && res.ok && res.type === 'basic') {
          var copy = res.clone();
          caches.open(CACHE).then(function (c) { c.put(req, copy); });
        }
        return res;
      }).catch(function () { return hit; });
    })
  );
});
