## Why

現行の月表示は840px、週表示は980pxの固定幅で、スマートフォンでは横スクロールが必須になっている。PCの情報量を維持しつつ、スマートフォンでは片手操作できる専用構成へ切り替える必要がある。

## What Changes

- PCでは月・週・日表示と左sidebarを維持し、headerと操作群を整理する。
- スマートフォンの月表示を幅内に収まるcompact gridと選択日agendaへ変更する。
- スマートフォンの週表示を7日stripと選択日の時間軸へ変更する。
- スマートフォンに下部navigationと予定追加floating buttonを追加する。
- modalを狭幅ではfullscreenまたはbottom sheetにし、safe area、keyboard、44px touch targetへ対応する。
- モバイルまたはstandalone表示のFirebase認証をredirect方式、PCをpopup方式にする。
- 経路結果へProviderの出典、非公式性、徒歩fallbackを判別できる表示を追加する。
- 非目標: カレンダーのgesture操作、drag-and-drop編集、tablet専用第三layout、visual brand全面刷新。

## Capabilities

### New Capabilities

なし。

### Modified Capabilities

- `schedule-management`: 狭幅時の月・週・日表示とnavigation操作を変更する。
- `preparations`: 狭幅時の準備案内配置と操作性を変更する。
- `authentication-and-persistence`: 端末表示条件に応じてGoogle認証方式を切り替える。
- `places-and-route-search`: 狭幅時の検索結果表示とProvider注意表示を追加する。

## Impact

- `frontend/src/App.jsx`、calendar・modal・auth componentとCSSを再構成する。
- viewport別component testとbrowser test基盤を追加する。
- backend、Firestore schema、route algorithmは変更しない。
