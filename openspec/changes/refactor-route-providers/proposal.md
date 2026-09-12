## Why
\n+
現在のProvider境界はすべてのレスポンスを駅すぱあと形式と仮定しており、利用可能な実APIがない環境では経路検索を検証・運用できない。日本向けTransit APIを主軸にしつつ、地域と障害に応じてGoogle Routesへ安全に切り替えられる共通Provider基盤が必要である。

## What Changes

- Providerごとのレスポンス変換を各Provider内へ移し、共通Routeを返す契約へ統一する。
- `auto`、`transit`、`google`、`ekispert`、`mock` の実行モードを追加し、`auto`を既定にする。
- 日本国内はTransit APIを優先してGoogle徒歩経路へfallbackし、国外はGoogle公共交通から徒歩へfallbackする。
- 駅すぱあとを自動選択から外し、明示設定時のみ利用可能な保守Providerとして残す。
- Mock Providerを外部APIおよび駅すぱあとfixtureに依存しない共通Route fixtureへ変更する。
- 共通Routeと保存済み移動予定へProvider、経路種別、fallback状態、注意事項を追加する。
- 外部APIを呼ばない契約テストと、任意実行のsmoke testを分離する。
- 非目標: 複数経路候補の比較、リアルタイム運行追跡、運賃保証、駅すぱあと実接続テスト。

## Capabilities

### New Capabilities

なし。

### Modified Capabilities

- `places-and-route-search`:: Provider選択、fallback、共通Route契約、出典表示を変更する。
- `travel-plans`: 保存する移動予定へProviderとfallback情報を追加する。\n+
## Impact

- `backend/routes_service.py`、`backend/route_providers/`、FastAPIレスポンスモデル、経路テストを変更する。
- フロントエンドの経路結果・移動予定表示とFirestore保存データを拡張する。
- バックエンド環境変数とProvider運用資料を更新する。
