/* Firebase Cloud Messaging Service Worker — background notifications + installability shim. */
importScripts("https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.12.2/firebase-messaging-compat.js");

// Passive fetch listener — required by Chrome/Android to consider the app installable.
// Does NOT cache; just passes every request through to the network.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));
self.addEventListener("fetch", () => { /* pass-through, no offline cache */ });

const _swApiKey = new URL(self.location.href).searchParams.get("apiKey") || "";
firebase.initializeApp({
  apiKey: _swApiKey,
  authDomain: "al-tariq-education-hub.firebaseapp.com",
  projectId: "al-tariq-education-hub",
  storageBucket: "al-tariq-education-hub.firebasestorage.app",
  messagingSenderId: "34455474408",
  appId: "1:34455474408:web:d0e5a217e75f2bdedcb95d",
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  const title = (payload.notification && payload.notification.title) || "الطارق التعليمية";
  const options = {
    body: (payload.notification && payload.notification.body) || "",
    icon: "/icon-192.png",
    badge: "/icon-192.png",
    dir: "rtl",
    lang: "ar",
    data: { url: (payload.fcmOptions && payload.fcmOptions.link) || (payload.data && payload.data.link) || "/" },
  };
  self.registration.showNotification(title, options);
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "/";
  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
      for (const c of list) {
        if ("focus" in c) { c.navigate(url); return c.focus(); }
      }
      if (clients.openWindow) return clients.openWindow(url);
    }),
  );
});
