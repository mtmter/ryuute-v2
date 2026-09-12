## Why

現在の移動予定は1予定につき1件だけ保存され、予定詳細でしか確認できないため、行きと帰り、複数目的地、予約済みの列車や夜行バスを一つの旅程として扱えない。予定を行動、移動を時間ブロック、Tripを任意のグループとして分離し、現実の移動をカレンダー上で管理できるようにする。

## What Changes

- **BREAKING** `travelPlans/{eventId}` を正規の保存先とする1予定1経路モデルを、複数件を保存できる `travelBlocks/{travelBlockId}` へ置き換える。
- Tripを追加し、予定、移動ブロック、準備項目を任意にグループ化する。Trip自体はカレンダーの時間ブロックにしない。
- 検索経路と手動登録した予約済み移動を同じ移動ブロックとして扱い、経路内の徒歩・鉄道等はsegmentとして保持する。
- 月・週・日カレンダーへ移動ブロックを表示し、日付またぎ、予定との重複、要確認状態を表現する。
- 予定詳細から行きと帰りを別々に検索・保存できるよう、経路検索入力を出発地、目的地、出発／到着条件へ一般化する。
- 予定・Tripの変更や削除に伴う関連解除、要確認化、選択式の連動削除を追加する。
- 既存travel planを冪等かつ非破壊で移動ブロックへ段階移行する。

## Capabilities

### New Capabilities

- `trips`: 予定、移動ブロック、準備項目をまとめるTripと旅程整合性警告。

### Modified Capabilities

- `travel-plans`: 複数移動ブロック、手動移動、関連解除、旧データ移行へ変更する。
- `schedule-management`: 移動ブロックを月・週・日のカレンダー項目として表示する。
- `places-and-route-search`: 予定に依存しない出発／到着条件で経路を検索する。
- `preparations`: 準備項目を予定またはTripへ関連付けられるようにする。

## Impact

- Reactのスケジュール状態、追加・詳細モーダル、月・週・日カレンダーを変更する。
- Firestoreへ `trips` と `travelBlocks` を追加し、eventsとpreparationsの関連フィールドを拡張する。
- FastAPIの `/api/route-search` を一般化し、旧リクエストも移行期間中は受け付ける。
- 既存の5 changeは実装順を維持し、このchangeをProvider基盤・プロダクト整理の後、Google Calendar・レスポンシブUI・PWAの前に位置付ける。

