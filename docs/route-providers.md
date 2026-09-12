# Route Providers

この文書は、現在実装されている経路Providerと変換処理の保守情報をまとめます。利用者に見えるAPI契約は `openspec/specs/places-and-route-search/spec.md` を参照してください。

## Providerの選択

`ROUTE_PROVIDER` で次のProviderを選択します。

| 値 | 動作 |
| --- | --- |
| `mock` | ローカルfixtureを読み込む。未設定時の既定値 |
| `ekispert` | 駅すぱあとAPIへ接続する |

対応していない値はProvider設定エラーになります。

```text
Provider
  -> 駅すぱあと形式JSON
  -> convert_ekispert_route()
  -> アプリ共通Route JSON
```

Mockと駅すぱあと実接続は、同じconverterを使用します。

## Ekispert Provider

`GET https://api.ekispert.jp/v1/json/search/course/extreme` を10秒のタイムアウトで呼び出します。現在のqueryは次のとおりです。

```text
key=<EKISPERT_API_KEY>
viaList=<origin>:<destination>
gcs=wgs84
date=YYYYMMDD
time=HHMM
searchType=arrival|departure
answerCount=1
sort=ekispert
```

`viaList` の区切り文字 `:` はURLエンコードせずに送信します。検索日時は日本標準時へ変換して `date` と `time` に分け、行きは到着検索、帰りは出発検索を使用します。

APIキーがない場合、タイムアウト、接続失敗、HTTPエラー、JSON以外のレスポンスはProviderエラーとして扱います。

## Mock Provider

Mock Providerは `backend/fixtures/ekispert_route_demo.json` を読み込みます。到着検索のfixture基準日時は、コード上で次に固定されています。

```text
2026-08-25T10:12:00+09:00
```

到着検索では基準到着希望日時、出発検索ではfixtureの先頭出発日時との差を求め、fixture内にあるすべての `Datetime.text` へ同じ差分を加えます。この処理は区間時間と待ち時間を保ったまま表示日時を移動するものであり、指定日時における実際の運行便を再探索するものではありません。

fixtureを置き換える場合は、`mock_provider.py` の `FIXTURE_DESIRED_ARRIVAL_AT` も新しいfixtureの基準条件に合わせる必要があります。

## Converter

converterは最初のCourseを使用し、PointとLineの数が `Point = Line + 1` であることを要求します。駅すぱあとJSONの単一オブジェクトと配列の差は内部でリストへ正規化します。

各Lineは次のように変換します。

- `Type` が大文字・小文字を問わず `walk`、または `Name` が `徒歩`: `WALK`
- それ以外: `TRANSIT`。路線名が必須
- 発着日時: 日本標準時の `YYYY-MM-DDTHH:mm`
- 所要時間: 発着日時の差を分単位へ切り上げ

Courseがない場合は経路なし、それ以外の不足・不整合はレスポンス変換エラーになります。
