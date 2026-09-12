## ADDED Requirements

### Requirement: 移動予定に経路の出典を保持する

移動予定は共通Routeとともに `provider`、`route_kind`、`is_fallback`、`notices` を保存し、表示時に経路の出典と性質を確認できなければならない（MUST）。

#### Scenario: Transit経路を保存する

- **WHEN** Transit APIの検索結果を移動予定として登録する
- **THEN** システムはTransit由来の公共交通経路であることと非公式情報の注意を保存する

#### Scenario: 徒歩fallbackを保存する

- **WHEN** Google Routesの徒歩fallbackを登録する
- **THEN** システムは徒歩経路かつfallbackであることを保存・表示する
