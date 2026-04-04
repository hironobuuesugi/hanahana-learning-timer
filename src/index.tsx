// =============================================
// 花はな Learning Timer - メインエントリーポイント
// =============================================

import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'
import { serveStatic } from 'hono/cloudflare-workers'
import authRoutes from './routes/auth'
import timerRoutes from './routes/timer'
import statsRoutes from './routes/stats'
import recordsRoutes from './routes/records'
import testdateRoutes from './routes/testdate'
import rankingRoutes from './routes/ranking'
import { authMiddleware } from './middleware/auth'
import type { Bindings, Variables } from './types'

const app = new Hono<{ Bindings: Bindings; Variables: Variables }>()

// ミドルウェア設定
app.use('*', logger())
app.use('/api/*', cors({
  origin: '*',
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
}))

// 静的ファイル配信
app.use('/static/*', serveStatic({ root: './public' }))

// =============================================
// APIルート登録
// =============================================
app.route('/api/auth', authRoutes)
app.route('/api/timer', timerRoutes)
app.route('/api/stats', statsRoutes)
app.route('/api/records', recordsRoutes)
app.route('/api/testdate', testdateRoutes)
app.route('/api/ranking', rankingRoutes)

// =============================================
// フロントエンドページ（SPA形式）
// =============================================

// メインSPAページ（ログイン・登録・ホームを一つのページで管理）
app.get('*', (c) => {
  return c.html(`<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>花はな Learning Timer</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css" />
  <style>
    /* カスタムカラーテーマ */
    :root {
      --color-primary: #f472b6;    /* ピンク（メインカラー） */
      --color-secondary: #a78bfa;  /* パープル（サブカラー） */
      --color-accent: #fb923c;     /* オレンジ（アクセント） */
      --color-bg: #fdf2f8;         /* 薄いピンク背景 */
    }

    body {
      background-color: var(--color-bg);
      font-family: 'Hiragino Kaku Gothic ProN', 'ヒラギノ角ゴ ProN W3', Meiryo, sans-serif;
      min-height: 100vh;
    }

    /* ページ切り替えアニメーション */
    .page {
      display: none;
      animation: fadeIn 0.3s ease-in;
    }
    .page.active {
      display: block;
    }
    @keyframes fadeIn {
      from { opacity: 0; transform: translateY(10px); }
      to { opacity: 1; transform: translateY(0); }
    }

    /* 桜の花びら装飾 */
    .sakura-icon {
      display: inline-block;
      animation: sway 3s ease-in-out infinite;
    }
    @keyframes sway {
      0%, 100% { transform: rotate(-5deg); }
      50% { transform: rotate(5deg); }
    }

    /* グラデーションボタン */
    .btn-primary {
      background: linear-gradient(135deg, #f472b6, #a78bfa);
      transition: all 0.2s ease;
    }
    .btn-primary:hover {
      background: linear-gradient(135deg, #ec4899, #8b5cf6);
      transform: translateY(-1px);
      box-shadow: 0 4px 15px rgba(244, 114, 182, 0.4);
    }
    .btn-primary:active {
      transform: translateY(0);
    }

    /* カード */
    .card {
      background: white;
      border-radius: 16px;
      box-shadow: 0 4px 20px rgba(244, 114, 182, 0.1);
    }

    /* 入力フィールド */
    .input-field {
      transition: border-color 0.2s ease, box-shadow 0.2s ease;
    }
    .input-field:focus {
      border-color: #f472b6;
      box-shadow: 0 0 0 3px rgba(244, 114, 182, 0.2);
      outline: none;
    }

    /* ローディング */
    .loading {
      opacity: 0.7;
      pointer-events: none;
    }

    /* エラーメッセージ */
    .error-msg {
      animation: shake 0.3s ease;
    }
    @keyframes shake {
      0%, 100% { transform: translateX(0); }
      25% { transform: translateX(-5px); }
      75% { transform: translateX(5px); }
    }
  </style>
</head>
<body>

<!-- =============================================
     ページ1: ログイン画面
     ============================================= -->
<div id="page-login" class="page active">
  <div class="min-h-screen flex items-center justify-center p-4">
    <div class="w-full max-w-sm">

      <!-- ロゴ・タイトル -->
      <div class="text-center mb-8">
        <div class="text-5xl mb-3">
          <span class="sakura-icon">🌸</span>
        </div>
        <h1 class="text-2xl font-bold text-gray-800 leading-tight">
          花はな<br/>
          <span class="text-transparent bg-clip-text bg-gradient-to-r from-pink-400 to-purple-400">
            Learning Timer
          </span>
        </h1>
        <p class="text-sm text-gray-500 mt-2">ログインして勉強をはじめよう！</p>
      </div>

      <!-- ログインフォーム -->
      <div class="card p-6">
        <div id="login-error" class="hidden error-msg bg-red-50 border border-red-200 text-red-600 text-sm rounded-lg p-3 mb-4"></div>

        <form onsubmit="handleLogin(); return false;">
        <div class="mb-4">
          <label class="block text-sm font-medium text-gray-700 mb-1">
            <i class="fas fa-user text-pink-400 mr-1"></i>ユーザーID
          </label>
          <input
            id="login-userid"
            type="text"
            placeholder="例: hanako123"
            autocomplete="username"
            class="input-field w-full border border-gray-200 rounded-lg px-4 py-3 text-gray-800 placeholder-gray-400"
          />
        </div>

        <div class="mb-6">
          <label class="block text-sm font-medium text-gray-700 mb-1">
            <i class="fas fa-lock text-pink-400 mr-1"></i>パスワード
          </label>
          <div class="relative">
            <input
              id="login-password"
              type="password"
              placeholder="パスワードを入力"
              autocomplete="current-password"
              class="input-field w-full border border-gray-200 rounded-lg px-4 py-3 text-gray-800 placeholder-gray-400 pr-12"
            />
            <button
              type="button"
              onclick="togglePassword('login-password', 'login-pw-icon')"
              class="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              <i id="login-pw-icon" class="fas fa-eye-slash text-sm"></i>
            </button>
          </div>
        </div>

        <button
          id="login-btn"
          type="submit"
          class="btn-primary w-full text-white font-bold py-3 rounded-lg"
        >
          <i class="fas fa-sign-in-alt mr-2"></i>ログイン
        </button>
        </form>

        <div class="mt-4 text-center">
          <p class="text-sm text-gray-500">
            まだアカウントがない方は
            <button onclick="showPage('page-register')" class="text-pink-500 font-medium hover:text-pink-600 underline">
              新規登録
            </button>
          </p>
        </div>
      </div>

    </div>
  </div>
</div>

<!-- =============================================
     ページ2: 新規登録画面
     ============================================= -->
<div id="page-register" class="page">
  <div class="min-h-screen flex items-center justify-center p-4">
    <div class="w-full max-w-sm">

      <!-- タイトル -->
      <div class="text-center mb-8">
        <div class="text-5xl mb-3">
          <span class="sakura-icon">🌸</span>
        </div>
        <h1 class="text-2xl font-bold text-gray-800">アカウント作成</h1>
        <p class="text-sm text-gray-500 mt-2">花はなで勉強をはじめよう！</p>
      </div>

      <!-- 登録フォーム -->
      <div class="card p-6">
        <div id="register-error" class="hidden error-msg bg-red-50 border border-red-200 text-red-600 text-sm rounded-lg p-3 mb-4"></div>
        <div id="register-success" class="hidden bg-green-50 border border-green-200 text-green-600 text-sm rounded-lg p-3 mb-4"></div>

        <form onsubmit="handleRegister(); return false;">
        <!-- ユーザーID -->
        <div class="mb-4">
          <label class="block text-sm font-medium text-gray-700 mb-1">
            <i class="fas fa-user text-pink-400 mr-1"></i>ユーザーID
            <span class="text-red-400">*</span>
          </label>
          <input
            id="reg-userid"
            type="text"
            placeholder="例: hanako123（英数字・_のみ）"
            autocomplete="username"
            class="input-field w-full border border-gray-200 rounded-lg px-4 py-3 text-gray-800 placeholder-gray-400"
          />
          <p class="text-xs text-gray-400 mt-1">3〜20文字、英数字とアンダースコア(_)のみ</p>
        </div>

        <!-- パスワード -->
        <div class="mb-4">
          <label class="block text-sm font-medium text-gray-700 mb-1">
            <i class="fas fa-lock text-pink-400 mr-1"></i>パスワード
            <span class="text-red-400">*</span>
          </label>
          <div class="relative">
            <input
              id="reg-password"
              type="password"
              placeholder="6文字以上のパスワード"
              autocomplete="new-password"
              class="input-field w-full border border-gray-200 rounded-lg px-4 py-3 text-gray-800 placeholder-gray-400 pr-12"
            />
            <button
              type="button"
              onclick="togglePassword('reg-password', 'reg-pw-icon')"
              class="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              <i id="reg-pw-icon" class="fas fa-eye-slash text-sm"></i>
            </button>
          </div>
          <p class="text-xs text-gray-400 mt-1">6〜50文字</p>
        </div>

        <!-- 表示名 -->
        <div class="mb-4">
          <label class="block text-sm font-medium text-gray-700 mb-1">
            <i class="fas fa-smile text-pink-400 mr-1"></i>表示名（ニックネーム）
            <span class="text-red-400">*</span>
          </label>
          <input
            id="reg-displayname"
            type="text"
            placeholder="例: はなこ"
            autocomplete="nickname"
            class="input-field w-full border border-gray-200 rounded-lg px-4 py-3 text-gray-800 placeholder-gray-400"
          />
          <p class="text-xs text-gray-400 mt-1">20文字以内（絵文字もOK！）— 登録後に変更はできません</p>
        </div>

        <!-- 登録用パスワード -->
        <div class="mb-6">
          <label class="block text-sm font-medium text-gray-700 mb-1">
            <i class="fas fa-key text-pink-400 mr-1"></i>登録用パスワード
            <span class="text-red-400">*</span>
          </label>
          <div class="relative">
            <input
              id="reg-regpassword"
              type="password"
              placeholder="登録用パスワードを入力"
              autocomplete="off"
              class="input-field w-full border border-gray-200 rounded-lg px-4 py-3 text-gray-800 placeholder-gray-400 pr-12"
            />
            <button
              type="button"
              onclick="togglePassword('reg-regpassword', 'reg-regpw-icon')"
              class="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              <i id="reg-regpw-icon" class="fas fa-eye-slash text-sm"></i>
            </button>
          </div>
          <p class="text-xs text-gray-400 mt-1">
            <i class="fas fa-info-circle mr-1"></i>このアプリの登録には管理者から伝えられた登録用パスワードが必要です
          </p>
        </div>

        <button
          id="register-btn"
          type="submit"
          class="btn-primary w-full text-white font-bold py-3 rounded-lg"
        >
          <i class="fas fa-user-plus mr-2"></i>アカウントを作成する
        </button>
        </form>

        <div class="mt-4 text-center">
          <p class="text-sm text-gray-500">
            すでにアカウントがある方は
            <button onclick="showPage('page-login')" class="text-pink-500 font-medium hover:text-pink-600 underline">
              ログイン
            </button>
          </p>
        </div>
      </div>

    </div>
  </div>
</div>

<!-- =============================================
     ページ3: ホーム画面（ログイン後）
     ============================================= -->
<div id="page-home" class="page">
  <div class="min-h-screen">

    <!-- ヘッダー -->
    <header class="bg-white shadow-sm sticky top-0 z-10">
      <div class="max-w-lg mx-auto px-4 py-3 flex items-center justify-between">
        <div class="flex items-center gap-2">
          <span class="text-2xl">🌸</span>
          <span class="font-bold text-transparent bg-clip-text bg-gradient-to-r from-pink-400 to-purple-400 text-sm">
            花はな Learning Timer
          </span>
        </div>
        <button
          onclick="handleLogout()"
          class="text-sm text-gray-500 hover:text-red-400 flex items-center gap-1 transition-colors"
        >
          <i class="fas fa-sign-out-alt"></i>
          <span class="hidden sm:inline">ログアウト</span>
        </button>
      </div>
    </header>

    <!-- メインコンテンツ -->
    <main class="max-w-lg mx-auto px-4 py-6">

      <!-- ウェルカムカード -->
      <div class="card p-6 mb-6 bg-gradient-to-br from-pink-50 to-purple-50">
        <div class="flex items-center gap-4">
          <div class="w-14 h-14 rounded-full bg-gradient-to-br from-pink-400 to-purple-400 flex items-center justify-center text-white text-2xl font-bold shadow-md">
            <span id="home-avatar">🌸</span>
          </div>
          <div>
            <p class="text-sm text-gray-500">おかえり！</p>
            <h2 class="text-xl font-bold text-gray-800">
              <span id="home-displayname">ゲスト</span>さん
            </h2>
            <p class="text-xs text-gray-400">
              <i class="fas fa-user text-pink-300 mr-1"></i>
              <span id="home-userid"></span>
            </p>
          </div>
        </div>
      </div>

      <!-- 勉強時間集計カード -->
      <div class="card p-4 mb-6">
        <h3 class="text-sm font-medium text-gray-500 mb-3 flex items-center gap-2">
          <i class="fas fa-chart-bar text-pink-400"></i>
          勉強時間
        </h3>
        <!-- 🔥 今日の勉強時間（強調表示） -->
        <div class="bg-pink-50 border border-pink-200 rounded-xl p-4 mb-3 text-center">
          <p class="text-sm text-pink-500 font-semibold mb-1">🔥 今日の勉強時間</p>
          <p class="text-3xl font-bold text-pink-600" id="home-stats-today">--</p>
        </div>
        <div class="grid grid-cols-3 gap-3" id="home-stats-grid">
          <!-- 今週 -->
          <div class="bg-purple-50 rounded-xl p-3 text-center">
            <p class="text-xs text-purple-400 font-medium mb-1">今週</p>
            <p class="text-lg font-bold text-purple-600" id="home-stats-week">--</p>
          </div>
          <!-- 今月 -->
          <div class="bg-blue-50 rounded-xl p-3 text-center">
            <p class="text-xs text-blue-400 font-medium mb-1">今月</p>
            <p class="text-lg font-bold text-blue-600" id="home-stats-month">--</p>
          </div>
          <!-- 累計 -->
          <div class="bg-green-50 rounded-xl p-3 text-center">
            <p class="text-xs text-green-500 font-medium mb-1">累計</p>
            <p class="text-lg font-bold text-green-600" id="home-stats-total">--</p>
          </div>
        </div>
        <!-- 自己ベスト -->
        <div class="mt-3 flex items-center justify-between bg-yellow-50 rounded-xl px-4 py-2">
          <div class="flex items-center gap-2">
            <span class="text-base">🏅</span>
            <span class="text-xs font-medium text-yellow-700">自己ベスト</span>
          </div>
          <div class="text-right">
            <span class="text-sm font-bold text-yellow-600" id="home-stats-best">--</span>
            <span class="text-xs text-yellow-500 ml-2" id="home-stats-best-date"></span>
          </div>
        </div>
      </div>

      <!-- テスト日カード -->
      <div class="card p-4 mb-6" id="testdate-card">
        <h3 class="text-sm font-medium text-gray-500 mb-3 flex items-center gap-2">
          <i class="fas fa-calendar-check text-orange-400"></i>
          テスト日
        </h3>
        <!-- 保存済みテスト日の表示 -->
        <div id="testdate-display" class="mb-3 hidden">
          <div class="flex items-center gap-3">
            <p class="text-2xl font-bold text-orange-500" id="testdate-value">--</p>
            <p class="text-sm font-medium text-orange-400 bg-orange-50 px-2 py-1 rounded-lg" id="testdate-countdown"></p>
          </div>
        </div>
        <!-- 入力フォーム -->
        <div class="flex gap-2 items-center">
          <input
            type="date"
            id="testdate-input"
            class="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-orange-300 focus:ring-1 focus:ring-orange-200"
          />
          <button
            id="testdate-save-btn"
            onclick="saveTestDate()"
            class="bg-orange-400 hover:bg-orange-500 text-white text-sm font-medium px-4 py-2 rounded-xl transition-colors whitespace-nowrap"
          >保存</button>
        </div>
        <!-- 保存メッセージ（一時表示） -->
        <p id="testdate-msg" class="text-xs text-green-600 mt-2 hidden"></p>
        <!-- エラーメッセージ -->
        <p id="testdate-err" class="text-xs text-red-500 mt-2 hidden"></p>
      </div>

      <!-- 機能カード一覧（今後の機能を予告） -->
      <div class="mb-6">
        <h3 class="text-sm font-medium text-gray-500 mb-3 flex items-center gap-2">
          <i class="fas fa-star text-yellow-400"></i>
          これから使える機能
        </h3>
        <div class="grid grid-cols-2 gap-3">

          <!-- タイマー（使用可能） -->
          <div
            class="card p-4 cursor-pointer hover:shadow-md transition-shadow border-2 border-pink-100 hover:border-pink-300"
            onclick="showPage('page-timer'); initTimerPage()"
          >
            <div class="text-3xl mb-2">⏱️</div>
            <p class="font-medium text-gray-700 text-sm">勉強タイマー</p>
            <p class="text-xs text-pink-400 mt-1 font-medium">タップして開始→</p>
          </div>

          <!-- 勉強記録（使用可能） -->
          <div
            class="card p-4 cursor-pointer hover:shadow-md transition-shadow border-2 border-purple-100 hover:border-purple-300"
            onclick="showPage('page-records'); initRecordsPage()"
          >
            <div class="text-3xl mb-2">📝</div>
            <p class="font-medium text-gray-700 text-sm">勉強記録</p>
            <p class="text-xs text-purple-400 mt-1 font-medium">記録を見る→</p>
          </div>

          <!-- ランキング（使用可能） -->
          <div
            class="card p-4 cursor-pointer hover:shadow-md transition-shadow border-2 border-yellow-100 hover:border-yellow-300"
            onclick="showPage('page-ranking'); initRankingPage()"
          >
            <div class="text-3xl mb-2">🏆</div>
            <p class="font-medium text-gray-700 text-sm">ランキング</p>
            <p class="text-xs text-yellow-500 mt-1 font-medium">順位を見る→</p>
          </div>

          <!-- スタートダッシュガチャ（使用可能） -->
          <div
            class="card p-4 cursor-pointer hover:shadow-md transition-shadow border-2 border-yellow-100 hover:border-yellow-300"
            onclick="drawGacha()"
          >
            <div class="text-3xl mb-2">🎰</div>
            <p class="font-medium text-gray-700 text-sm">スタートダッシュガチャ</p>
            <p class="text-xs text-yellow-500 mt-1 font-medium">最初の1つを引く→</p>
          </div>

        </div>

        <!-- ガチャ結果表示エリア（ガチャを引いたときだけ表示） -->
        <div id="gacha-result-area" class="hidden mt-4">
          <div class="bg-gradient-to-br from-yellow-50 to-orange-50 border-2 border-yellow-200 rounded-2xl p-5">
            <p class="text-xs font-medium text-yellow-600 mb-3 text-center tracking-wide">✨ 最初の1つを決めよう ✨</p>
            <p class="text-base font-bold text-gray-800 leading-relaxed text-center" id="gacha-result-text"></p>
            <div class="mt-4 text-center">
              <button
                onclick="drawGacha()"
                class="bg-yellow-400 hover:bg-yellow-500 text-white text-sm font-bold px-6 py-2 rounded-full transition-colors shadow-sm"
              >もう一度引く 🎰</button>
            </div>
          </div>
        </div>

      </div>

      <!-- アカウント情報 -->
      <div class="card p-4">
        <h3 class="text-sm font-medium text-gray-500 mb-3 flex items-center gap-2">
          <i class="fas fa-cog text-gray-400"></i>
          アカウント情報
        </h3>
        <div class="space-y-2">
          <div class="flex justify-between items-center py-2 border-b border-gray-50">
            <span class="text-sm text-gray-600">表示名</span>
            <span class="text-sm font-medium text-gray-800" id="home-info-displayname">-</span>
          </div>
          <div class="flex justify-between items-center py-2 border-b border-gray-50">
            <span class="text-sm text-gray-600">ユーザーID</span>
            <span class="text-sm font-mono text-gray-600" id="home-info-userid">-</span>
          </div>
          <div class="flex justify-between items-center py-2">
            <span class="text-sm text-gray-600">登録日</span>
            <span class="text-sm text-gray-600" id="home-info-created">-</span>
          </div>
        </div>
      </div>

      <!-- 勉強タイマーを始めるボタン（大きめ） -->
      <div class="mt-6">
        <button
          onclick="showPage('page-timer'); initTimerPage()"
          class="btn-primary w-full text-white font-bold py-4 rounded-xl flex items-center justify-center gap-3 text-lg shadow-md"
        >
          <span class="text-2xl">⏱️</span>
          勉強タイマーを始める
        </button>
      </div>

      <!-- ログアウトボタン（モバイル向け大きめ） -->
      <div class="mt-3">
        <button
          onclick="handleLogout()"
          class="w-full bg-gray-100 hover:bg-red-50 text-gray-600 hover:text-red-500 font-medium py-3 rounded-lg transition-colors flex items-center justify-center gap-2"
        >
          <i class="fas fa-sign-out-alt"></i>
          ログアウト
        </button>
      </div>

    </main>
  </div>
</div>

<!-- =============================================
     ページ6: ランキング画面
     ============================================= -->
<div id="page-ranking" class="page">
  <div class="min-h-screen bg-gray-50">

    <!-- ヘッダー -->
    <header class="bg-white shadow-sm sticky top-0 z-10">
      <div class="max-w-lg mx-auto px-4 py-3 flex items-center justify-between">
        <button
          onclick="showPage('page-home')"
          class="text-gray-500 hover:text-gray-700 flex items-center gap-1 transition-colors"
        >
          <i class="fas fa-chevron-left"></i>
          <span class="text-sm">ホーム</span>
        </button>
        <span class="font-bold text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 to-orange-400 text-sm">
          🏆 ランキング
        </span>
        <div class="w-16"></div>
      </div>
    </header>

    <!-- メインコンテンツ -->
    <main class="max-w-lg mx-auto px-4 py-6 space-y-5">

      <!-- ローディング中 -->
      <div id="ranking-loading" class="text-center py-12 hidden">
        <div class="inline-block w-8 h-8 border-4 border-yellow-200 border-t-yellow-400 rounded-full animate-spin mb-3"></div>
        <p class="text-sm text-gray-400">集計中...</p>
      </div>

      <!-- エラーメッセージ -->
      <div id="ranking-error" class="hidden bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-600"></div>

      <!-- 今週のランキング -->
      <div id="ranking-week-section" class="hidden">
        <div class="bg-white rounded-2xl shadow-sm p-4">
          <div class="flex items-center gap-2 mb-1">
            <span class="text-lg">📅</span>
            <h2 class="font-bold text-gray-700 text-sm">今週のランキング</h2>
          </div>
          <p class="text-xs text-gray-400 mb-3" id="ranking-week-label"></p>
          <div id="ranking-week-list" class="space-y-2"></div>
          <!-- 自分の順位（圏外の場合） -->
          <div id="ranking-week-myrank-area" class="hidden mt-3 pt-3 border-t border-dashed border-gray-200">
            <p class="text-xs text-gray-500 text-center" id="ranking-week-myrank-text"></p>
          </div>
        </div>
      </div>

      <!-- 今月のランキング -->
      <div id="ranking-month-section" class="hidden">
        <div class="bg-white rounded-2xl shadow-sm p-4">
          <div class="flex items-center gap-2 mb-1">
            <span class="text-lg">🗓️</span>
            <h2 class="font-bold text-gray-700 text-sm">今月のランキング</h2>
          </div>
          <p class="text-xs text-gray-400 mb-3" id="ranking-month-label"></p>
          <div id="ranking-month-list" class="space-y-2"></div>
          <!-- 自分の順位（圏外の場合） -->
          <div id="ranking-month-myrank-area" class="hidden mt-3 pt-3 border-t border-dashed border-gray-200">
            <p class="text-xs text-gray-500 text-center" id="ranking-month-myrank-text"></p>
          </div>
          <!-- 月特典カード -->
          <div class="mt-4 pt-3 border-t border-gray-100">
            <div class="bg-amber-50 border border-amber-200 rounded-xl p-3">
              <p class="text-xs font-bold text-amber-700 mb-2 text-center">🎁 月20時間以上で特典対象</p>
              <div class="space-y-1">
                <div class="flex items-center gap-2 text-sm">
                  <span class="text-base">🏆</span>
                  <span class="font-bold text-yellow-600">1位</span>
                  <span class="text-gray-700">図書カード1000円</span>
                </div>
                <div class="flex items-center gap-2 text-sm">
                  <span class="text-base">🥈</span>
                  <span class="font-bold text-gray-500">2位</span>
                  <span class="text-gray-700">図書カード500円</span>
                </div>
                <div class="flex items-center gap-2 text-sm">
                  <span class="text-base">🍨</span>
                  <span class="font-bold text-amber-700">3位</span>
                  <span class="text-gray-700">ハーゲンダッツ</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- 記録なし -->
      <div id="ranking-empty" class="hidden text-center py-16">
        <div class="text-5xl mb-4">🏅</div>
        <p class="text-gray-500 text-sm">まだランキングデータがありません</p>
        <p class="text-gray-400 text-xs mt-2">勉強を記録するとランキングに表示されます！</p>
      </div>

    </main>
  </div>
</div>

<!-- =============================================
     ページ5: 勉強記録一覧画面
     ============================================= -->
<div id="page-records" class="page">
  <div class="min-h-screen">

    <!-- ヘッダー -->
    <header class="bg-white shadow-sm sticky top-0 z-10">
      <div class="max-w-lg mx-auto px-4 py-3 flex items-center justify-between">
        <button
          onclick="showPage('page-home')"
          class="text-gray-500 hover:text-gray-700 flex items-center gap-1 transition-colors"
        >
          <i class="fas fa-chevron-left"></i>
          <span class="text-sm">ホーム</span>
        </button>
        <span class="font-bold text-transparent bg-clip-text bg-gradient-to-r from-pink-400 to-purple-400 text-sm">
          📝 勉強記録
        </span>
        <div class="w-16"></div><!-- スペーサー -->
      </div>
    </header>

    <!-- メインコンテンツ -->
    <main class="max-w-lg mx-auto px-4 py-6">

      <!-- ローディング中 -->
      <div id="records-loading" class="text-center py-12 hidden">
        <div class="inline-block w-8 h-8 border-4 border-pink-200 border-t-pink-400 rounded-full animate-spin mb-3"></div>
        <p class="text-sm text-gray-400">読み込み中...</p>
      </div>

      <!-- エラーメッセージ -->
      <div id="records-error" class="hidden bg-red-50 border border-red-200 rounded-lg p-3 mb-4 text-sm text-red-600"></div>

      <!-- 今月の教科別勉強時間カード -->
      <div id="subject-stats-card" class="hidden mb-5">
        <div class="bg-white rounded-2xl shadow-sm p-4">
          <div class="flex items-center gap-2 mb-3">
            <span class="text-lg">📊</span>
            <h2 class="font-bold text-gray-700 text-sm">今月の教科別勉強時間</h2>
          </div>
          <div id="subject-stats-list" class="space-y-2">
            <!-- JS で描画 -->
          </div>
        </div>
      </div>

      <!-- 記録なし -->
      <div id="records-empty" class="hidden text-center py-16">
        <div class="text-5xl mb-4">📚</div>
        <p class="text-gray-500 text-sm">まだ勉強記録がありません</p>
        <p class="text-gray-400 text-xs mt-2">タイマーで勉強を記録しよう！</p>
      </div>

      <!-- 記録一覧 -->
      <div id="records-list" class="space-y-3"></div>

    </main>
  </div>
</div>

<!-- =============================================
     ページ4: タイマー画面
     ============================================= -->
<div id="page-timer" class="page">
  <div class="min-h-screen">

    <!-- ヘッダー -->
    <header class="bg-white shadow-sm sticky top-0 z-10">
      <div class="max-w-lg mx-auto px-4 py-3 flex items-center justify-between">
        <button
          onclick="handleTimerBack()"
          class="text-gray-500 hover:text-gray-700 flex items-center gap-1 transition-colors"
        >
          <i class="fas fa-chevron-left"></i>
          <span class="text-sm">ホーム</span>
        </button>
        <span class="font-bold text-transparent bg-clip-text bg-gradient-to-r from-pink-400 to-purple-400 text-sm">
          ⏱️ 勉強タイマー
        </span>
        <div class="w-16"></div><!-- スペーサー -->
      </div>
    </header>

    <main class="max-w-lg mx-auto px-4 py-8">

      <!-- タイマーメインカード -->
      <div class="card p-8 mb-6 text-center">

        <!-- 状態バッジ -->
        <div class="mb-4 flex justify-center">
          <span id="timer-status-badge" class="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-500">
            <span id="timer-status-dot" class="w-2 h-2 rounded-full bg-gray-400 inline-block"></span>
            <span id="timer-status-text">待機中</span>
          </span>
        </div>

        <!-- 経過時間表示 -->
        <div class="mb-8">
          <div id="timer-display" class="text-6xl font-mono font-bold text-gray-800 tabular-nums leading-none">
            00:00:00
          </div>
          <p class="text-sm text-gray-400 mt-2" id="timer-sub-text">スタートを押して勉強を始めよう！</p>
        </div>

        <!-- ボタングループ -->
        <div id="timer-buttons" class="space-y-3">

          <!-- スタートボタン -->
          <button
            id="btn-start"
            onclick="handleTimerStart()"
            class="btn-primary w-full text-white font-bold py-4 rounded-xl text-lg flex items-center justify-center gap-2 shadow-md"
          >
            <i class="fas fa-play"></i> スタート
          </button>

          <!-- 一時停止ボタン -->
          <button
            id="btn-pause"
            onclick="handleTimerPause()"
            class="hidden w-full bg-amber-400 hover:bg-amber-500 text-white font-bold py-4 rounded-xl text-lg flex items-center justify-center gap-2 shadow-md transition-colors"
          >
            <i class="fas fa-pause"></i> 一時停止
          </button>

          <!-- 再開ボタン -->
          <button
            id="btn-resume"
            onclick="handleTimerResume()"
            class="hidden w-full bg-emerald-400 hover:bg-emerald-500 text-white font-bold py-4 rounded-xl text-lg flex items-center justify-center gap-2 shadow-md transition-colors"
          >
            <i class="fas fa-play"></i> 再開
          </button>

          <!-- フィニッシュボタン -->
          <button
            id="btn-finish"
            onclick="handleTimerFinish()"
            class="hidden w-full bg-purple-400 hover:bg-purple-500 text-white font-bold py-4 rounded-xl text-lg flex items-center justify-center gap-2 shadow-md transition-colors"
          >
            <i class="fas fa-flag-checkered"></i> フィニッシュ
          </button>

        </div>

      </div>

      <!-- 結果カード（フィニッシュ後に表示） -->
      <div id="timer-result-card" class="hidden card p-6 text-center mb-6 bg-gradient-to-br from-pink-50 to-purple-50">
        <div class="text-4xl mb-3">🎉</div>
        <h3 class="text-lg font-bold text-gray-800 mb-1">お疲れ様でした！</h3>
        <p class="text-sm text-gray-500 mb-3">今回の勉強時間</p>
        <div id="timer-result-time" class="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-pink-400 to-purple-400">
          -
        </div>
      </div>

      <!-- エラーメッセージ -->
      <div id="timer-error" class="hidden error-msg bg-red-50 border border-red-200 text-red-600 text-sm rounded-lg p-3 mb-4 text-center"></div>

      <!-- 成功メッセージ -->
      <div id="timer-success" class="hidden bg-green-50 border border-green-200 text-green-700 text-sm rounded-lg p-3 mb-4 text-center font-medium"></div>

    </main>
  </div>
</div>

<!-- =============================================
     未終了セッション確認ダイアログ（オーバーレイ）
     タイマー画面を開いた時に未終了セッションがある場合に表示
     ============================================= -->
<div id="abandoned-dialog" class="hidden fixed inset-0 bg-black bg-opacity-50 flex items-end sm:items-center justify-center z-50 p-4">
  <div class="bg-white rounded-2xl w-full max-w-sm shadow-2xl overflow-hidden">

    <!-- ダイアログヘッダー -->
    <div class="bg-gradient-to-r from-amber-400 to-orange-400 px-6 py-4 text-white text-center">
      <div class="text-3xl mb-1">⚠️</div>
      <h2 class="text-lg font-bold">前回の勉強が終了されていません</h2>
    </div>

    <!-- セッション情報 -->
    <div class="px-6 py-4 bg-amber-50 border-b border-amber-100">
      <div class="flex items-center justify-between text-sm mb-1">
        <span class="text-gray-500">開始時刻</span>
        <span id="abandoned-started-at" class="font-medium text-gray-700">-</span>
      </div>
      <div class="flex items-center justify-between text-sm mb-1">
        <span class="text-gray-500">状態</span>
        <span id="abandoned-status" class="font-medium text-gray-700">-</span>
      </div>
      <div class="flex items-center justify-between text-sm">
        <span class="text-gray-500">それまでの勉強時間</span>
        <span id="abandoned-elapsed" class="font-bold text-amber-600">-</span>
      </div>
    </div>

    <!-- 選択肢 -->
    <div class="px-6 py-5 space-y-3">
      <p class="text-sm text-gray-500 text-center mb-4">どうしますか？</p>

      <!-- 再開する -->
      <button
        id="abandoned-btn-resume"
        onclick="handleAbandonedResume()"
        class="w-full bg-gradient-to-r from-pink-400 to-purple-400 hover:from-pink-500 hover:to-purple-500 text-white font-bold py-4 rounded-xl flex items-center justify-center gap-2 shadow-md transition-all"
      >
        <i class="fas fa-play"></i>
        再開する
      </button>

      <!-- ここで終了する -->
      <button
        id="abandoned-btn-finish"
        onclick="handleAbandonedFinish()"
        class="w-full bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold py-4 rounded-xl flex items-center justify-center gap-2 transition-colors"
      >
        <i class="fas fa-flag-checkered text-gray-500"></i>
        ここで終了する
      </button>
    </div>

  </div>
</div>

<!-- =============================================
     勉強記録入力ダイアログ（フィニッシュ後に表示）
     ============================================= -->
<div id="record-dialog" class="hidden fixed inset-0 bg-black bg-opacity-50 flex items-end sm:items-center justify-center z-50 p-4">
  <div class="bg-white rounded-2xl w-full max-w-sm shadow-2xl overflow-hidden">

    <!-- ダイアログヘッダー -->
    <div class="bg-gradient-to-r from-pink-400 to-purple-400 px-6 py-4 text-white text-center">
      <div class="text-3xl mb-1">📝</div>
      <h2 class="text-lg font-bold">勉強を記録しよう！</h2>
      <p class="text-sm opacity-80 mt-1">今回の勉強時間: <span id="record-dialog-time" class="font-bold">-</span></p>
    </div>

    <!-- 入力フォーム -->
    <div class="px-6 py-5 space-y-4">

      <!-- エラーメッセージ -->
      <div id="record-error" class="hidden bg-red-50 border border-red-200 text-red-600 text-sm rounded-lg p-3 text-center"></div>

      <!-- 教科選択 -->
      <div>
        <label class="block text-sm font-bold text-gray-700 mb-2">
          <i class="fas fa-book text-pink-400 mr-1"></i>
          教科 <span class="text-red-400">*</span>
        </label>
        <div id="record-subject-buttons" class="grid grid-cols-3 gap-2">
          <button type="button" data-subject="japanese"
            onclick="selectSubject('japanese')"
            class="subject-btn py-3 rounded-xl text-sm font-medium border-2 border-gray-200 text-gray-600 hover:border-pink-300 hover:text-pink-600 transition-all">
            国語
          </button>
          <button type="button" data-subject="math"
            onclick="selectSubject('math')"
            class="subject-btn py-3 rounded-xl text-sm font-medium border-2 border-gray-200 text-gray-600 hover:border-pink-300 hover:text-pink-600 transition-all">
            数学
          </button>
          <button type="button" data-subject="english"
            onclick="selectSubject('english')"
            class="subject-btn py-3 rounded-xl text-sm font-medium border-2 border-gray-200 text-gray-600 hover:border-pink-300 hover:text-pink-600 transition-all">
            英語
          </button>
          <button type="button" data-subject="science"
            onclick="selectSubject('science')"
            class="subject-btn py-3 rounded-xl text-sm font-medium border-2 border-gray-200 text-gray-600 hover:border-pink-300 hover:text-pink-600 transition-all">
            理科
          </button>
          <button type="button" data-subject="social"
            onclick="selectSubject('social')"
            class="subject-btn py-3 rounded-xl text-sm font-medium border-2 border-gray-200 text-gray-600 hover:border-pink-300 hover:text-pink-600 transition-all">
            社会
          </button>
          <button type="button" data-subject="other"
            onclick="selectSubject('other')"
            class="subject-btn py-3 rounded-xl text-sm font-medium border-2 border-gray-200 text-gray-600 hover:border-pink-300 hover:text-pink-600 transition-all">
            その他
          </button>
        </div>
      </div>

      <!-- 勉強内容 -->
      <div>
        <label for="record-memo" class="block text-sm font-bold text-gray-700 mb-2">
          <i class="fas fa-pencil-alt text-purple-400 mr-1"></i>
          勉強内容 <span class="text-red-400">*</span>
        </label>
        <textarea
          id="record-memo"
          placeholder="例: 二次方程式の練習問題を解いた"
          rows="3"
          maxlength="200"
          class="w-full border-2 border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-700 focus:outline-none focus:border-pink-300 resize-none placeholder-gray-300"
        ></textarea>
        <p class="text-xs text-gray-400 text-right mt-1">最大200文字</p>
      </div>

      <!-- 保存ボタン -->
      <button
        id="record-save-btn"
        onclick="handleRecordSave()"
        class="w-full bg-gradient-to-r from-pink-400 to-purple-400 hover:from-pink-500 hover:to-purple-500 text-white font-bold py-4 rounded-xl flex items-center justify-center gap-2 shadow-md transition-all"
      >
        <i class="fas fa-save"></i>
        保存する
      </button>

    </div>
  </div>
</div>

<!-- ローディングオーバーレイ -->
<div id="loading-overlay" class="hidden fixed inset-0 bg-white bg-opacity-70 flex items-center justify-center z-50">
  <div class="text-center">
    <div class="text-4xl animate-bounce mb-2">🌸</div>
    <p class="text-sm text-gray-500">読み込み中...</p>
  </div>
</div>

<script>
// =============================================
// 花はな Learning Timer - フロントエンドJS
// =============================================

// 現在のユーザー情報
let currentUser = null;

// ページ表示管理
function showPage(pageId) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.getElementById(pageId).classList.add('active');
  // エラーメッセージをクリア
  clearMessages();
}

// ローディング表示
function setLoading(show) {
  const overlay = document.getElementById('loading-overlay');
  overlay.classList.toggle('hidden', !show);
}

// ボタンのローディング状態
function setButtonLoading(btnId, isLoading, originalText) {
  const btn = document.getElementById(btnId);
  if (isLoading) {
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i>処理中...';
    btn.classList.add('loading');
  } else {
    btn.disabled = false;
    btn.innerHTML = originalText;
    btn.classList.remove('loading');
  }
}

// エラー表示
function showError(elementId, message) {
  const el = document.getElementById(elementId);
  el.textContent = message;
  el.classList.remove('hidden');
}

// 成功メッセージ表示
function showSuccess(elementId, message) {
  const el = document.getElementById(elementId);
  el.textContent = message;
  el.classList.remove('hidden');
}

// メッセージクリア
function clearMessages() {
  document.querySelectorAll('[id$="-error"], [id$="-success"]').forEach(el => {
    el.classList.add('hidden');
    el.textContent = '';
  });
}

// パスワード表示切り替え
function togglePassword(inputId, iconId) {
  const input = document.getElementById(inputId);
  const icon = document.getElementById(iconId);
  if (input.type === 'password') {
    input.type = 'text';
    icon.className = 'fas fa-eye text-sm';
  } else {
    input.type = 'password';
    icon.className = 'fas fa-eye-slash text-sm';
  }
}

// =============================================
// ログイン処理
// =============================================
async function handleLogin() {
  const userId = document.getElementById('login-userid').value.trim();
  const password = document.getElementById('login-password').value;

  clearMessages();

  if (!userId || !password) {
    showError('login-error', 'ユーザーIDとパスワードを入力してください');
    return;
  }

  setButtonLoading('login-btn', true, '<i class="fas fa-sign-in-alt mr-2"></i>ログイン');

  try {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ user_id: userId, password: password })
    });

    const data = await res.json();

    if (data.success) {
      currentUser = data.data.user;
      updateHomeScreen(currentUser);
      showPage('page-home');
      // フォームをリセット
      document.getElementById('login-userid').value = '';
      document.getElementById('login-password').value = '';
    } else {
      showError('login-error', data.error || 'ログインに失敗しました');
    }
  } catch (err) {
    showError('login-error', '通信エラーが発生しました。もう一度お試しください');
  } finally {
    setButtonLoading('login-btn', false, '<i class="fas fa-sign-in-alt mr-2"></i>ログイン');
  }
}

// =============================================
// 新規登録処理
// =============================================
async function handleRegister() {
  const userId = document.getElementById('reg-userid').value.trim();
  const password = document.getElementById('reg-password').value;
  const displayName = document.getElementById('reg-displayname').value.trim();
  const registrationPassword = document.getElementById('reg-regpassword').value;

  clearMessages();

  if (!userId || !password || !displayName || !registrationPassword) {
    showError('register-error', 'すべての項目を入力してください');
    return;
  }

  setButtonLoading('register-btn', true, '<i class="fas fa-user-plus mr-2"></i>アカウントを作成する');

  try {
    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        user_id: userId,
        password: password,
        display_name: displayName,
        registration_password: registrationPassword,
      })
    });

    const data = await res.json();

    if (data.success) {
      currentUser = data.data.user;
      updateHomeScreen(currentUser);
      showPage('page-home');
      // フォームをリセット
      document.getElementById('reg-userid').value = '';
      document.getElementById('reg-password').value = '';
      document.getElementById('reg-displayname').value = '';
      document.getElementById('reg-regpassword').value = '';
    } else {
      showError('register-error', data.error || '登録に失敗しました');
    }
  } catch (err) {
    showError('register-error', '通信エラーが発生しました。もう一度お試しください');
  } finally {
    setButtonLoading('register-btn', false, '<i class="fas fa-user-plus mr-2"></i>アカウントを作成する');
  }
}

// =============================================
// ログアウト処理
// =============================================
async function handleLogout() {
  setLoading(true);

  try {
    await fetch('/api/auth/logout', {
      method: 'POST',
      credentials: 'include',
    });
  } catch (err) {
    // エラーでも強制的にログアウト画面へ
  } finally {
    currentUser = null;
    setLoading(false);
    showPage('page-login');
  }
}

// =============================================
// ホーム画面の情報を更新
// =============================================
function updateHomeScreen(user) {
  document.getElementById('home-displayname').textContent = user.display_name;
  document.getElementById('home-userid').textContent = '@' + user.user_id;
  document.getElementById('home-info-displayname').textContent = user.display_name;
  document.getElementById('home-info-userid').textContent = user.user_id;

  // 登録日をフォーマット
  if (user.created_at) {
    const date = new Date(user.created_at);
    document.getElementById('home-info-created').textContent =
      date.toLocaleDateString('ja-JP', { year: 'numeric', month: 'long', day: 'numeric' });
  }

  // アバター（表示名の最初の文字）
  const firstChar = user.display_name.charAt(0);
  document.getElementById('home-avatar').textContent = firstChar;

  // 勉強時間集計を非同期で取得して表示（既存機能に影響しない）
  fetchAndRenderStats();
  // テスト日を非同期で取得して表示
  fetchTestDate();
}

// フォームタグのonsubmitでEnterキー送信をハンドリング済み

// =============================================
// 勉強時間集計 - フォーマットユーティリティ
// =============================================

// 秒数を中学生向けの日本語表記に変換
// 例: 0 → "0分", 45 → "45分", 90 → "1時間30分"
function formatSecondsJaShort(totalSeconds) {
  const sec = Math.floor(totalSeconds);
  if (sec <= 0) return '0分';
  const hours   = Math.floor(sec / 3600);
  const minutes = Math.floor((sec % 3600) / 60);
  if (hours === 0) {
    return minutes + '分';
  } else if (minutes === 0) {
    return hours + '時間';
  } else {
    return hours + '時間' + minutes + '分';
  }
}

// =============================================
// 勉強時間集計 - ホーム画面取得・表示
// =============================================

async function fetchAndRenderStats() {
  try {
    const res  = await fetch('/api/stats');
    const json = await res.json();
    if (!json.success) return;

    const d = json.data;
    const todayEl  = document.getElementById('home-stats-today');
    const weekEl   = document.getElementById('home-stats-week');
    const monthEl  = document.getElementById('home-stats-month');
    const totalEl  = document.getElementById('home-stats-total');

    if (todayEl)  todayEl.textContent  = formatSecondsJaShort(d.today_seconds);
    if (weekEl)   weekEl.textContent   = formatSecondsJaShort(d.week_seconds);
    if (monthEl)  monthEl.textContent  = formatSecondsJaShort(d.month_seconds);
    if (totalEl)  totalEl.textContent  = formatSecondsJaShort(d.total_seconds);

    // 自己ベスト表示
    var bestEl     = document.getElementById('home-stats-best');
    var bestDateEl = document.getElementById('home-stats-best-date');
    if (bestEl) {
      if (d.best_day_seconds > 0) {
        bestEl.textContent = formatSecondsJaShort(d.best_day_seconds);
      } else {
        bestEl.textContent = 'まだありません';
      }
    }
    if (bestDateEl) {
      if (d.best_day_date) {
        // YYYY-MM-DD → M/D 形式に変換して表示
        var parts = d.best_day_date.split('-');
        bestDateEl.textContent = parseInt(parts[1], 10) + '/' + parseInt(parts[2], 10);
      } else {
        bestDateEl.textContent = '';
      }
    }
  } catch (e) {
    // ネットワークエラーは集計欄を "--" のまま無視（既存機能に影響しない）
    console.warn('Stats fetch error:', e);
  }
}

// =============================================
// スタートダッシュガチャ
// =============================================

var GACHA_ITEMS = [
  '日本語の意味を確認してから英単語10個を3回ずつ書く',
  '日本語の意味を確認してから英単語10個を声に出して5回読む（読み方がわからないものは調べる）',
  '英語の教科書の本文を3回音読する',
  '英語の教科書の本文を1ページ分、2回書く',
  'ジョイフルワークを2ページ進める',
  '数学の問題集を2ページ進める、または教科書の章末問題を1ページやる',
  '数学の授業ノートを3ページ見直し、わからない部分をピックアップして復習、またはひろ先生に質問する',
  '塾のワーク・問題集・授業ノートを見返して、間違えた問題を5問やり直す',
  '数学の教科書を2ページ予習する',
  '数学の教科書で学校で習ったページを復習する',
  '完全学習を2ページ進める',
  '理科の重要語句10個を意味を確認しながら3回ずつ確認する',
  '理科の教科書を3ページ音読する',
  '理科の授業ノートまたはプリントを3ページ分見直す',
  '理科の重要語句10個を声に出して5回読む',
  '社会の教科書の太字10個を意味を確認しながら3回ずつ書く',
  '社会の教科書を3ページ音読する',
  '社会の授業ノートまたはプリントを3ページ分見直す',
  '社会の教科書の太字10個を声に出して5回読む',
  '国語の学習の2ページ分の熟語を3回ずつ書く（読みも確認する）',
  '国語の教科書の文章を1つ音読する',
  '国語の学習を2ページ進める',
  '英単語帳を5分だけ眺める（意味とスペルを確認する）',
];

// ガチャを引いて結果を表示する
function drawGacha() {
  var idx        = Math.floor(Math.random() * GACHA_ITEMS.length);
  var result     = GACHA_ITEMS[idx];
  var areaEl     = document.getElementById('gacha-result-area');
  var resultEl   = document.getElementById('gacha-result-text');
  if (resultEl)  resultEl.textContent = result;
  if (areaEl)    areaEl.classList.remove('hidden');
  // スムーズにスクロールして結果を見せる
  if (areaEl)    areaEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

// =============================================
// ランキング機能
// =============================================

// 秒数を「X時間Y分」形式にフォーマット（秒は表示しない）
function formatSecondsRanking(seconds) {
  var s = Math.floor(seconds);
  var h = Math.floor(s / 3600);
  var m = Math.floor((s % 3600) / 60);
  if (h === 0 && m === 0) return '0分';
  if (h === 0) return m + '分';
  if (m === 0) return h + '時間';
  return h + '時間' + m + '分';
}

// 順位バッジの色
function getRankBadgeClass(rank) {
  if (rank === 1) return 'bg-yellow-400 text-white';
  if (rank === 2) return 'bg-gray-300 text-gray-700';
  if (rank === 3) return 'bg-amber-600 text-white';
  return 'bg-gray-100 text-gray-500';
}

// ランキング行HTMLを生成
// entry.display_name に表示名を使用（ログインIDは表示しない）
function buildRankRow(entry, myDisplayName) {
  var isMe = (entry.display_name === myDisplayName);
  var badgeClass = getRankBadgeClass(entry.rank);
  var rowBg = isMe ? 'bg-pink-50 border border-pink-200' : 'bg-gray-50';
  var nameLabel = isMe ? '<span class="text-xs text-pink-500 font-bold ml-1">（あなた）</span>' : '';
  return (
    '<div class="flex items-center gap-3 rounded-xl px-3 py-2 ' + rowBg + '">' +
      '<span class="flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ' + badgeClass + '">' + entry.rank + '</span>' +
      '<span class="flex-1 text-sm text-gray-700 truncate">' + escapeHtml(entry.display_name) + nameLabel + '</span>' +
      '<span class="text-sm font-bold text-gray-600">' + formatSecondsRanking(entry.seconds) + '</span>' +
    '</div>'
  );
}

// HTML エスケープ
function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ランキングページ初期化（ページ遷移時に呼ばれる）
async function initRankingPage() {
  // 表示をリセット
  var loadingEl = document.getElementById('ranking-loading');
  var errorEl   = document.getElementById('ranking-error');
  var weekSec   = document.getElementById('ranking-week-section');
  var monthSec  = document.getElementById('ranking-month-section');
  var emptyEl   = document.getElementById('ranking-empty');

  if (loadingEl) loadingEl.classList.remove('hidden');
  if (errorEl)   errorEl.classList.add('hidden');
  if (weekSec)   weekSec.classList.add('hidden');
  if (monthSec)  monthSec.classList.add('hidden');
  if (emptyEl)   emptyEl.classList.add('hidden');

  try {
    var res  = await fetch('/api/ranking', { credentials: 'include' });
    var json = await res.json();

    if (loadingEl) loadingEl.classList.add('hidden');

    if (!json.success) {
      if (errorEl) {
        errorEl.textContent = json.error || 'ランキングの取得に失敗しました';
        errorEl.classList.remove('hidden');
      }
      return;
    }

    var data = json.data;
    // 表示名（display_name）で自分を判定する—ログインIDは一切使わない
    var myDisplayName = currentUser ? (currentUser.display_name || currentUser.user_id) : '';
    var weekData  = data.week;
    var monthData = data.month;

    var hasAnyData = (weekData.ranking.length > 0 || monthData.ranking.length > 0);

    if (!hasAnyData) {
      if (emptyEl) emptyEl.classList.remove('hidden');
      return;
    }

    // ─── 今週 ───
    renderRankingSection({
      sectionEl:   weekSec,
      labelElId:   'ranking-week-label',
      listElId:    'ranking-week-list',
      myrankArea:  document.getElementById('ranking-week-myrank-area'),
      myrankText:  document.getElementById('ranking-week-myrank-text'),
      data:        weekData,
      myId:        myDisplayName,
      periodType:  'week',
    });

    // ─── 今月 ───
    renderRankingSection({
      sectionEl:   monthSec,
      labelElId:   'ranking-month-label',
      listElId:    'ranking-month-list',
      myrankArea:  document.getElementById('ranking-month-myrank-area'),
      myrankText:  document.getElementById('ranking-month-myrank-text'),
      data:        monthData,
      myId:        myDisplayName,
      periodType:  'month',
    });

  } catch (e) {
    if (loadingEl) loadingEl.classList.add('hidden');
    if (errorEl) {
      errorEl.textContent = '通信エラーが発生しました';
      errorEl.classList.remove('hidden');
    }
  }
}

// ランキングセクション描画ヘルパー
function renderRankingSection(opts) {
  var sectionEl  = opts.sectionEl;
  var labelEl    = document.getElementById(opts.labelElId);
  var listEl     = document.getElementById(opts.listElId);
  var myrankArea = opts.myrankArea;
  var myrankText = opts.myrankText;
  var data       = opts.data;
  var myId       = opts.myId;

  if (labelEl) labelEl.textContent = data.period_label;

  // ランキング行を描画
  if (listEl) {
    if (data.ranking.length === 0) {
      listEl.innerHTML = '<p class="text-xs text-gray-400 text-center py-3">まだデータがありません</p>';
    } else {
      listEl.innerHTML = data.ranking.map(function(entry) {
        return buildRankRow(entry, myId);
      }).join('');
    }
  }

  // 自分の順位（トップ5圏外の場合だけ下部に表示）
  // display_name で比較（ログインIDは使わない）
  var myInTop5 = data.ranking.some(function(r) { return r.display_name === myId; });
  if (!myInTop5 && data.my_rank !== null && data.my_seconds > 0) {
    // 圏外だが記録あり
    if (myrankText) {
      myrankText.textContent =
        'あなたの順位: ' + data.my_rank + '位（' + formatSecondsRanking(data.my_seconds) + '）';
    }
    if (myrankArea) myrankArea.classList.remove('hidden');
  } else if (!myInTop5 && data.my_seconds === 0) {
    // 記録なし
    if (myrankText) {
      myrankText.textContent = 'あなたはまだ記録がありません';
    }
    if (myrankArea) myrankArea.classList.remove('hidden');
  } else {
    if (myrankArea) myrankArea.classList.add('hidden');
  }

  if (sectionEl) sectionEl.classList.remove('hidden');
}

// =============================================
// テスト日機能 - 取得・保存
// =============================================

// YYYY-MM-DD を「M/D」形式に変換するユーティリティ
function formatTestDateShort(dateStr) {
  var parts = dateStr.split('-');
  if (parts.length !== 3) return dateStr;
  return parseInt(parts[1], 10) + '/' + parseInt(parts[2], 10);
}

// 今日からテスト日までの日数差を計算（テスト日 - 今日）
function calcDaysUntilTest(dateStr) {
  // 日付のみで比較するため時刻をゼロにする
  var today = new Date();
  var todayMidnight = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  var parts = dateStr.split('-');
  var testMidnight  = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
  var diffMs   = testMidnight.getTime() - todayMidnight.getTime();
  var diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));
  return diffDays;
}

// 日数差を「あと◯日」テキストに変換
function formatCountdown(days) {
  if (days < 0)  return '終了';
  return 'あと' + days + '日';
}

// テスト日の表示エリアを更新する共通関数
function renderTestDateDisplay(dateVal) {
  var displayEl    = document.getElementById('testdate-display');
  var valueEl      = document.getElementById('testdate-value');
  var countdownEl  = document.getElementById('testdate-countdown');
  if (dateVal && displayEl && valueEl && countdownEl) {
    valueEl.textContent     = formatTestDateShort(dateVal);
    countdownEl.textContent = formatCountdown(calcDaysUntilTest(dateVal));
    displayEl.classList.remove('hidden');
  } else if (displayEl) {
    displayEl.classList.add('hidden');
  }
}

// テスト日をAPIから取得してホーム画面に表示する
async function fetchTestDate() {
  try {
    var res  = await fetch('/api/testdate');
    var json = await res.json();
    if (!json.success) return;
    renderTestDateDisplay(json.test_date);
  } catch (e) {
    console.warn('TestDate fetch error:', e);
  }
}

// テスト日を保存する（バリデーション付き）
async function saveTestDate() {
  var inputEl = document.getElementById('testdate-input');
  var msgEl   = document.getElementById('testdate-msg');
  var errEl   = document.getElementById('testdate-err');
  var btnEl   = document.getElementById('testdate-save-btn');

  // メッセージをリセット
  if (msgEl) { msgEl.textContent = ''; msgEl.classList.add('hidden'); }
  if (errEl) { errEl.textContent = ''; errEl.classList.add('hidden'); }

  var dateVal = inputEl ? inputEl.value.trim() : '';

  // バリデーション: 日付未入力
  if (!dateVal) {
    if (errEl) { errEl.textContent = 'テスト日を入力してください'; errEl.classList.remove('hidden'); }
    return;
  }

  // 保存中はボタンを無効化
  if (btnEl) { btnEl.disabled = true; btnEl.textContent = '保存中...'; }

  try {
    var res = await fetch('/api/testdate', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ test_date: dateVal }),
    });
    var json = await res.json();

    if (json.success) {
      // 表示を更新
      renderTestDateDisplay(json.test_date);

      // 成功メッセージを3秒表示
      if (msgEl) {
        msgEl.textContent = 'テスト日を保存しました';
        msgEl.classList.remove('hidden');
        setTimeout(function() { msgEl.classList.add('hidden'); }, 3000);
      }
    } else {
      if (errEl) { errEl.textContent = json.error || '保存に失敗しました'; errEl.classList.remove('hidden'); }
    }
  } catch (e) {
    if (errEl) { errEl.textContent = '通信エラーが発生しました'; errEl.classList.remove('hidden'); }
    console.warn('TestDate save error:', e);
  } finally {
    if (btnEl) { btnEl.disabled = false; btnEl.textContent = '保存'; }
  }
}

// =============================================
// 勉強記録一覧ページ
// =============================================

// 教科コード → 日本語表示マップ
const SUBJECT_LABELS = {
  english: '英語',
  math:    '数学',
  japanese:'国語',
  science: '理科',
  social:  '社会',
  other:   'その他',
};

// 教科コードカンマ区切り文字列 → 日本語スラッシュ区切り表示
// 例: "english,math" → "英語 / 数学"
function formatSubjects(subjectStr) {
  if (!subjectStr) return '-';
  return subjectStr
    .split(',')
    .map(s => SUBJECT_LABELS[s.trim()] || s.trim())
    .join(' / ');
}

// UTC の ISO8601 文字列を日本時間（JST = UTC+9）に変換して Date を返すヘルパー
// 例: "2026-04-01T18:30:00.000Z" → JST では 2026-04-02 03:30 なので 4月2日を返す
function toJstDate(isoStr) {
  const utcMs  = new Date(isoStr).getTime();
  const jstMs  = utcMs + 9 * 60 * 60 * 1000;
  return new Date(jstMs);
}

// UTC の ISO8601 文字列から JST の "YYYY-MM-DD" キーを生成する
function isoToJstDateKey(isoStr) {
  if (!isoStr) return 'unknown';
  const jst = toJstDate(isoStr);
  // getUTCFullYear/Month/Date は JST オフセット済みの値から UTC 部分を読む
  const y = jst.getUTCFullYear();
  const m = String(jst.getUTCMonth() + 1).padStart(2, '0');
  const d = String(jst.getUTCDate()).padStart(2, '0');
  return y + '-' + m + '-' + d;
}

// 日付文字列 (ISO8601 UTC) → JST での "YYYY年M月D日（曜日）" 形式
function formatDateJa(isoStr) {
  if (!isoStr) return '-';
  // UTC ISO 文字列を JST に変換してから表示する
  const jst = toJstDate(isoStr);
  const DOW = ['日', '月', '火', '水', '木', '金', '土'];
  // JST オフセット済み Date から UTC 値で年月日・曜日を取り出す
  const year  = jst.getUTCFullYear();
  const month = jst.getUTCMonth() + 1;
  const day   = jst.getUTCDate();
  const dow   = DOW[jst.getUTCDay()];
  return year + '年' + month + '月' + day + '日（' + dow + '）';
}

// -----------------------------------------------
// セッション配列を「日付キー (YYYY-MM-DD)」でグループ化して返す
// 戻り値: [{ dateKey, dateStr, totalSeconds, subjects[], memos[] }, ...]
//   - dateKey の降順（新しい日が先頭）で返す
//   - subjects は重複排除済みの日本語名配列
//   - memos は空文字・null を除いた文字列配列（順番通り）
// -----------------------------------------------
function groupRecordsByDate(records) {
  // dateKey → グループオブジェクト のマップ
  const map = {};

  records.forEach(rec => {
    // JST 日付を YYYY-MM-DD キーに変換（UTC の slice は使わない）
    const dateKey = isoToJstDateKey(rec.started_at);

    if (!map[dateKey]) {
      map[dateKey] = {
        dateKey,
        dateStr:      formatDateJa(rec.started_at),
        totalSeconds: 0,
        subjectSet:   new Set(),   // 重複排除用
        memos:        [],
      };
    }

    const g = map[dateKey];
    g.totalSeconds += (rec.total_seconds || 0);

    // 教科コードをセットに追加（重複排除）
    if (rec.subject) {
      rec.subject.split(',').forEach(code => {
        const label = SUBJECT_LABELS[code.trim()] || code.trim();
        g.subjectSet.add(label);
      });
    }

    // 勉強内容を追加（空除外）
    if (rec.memo && rec.memo.trim()) {
      g.memos.push(rec.memo.trim());
    }
  });

  // dateKey の降順（新しい日が上）に並べて返す
  return Object.values(map)
    .sort((a, b) => (a.dateKey > b.dateKey ? -1 : 1))
    .map(g => ({
      dateKey:      g.dateKey,
      dateStr:      g.dateStr,
      totalSeconds: g.totalSeconds,
      subjects:     Array.from(g.subjectSet),
      memos:        g.memos,
    }));
}

// -----------------------------------------------
// 1日分のグループカードHTML を生成して返す
// （.tsx 内で class= が JSX 誤解釈されないよう文字列連結で構築）
// -----------------------------------------------
function buildDayCard(group) {
  const timeStr = formatSecondsJaShort(group.totalSeconds);

  // 教科バッジ
  const badgeHtml = group.subjects.length > 0
    ? group.subjects.map(s =>
        '<span style="display:inline-block;font-size:0.75rem;font-weight:600;'
        + 'background:#fce7f3;color:#db2777;border-radius:9999px;padding:1px 10px;">'
        + escapeHtml(s) + '</span>'
      ).join(' ')
    : '<span style="font-size:0.75rem;color:#9ca3af;">-</span>';

  // 勉強内容リスト（複数行を箇条書き風に）
  let memosHtml;
  if (group.memos.length === 0) {
    memosHtml = '<span style="color:#9ca3af;">-</span>';
  } else if (group.memos.length === 1) {
    memosHtml = '<span style="font-size:0.875rem;color:#4b5563;">' + escapeHtml(group.memos[0]) + '</span>';
  } else {
    memosHtml = '<ul style="margin:0;padding-left:1.1rem;list-style:disc;">'
      + group.memos.map(m =>
          '<li style="font-size:0.875rem;color:#4b5563;line-height:1.7;">' + escapeHtml(m) + '</li>'
        ).join('')
      + '</ul>';
  }

  return (
    '<div style="background:#fff;border-radius:0.75rem;box-shadow:0 1px 4px rgba(0,0,0,0.08);padding:1rem;">'

    // ── 日付ヘッダー ──
    + '<div style="display:flex;align-items:center;gap:8px;margin-bottom:12px;">'
    +   '<i class="fas fa-calendar-alt" style="color:#f9a8d4;font-size:0.875rem;"></i>'
    +   '<span style="font-size:0.875rem;font-weight:600;color:#374151;">' + escapeHtml(group.dateStr) + '</span>'
    + '</div>'

    // ── 合計時間 + 教科バッジ ──
    + '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;">'
    +   '<div style="display:flex;align-items:center;gap:6px;">'
    +     '<i class="fas fa-clock" style="color:#c4b5fd;font-size:0.875rem;"></i>'
    +     '<span style="font-size:1.05rem;font-weight:700;color:#7c3aed;">' + escapeHtml(timeStr) + '</span>'
    +   '</div>'
    +   '<div style="display:flex;flex-wrap:wrap;gap:4px;justify-content:flex-end;">' + badgeHtml + '</div>'
    + '</div>'

    // ── 勉強内容 ──
    + '<div style="display:flex;align-items:flex-start;gap:8px;padding-top:10px;border-top:1px solid #f3f4f6;">'
    +   '<i class="fas fa-pencil-alt" style="color:#d1d5db;font-size:0.875rem;margin-top:3px;flex-shrink:0;"></i>'
    +   '<div style="flex:1;">' + memosHtml + '</div>'
    + '</div>'

    + '</div>'
  );
}

// HTML特殊文字エスケープ（XSS防止）
function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// 勉強記録ページの初期化（ホーム画面から遷移してきた時）
// =============================================
// 今月の教科別勉強時間表示
// =============================================

// 教科コードの表示順と日本語ラベル
const SUBJECT_ORDER = [
  { code: 'english',  label: '英語' },
  { code: 'math',     label: '数学' },
  { code: 'japanese', label: '国語' },
  { code: 'science',  label: '理科' },
  { code: 'social',   label: '社会' },
  { code: 'other',    label: 'その他' },
];

// 秒数を「X時間Y分」または「Y分」形式にフォーマット（0秒は「0分」）
function formatSecondsSubject(seconds) {
  var s = Math.floor(seconds);
  var h = Math.floor(s / 3600);
  var m = Math.floor((s % 3600) / 60);
  if (h === 0 && m === 0) return '0分';
  if (h === 0) return m + '分';
  if (m === 0) return h + '時間';
  return h + '時間' + m + '分';
}

// 教科別勉強時間カードを描画する
// data: { english, math, japanese, science, social, other } (各秒数)
function renderSubjectStats(data) {
  var cardEl = document.getElementById('subject-stats-card');
  var listEl = document.getElementById('subject-stats-list');
  if (!cardEl || !listEl) return;

  var rows = SUBJECT_ORDER.map(function(s) {
    var sec = data[s.code] || 0;
    var timeStr = formatSecondsSubject(sec);
    // 記録がある教科はテキストを少し濃く
    var valueColor = sec > 0 ? 'text-purple-600 font-bold' : 'text-gray-400';
    return (
      '<div class="flex items-center justify-between py-1 border-b border-gray-50 last:border-0">' +
        '<span class="text-sm text-gray-600">' + s.label + '</span>' +
        '<span class="text-sm ' + valueColor + '">' + timeStr + '</span>' +
      '</div>'
    );
  }).join('');

  listEl.innerHTML = rows;
  cardEl.classList.remove('hidden');
}

// 今月教科別勉強時間を API から取得して描画する
async function fetchAndRenderSubjectStats() {
  var cardEl = document.getElementById('subject-stats-card');
  if (cardEl) cardEl.classList.add('hidden');

  try {
    var res  = await fetch('/api/stats/subjects', { credentials: 'include' });
    var json = await res.json();
    if (json.success && json.data) {
      renderSubjectStats(json.data);
    }
  } catch (e) {
    // 教科別集計の取得失敗は静かに無視（記録一覧は引き続き表示）
  }
}

async function initRecordsPage() {
  const loadingEl = document.getElementById('records-loading');
  const errorEl   = document.getElementById('records-error');
  const emptyEl   = document.getElementById('records-empty');
  const listEl    = document.getElementById('records-list');

  // 初期化
  loadingEl.classList.remove('hidden');
  errorEl.classList.add('hidden');
  emptyEl.classList.add('hidden');
  listEl.innerHTML = '';
  // 教科別カードも非表示にリセット
  var subjectCard = document.getElementById('subject-stats-card');
  if (subjectCard) subjectCard.classList.add('hidden');

  // 教科別集計と記録一覧を並行して取得
  fetchAndRenderSubjectStats();

  try {
    const res  = await fetch('/api/records');
    const json = await res.json();

    loadingEl.classList.add('hidden');

    if (!json.success) {
      errorEl.textContent = json.error || '記録の取得に失敗しました';
      errorEl.classList.remove('hidden');
      return;
    }

    const records = json.data;
    if (!records || records.length === 0) {
      emptyEl.classList.remove('hidden');
      return;
    }

    // セッションを日付ごとにグループ化してカードを描画
    const groups = groupRecordsByDate(records);
    listEl.innerHTML = groups.map(buildDayCard).join('<div style="height:12px;"></div>');

  } catch (e) {
    loadingEl.classList.add('hidden');
    errorEl.textContent = '通信エラーが発生しました。再度お試しください。';
    errorEl.classList.remove('hidden');
    console.error('Records fetch error:', e);
  }
}

// =============================================
// タイマー機能
// =============================================

// タイマーの内部状態（サーバーから取得した状態を保持）
let timerState = null;      // APIから取得した TimerStateResponse
let timerIntervalId = null; // setInterval の ID

// -----------------------------------------------
// タイマーページ初期化（ホームから遷移してきた時）
// -----------------------------------------------
async function initTimerPage() {
  clearTimerError();
  stopTimerTick();

  // 画面を必ずリセット状態にする（前回の数字が残らないように）
  resetTimerDisplay();

  // サーバーから現在のセッション状態を取得
  let serverState = null;
  try {
    const res = await fetch('/api/timer/current', { credentials: 'include' });
    const data = await res.json();
    if (data.success) serverState = data.data;
  } catch (err) {
    serverState = null;
  }

  if (serverState && serverState.status === 'frozen') {
    // ─── 凍結状態（確認待ち）→ 確認ダイアログを表示 ───
    // タイマーは動かさない（startTimerTick を呼ばない）
    timerState = serverState;
    showAbandonedDialog(serverState);

  } else if (serverState && (serverState.status === 'running' || serverState.status === 'paused')) {
    // ─── running/paused のまま残っている（古い状態）→ まず凍結してからダイアログ ───
    // ブラウザ再起動等でfreezeが呼ばれなかったケースの救済
    try {
      const freezeRes = await fetch('/api/timer/freeze', {
        method: 'POST',
        credentials: 'include',
      });
      const freezeData = await freezeRes.json();
      if (freezeData.success && freezeData.data) {
        timerState = freezeData.data;
        showAbandonedDialog(freezeData.data);
      } else {
        // 凍結失敗時はそのまま表示
        timerState = serverState;
        renderTimerUI();
        startTimerTick();
      }
    } catch (err) {
      timerState = serverState;
      renderTimerUI();
      startTimerTick();
    }

  } else {
    // ─── セッションなし / 終了済み → 通常の待機状態 ───
    timerState = null;
    renderTimerUI();
    startTimerTick();
  }
}

// -----------------------------------------------
// タイマー表示を 00:00:00 にリセットする
// -----------------------------------------------
function resetTimerDisplay() {
  const display = document.getElementById('timer-display');
  if (display) display.textContent = '00:00:00';
  const resultCard = document.getElementById('timer-result-card');
  if (resultCard) resultCard.classList.add('hidden');
}

// -----------------------------------------------
// タイマー状態を完全に初期状態へリセットする
//
// 呼び出しタイミング:
//   - 記録保存完了後（handleRecordSave の成功時）
//   - 60秒未満フィニッシュ後（記録せずに終わる場合）
//
// 内部状態・ボタン disabled・表示をすべてクリアして
// 「新しいセッションをすぐ開始できる idle 状態」に戻す。
// -----------------------------------------------
function resetTimerFull() {
  // tick を止める
  stopTimerTick();

  // 内部状態をクリア
  timerState = null;

  // 表示リセット（00:00:00 + 結果カード非表示）
  resetTimerDisplay();

  // ボタンの disabled を全解除
  // ※ handleTimerFinish で btn-finish が true のまま残るのを防ぐ
  setButtonDisabled('btn-start',  false);
  setButtonDisabled('btn-pause',  false);
  setButtonDisabled('btn-resume', false);
  setButtonDisabled('btn-finish', false);

  // エラー・成功メッセージをクリア
  clearTimerError();

  // UI を idle 状態に描画（btn-start 表示、他は非表示）
  renderTimerUI();
}

// -----------------------------------------------
// 60秒未満セッションをサーバーから完全废棄してホームに戻る
//
// フロー:
//   1. /api/timer/discard で DB からセッションを削除（集計に入らない）
//   2. 内部状態を完全リセット
//   3. ホーム画面へ自動遷移＋集計表示更新
// -----------------------------------------------
async function discardShortSessionAndGoHome(sessionId) {
  // DB から削除（失敗しても画面遷移は行う）
  try {
    await fetch('/api/timer/discard', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ session_id: sessionId }),
    });
  } catch (e) {
    // 通信エラーは無視して遷移を続行
  }

  // 内部状態を完全リセット
  resetTimerFull();

  // ホーム画面へ移動＋集計更新
  showPage('page-home');
  fetchAndRenderStats();
}

// -----------------------------------------------
// タイマーUIを状態に合わせて描画する
// -----------------------------------------------
function renderTimerUI() {
  const status = timerState ? timerState.status : 'idle';

  // 結果カードを隠す（finished でなければ）
  const resultCard = document.getElementById('timer-result-card');
  if (status !== 'finished') {
    resultCard.classList.add('hidden');
  }

  // ステータスバッジ
  const badge    = document.getElementById('timer-status-badge');
  const dot      = document.getElementById('timer-status-dot');
  const statusTx = document.getElementById('timer-status-text');
  const subText  = document.getElementById('timer-sub-text');

  const statusMap = {
    idle:     { label: '待機中',       dotColor: 'bg-gray-400',               badgeColor: 'bg-gray-100 text-gray-500' },
    running:  { label: '勉強中',       dotColor: 'bg-green-400 animate-pulse', badgeColor: 'bg-green-100 text-green-600' },
    paused:   { label: '一時停止中',   dotColor: 'bg-amber-400',              badgeColor: 'bg-amber-100 text-amber-600' },
    frozen:   { label: '確認待ち',     dotColor: 'bg-orange-400',             badgeColor: 'bg-orange-100 text-orange-600' },
    finished: { label: '終了',         dotColor: 'bg-purple-400',             badgeColor: 'bg-purple-100 text-purple-600' },
  };
  const s = statusMap[status] || statusMap.idle;
  dot.className      = 'w-2 h-2 rounded-full inline-block ' + s.dotColor;
  statusTx.textContent = s.label;
  badge.className    = 'inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium ' + s.badgeColor;

  // サブテキスト
  const subMap = {
    idle:     'スタートを押して勉強を始めよう！',
    running:  '集中して頑張ろう！💪',
    paused:   '一時停止中... 再開できるよ',
    frozen:   '確認が必要です',
    finished: 'お疲れ様でした！🌸',
  };
  subText.textContent = subMap[status] || '';

  // ボタン表示制御（frozen は idle 扱いで全ボタン隠す）
  const showStart  = (status === 'idle');
  const showPause  = (status === 'running');
  const showResume = (status === 'paused');
  const showFinish = (status === 'running' || status === 'paused');

  document.getElementById('btn-start').classList.toggle('hidden',  !showStart);
  document.getElementById('btn-pause').classList.toggle('hidden',  !showPause);
  document.getElementById('btn-resume').classList.toggle('hidden', !showResume);
  document.getElementById('btn-finish').classList.toggle('hidden', !showFinish);
}

// -----------------------------------------------
// 1秒ごとに経過時間を計算して表示する
// -----------------------------------------------
function startTimerTick() {
  stopTimerTick(); // 二重起動防止
  timerIntervalId = setInterval(() => {
    if (!timerState || timerState.status === 'idle' || timerState.status === 'finished' || timerState.status === 'frozen') {
      // 待機中・終了後・凍結中はタイマーを進めない
      return;
    }
    const elapsed = calcElapsedSeconds(timerState);
    const display = document.getElementById('timer-display');
    if (display) display.textContent = formatSecondsDisplay(elapsed);
  }, 1000);
}

function stopTimerTick() {
  if (timerIntervalId !== null) {
    clearInterval(timerIntervalId);
    timerIntervalId = null;
  }
}

// -----------------------------------------------
// 経過秒数を計算する（フロント側）
// started_at からの経過時間 - 一時停止時間の合計
//
// ※ frozen 状態では total_seconds が確定値として保存済みのため
//    この関数は frozen では呼ばない（呼んでも 0 を返すように設計）
// -----------------------------------------------
function calcElapsedSeconds(state) {
  if (!state) return 0;
  // frozen / finished は total_seconds をそのまま使う
  if (state.status === 'frozen' || state.status === 'finished') {
    return state.total_seconds || 0;
  }

  const now   = Date.now();
  const start = new Date(state.started_at).getTime();
  let elapsed = Math.floor((now - start) / 1000);

  // 一時停止時間を差し引く
  for (const pause of (state.pauses || [])) {
    const pauseMs  = new Date(pause.pause_at).getTime();
    const resumeMs = pause.resume_at ? new Date(pause.resume_at).getTime() : now;
    elapsed -= Math.floor((resumeMs - pauseMs) / 1000);
  }

  return Math.max(0, elapsed);
}

// -----------------------------------------------
// 秒数を HH:MM:SS 形式に変換
// -----------------------------------------------
function formatSecondsDisplay(sec) {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  return [
    String(h).padStart(2, '0'),
    String(m).padStart(2, '0'),
    String(s).padStart(2, '0'),
  ].join(':');
}

// -----------------------------------------------
// 秒数を「X時間Y分Z秒」形式に変換
// -----------------------------------------------
function formatSecondsJa(sec) {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  if (h > 0) return h + '時間' + m + '分' + s + '秒';
  if (m > 0) return m + '分' + s + '秒';
  return s + '秒';
}

// -----------------------------------------------
// スタート
// -----------------------------------------------
async function handleTimerStart() {
  clearTimerError();
  setButtonDisabled('btn-start', true);
  try {
    const res = await fetch('/api/timer/start', {
      method: 'POST',
      credentials: 'include',
    });
    const data = await res.json();
    if (data.success) {
      timerState = data.data;
      renderTimerUI();
    } else {
      showTimerError(data.error || 'スタートに失敗しました');
      if (data.data) {
        timerState = data.data;
        renderTimerUI();
      }
    }
  } catch (err) {
    showTimerError('通信エラーが発生しました');
  } finally {
    setButtonDisabled('btn-start', false);
  }
}

// -----------------------------------------------
// 一時停止
// -----------------------------------------------
async function handleTimerPause() {
  clearTimerError();
  setButtonDisabled('btn-pause', true);
  try {
    const res = await fetch('/api/timer/pause', {
      method: 'POST',
      credentials: 'include',
    });
    const data = await res.json();
    if (data.success) {
      timerState = data.data;
      renderTimerUI();
    } else {
      showTimerError(data.error || '一時停止に失敗しました');
    }
  } catch (err) {
    showTimerError('通信エラーが発生しました');
  } finally {
    setButtonDisabled('btn-pause', false);
  }
}

// -----------------------------------------------
// 再開（一時停止 → 再開）
// -----------------------------------------------
async function handleTimerResume() {
  clearTimerError();
  setButtonDisabled('btn-resume', true);
  try {
    const res = await fetch('/api/timer/resume', {
      method: 'POST',
      credentials: 'include',
    });
    const data = await res.json();
    if (data.success) {
      timerState = data.data;
      renderTimerUI();
    } else {
      showTimerError(data.error || '再開に失敗しました');
    }
  } catch (err) {
    showTimerError('通信エラーが発生しました');
  } finally {
    setButtonDisabled('btn-resume', false);
  }
}

// -----------------------------------------------
// フィニッシュ
// -----------------------------------------------
async function handleTimerFinish() {
  clearTimerError();
  setButtonDisabled('btn-finish', true);
  try {
    const res = await fetch('/api/timer/finish', {
      method: 'POST',
      credentials: 'include',
    });
    const data = await res.json();
    if (data.success) {
      timerState = data.data;

      // 表示を確定した秒数に固定
      const display = document.getElementById('timer-display');
      if (display) display.textContent = formatSecondsDisplay(timerState.total_seconds);

      stopTimerTick();
      renderTimerUI();

      // 60秒未満: DBから削除してホームへ戻る
      if (timerState.total_seconds < 60) {
        const shortId = timerState.session_id;
        stopTimerTick();
        renderTimerUI();
        // 「記録されません」メッセージを一瞬表示してからホームへ
        showTimerSuccess('1分未満の勉強は記録されません');
        setTimeout(() => discardShortSessionAndGoHome(shortId), 1500);
      } else {
        showRecordDialog(timerState.session_id, timerState.total_seconds);
      }
    } else {
      showTimerError(data.error || 'フィニッシュに失敗しました');
      setButtonDisabled('btn-finish', false);
    }
  } catch (err) {
    showTimerError('通信エラーが発生しました');
    setButtonDisabled('btn-finish', false);
  }
}

// -----------------------------------------------
// ホームに戻るボタン
//
// タイマーが running/paused の場合は凍結してからホームへ。
// frozen/finished/idle の場合はそのままホームへ。
// -----------------------------------------------
async function handleTimerBack() {
  stopTimerTick();
  closeAbandonedDialog();

  // タイマーが動作中 (running / paused) なら凍結してからホームへ
  if (timerState && (timerState.status === 'running' || timerState.status === 'paused')) {
    try {
      const res = await fetch('/api/timer/freeze', {
        method: 'POST',
        credentials: 'include',
      });
      const data = await res.json();
      if (data.success && data.data) {
        timerState = data.data; // frozen 状態に更新
      }
    } catch (err) {
      // 通信エラーでも画面遷移は行う
    }
  }

  showPage('page-home');
}

// =============================================
// 未終了セッション確認ダイアログ
// =============================================

// -----------------------------------------------
// ダイアログを表示し、セッション情報を埋め込む
// state は frozen 状態のセッションデータ
// -----------------------------------------------
function showAbandonedDialog(state) {
  // 開始時刻を日本語表記に変換
  const startedDate = new Date(state.started_at);
  const startedStr = startedDate.toLocaleString('ja-JP', {
    month: 'numeric', day: 'numeric',
    hour: '2-digit', minute: '2-digit'
  });
  document.getElementById('abandoned-started-at').textContent = startedStr;

  // 状態の日本語表記
  const statusLabel = '凍結状態（確認待ち）';
  document.getElementById('abandoned-status').textContent = statusLabel;

  // 凍結時点で確定済みの total_seconds を表示
  // ※ 凍結後は時間が加算されないので total_seconds が正確な累計値
  const savedSec = state.total_seconds || 0;
  document.getElementById('abandoned-elapsed').textContent = formatSecondsJa(savedSec);

  // タイマー表示も凍結時点の値に固定
  const display = document.getElementById('timer-display');
  if (display) display.textContent = formatSecondsDisplay(savedSec);

  // ボタンを必ず有効化してからダイアログを表示
  setButtonDisabled('abandoned-btn-resume', false);
  setButtonDisabled('abandoned-btn-finish', false);

  // ダイアログを表示
  document.getElementById('abandoned-dialog').classList.remove('hidden');
}

// -----------------------------------------------
// ダイアログを閉じる
// -----------------------------------------------
function closeAbandonedDialog() {
  document.getElementById('abandoned-dialog').classList.add('hidden');
}

// -----------------------------------------------
// 「再開する」ボタン
//
// /api/timer/resume-frozen を呼び、
// バックエンドが「adjusted_start = now - saved_seconds 秒前」に
// started_at を書き換えた running セッションを返す。
// フロントは通常の running 状態として扱うだけでよい。
// -----------------------------------------------
async function handleAbandonedResume() {
  // ボタンを無効化（二重送信防止）
  setButtonDisabled('abandoned-btn-resume', true);
  setButtonDisabled('abandoned-btn-finish', true);

  try {
    const res = await fetch('/api/timer/resume-frozen', {
      method: 'POST',
      credentials: 'include',
    });
    const data = await res.json();

    if (data.success && data.data) {
      timerState = data.data; // running 状態のセッション
      closeAbandonedDialog();
      renderTimerUI();
      startTimerTick(); // ここで初めてタイマーを再開

    } else {
      // エラー時はボタンを再度有効化
      showTimerError(data.error || '再開に失敗しました。もう一度お試しください');
      setButtonDisabled('abandoned-btn-resume', false);
      setButtonDisabled('abandoned-btn-finish', false);
    }
  } catch (err) {
    showTimerError('通信エラーが発生しました。もう一度お試しください');
    setButtonDisabled('abandoned-btn-resume', false);
    setButtonDisabled('abandoned-btn-finish', false);
  }
}

// -----------------------------------------------
// 「ここで終了する」ボタン
//
// /api/timer/finish-frozen を呼ぶ。
// 凍結時点で確定済みの total_seconds がそのまま終了秒数になる。
// 確認ダイアログが表示されていた時間は一切加算されない。
// -----------------------------------------------
async function handleAbandonedFinish() {
  // ボタンを無効化（二重送信防止）
  setButtonDisabled('abandoned-btn-resume', true);
  setButtonDisabled('abandoned-btn-finish', true);

  try {
    const res = await fetch('/api/timer/finish-frozen', {
      method: 'POST',
      credentials: 'include',
    });
    const data = await res.json();

    if (data.success && data.data) {
      timerState = data.data;
      closeAbandonedDialog();

      // 確定した秒数を表示（凍結時の total_seconds）
      const display = document.getElementById('timer-display');
      if (display) display.textContent = formatSecondsDisplay(timerState.total_seconds);

      stopTimerTick();
      renderTimerUI();

      // 60秒未満: DBから削除してホームへ戻る
      if (timerState.total_seconds < 60) {
        const shortId = timerState.session_id;
        closeAbandonedDialog();
        stopTimerTick();
        renderTimerUI();
        showTimerSuccess('1分未満の勉強は記録されません');
        setTimeout(() => discardShortSessionAndGoHome(shortId), 1500);
      } else {
        showRecordDialog(timerState.session_id, timerState.total_seconds);
      }

    } else {
      showTimerError(data.error || '終了処理に失敗しました。もう一度お試しください');
      setButtonDisabled('abandoned-btn-resume', false);
      setButtonDisabled('abandoned-btn-finish', false);
    }
  } catch (err) {
    showTimerError('通信エラーが発生しました。もう一度お試しください');
    setButtonDisabled('abandoned-btn-resume', false);
    setButtonDisabled('abandoned-btn-finish', false);
  }
}

// =============================================
// 勉強記録入力ダイアログ
// =============================================

// 記録ダイアログで選択された教科（複数選択対応・Set で管理）
let recordSelectedSubjects = new Set();
// 記録対象のセッションID
let recordSessionId = null;

// -----------------------------------------------
// 記録ダイアログを表示する
// sessionId: 対象セッションID
// totalSeconds: 今回の勉強秒数
// -----------------------------------------------
function showRecordDialog(sessionId, totalSeconds) {
  recordSessionId = sessionId;
  recordSelectedSubjects = new Set(); // 選択状態をリセット

  // 時間表示を設定
  const timeEl = document.getElementById('record-dialog-time');
  if (timeEl) timeEl.textContent = formatSecondsJa(totalSeconds);

  // 前回の入力をリセット
  const memoEl = document.getElementById('record-memo');
  if (memoEl) memoEl.value = '';

  // 教科ボタンの選択状態をリセット
  document.querySelectorAll('.subject-btn').forEach(btn => {
    btn.classList.remove('border-pink-400', 'bg-pink-50', 'text-pink-600');
    btn.classList.add('border-gray-200', 'text-gray-600');
  });

  // エラーを隠す
  const errEl = document.getElementById('record-error');
  if (errEl) errEl.classList.add('hidden');

  // 保存ボタンを有効化
  setButtonDisabled('record-save-btn', false);

  // ダイアログを表示
  document.getElementById('record-dialog').classList.remove('hidden');
}

// -----------------------------------------------
// 教科ボタン選択ハンドラ（複数選択トグル式）
// 押すと選択、もう一度押すと解除
// -----------------------------------------------
function selectSubject(subject) {
  if (recordSelectedSubjects.has(subject)) {
    // 選択済み → 解除
    recordSelectedSubjects.delete(subject);
  } else {
    // 未選択 → 追加
    recordSelectedSubjects.add(subject);
  }
  // ボタンのスタイルを選択状態に同期
  const btn = document.querySelector('[data-subject="' + subject + '"]');
  if (btn) {
    if (recordSelectedSubjects.has(subject)) {
      btn.classList.remove('border-gray-200', 'text-gray-600');
      btn.classList.add('border-pink-400', 'bg-pink-50', 'text-pink-600');
    } else {
      btn.classList.remove('border-pink-400', 'bg-pink-50', 'text-pink-600');
      btn.classList.add('border-gray-200', 'text-gray-600');
    }
  }
}

// -----------------------------------------------
// 記録保存ハンドラ
// -----------------------------------------------
async function handleRecordSave() {
  const errEl = document.getElementById('record-error');
  if (errEl) {
    errEl.classList.add('hidden');
    errEl.textContent = '';
  }

  // バリデーション: 教科（1つ以上必須）
  if (recordSelectedSubjects.size === 0) {
    if (errEl) {
      errEl.textContent = '教科を1つ以上選択してください';
      errEl.classList.remove('hidden');
    }
    return;
  }
  const memoEl = document.getElementById('record-memo');
  const memo = memoEl ? memoEl.value.trim() : '';
  if (!memo) {
    if (errEl) {
      errEl.textContent = '勉強内容を入力してください';
      errEl.classList.remove('hidden');
    }
    return;
  }

  setButtonDisabled('record-save-btn', true);

  try {
    const res = await fetch('/api/timer/record', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        session_id: recordSessionId,
        subjects: Array.from(recordSelectedSubjects), // Set → 配列に変換して送信
        memo: memo,
      }),
    });
    const data = await res.json();

    if (data.success) {
      // ダイアログを閉じる
      document.getElementById('record-dialog').classList.add('hidden');

      // タイマー状態を完全リセット
      resetTimerFull();

      // ホーム画面へ自動遷移＋集計更新
      showPage('page-home');
      fetchAndRenderStats();

    } else {
      if (errEl) {
        errEl.textContent = data.error || '保存に失敗しました';
        errEl.classList.remove('hidden');
      }
      setButtonDisabled('record-save-btn', false);
    }
  } catch (err) {
    if (errEl) {
      errEl.textContent = '通信エラーが発生しました。もう一度お試しください';
      errEl.classList.remove('hidden');
    }
    setButtonDisabled('record-save-btn', false);
  }
}

// -----------------------------------------------
// タイマーUI用ヘルパー
// -----------------------------------------------
function showTimerError(msg) {
  const el = document.getElementById('timer-error');
  el.textContent = msg;
  el.classList.remove('hidden');
}
function showTimerSuccess(msg) {
  const el = document.getElementById('timer-success');
  if (el) {
    el.textContent = msg;
    el.classList.remove('hidden');
  }
}
function clearTimerError() {
  const errEl = document.getElementById('timer-error');
  errEl.classList.add('hidden');
  errEl.textContent = '';
  const sucEl = document.getElementById('timer-success');
  if (sucEl) {
    sucEl.classList.add('hidden');
    sucEl.textContent = '';
  }
}
function setButtonDisabled(id, disabled) {
  const btn = document.getElementById(id);
  if (btn) btn.disabled = disabled;
}

// =============================================
// 初期化: 既存セッションの確認
// =============================================
async function initApp() {
  setLoading(true);
  try {
    const res = await fetch('/api/auth/me', { credentials: 'include' });
    if (res.ok) {
      const data = await res.json();
      if (data.success && data.data) {
        currentUser = data.data;
        updateHomeScreen(currentUser);
        showPage('page-home');
        return;
      }
    }
  } catch (err) {
    // セッションなし→ログイン画面表示
  } finally {
    setLoading(false);
  }
  showPage('page-login');
}

// アプリ起動
initApp();

// =============================================
// ブラウザ離脱時の凍結処理
//
// 凍結を行う操作:
//   ・ブラウザを閉じる
//   ・タブを閉じる
//   ・ページ再読み込み
//   → pagehide イベントで検知
//
// 凍結を行わない操作:
//   ・別タブへ移動（タブが非表示になるだけ）
//   ・ウィンドウを最小化
//   → visibilitychange は「別タブ移動でも hidden になる」ため使わない
//
// ★ fetch は使わない（ブラウザが即座に切断するため非同期は届かない）
// ★ navigator.sendBeacon を使う（ページ離脱後も確実にリクエストが届く）
// =============================================

function freezeOnLeave() {
  // タイマーが running/paused の時だけ送信する
  if (!timerState) return;
  if (timerState.status !== 'running' && timerState.status !== 'paused') return;

  // sendBeacon: ページ離脱後もブラウザがバックグラウンドで送信を完了させる
  try {
    navigator.sendBeacon('/api/timer/freeze', new Blob([], { type: 'application/json' }));
  } catch (e) {
    // sendBeacon 未対応環境（古いブラウザ）では無視
  }
}

// pagehide のみ使用:
//   ブラウザを閉じる・タブを閉じる・ページ再読み込みで発火する。
//   別タブへの移動では発火しないため、別タブ移動で誤って凍結しない。
//   （visibilitychange は別タブ移動でも hidden になるため使用しない）
window.addEventListener('pagehide', freezeOnLeave);
</script>
</body>
</html>`)
})

export default app
