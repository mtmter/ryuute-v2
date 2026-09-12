## ADDED Requirements

### Requirement: Google Calendar同期状態をユーザーごとに保存する

システムは `users/{uid}/integrations/googleCalendar` にcalendar選択とcalendar別同期状態を保存し、外部予定へsource識別情報を保持しなければならない（MUST）。OAuth access tokenはFirestoreへ保存してはならない（MUST NOT）。

#### Scenario: integration設定を保存する

- **WHEN** 認証済み利用者がcalendar選択または同期を完了する
- **THEN** システムはそのuid配下だけに選択calendar、同期token、最終同期日時を保存する

#### Scenario: 外部予定を保存する

- **WHEN** Google予定を同期する
- **THEN** システムはProvider、calendar ID、external event ID、external更新時刻、同期状態を予定へ保存する

#### Scenario: 別ユーザーのintegrationへアクセスする

- **WHEN** 認証中uidと異なるintegrationまたは外部予定を読み書きしようとする
- **THEN** Firestore Security Rulesはアクセスを許可しない
