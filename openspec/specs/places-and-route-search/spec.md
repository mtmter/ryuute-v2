# Places and Route Search Specification

## Purpose

場所入力、Google Mapsリンク、および公共交通経路検索APIの現行契約を定義する。Provider選択、共通レスポンス、検索結果表示までをこの仕様の対象とする。

## Requirements

### Requirement: 場所候補と文字入力を提供する

予定の追加・編集時の場所名と、経路検索時の出発地にはGoogle Placesの候補入力を提供しなければならない（MUST）。Google Maps APIキーがない場合または候補を読み込めない場合は、通常の文字入力へフォールバックしなければならない。

#### Scenario: Places候補を選択する

- **WHEN** ユーザーがPlaces候補を選択する
- **THEN** システムは場所名、住所、Place ID、緯度、経度を取得する

#### Scenario: 候補を選択せず入力する

- **WHEN** ユーザーが文字列だけを入力する
- **THEN** システムはPlace IDや座標がなくても予定の場所または経路検索の出発地として受け付ける

#### Scenario: 予定へ候補を保存する

- **WHEN** 選択したPlaces候補を含む予定を保存する
- **THEN** システムは名前を `location_name`、住所を `destination`、Place IDを `destination_place_id`、座標を `destination_lat` と `destination_lng` に保存する

### Requirement: Google Mapsリンクを生成する

予定に場所名、住所、座標、またはPlace IDから検索可能な情報がある場合、システムは保存済みURLではなく表示時にGoogle Maps Search URLを生成しなければならない（MUST）。

#### Scenario: Place IDがある

- **WHEN** 予定に `destination_place_id` がある
- **THEN** システムはURLへ `query_place_id` を含める

#### Scenario: Place IDがない

- **WHEN** 予定にPlace IDがなく、住所、場所名、または座標がある
- **THEN** システムは利用可能な値を `query` とするリンクを表示する

### Requirement: 経路検索リクエストを受け付ける

システムは `POST /api/route-search` で出発地情報と対象予定をJSONとして受け付けなければならない（MUST）。

#### Scenario: 地点を解決する

- **WHEN** 出発地または目的地に緯度と経度の両方がある
- **THEN** システムは `緯度,経度` をProviderへ渡す地点として優先する
- **WHEN** 座標がない
- **THEN** システムは住所、次に表示名の順で利用可能な文字列を使用する

#### Scenario: 出発地または目的地がない

- **WHEN** 利用可能な出発地または目的地の情報がない
- **THEN** APIはHTTP 400を返す

#### Scenario: 予定開始日時が不正である

- **WHEN** `event.start_at` が `YYYY-MM-DDTHH:mm` として解析できない
- **THEN** APIはHTTP 400を返す

### Requirement: 到着希望日時を計算する

バックエンドは予定開始日時から到着余裕時間を減算してProviderへ渡す到着希望日時を計算しなければならない（MUST）。到着余裕時間が未設定の場合は0分として扱わなければならない。

#### Scenario: 到着余裕時間が設定されている

- **WHEN** 予定開始が10:30で到着余裕時間が10分である
- **THEN** バックエンドは10:20を到着希望日時として検索する

### Requirement: Route Providerを選択する

バックエンドは `ROUTE_PROVIDER` により `mock` または `ekispert` を選択し、未設定時は `mock` を使用しなければならない（MUST）。

#### Scenario: 未知のProviderを指定する

- **WHEN** `ROUTE_PROVIDER` に対応していない名前を指定する
- **THEN** APIはProvider設定エラーとしてHTTP 502を返す

#### Scenario: 駅すぱあとキーがない

- **WHEN** `ekispert` を選択し `EKISPERT_API_KEY` が設定されていない
- **THEN** APIはHTTP 500を返す

### Requirement: 共通Route JSONを返す

Providerのレスポンスは、フロントエンドへ返す前に次の共通形式へ変換しなければならない（MUST）。

```text
origin: string
destination: string
departure_at: YYYY-MM-DDTHH:mm
arrival_at: YYYY-MM-DDTHH:mm
duration_minutes: 0以上の整数
transport_mode: string
segments: RouteSegment[]

RouteSegment:
  type: string
  from: string
  to: string
  departure_at: YYYY-MM-DDTHH:mm
  arrival_at: YYYY-MM-DDTHH:mm
  duration_minutes: 0以上の整数
  line_name: string | null
```

#### Scenario: 駅すぱあと形式を変換する

- **WHEN** Providerが有効な駅すぱあと形式のCourseを返す
- **THEN** システムは最初のCourseを共通Route JSONへ変換する

#### Scenario: 経路がない

- **WHEN** Providerの結果にCourseがない
- **THEN** APIはHTTP 404を返す

#### Scenario: Providerとの通信または変換に失敗する

- **WHEN** Providerが通信エラーまたは不正なデータを返す
- **THEN** APIはHTTP 502を返す

### Requirement: 経路結果を登録前に表示する

フロントエンドは検索結果の出発・到着時刻、所要時間、出発地、目的地、および各区間を表示しなければならない（MUST）。

#### Scenario: 検索に成功する

- **WHEN** 経路検索APIが共通Route JSONを返す
- **THEN** システムは縦型の経路結果と「この経路を登録」操作を表示する

#### Scenario: 条件を変更する

- **WHEN** ユーザーが検索条件の変更を選択する
- **THEN** システムは検索結果をクリアして出発地入力へ戻る
