// =============================================
// 花はな Learning Timer - メインエントリーポイント
// =============================================

import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'
import { serveStatic } from 'hono/cloudflare-workers'
import authRoutes from './routes/auth'
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

      <!-- 機能カード一覧（今後の機能を予告） -->
      <div class="mb-6">
        <h3 class="text-sm font-medium text-gray-500 mb-3 flex items-center gap-2">
          <i class="fas fa-star text-yellow-400"></i>
          これから使える機能
        </h3>
        <div class="grid grid-cols-2 gap-3">

          <!-- タイマー（準備中） -->
          <div class="card p-4 opacity-60 cursor-not-allowed">
            <div class="text-3xl mb-2">⏱️</div>
            <p class="font-medium text-gray-700 text-sm">勉強タイマー</p>
            <p class="text-xs text-gray-400 mt-1">準備中...</p>
          </div>

          <!-- 勉強記録（準備中） -->
          <div class="card p-4 opacity-60 cursor-not-allowed">
            <div class="text-3xl mb-2">📝</div>
            <p class="font-medium text-gray-700 text-sm">勉強記録</p>
            <p class="text-xs text-gray-400 mt-1">準備中...</p>
          </div>

          <!-- ランキング（準備中） -->
          <div class="card p-4 opacity-60 cursor-not-allowed">
            <div class="text-3xl mb-2">🏆</div>
            <p class="font-medium text-gray-700 text-sm">ランキング</p>
            <p class="text-xs text-gray-400 mt-1">準備中...</p>
          </div>

          <!-- カレンダー（準備中） -->
          <div class="card p-4 opacity-60 cursor-not-allowed">
            <div class="text-3xl mb-2">📅</div>
            <p class="font-medium text-gray-700 text-sm">カレンダー</p>
            <p class="text-xs text-gray-400 mt-1">準備中...</p>
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

      <!-- ログアウトボタン（モバイル向け大きめ） -->
      <div class="mt-6">
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
}

// フォームタグのonsubmitでEnterキー送信をハンドリング済み

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
</script>
</body>
</html>`)
})

export default app
