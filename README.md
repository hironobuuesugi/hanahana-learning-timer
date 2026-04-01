# 🌸 花はな Learning Timer

中学生向け勉強時間管理アプリ（ユーザー管理基盤）

---

## プロジェクト概要

- **アプリ名**: 花はな Learning Timer
- **目的**: 中学生が勉強時間を記録・管理するためのアプリ
- **現フェーズ**: ユーザー管理基盤（ログイン・登録・ログアウト）
- **技術スタック**: Hono + TypeScript + Cloudflare Pages + D1 SQLite

---

## 現在実装済みの機能

| 機能 | 状態 |
|------|------|
| ユーザー新規登録 | ✅ 完成 |
| ログイン | ✅ 完成 |
| ログアウト | ✅ 完成 |
| ホーム画面 | ✅ 完成 |
| セッション管理（Cookie） | ✅ 完成 |
| ユーザーデータ永続化（D1） | ✅ 完成 |
| レスポンシブデザイン（SP対応） | ✅ 完成 |

---

## 今後追加予定の機能（未実装）

- ⏱️ 勉強タイマー
- 📝 勉強記録（科目・時間・メモ）
- 🏆 ランキング
- 📅 学習カレンダー
- 🎯 目標設定（1日の目標時間）
- 🔥 連続学習記録

---

## APIエンドポイント

| メソッド | パス | 説明 | 認証 |
|----------|------|------|------|
| POST | `/api/auth/register` | 新規ユーザー登録 | 不要 |
| POST | `/api/auth/login` | ログイン | 不要 |
| POST | `/api/auth/logout` | ログアウト | 必要 |
| GET | `/api/auth/me` | ログイン中ユーザー情報取得 | 必要 |

### リクエスト例

**新規登録**
```json
POST /api/auth/register
{
  "user_id": "hanako123",
  "password": "mypassword",
  "display_name": "はなこ"
}
```

**ログイン**
```json
POST /api/auth/login
{
  "user_id": "hanako123",
  "password": "mypassword"
}
```

---

## データ設計

### usersテーブル
| カラム | 型 | 説明 |
|--------|-----|------|
| id | INTEGER PK | 自動採番 |
| user_id | TEXT UNIQUE | ログイン用ID |
| password_hash | TEXT | SHA-256ハッシュ |
| display_name | TEXT | 表示名 |
| created_at | DATETIME | 登録日時 |
| is_active | INTEGER | 有効フラグ |

### sessionsテーブル
| カラム | 型 | 説明 |
|--------|-----|------|
| id | INTEGER PK | 自動採番 |
| session_token | TEXT UNIQUE | セッショントークン |
| user_id | INTEGER FK | ユーザーID |
| expires_at | DATETIME | 有効期限（7日） |

---

## プロジェクト構造

```
webapp/
├── src/
│   ├── index.tsx          # メインエントリー＋フロントエンドHTML
│   ├── routes/
│   │   └── auth.ts        # 認証APIルート
│   ├── middleware/
│   │   └── auth.ts        # 認証ミドルウェア
│   ├── utils/
│   │   ├── crypto.ts      # パスワードハッシュ・セッション生成
│   │   └── validation.ts  # 入力バリデーション
│   └── types/
│       └── index.ts       # 型定義
├── migrations/
│   └── 0001_initial_schema.sql  # DBスキーマ
├── public/                # 静的ファイル（今後追加）
├── ecosystem.config.cjs   # PM2設定
├── wrangler.jsonc         # Cloudflare設定
├── package.json
└── tsconfig.json
```

---

## ローカル開発

```bash
# 依存関係インストール
npm install

# DBマイグレーション（初回）
npm run db:migrate:local

# ビルド
npm run build

# 開発サーバー起動（PM2）
pm2 start ecosystem.config.cjs

# ログ確認
pm2 logs hanahana-learning-timer --nostream
```

---

## 本番デプロイ（Cloudflare Pages）

```bash
# Cloudflare D1データベース作成（初回のみ）
npx wrangler d1 create hanahana-production

# wrangler.jsoncのdatabase_idを更新後:
npm run db:migrate:prod

# デプロイ
npm run deploy:prod
```

---

## デザイン仕様

- **メインカラー**: ピンク (#f472b6) → パープル (#a78bfa) グラデーション
- **背景**: 薄いピンク (#fdf2f8)
- **フォント**: ヒラギノ角ゴシック / メイリオ
- **ブレークポイント**: スマートフォンファースト設計

---

## デプロイ状況

- **プラットフォーム**: Cloudflare Pages（準備済み）
- **開発サーバー**: http://localhost:3000
- **ステータス**: 🟡 ローカル動作確認済み（本番未デプロイ）
- **最終更新**: 2026-04-01
