# Repository Guide

## Sources of truth

- `README.md` は人間向けの概要とローカルセットアップを扱う。
- `openspec/specs/` は確認済みの現行プロダクト仕様を扱う。
- `openspec/changes/` は未実装を含む変更提案を扱う。
- `docs/` はアーキテクチャ、外部連携、デプロイなどの技術資料を扱う。
- 実装と文書が食い違う場合は、関連コードとテストを確認し、勝手に仕様を決めず不整合を報告する。

## Repository map

- `frontend/`: React/Vite。認証とFirestore CRUDもここで行う。
- `backend/`: FastAPI。ヘルスチェックと経路検索を提供する。
- `firestore.rules`: ユーザー別データのアクセス規則。

## Working rules

- 依頼された範囲に限定し、関係のない変更や先回り実装をしない。
- 既存の変更を上書きせず、変更前に関連するコード、テスト、設定、specを読む。
- 読みやすく明示的なReact/JavaScriptとPythonを優先し、必要性のない抽象化・依存関係・大規模リファクタリングを避ける。
- API、Firestore構造、外部連携を変更するときは、フロントエンドとバックエンド双方への影響を確認する。
- APIキー、トークン、秘密鍵、実値入りの `.env` をコミットしない。
- 未実装・計画中・推測だけの挙動を現行OpenSpecへ追加しない。

## Verification

変更範囲に応じて実行する。

```bash
backend/.venv/bin/python -m unittest discover -s backend -p 'test_*.py'
```

```bash
cd frontend
npm run lint
npm run build
```

フロントエンドには現在、自動テストスクリプトがない。実行できなかった確認は、その理由と未確認範囲を報告する。

## Handoff

完了時は、変更内容、変更ファイル、実行した検証と結果、残る不整合または未確認事項を簡潔に報告する。
