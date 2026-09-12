## Context

The Vite frontend has no manifest or service worker and is deployed over HTTPS on Vercel. Application data comes from Firestore and external APIs, and offline persistence is not enabled, so cached dynamic responses would create misleading stale behavior.

## Goals / Non-Goals

**Goals:**

- Make production builds installable and standalone-capable.
- Cache only versioned application shell assets.
- Communicate offline and update states clearly.

**Non-Goals:**

- Offline schedule data, queued edits, background sync or push notifications.

## Decisions

1. Use `vite-plugin-pwa` in generate-service-worker mode with an explicit manifest. Generate hashed precache entries only for build output and use a navigation fallback to the app shell.
2. Define no runtime caching routes for Firestore, Google, Transit or the backend. Observe `navigator.onLine` to disable network actions and display a persistent offline banner.
3. Register with prompt-style updates. Show an in-app update banner when a worker is waiting; activate it only after the user confirms, avoiding mid-edit reloads.
4. Supply 192px, 512px and maskable PNG icons based on the existing Ryuute mark, plus an Apple touch icon. Set Japanese name/description, `display: standalone`, root scope/start URL and matching theme/background colors.
5. Keep install UI minimal: show an install action only when `beforeinstallprompt` is available and provide short iOS home-screen guidance in the account/settings area.

## Risks / Trade-offs

- [A service worker can serve stale application code] -> Use generated revisioned precache and explicit user-driven activation.
- [Users expect offline data after installation] -> Display online-required messaging and disable writes/search while offline.
- [Browser install behavior differs] -> Test Chromium installability and manually verify iOS Safari guidance/standalone launch.

## Migration Plan

1. Add icons, manifest and plugin configuration without enabling runtime API caching.
2. Add registration and online/update UI, then verify a production preview.
3. Deploy and confirm service-worker scope and headers. Roll back by removing registration/plugin output; no data migration is involved.
