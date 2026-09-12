## Purpose

PlanRailを対応browserのhome画面へinstallしてappらしく起動しつつ、online必須dataを古いcacheと誤認させないPWA動作を定義する。

## ADDED Requirements

### Requirement: install可能なweb app情報を提供する

システムはapp名、icon、theme color、standalone表示を含む有効なWeb App Manifestを提供しなければならない（MUST）。

#### Scenario: 対応browserで開く

- **WHEN** 利用者がHTTPS上のappを対応browserで開く
- **THEN** browserはPlanRailをinstall可能なweb appとして認識する

### Requirement: 静的app shellだけをoffline cacheする

service workerはbuild済み静的assetとnavigation shellだけをcacheし、Firestore、Google API、Transit API、FastAPIのresponseをruntime cacheしてはならない（MUST NOT）。

#### Scenario: offlineで起動する

- **WHEN** install済みappをnetworkなしで起動する
- **THEN** システムはapp shellとoffline状態を表示し、remote dataが最新であると表示しない

#### Scenario: online dataを要求する

- **WHEN** offline中に同期、保存または経路検索を実行しようとする
- **THEN** システムは操作を送信せずnetworkが必要であることを表示する

### Requirement: app更新を安全に適用する

新しいservice workerが待機している場合、システムは利用者へ更新操作を表示し、利用者が選択した後にreloadしなければならない（MUST）。

#### Scenario: 更新版が利用可能になる

- **WHEN** 新しいservice workerがinstallされて待機する
- **THEN** システムは更新通知を表示する

#### Scenario: 更新を適用する

- **WHEN** 利用者が更新を選択する
- **THEN** システムは待機中のworkerを有効化してappをreloadする
