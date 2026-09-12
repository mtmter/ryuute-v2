# Deployment

このリポジトリとVercelから確認できるデプロイ設定、およびほかの外部サービス側で確認が必要な事項を分けて記載します。

## 現在の本番環境

2026年9月13日にVercel CLIと公開URLで確認した構成です。GitHubリポジトリは `mtmter/planrail`、VercelプロジェクトはPlanRail名へ変更済みです。

| 用途 | Project | Root Directory | Framework Preset | 公開URL |
| --- | --- | --- | --- | --- |
| フロントエンド | `planrail-frontend` | `frontend` | Vite | `https://planrail-frontend.vercel.app` |
| バックエンド | `planrail-backend` | `backend` | FastAPI | `https://planrail-backend.vercel.app` |

旧URL `ryuute-v2-frontend.vercel.app` と `ryuute-v2-backend.vercel.app` は移行期間中の互換性のため、同じProduction deploymentへ向けたaliasとして残しています。

両プロジェクトの直近Production Deploymentは `READY` です。フロントエンドは `npm run build`、バックエンドは `pip install -r requirements.txt` を使用する設定です。VercelのProject設定では両方にNode.js 24.xが選択されていますが、バックエンドのPythonランタイムバージョンはリポジトリでもVercel CLIの表示でも確認できませんでした。

Production環境には次の環境変数名が登録されています。値は暗号化されており、この確認では取得していません。

フロントエンド:

```text
VITE_GOOGLE_MAPS_API_KEY
VITE_FIREBASE_API_KEY
VITE_FIREBASE_AUTH_DOMAIN
VITE_FIREBASE_PROJECT_ID
VITE_FIREBASE_STORAGE_BUCKET
VITE_FIREBASE_MESSAGING_SENDER_ID
VITE_FIREBASE_APP_ID
VITE_BACKEND_API_BASE_URL
```

バックエンド:

```text
CORS_ORIGINS
ROUTE_PROVIDER_MODE
LS8H_TRANSIT_API_URL
```

`ROUTE_PROVIDER_MODE` は `auto` に設定しています。日本国内で座標を持つ地点の検索はLS8H Transit APIを優先し、対象外・経路なし・timeout・rate limit・server errorのときだけGoogle徒歩検索へfallbackします。旧 `ROUTE_PROVIDER=mock` は削除済みです。Productionには `EKISPERT_API_KEY` が登録されていません。

公開環境では次を確認済みです。

- フロントエンドURLがHTTP 200とHTMLを返す
- `GET /api/health` がHTTP 200と `{"status":"ok"}` を返す
- `POST /api/route-search` がHTTP 200と共通Route JSONを返す
- 東京駅から渋谷駅への座標付き検索が `provider: "transit"`、`route_kind: "transit"`、`is_fallback: false` を返す
- バックエンドの `CORS_ORIGINS` が `https://planrail-frontend.vercel.app` と旧フロントエンドURLの両方を許可する

## リポジトリで管理している設定

`firebase.json` は `firestore.rules` をFirestore Security Rulesとして参照しています。Firebase Hostingの設定はありません。

リポジトリには次の設定がありません。

- `vercel.json`
- GitHub ActionsなどのCI/CDワークフロー
- Node.jsまたはPythonのランタイムバージョン指定

Vercelの設定はリポジトリだけでは再現されないため、変更時は上記のProject設定とこの文書を同期する必要があります。

## Vercel Projectを再作成する場合

同じリポジトリからフロントエンドとバックエンドを別プロジェクトとして設定します。

| 用途 | Root Directory | 必要な主な設定 |
| --- | --- | --- |
| フロントエンド | `frontend` | Firebase、Google Maps、バックエンドURL |
| バックエンド | `backend` | Route Provider、CORS、Googleサーバーキー、必要なら駅すぱあとキー |

バックエンドの環境変数例:

```text
ROUTE_PROVIDER_MODE=auto
CORS_ORIGINS=https://<frontend-domain>
GOOGLE_MAPS_API_KEY=
EKISPERT_API_KEY=
LS8H_TRANSIT_API_URL=https://api.transit.ls8h.com/api/v1/plan
```

フロントエンドの環境変数例:

```text
VITE_GOOGLE_MAPS_API_KEY=
VITE_GOOGLE_OAUTH_CLIENT_ID=
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_STORAGE_BUCKET=
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=
VITE_BACKEND_API_BASE_URL=https://<backend-domain>/api
```

`VITE_BACKEND_API_BASE_URL` の末尾は `/api` とし、その後ろに `/` を付けません。Viteの環境変数はビルド時に取り込まれるため、値を変更した場合はフロントエンドを再デプロイします。

## 外部サービス側の確認

- Firebase AuthenticationでGoogleログインが有効であること
- Firebase AuthenticationのAuthorized domainsにフロントエンドドメインがあること
- Google Mapsのブラウザ用キーで必要なAPIとHTTPリファラが許可されていること
- Google Calendar APIが有効で、OAuth同意画面に読み取り専用スコープ、ウェブクライアントにフロントエンドのJavaScript生成元が設定されていること
- Google Routes用のサーバーキーでRoutes APIとデプロイ元の制限が設定されていること
- FastAPIの `CORS_ORIGINS` が実際のフロントエンドオリジンと一致すること
- Firestore Security Rulesが `firestore.rules` の内容でデプロイされていること

## デプロイ後の確認

バックエンド:

```text
GET https://<backend-domain>/api/health
```

期待するレスポンス:

```json
{"status":"ok"}
```

フロントエンドでは、Googleログイン、Firestoreの読み書き、場所入力、経路検索、移動予定登録を実環境で確認します。

経路Providerを変更した場合は `provider`、`route_kind`、`is_fallback`、`notices` が
レスポンスと保存済み移動ブロックへ残ることを確認します。障害時のrollbackは
`ROUTE_PROVIDER_MODE=mock` へ変更して再デプロイし、healthとroute-searchを再確認します。

## 未確認事項

環境変数の実値、Firebase AuthenticationのAuthorized domains、Google Maps APIキーのHTTPリファラ制限、デプロイ済みFirestore Security Rulesの版は今回取得していません。これらは各サービスの管理画面で確認する必要があります。
