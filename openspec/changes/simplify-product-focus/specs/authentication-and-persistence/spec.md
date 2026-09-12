## MODIFIED Requirements

### Requirement: データをユーザーごとに分離する

システムは認証中ユーザーのuidを使い、次のFirestore pathでデータを読み書きしなければならない（MUST）。既存の `tasks` pathへのdataは削除してはならない（MUST NOT）。

```text
users/{uid}/events/{eventId}
users/{uid}/preparations/{preparationId}
users/{uid}/travelPlans/{eventId}
```

#### Scenario: スケジュールを読み込む

- **WHEN** 認証済みユーザーのスケジュール画面を開始する
- **THEN** システムはそのuid配下の予定と準備項目をFirestoreから読み込む

#### Scenario: 既存タスクがある

- **WHEN** ユーザーの `tasks` collectionに既存documentがある
- **THEN** システムはそれを読み込まず、変更または削除しない

#### Scenario: 別ユーザーのパスへアクセスする

- **WHEN** 認証中のuidと異なる `users/{uid}` 配下を読み書きしようとする
- **THEN** Firestore Security Rulesはアクセスを許可しない

### Requirement: スケジュールデータはFirestoreへ直接保存する

フロントエンドは予定、準備項目、移動予定のCRUDをCloud Firestoreへ直接行わなければならない（MUST）。FastAPIをこれらのCRUDの中継に使用してはならない。

#### Scenario: 予定を作成する

- **WHEN** 認証済みユーザーが予定追加formを送信する
- **THEN** フロントエンドはそのユーザーの `events` subcollectionへ予定を追加する

#### Scenario: 経路検索を実行する

- **WHEN** 認証済みユーザーが予定の経路を検索する
- **THEN** フロントエンドはFastAPIの経路検索APIを呼び出す
