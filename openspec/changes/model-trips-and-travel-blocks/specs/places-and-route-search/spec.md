## MODIFIED Requirements

### Requirement: 経路検索リクエストを受け付ける

システムは `POST /api/route-search` でProvider固有形式を含まない出発地、目的地、および出発または到着の時刻条件をJSONとして受け付けなければならない（MUST）。移行期間中は従来の予定を含む到着検索形式も受け付けなければならない（MUST）。

```text
origin: PlaceRef
destination: PlaceRef
timing:
  type: arrival | departure
  at: YYYY-MM-DDTHH:mm
```

#### Scenario: 地点を解決する
- **WHEN** 地点に緯度と経度の両方がある
- **THEN** システムは座標をProviderへ渡す地点として優先する
- **WHEN** 座標がない
- **THEN** システムは住所、次に表示名の順で利用可能な文字列を使用する

#### Scenario: 出発地または目的地がない
- **WHEN** 利用可能な出発地または目的地の情報がない
- **THEN** APIはHTTP 400を返す

#### Scenario: 時刻条件が不正である
- **WHEN** 時刻が解析できない、またはtypeがarrivalとdepartureのどちらでもない
- **THEN** APIはHTTP 400または422を返す

#### Scenario: 予定開始日時が不正である
- **WHEN** 従来形式の `event.start_at` が `YYYY-MM-DDTHH:mm` として解析できない
- **THEN** APIはHTTP 400を返す

#### Scenario: 従来形式を受け付ける
- **WHEN** 従来形式の予定開始日時と到着余裕時間を受け取る
- **THEN** システムは予定開始から余裕時間を減算したarrival検索として処理する

## REMOVED Requirements

### Requirement: 到着希望日時を計算する

**Reason**: 到着時刻だけでなく帰りの出発時刻や独立した移動を検索するため。

**Migration**: 従来形式では同じ到着希望日時を計算し、新形式ではクライアントが明示したtimingを使用する。
