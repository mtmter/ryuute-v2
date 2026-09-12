## MODIFIED Requirements

### Requirement: Route Providerを選択する

バックエンドは `ROUTE_PROVIDER_MODE` の `auto`、`transit`、`google`、`ekispert`、`mock` から実行方法を選択し、未設定時は `auto` を使用しなければならない（MUST）。`auto` は日本国内でTransit APIからGoogle徒歩検索、国外でGoogle公共交通検索からGoogle徒歩検索の順にfallbackし、駅すぱあとを自動選択してはならない（MUST NOT）。

#### Scenario: 日本国内を自動検索する

- **WHEN** 国内の座標を持つ出発地と目的地を `auto` で検索する
- **THEN** システムはTransit APIを最初に使用する
- **WHEN** Transit APIが対象外、経路なし、timeout、rate limitまたはserver errorを返す
- **THEN** システムはGoogle Routesの徒歩検索へfallbackする

#### Scenario: 日本国外を自動検索する

- **WHEN** 国内ではない座標を持つ経路を `auto` で検索する
- **THEN** システムはGoogle Routesの公共交通検索を使用する
- **WHEN** Google Routesが公共交通経路を返さない
- **THEN** システムはGoogle Routesの徒歩検索へfallbackする

#### Scenario: Providerを明示する

- **WHEN** `transit`、`google`、`ekispert` または `mock` を指定する
- **THEN** システムは指定されたProviderだけを使用する

#### Scenario: 未知のProviderを指定する

- **WHEN** 対応していない実行modeを指定する
- **THEN** APIはProvider設定エラーとしてHTTP 502を返す

#### Scenario: 駅すぱあとキーがない

- **WHEN** `ekispert` を選択し `EKISPERT_API_KEY` が設定されていない
- **THEN** APIはHTTP 500を返す

### Requirement: 共通Route JSONを返す

Providerは結果を次の共通Route JSONへ変換し、Provider固有のレスポンスをフロントエンドへ公開してはならない（MUST NOT）。

```text
origin: string
destination: string
departure_at: YYYY-MM-DDTHH:mm
arrival_at: YYYY-MM-DDTHH:mm
duration_minutes: 0以上の整数
transport_mode: string
provider: transit | google | ekispert | mock
route_kind: transit | walk
is_fallback: boolean
notices: string[]
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

#### Scenario: Provider結果を変換する

- **WHEN** いずれかのProviderが有効な経路を返す
- **THEN** システムは共通Route、使用Provider、経路種別、fallback状態、注意事項を返す

#### Scenario: 駅すぱあと形式を変換する

- **WHEN** 明示選択した駅すぱあとProviderが有効なCourseを返す
- **THEN** システムは駅すぱあと形式をProvider内部で共通Routeへ変換する

#### Scenario: 経路がない

- **WHEN** 明示Providerまたは自動fallbackの全Providerに経路がない
- **THEN** APIはHTTP 404を返す

#### Scenario: Providerとの通信または変換に失敗する

- **WHEN** 明示Providerが通信エラーまたは不正なデータを返す
- **THEN** APIはHTTP 502を返す

### Requirement: 経路結果を登録前に表示する

フロントエンドは検索結果の出発・到着時刻、所要時間、出発地、目的地、各区間、Provider、経路種別および注意事項を表示しなければならない（MUST）。

#### Scenario: 検索に成功する

- **WHEN** 経路検索APIが共通Route JSONを返す
- **THEN** システムは縦型の経路結果、出典・注意事項と「この経路を登録」操作を表示する

#### Scenario: 条件を変更する

- **WHEN** ユーザーが検索条件の変更を選択する
- **THEN** システムは検索結果をクリアして出発地入力へ戻る
