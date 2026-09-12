## ADDED Requirements

### Requirement: 狭幅画面へ専用calendar表示を提供する

幅720px以下ではpage全体に横scrollを発生させず、月、週、日の予定へ到達できる専用layoutを提供しなければならない（MUST）。

#### Scenario: 月表示を開く

- **WHEN** 狭幅画面で月表示を開く
- **THEN** システムは幅内のcompact月gridと選択日のagendaを表示する

#### Scenario: 週表示を開く

- **WHEN** 狭幅画面で週表示を開く
- **THEN** システムは7日の日付stripと選択日の時間軸を表示する

#### Scenario: 日表示を開く

- **WHEN** 狭幅画面で日表示を開く
- **THEN** システムは幅内に収まる1日の時間軸を表示する

### Requirement: 狭幅画面の主要操作を下部へ配置する

狭幅画面では月・週・日の切替をsafe areaに対応した下部navigationへ配置し、予定追加操作をfloating buttonとして提供しなければならない（MUST）。

#### Scenario: 表示を切り替える

- **WHEN** 利用者が下部navigationの月、週、日を選択する
- **THEN** システムは表示基準日を維持して対象表示へ切り替える

#### Scenario: 予定を追加する

- **WHEN** 利用者がfloating buttonを選択する
- **THEN** システムは現在の表示基準日を初期値に予定追加画面を開く

### Requirement: 狭幅画面で入力画面を操作できる

狭幅画面のdialogはviewportとsafe area内に収まり、software keyboard表示中も送信・取消操作へ到達できなければならない（MUST）。

#### Scenario: 小さい画面で予定を編集する

- **WHEN** 幅320pxの画面で予定追加または詳細を開く
- **THEN** 入力、保存、取消操作がpage横scrollなしで利用できる
