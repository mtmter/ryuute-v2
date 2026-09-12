# Route Providers

Provider固有のHTTP処理と変換は `backend/route_providers/` に置き、すべて
`RouteRequest -> RouteResult` の共通契約を返します。Providerの生レスポンスは
FastAPI、フロントエンド、Firestoreへ渡しません。

## Providerの選択

`ROUTE_PROVIDER_MODE` は次の値を受け付け、未設定時は `auto` です。移行中は旧
`ROUTE_PROVIDER` も読みますが、新規設定では使用しません。

| 値 | 動作 |
| --- | --- |
| `auto` | 座標と失敗分類に応じてProviderを切り替える |
| `transit` | Transitousの公共交通だけを検索する |
| `google` | Google Routesの公共交通だけを検索する |
| `ekispert` | 駅すぱあとだけを検索する |
| `mock` | 外部通信なしの固定共通Routeを返す |

`auto` は両端が日本の座標範囲内ならTransitous、Google徒歩の順、それ以外または
座標不足ならGoogle公共交通、Google徒歩の順です。駅すぱあとは自動選択しません。
fallbackするのは対象外・経路なし・timeout・rate limit・server errorです。
Transitousのtimeout、429、5xxは1回だけ再試行します。

## Transitous

`TRANSIT_API_URL`（既定 `https://api.transitous.org/api/v1/plan`）を7秒timeoutで
呼び出します。`fromPlace`、`toPlace`、ISO 8601の `time`、`arriveBy`、
`detailedTransfers=false`、`numItineraries=1` を送ります。

公開サービスの利用方針に従い、連絡先を含む `TRANSIT_USER_AGENT` を本番環境で
必ず設定してください。レスポンスのISO日時に加え、`serviceDate` と0時からの秒数
で表された時刻も変換します。86400以上の値は翌日以降として扱います。秒数形式の
timezoneは `TRANSIT_TIMEZONE`（既定 `Asia/Tokyo`）です。

Transitousはbest-effortの非公式情報であるため、結果と保存済み移動ブロックへ注意文を
付けます。重要な移動は交通事業者の案内でも確認してください。

## Google Routes

`GOOGLE_MAPS_API_KEY` をサーバー側に設定します。TRANSITとWALKを登録済みProvider
として利用し、到着検索は `arrivalTime`、出発検索は `departureTime` を送ります。
ブラウザ用の `VITE_GOOGLE_MAPS_API_KEY` とは用途と制限を分けてください。

## 駅すぱあと

明示的に `ekispert` を指定した場合だけ利用します。`EKISPERT_API_KEY` が必要です。
`GET https://api.ekispert.jp/v1/json/search/course/extreme` の応答変換はProvider内で
行い、単体オブジェクト／配列の差を正規化します。

## エラーと共通レスポンス

Provider失敗は `invalid_input`、`unavailable`、`not_configured`、`no_route`、
`transient`、`invalid_response` に分類します。経路なしはHTTP 404、明示Providerの
キー不足はHTTP 500、未知のmode・通信・変換失敗はHTTP 502へ変換します。

共通Routeには `provider`、`route_kind`、`is_fallback`、`notices` と共通segmentが
必須です。保存済み旧データにこれらがない場合、フロントエンドは `legacy` と
移動手段から導く既定値を非破壊で適用します。

## テストと任意smoke

通常のunit testは全HTTP呼び出しをmockし、外部ネットワークを必要としません。
実接続は明示的に次を実行します。

```bash
cd backend
RUN_LIVE_ROUTE_SMOKE=1 ROUTE_PROVIDER_MODE=transit \
  .venv/bin/python smoke_route_providers.py
```

Googleまたは駅すぱあとでは、対応するAPIキーも環境変数に設定します。
