// public/sw.js
self.addEventListener('install', (e) => {
  // versão simples: ativa imediato
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  // pega controle sem recarregar
  e.waitUntil(clients.claim());
});

// opcional: modo passthrough (sem cache ativo ainda)
self.addEventListener('fetch', () => {});
