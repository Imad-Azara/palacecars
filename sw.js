// Service Worker (sw.js) - Minimal pour PWA et notifications

const CACHE_NAME = 'palace-cars-admin-cache-v1';
// Ajustez les URLs si admin.html n'est pas à la racine
const urlsToCache = [
  '/admin.html', // Met en cache la page admin elle-même
  '/manifest.json', // Met en cache le manifest
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png'
  // Ajoutez d'autres ressources statiques si nécessaire (CSS, JS)
];

// Installation du Service Worker et mise en cache des ressources de base
self.addEventListener('install', event => {
  console.log('Service Worker: Installation...');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Service Worker: Mise en cache des fichiers de base:', urlsToCache);
        // Utiliser addAll avec catch pour ignorer les erreurs si un fichier manque
        return cache.addAll(urlsToCache).catch(error => {
            console.warn('SW Cache addAll a échoué pour certains URLs:', error);
            // Si un fichier essentiel manque (comme admin.html), l'installation échoue
            if (urlsToCache.includes(error.url)) {
                throw error; // Propage l'erreur si un fichier essentiel n'est pas trouvé
            }
        });
      })
      .then(() => self.skipWaiting()) // Forcer l'activation immédiate
      .catch(err => {
          console.error("Erreur lors de l'installation du SW:", err);
      })
  );
});

// Activation du Service Worker et nettoyage des anciens caches
self.addEventListener('activate', event => {
  console.log('Service Worker: Activation...');
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.filter(cacheName => {
          // Supprimer les caches qui ne correspondent pas au nom actuel
          return cacheName !== CACHE_NAME;
        }).map(cacheName => {
          console.log('Service Worker: Suppression de l\'ancien cache:', cacheName);
          return caches.delete(cacheName);
        })
      );
    }).then(() => self.clients.claim()) // Prendre le contrôle immédiatement
  );
});

// Stratégie de cache : Network falling back to Cache
self.addEventListener('fetch', event => {
  // Ignorer les requêtes non-GET et celles vers Firebase/autres APIs externes
  if (event.request.method !== 'GET' ||
      event.request.url.startsWith('chrome-extension://') ||
      !event.request.url.startsWith(self.location.origin) || // Ignore les requêtes externes (Firebase, CDN...)
      event.request.url.includes('firestore.googleapis.com')) {
    // Laisse passer la requête sans l'intercepter
    return;
  }

 // console.log('SW Fetch: Interception de', event.request.url);

  event.respondWith(
    fetch(event.request)
      .then(networkResponse => {
        // Si la réponse réseau est valide, la mettre en cache et la retourner
        if (networkResponse && networkResponse.ok) {
        //  console.log('SW Fetch: Réponse réseau OK pour', event.request.url);
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME)
            .then(cache => {
              //console.log('SW Caching:', event.request.url);
              cache.put(event.request, responseToCache);
            });
        } else {
            // Si la réponse réseau n'est pas OK (ex: 404), essayer le cache
            // console.warn('SW Fetch: Réponse réseau non OK pour', event.request.url, networkResponse.status);
            // throw new Error('Network response was not ok.'); // Provoque le catch pour utiliser le cache
        }
        return networkResponse;
      })
      .catch(error => {
        // Si le réseau échoue OU si la réponse n'était pas OK, essayer de récupérer depuis le cache
       // console.log('SW Fetch: Réseau échoué ou réponse non OK, tentative depuis le cache pour', event.request.url);
        return caches.match(event.request)
          .then(cachedResponse => {
            if (cachedResponse) {
             // console.log('SW Fetch: Trouvé dans le cache:', event.request.url);
              return cachedResponse;
            }
            // Si ni le réseau ni le cache ne fonctionnent
           // console.warn('SW Fetch: Ni réseau ni cache disponible pour', event.request.url);
             // Retourner une réponse d'erreur simple
             return new Response('Offline et non trouvé dans le cache.', {
                 status: 404,
                 statusText: 'Not Found',
                 headers: { 'Content-Type': 'text/plain' }
             });
          });
      })
  );
});


// Gestion des notifications push (si utilisées dans le futur)
self.addEventListener('push', event => {
  console.log('Service Worker: Push reçu.');
  // Code pour gérer les notifications push
});

// Gestion des clics sur les notifications
self.addEventListener('notificationclick', event => {
  console.log('Service Worker: Clic sur notification reçu.');
  event.notification.close();
  // Ouvrir l'application ou une URL spécifique
  event.waitUntil(
    clients.matchAll({ type: 'window' }).then(windowClients => {
        // Vérifier si une fenêtre de l'app est déjà ouverte
        for (var i = 0; i < windowClients.length; i++) {
            var client = windowClients[i];
            if (client.url.includes('/admin.html') && 'focus' in client) {
                return client.focus();
            }
        }
        // Sinon, ouvrir une nouvelle fenêtre
        if (clients.openWindow) {
            return clients.openWindow('/admin.html');
        }
    })
  );
});

// Écouter les messages de la page (pour afficher les notifications via le SW)
self.addEventListener('message', event => {
    if (event.data && event.data.type === 'show-notification') {
        const { title, options } = event.data;
        // Vérifier si registration.showNotification existe avant de l'appeler
        if (self.registration && self.registration.showNotification) {
             event.waitUntil(self.registration.showNotification(title, options));
        } else {
            console.error("Impossible d'afficher la notification depuis le Service Worker.");
        }
    }
});

