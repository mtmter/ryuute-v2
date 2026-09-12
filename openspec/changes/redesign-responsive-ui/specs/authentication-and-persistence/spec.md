## MODIFIED Requirements

### Requirement: Googleアカウントで認証する

システムはFirebase AuthenticationのGoogle認証を提供し、認証済みユーザーだけにschedule画面を表示しなければならない（MUST）。desktop browserではpopup方式を使い、mobileまたはstandalone表示ではredirect方式を使わなければならない（MUST）。

#### Scenario: 未認証でアプリを開く

- **WHEN** Firebaseの認証状態にユーザーが存在しない
- **THEN** システムはGoogle login buttonを含むlogin画面を表示する

#### Scenario: 認証済みでアプリを開く

- **WHEN** Firebaseの認証状態にユーザーが存在する
- **THEN** システムはそのユーザーのschedule画面を表示する

#### Scenario: desktopでloginする

- **WHEN** desktop browserでGoogle loginを選択する
- **THEN** システムはpopup認証を開始する

#### Scenario: mobileまたはstandaloneでloginする

- **WHEN** mobileまたはstandalone表示でGoogle loginを選択する
- **THEN** システムはredirect認証を開始し、復帰後に認証結果を反映する

#### Scenario: ログアウトする

- **WHEN** ユーザーがaccount menuからlogoutする
- **THEN** システムはFirebaseからlogoutし、login画面へ戻る
