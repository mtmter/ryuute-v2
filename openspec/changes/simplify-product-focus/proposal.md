## Why

PlanRailの中心価値を予定に対する移動・準備支援へ明確化するため、独立した汎用タスク管理を廃止する。タスクを残したまま画面再設計や外部カレンダー統合を進めると、ナビゲーションとデータ責務が不必要に複雑になる。

## What Changes

- **BREAKING** 月・週・日カレンダーと表示切替から汎用タスクを除去する。
- **BREAKING** タスク一覧、タスク追加・編集・削除・完了切替をUIから除去する。
- 起動時に `tasks` collectionを読み込まず、タスクCRUDをアプリから使用しない。
- 既存の `users/{uid}/tasks` データは削除せず保持する。
- 予定、準備チェックリスト、準備案内、経路検索、移動予定は維持する。
- 非目標: 既存タスクの移行・削除・エクスポート、準備項目の汎用タスク化。

## Capabilities

### New Capabilities

なし。

### Modified Capabilities

- `schedule-management`: 表示種別とカレンダー内容からタスクを削除し、予定管理に集中させる。
- `authentication-and-persistence`: 起動時の読み込み対象と現行CRUD対象からタスクを除外する。

## Impact

- `frontend/src/App.jsx`、カレンダーcomponent、追加・詳細modal、Firestore serviceからタスク経路を削除する。
- 未使用になるタスクcomponentを削除し、関連CSSと現行仕様・READMEを更新する。
- Firestore Rulesと保存済みtaskドキュメントは変更しない。
