# Architecture

この文書は、現在のコードから確認できるRyuuteの構成と責務を説明します。画面上の詳細な挙動とデータ契約は `openspec/specs/` を参照してください。

## 全体構成

```text
Browser / React
  |
  +-- Firebase Authentication -- Google login
  |
  +-- Cloud Firestore --------- events, tasks, preparations, trips,
  |                             travelBlocks, legacy travelPlans
  |
  +-- Google Maps JavaScript API / Places
  |
  +-- FastAPI
        |
        +-- GET  /api/health
        +-- POST /api/route-search
               |
               +-- Mock Provider
               +-- Ekispert Provider
```

フロントエンドは認証済みユーザーのuidを使い、Firestoreの `users/{uid}` 以下を直接読み書きします。FastAPIはFirestoreのCRUDを担当しません。

## フロントエンド

- `src/App.jsx`: 認証後の画面状態、データ読み込み、CRUD操作、経路検索の接続
- `src/auth/`: Firebase Authenticationの状態とGoogleログイン・ログアウト
- `src/firestoreService.js`: ユーザー別FirestoreパスとCRUD
- `src/googleMaps.js`: Google Maps JavaScript APIの遅延読み込み
- `src/components/`: カレンダー、モーダル、経路、準備案内などのUI
- `src/dateUtils.js`: ローカル日時文字列とカレンダー表示用の日時計算

予定、タスク、準備項目、Trip、移動ブロックはログイン後にまとめて読み込みます。移動ブロックは予定と同じ開始・終了日時を持ち、月・週・日のカレンダーへ表示します。`travelPlans/{eventId}` の旧データは `travelBlocks/legacy-{eventId}` へ冪等に変換しますが、移行確認期間中は旧ドキュメントも保持します。

主なFirestoreデータの関係は次のとおりです。

```text
trips/{tripId}
  <- events.trip_id
  <- travelBlocks.trip_id
  <- preparations.trip_id

travelBlocks/{travelBlockId}
  -> origin_event_id? / destination_event_id?
  -> origin / destination snapshots
  -> searched route metadata and segments, or manual booking fields
```

予定やTripが削除されても移動の地点スナップショットは独立して保持できます。関連予定の日時・場所が変わった場合は保存済み経路を変更せず、移動ブロックを要確認にします。

## バックエンド

- `main.py`: FastAPIアプリ、CORS、リクエスト・レスポンスモデル、HTTPエラー変換
- `routes_service.py`: Provider選択と駅すぱあと形式から共通Route形式への変換
- `route_providers/mock_provider.py`: fixtureの読み込みと時刻調整
- `route_providers/ekispert_provider.py`: 駅すぱあとAPIへのHTTPリクエスト
- `fixtures/ekispert_route_demo.json`: Mock Providerが返す駅すぱあと形式データ

Providerから取得したデータはバックエンドでアプリ共通Route JSONへ変換します。フロントエンドとFirestoreは駅すぱあとの生レスポンスを扱いません。

`POST /api/route-search` は `origin`、`destination` と `timing.type`（`arrival` または `departure`）、`timing.at` を受け付けます。旧Event形式も移行期間中は到着検索として受け付けます。

## データ境界

Firestore Security Rulesは、認証中のuidとパス上のuidが一致するときだけ `users/{uid}` 以下の読み書きを許可します。フィールド単位のスキーマ検証はSecurity Rulesには定義されていません。

FastAPIのCORSは、未設定時に次のオリジンを許可します。

```text
http://localhost:5173
http://127.0.0.1:5173
```

`CORS_ORIGINS` が設定されている場合は、カンマ区切りの値を使用します。

## 残存している旧Google Routesコード

`backend/routes_service.py` にはGoogle Routes APIを呼び出して共通Route形式へ変換する関数と、そのユニットテストが残っています。ただし、この関数は現在のProvider一覧にもFastAPIエンドポイントにも接続されていません。

このコードを互換用として維持するか削除するかは未決定です。現在のプロダクト仕様には含めません。
