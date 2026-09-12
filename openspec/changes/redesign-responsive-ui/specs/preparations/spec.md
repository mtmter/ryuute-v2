## MODIFIED Requirements

### Requirement: 画面幅に応じて案内位置を切り替える

幅721px以上の月、週、日表示では、システムは左sidebarにmini calendarと準備案内を表示しなければならない（MUST）。幅720px以下では、システムは準備案内を選択日のagendaより前に表示し、page横scrollを発生させてはならない（MUST NOT）。

#### Scenario: デスクトップ幅のカレンダーを表示する

- **WHEN** 幅721px以上でcalendarを表示する
- **THEN** システムは左sidebarのscroll可能領域に準備案内を表示する

#### Scenario: モバイル幅またはタスク表示を開く

- **WHEN** 幅720px以下でcalendarを表示する
- **THEN** システムはsidebarを隠し、主content内に準備案内を表示する
