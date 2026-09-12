## ADDED Requirements

### Requirement: 経路情報の出典とfallbackを表示する

経路検索結果と保存済み移動予定は、使用Provider、公共交通または徒歩、fallback状態およびProviderの注意事項を画面幅にかかわらず表示しなければならない（MUST）。

#### Scenario: Transit経路を表示する

- **WHEN** Transit API由来の経路を表示する
- **THEN** システムは非公式情報であり公式運行情報の確認が必要であることを表示する

#### Scenario: 徒歩fallbackを表示する

- **WHEN** Google徒歩経路をfallbackとして表示する
- **THEN** システムは公共交通経路ではなく徒歩fallbackであることを表示する
