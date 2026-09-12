## Why

再設計後のPlanRailをPC・スマートフォンのhome画面から起動できるappとして提供する。データ同期はonline前提のまま、静的app shellだけを安全にcacheし、古い予定を最新と誤認させない。

## What Changes

- Web App Manifest、theme color、branded icon、standalone表示設定を追加する。
- service workerでbuild済み静的assetとnavigation shellだけをprecacheする。
- Firestore、Google API、Transit API、FastAPI responseはruntime cacheしない。
- offline状態を検出して同期・編集・経路検索を無効化し、online復帰を案内する。
- 新しいservice workerが待機中の場合、利用者が選択できる更新通知を表示する。
- 対応browserではinstall導線を表示し、iOSではhome画面追加手順を案内する。
- 非目標: offline閲覧・編集、background sync、push通知、API response cache。

## Capabilities

### New Capabilities

- `progressive-web-app`: install、standalone起動、静的cache、offline制御、更新通知を定義する。

### Modified Capabilities

なし。

## Impact

- Vite PWA依存、manifest設定、service worker登録、icon asset、online状態UIを追加する。
- install/update/offlineのbrowser testとdeployment確認項目を追加する。
- backend APIとFirestore data modelは変更しない。
