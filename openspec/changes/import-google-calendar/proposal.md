## Why

利用者が既にGoogleカレンダーで管理している予定を再入力せず、Ryuute固有の経路・準備情報を付加できるようにする。v1はブラウザ完結の読み取り専用同期に限定し、サーバーでOAuth tokenを保管する運用負担を避ける。

## What Changes

- Google Calendarへの接続・切断と、primaryおよび追加calendarの選択画面を追加する。
- `calendar.readonly` tokenをブラウザmemoryだけで扱い、失効時は再接続を求める。
- 初回全同期と `syncToken` による起動時・手動差分同期を追加する。
- Google予定を既存カレンダーへ表示し、Google所有項目は読み取り専用にする。
- 取り込み予定へRyuute固有の到着余裕、場所補足、準備、経路を関連付けられるようにする。
- Google側削除はカレンダーから非表示にし、関連するRyuuteデータは保持する。
- 非目標: 双方向同期、background同期、push通知、Google以外のcalendar、refresh token保管。

## Capabilities

### New Capabilities

- `google-calendar-integration`: Google Calendarの認可、calendar選択、差分同期、読み取り専用予定を定義する。

### Modified Capabilities

- `schedule-management`: ローカル予定とGoogle由来予定を同じcalendarへ表示し、編集可能範囲を区別する。
- `authentication-and-persistence`: integration設定と外部予定source情報のFirestore保存境界を追加する。

## Impact

- Google Identity ServicesとCalendar REST APIを呼ぶfrontend serviceを追加する。
- Firestoreのevent documentへsource・同期状態を追加し、integration設定documentを新設する。
- 認可・同期・calendar選択UI、環境変数、Firebase/Google Cloud設定資料を追加する。
