## Purpose

Google Calendarの予定を再入力せずPlanRailへ読み取り専用で同期し、予定ごとにPlanRail固有の移動・準備情報を安全に付加する挙動を定義する。

## ADDED Requirements

### Requirement: Google Calendarを個別に認可する

システムはFirebase loginとは別に、Google Calendarの読み取り専用scopeを利用者の操作で要求し、access tokenを永続保存してはならない（MUST NOT）。

#### Scenario: 初めて接続する

- **WHEN** 利用者がGoogle Calendar接続を選択して同意する
- **THEN** システムは利用可能なcalendarを読み込む

#### Scenario: tokenが失効する

- **WHEN** 同期に必要なaccess tokenが失効している
- **THEN** システムは自動でcredentialを保存・更新せず、再接続操作を案内する

### Requirement: 同期するcalendarを選択する

システムはprimary calendarを初期選択し、利用者が追加calendarの同期有無を変更できなければならない（MUST）。

#### Scenario: calendar選択を保存する

- **WHEN** 利用者が同期対象を変更する
- **THEN** システムはユーザー配下のintegration設定へ選択結果を保存する

### Requirement: Google予定を差分同期する

システムは選択calendarの初回全同期後に同期tokenを保存し、起動時および手動更新時は変更分を取得しなければならない（MUST）。

#### Scenario: 初回同期する

- **WHEN** 選択calendarに同期tokenがない
- **THEN** システムは全pageを取得して予定と次回tokenを保存する

#### Scenario: 差分同期する

- **WHEN** 選択calendarに有効な同期tokenがある
- **THEN** システムは変更・取消分をpage末尾まで取得し、新しいtokenを保存する

#### Scenario: 同期tokenが無効になる

- **WHEN** Google CalendarがHTTP 410を返す
- **THEN** システムは該当calendarのtokenを破棄して全同期をやり直す

### Requirement: 取消予定のPlanRail情報を保持する

Google側で取消・削除された予定はcalendar表示から除外し、関連する準備項目と移動予定は自動削除してはならない（MUST NOT）。

#### Scenario: Google予定が取り消される

- **WHEN** 差分同期が取消予定を受信する
- **THEN** システムは予定を非表示状態に更新し、関連するPlanRail dataを保持する
