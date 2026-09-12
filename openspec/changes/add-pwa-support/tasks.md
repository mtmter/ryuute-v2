## 1. Manifest and Assets

- [ ] 1.1 Add `vite-plugin-pwa` and configure a Japanese manifest, standalone scope/start URL and theme colors, and verify the production build emits a valid manifest.
- [ ] 1.2 Add 192px, 512px, maskable and Apple touch icons based on the PlanRail mark, and verify referenced files exist with correct dimensions.

## 2. Service Worker Behavior

- [ ] 2.1 Configure revisioned app-shell precaching and navigation fallback with no runtime API caching, and verify generated worker rules exclude Firestore, Google, Transit and FastAPI responses.
- [ ] 2.2 Register the worker with user-prompted updates and add an update banner, and verify activation/reload occurs only after confirmation.

## 3. Online and Install Experience

- [ ] 3.1 Add online-state handling that displays an offline banner and disables create, sync and route-search actions, and verify reconnect restores the actions.
- [ ] 3.2 Add a conditional Chromium install action and iOS home-screen guidance, and verify unsupported browsers show neither a broken action nor false install status.

## 4. Verification and Documentation

- [ ] 4.1 Add browser tests for offline UI, update prompting and standalone-safe layout, and verify they pass against a production preview.
- [ ] 4.2 Run frontend tests, lint/build and backend tests; run an installability audit and manually verify installed launch on Chromium and iOS Safari.
- [ ] 4.3 Update README and deployment docs with HTTPS, service-worker update, cache scope and rollback checks, and verify instructions match generated output.
