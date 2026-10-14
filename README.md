# 花はな Learning Timer

正式URL：https://hanahana-learning-timer.pages.dev/

2026-10-14の正式公開r2の修正を維持し、先生管理画面と90分・120分タイマーを拡張した開発ソースです。2026-10-15にユーザーがプレビューのデザイン・操作性と正式公開を承認しました。

## アプリとビルド

- `src/`：先生管理・学習タイマー・認証API。先生専用APIはサーバー側で認証と先生判定を行います。
- `public/`：既存の静的資産。プレビュー専用URLや架空データは含みません。
- `migrations/0010_teacher_management.sql`：先生管理の追加構造。0009とは独立です。
- `vite.config.ts`：Cloudflare Pages Advanced Modeの公式Honoビルド設定。
- `wrangler.toml`：既存DB bindingと公開Workerの互換性設定。正式公開時はこの設定を確実に読み込ませます。

Node.js 24.21.0と固定の依存関係を使用し、`npm run build:management`でビルドします。出力は `build/pages-management-20261015/dist` の5ファイルです。旧r2出力を上書きしません。Mac側の履歴・保護コマンドは引き続き維持します。

## 本番運用

既存Pagesプロジェクト `hanahana-learning-timer`、既存D1 `hanahana-production`、binding `DB`を維持します。`REGISTRATION_PASSWORD`と`TEACHER_USER_ID`はCloudflareの既存Secretを使用し、ソースに実値を入れません。先生の完全削除時の再認証は、登録済み先生アカウントのパスワードで照合します。

**0009は本番適用済みですが移行履歴表に未記録です。0009を再実行したり、自動migrations applyを実行したりしないでください。** 0010は本番構造・適用状況と最新の暗号化バックアップを確認してから、必要なときだけ単独適用します。

2026-10-15に0010の単独適用と正式公開を完了しました。0010は移行履歴へ登録済みです。ログインCookieの互換性問題も公開設定で解消し、本人による先生ログインと管理画面表示を確認済みです。再適用は不要です。

今回の機能・検証・公開手順は [正式公開の引き継ぎ](handoff/teacher-management-release-20261015.md) を参照してください。過去の第20段階の文書・確認番号は履歴です。実DB、バックアップ、秘密情報、プレビュー専用データは公開リポジトリに保存しません。
