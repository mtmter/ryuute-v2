## Context

See proposal.md. 予定は既に `location_name`、`destination`、`destination_place_id`、`destination_lat`、`destination_lng` を保存する。Transitousは座標で検索できるが、任意文字列は検索できない。現在は同じ場所を二つの編集欄へ持ち、座標不足の検索がバックエンドへ到達してGoogle Routes未設定の失敗になる。

## Goals / Non-Goals

**Goals:**

- 場所を一度だけ入力・選択し、候補選択の座標を既存形式で保存する。
- API呼出前に座標不足を止め、既存の自由入力予定は表示・編集できるように保つ。
- Providerの内部IDを利用者向け表示から除く。

**Non-Goals:**

- 既存ドキュメントの書き換え、任意文字列のジオコーディング、Google Routesのサーバー設定。

## Decisions

1. 新規・編集予定は候補入力を唯一の場所編集面とし、候補選択時に名称を `location_name`、住所を `destination` へ保存する。自由入力は名称として保存し、住所・座標・Place IDを空にする。既存フィールドとGoogle Calendar由来の予定を読み替えることで移行を不要にする。
2. 経路検索の各入口で、予定地点と入力地点の両方に座標があることを確認する。満たさない場合はボタンを無効化またはフォーム内エラーにして、fetchを行わない。バックエンドの既存互換文字列解決は残す。
3. Transitousの区間名は数字だけの `displayName` を採用せず、数字だけでない `routeLongName`、`routeShortName`、`displayName` の順で選ぶ。どれも読めない場合は共通の交通種別を使う。

## Risks / Trade-offs

- [自由入力の既存予定では検索操作が減る] → 候補を選び直す明確な案内を表示し、予定の保存・表示は制限しない。
- [フィードに路線名がない] → 内部IDを露出せず、公共交通という共通ラベルを表示する。

## Migration Plan

1. フロントエンドの入力・検索可否とProviderラベルを変更する。
2. 単体テスト、lint、build、バックエンドテストを実行する。
3. 既存の座標なし予定と候補選択済み予定を本番で確認する。問題時はフロントエンドを直前デプロイへ戻せる。
