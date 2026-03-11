/* ═══════════════════════════════
   sw.js — Service Worker (PWA 오프라인 지원)
   ═══════════════════════════════ */
const CACHE = 'sudoku-v1';
const FILES = [
  './',
  './index.html',
  './style.css',
  './langs.js',
  './puzzles.js',
  './ranking.js',
  './game.js',
  './manifest.json',
  './icon-192.svg',
  './icon-512.svg',
];

// 설치: 모든 파일 캐시에 저장
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(FILES))
  );
  self.skipWaiting();
});

// 활성화: 구버전 캐시 삭제
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// 요청: 캐시 우선, 없으면 네트워크
self.addEventListener('fetch', e => {
  e.respondWith(
    caches.match(e.request).then(r => r || fetch(e.request))
  );
});
