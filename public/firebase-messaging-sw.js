// Background FCM handler — runs when the admin portal tab is not focused (or closed
// entirely, as long as the browser process is running and this SW stays registered).
// Must live as a static file at the site root; it can't be bundled by Vite, so it can't
// read import.meta.env — these values are the same public Firebase Web config already in
// src/config/firebase.js. They're client identifiers meant to ship in every page load
// (same as any Firebase web app's config), not secrets, so hardcoding them here is safe
// and is exactly what Firebase's own setup docs do for this file.
importScripts('https://www.gstatic.com/firebasejs/10.14.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.14.1/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: 'AIzaSyDR-BltC2fuUfA76m29S-HXP6ZidlWrW34',
  authDomain: 'supamart-b9c9a.firebaseapp.com',
  projectId: 'supamart-b9c9a',
  storageBucket: 'supamart-b9c9a.firebasestorage.app',
  messagingSenderId: '487281984299',
  appId: '1:487281984299:web:d3c0a096cd8790256fbb6e',
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  const { title, body } = payload.notification || {};
  self.registration.showNotification(title || 'New order', {
    body: body || '',
    icon: '/logo.png',
    badge: '/logo.png',
    tag: payload.data?.orderId || 'ms-traders-order',
  });
});

// Clicking the OS notification focuses an existing admin-portal tab if one is open,
// otherwise opens a new one — instead of doing nothing (the default).
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ('focus' in client) return client.focus();
      }
      if (clients.openWindow) return clients.openWindow('/orders');
    })
  );
});
