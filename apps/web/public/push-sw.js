/* Push handlers, imported into the generated Workbox service worker (see
   vite.config workbox.importScripts). Shows the notification and, on click,
   focuses an open window (navigating it to the post) or opens a new one. */

self.addEventListener("push", (event) => {
  let data = { title: "WoWLocker", body: "" };
  try {
    if (event.data) data = event.data.json();
  } catch (e) {
    if (event.data) data = { title: "WoWLocker", body: event.data.text() };
  }
  event.waitUntil(
    self.registration.showNotification(data.title || "WoWLocker", {
      body: data.body || "",
      tag: data.tag,
      icon: "/pwa-192.png",
      badge: "/badge-96.png",
      data: { url: data.url || "/" },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "/";
  event.waitUntil(
    (async () => {
      const wins = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      for (const w of wins) {
        if (w.url.indexOf(self.location.origin) === 0) {
          await w.focus();
          if ("navigate" in w) {
            try {
              await w.navigate(url);
            } catch (e) {
              /* not allowed — ignore */
            }
          }
          return;
        }
      }
      await self.clients.openWindow(url);
    })(),
  );
});
