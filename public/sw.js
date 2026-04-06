// Service Worker - Web Push notifications

self.addEventListener('install', function () {
  self.skipWaiting();
});

self.addEventListener('activate', function (event) {
  event.waitUntil(clients.claim());
});

self.addEventListener('push', function (event) {
  if (!event.data) return;

  let data = {};
  try {
    data = event.data.json();
  } catch {
    data = { title: 'Influo', body: event.data.text() || 'Νέα ειδοποίηση' };
  }

  const title = data.title || 'Influo';
  const body = data.body || 'Νέα ειδοποίηση';
  const url = data.url || '/';
  const tag = data.tag || 'influo-notification';
  // Android Chrome εμφανίζει λάθος/γενικό εικονίδιο με SVG — χρησιμοποιούμε PNG από το λογότυπο
  const base = self.location.origin;
  const iconUrl = data.icon || `${base}/push-icon-192.png`;
  const badgeUrl = data.badge || `${base}/push-badge-96.png`;
  const imageUrl = data.image || `${base}/push-image-512.png`;

  const options = {
    body: body,
    icon: iconUrl,
    badge: badgeUrl,
    image: imageUrl,
    tag: tag,
    data: { url: url },
    requireInteraction: false,
    vibrate: [200, 100, 200],
    actions: [
      { action: 'open', title: 'Άνοιγμα' },
      { action: 'close', title: 'Κλείσιμο' },
    ],
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', function (event) {
  event.notification.close();

  const url = event.notification.data?.url || '/';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.navigate(url);
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(self.location.origin + (url.startsWith('/') ? url : '/' + url));
      }
    })
  );
});
