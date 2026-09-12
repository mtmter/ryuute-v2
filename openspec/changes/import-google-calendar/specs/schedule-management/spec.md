## ADDED Requirements

### Requirement: 外部予定とローカル予定を区別して管理する

システムはlocal予定とGoogle由来予定を同じcalendarへ表示し、Google由来予定のsource所有項目を読み取り専用にしなければならない（MUST）。

#### Scenario: Google予定を表示する

- **WHEN** 同期済みで取消されていないGoogle予定が表示期間に含まれる
- **THEN** システムはlocal予定と同じcalendarへsourceが分かる状態で表示する

#### Scenario: Google所有項目を編集する

- **WHEN** 利用者がGoogle予定のtitle、開始・終了、description、source locationを編集しようとする
- **THEN** システムは入力を読み取り専用として表示する

#### Scenario: PlanRail情報を編集する

- **WHEN** 利用者がGoogle予定の到着余裕、場所補足、準備または移動予定を編集する
- **THEN** システムはPlanRail側のdataだけを保存する
