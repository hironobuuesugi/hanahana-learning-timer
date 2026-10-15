import { sharedTestdateDialog, sharedTestdateScript } from './shared-testdate';
// 既存の花はなカード・配色・ゴシック体を引き継ぐ先生画面。
export const managementHeader = String.raw`
<div id="page-admin" class="page"><div class="min-h-screen" style="background:#fdf2f8">
<header class="bg-white shadow-sm sticky top-0 z-10"><div class="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
<button onclick="showPage('page-home')" class="text-sm text-gray-500 py-2">‹ ホーム</button>
<span class="font-bold text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-purple-500">🌸 先生管理画面</span><button onclick="refreshManagement()" class="text-sm text-indigo-500 py-2">更新</button></div></header>
<main class="max-w-5xl mx-auto px-4 py-6 space-y-4">
<nav class="grid grid-cols-2 sm:grid-cols-5 gap-2" aria-label="先生管理メニュー">
<button data-management="tab" data-tab="students" class="management-tab">👩‍🎓 生徒一覧</button>
<button data-management="tab" data-tab="timers" class="management-tab">⏱ タイマー状況 <span id="management-new-badge" class="hidden"></span></button>
<button data-management="tab" data-tab="accounts" class="management-tab">🌷 アカウント</button>
<button data-management="tab" data-tab="history" class="management-tab">📝 変更履歴</button>
<button data-management="tab" data-tab="testdate" class="management-tab">📅 共通テスト日</button></nav>
<div id="management-error" role="alert" class="hidden bg-red-50 text-red-600 rounded-xl p-4 text-sm"></div>
<section id="management-students" class="management-panel space-y-4">
<div class="bg-white rounded-2xl shadow-sm p-4 sm:p-5"><div class="flex flex-wrap items-center justify-between gap-3">
<div><h2 class="font-bold text-gray-700">みんなの学習時間</h2><p class="text-sm text-gray-500 mt-1">保存済みの学習時間順です 🌸</p></div>
<div class="flex items-center gap-2"><button data-management="month" data-delta="-1" class="management-small" aria-label="前の月">‹</button><input id="management-month" type="month" class="management-input" aria-label="一覧の月"><button data-management="month" data-delta="1" class="management-small" aria-label="次の月">›</button></div></div>
<div id="management-student-list" class="mt-4"></div></div>
</section>
<section id="management-timers" class="management-panel hidden space-y-4">
<div class="bg-white rounded-2xl shadow-sm p-4 sm:p-5"><h2 class="font-bold text-gray-700">タイマー・未保存記録</h2><p class="text-sm text-gray-500 mt-1">未保存の時間は、集計・ランキングには含まれません。</p><p id="management-observed" class="text-xs text-gray-400 mt-2"></p><div id="management-timer-list" class="mt-4 space-y-3"></div></div>
<div class="bg-white rounded-2xl shadow-sm p-4 sm:p-5"><button data-management="attention" class="text-left font-bold text-gray-700 py-2" aria-expanded="false">最近の自動停止・時間修正 <span id="management-attention-badge"></span> <span id="management-attention-toggle-label">一覧を見る</span></button><p class="text-sm text-gray-500">ここから生徒の詳細を開くと、その生徒の新着がまとめて既読になります。</p><button id="management-attention-read-all" data-management="attention-read-all" class="management-small mt-3" disabled>すべて既読にする</button><div id="management-attention-list" class="hidden mt-4 space-y-3"></div><button id="management-attention-more" data-management="attention-more" class="hidden management-small mt-3">新着をもっと見る</button></div>
</section>
<section id="management-accounts" class="management-panel hidden bg-white rounded-2xl shadow-sm p-4 sm:p-5">
<h2 class="font-bold text-gray-700">生徒アカウント</h2><p class="text-sm text-gray-500 mt-1">お休み中の生徒はアーカイブできます。記録はそのまま残ります。</p>
<label class="flex items-center gap-2 py-4 text-sm text-gray-600"><input id="management-archived" type="checkbox">アーカイブ済みの生徒を表示</label><div id="management-account-list"></div></section>
<section id="management-history" class="management-panel hidden bg-white rounded-2xl shadow-sm p-4 sm:p-5"><h2 class="font-bold text-gray-700">変更履歴</h2><div id="management-history-list" class="mt-4 space-y-3"></div><button id="management-history-more" data-management="history-more" class="hidden management-small mt-3">以前の履歴を読む</button></section>
<section id="management-testdate" class="management-panel hidden bg-white rounded-2xl shadow-sm p-4 sm:p-5">
<h2 class="font-bold text-gray-700">共通テスト日</h2><p class="text-sm text-gray-500 mt-2">アーカイブされていない全生徒へ同じ日付を表示します。</p>
<div id="management-testdate-summary" class="rounded-xl bg-purple-50 p-4 mt-4 text-sm text-gray-600"></div>
<div class="flex flex-wrap gap-2 mt-4"><button id="management-testdate-edit" data-management="testdate-edit" class="management-primary">日付設定</button><button id="management-testdate-visibility" data-management="testdate-visibility" class="management-small" disabled>表示にする</button><button id="management-testdate-delete" data-management="testdate-delete" class="management-small" disabled>削除</button></div>
<p class="text-xs text-gray-400 mt-4">非表示は日付を保持します。削除は日付設定を解除します。以前の個別設定は再表示されません。</p></section>
<section id="management-detail" class="hidden space-y-4"><div class="flex flex-wrap items-center justify-between gap-3"><button data-management="back" class="management-small">‹ 生徒一覧に戻る</button><button data-management="add" class="management-primary">＋ 学習記録を追加</button></div>
<div class="bg-white rounded-2xl shadow-sm p-4"><label class="text-sm text-gray-600" for="admin-student-select">生徒の切り替え</label><select id="admin-student-select" onchange="openManagementStudent(this.value)" class="management-input w-full mt-2"><option value="">-- 生徒を選択 --</option></select></div><div id="admin-loading" class="hidden text-center py-8 text-gray-500">🌸 読み込み中…</div>
`
export const managementFooter = String.raw`
</section></main></div></div>
<dialog id="management-dialog" class="management-dialog" aria-labelledby="management-dialog-title"><form id="management-form">
<div class="bg-gradient-to-r from-pink-400 to-purple-400 text-white px-5 py-4"><h2 id="management-dialog-title" class="font-bold text-lg"></h2></div>
<div class="p-5 space-y-4"><div id="management-dialog-body"></div><div id="management-dialog-error" role="alert" class="hidden bg-red-50 rounded-xl text-red-600 text-sm p-3"></div>
<div class="flex gap-3"><button type="button" id="management-dialog-cancel" class="management-small flex-1">キャンセル</button><button type="submit" id="management-dialog-submit" class="management-primary flex-1">確認する</button></div></div></form></dialog>
<div id="management-toast" role="status" aria-live="polite" class="hidden fixed bottom-6 left-1/2 z-50 rounded-2xl bg-white shadow-lg px-5 py-3 text-sm text-purple-700" style="transform:translateX(-50%);max-width:90vw"></div>
${sharedTestdateDialog}
<style>
.session-details-open{display:none}.session-details[open] .session-details-open{display:inline}.session-details[open] .session-details-closed{display:none}.session-facts-pair{display:flex;flex-wrap:wrap;column-gap:4px}.session-facts-pair>span{white-space:nowrap}.session-details summary:focus-visible{outline:2px solid #f9a8d4;outline-offset:2px;border-radius:8px}
.management-tab{padding:12px 8px;border-radius:16px;background:white;color:#6b7280;font-size:14px;font-weight:600;box-shadow:0 1px 3px #00000008;min-height:48px}
.management-tab[aria-selected=true]{background:linear-gradient(110deg,#a5b4fc,#c4b5fd);color:white}
.management-small{background:#f5f3ff;color:#6b5e9e;border:1px solid #ede9fe;border-radius:12px;padding:10px 14px;font-size:14px;min-height:44px}
.management-small.management-timer-action{background:#e9d5ff;color:#6b21a8;border-color:#c084fc;font-weight:700;box-shadow:0 1px 2px #7c3aed14}
.management-small.management-timer-action:hover{background:#d8b4fe}
.management-timer-action:focus-visible{outline:2px solid #c084fc;outline-offset:2px}
.management-primary{background:linear-gradient(110deg,#f472b6,#c084fc);color:white;border:0;border-radius:12px;padding:12px 16px;font-size:14px;font-weight:600;min-height:44px}
.management-input{border:1px solid #e5e7eb;border-radius:12px;padding:10px 12px;font:inherit;font-size:14px;background:white;min-height:44px;max-width:100%}
.management-row{display:flex;align-items:center;justify-content:space-between;gap:16px;padding:16px 2px;border-bottom:1px solid #f3f4f6}.management-row:last-child{border-bottom:0}
.management-name{font-size:15px;font-weight:600;color:#655b89;text-align:left;overflow-wrap:anywhere;padding:5px 0}
.management-dialog{padding:0;border:0;border-radius:20px;width:min(480px,calc(100vw - 32px));max-height:90dvh;color:#374151;box-shadow:0 20px 70px #0003}.management-dialog::backdrop{background:#0006}
.management-dialog label{display:block;font-size:14px;margin:12px 0 6px}.management-dialog input:not([type=checkbox]),.management-dialog textarea{width:100%}
.management-dialog .management-subjects{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}.management-dialog .management-subjects label{margin:0;padding:10px;border:1px solid #e5e7eb;border-radius:12px}
#management-new-badge{background:#f472b6;color:white;font-size:12px;border-radius:999px;padding:2px 7px}
#management-detail #admin-student-detail>div{min-width:0}#management-detail #admin-student-detail>div:first-child{grid-column:1/-1}#management-detail #admin-student-detail>div:nth-last-child(2){grid-column:1/-1}
@media(min-width:768px){#management-detail #admin-student-detail:not(.hidden){display:grid;grid-template-columns:1fr 1fr;gap:16px}#management-detail #admin-student-detail>div{margin:0!important}}
@media(max-width:420px){.management-row{gap:8px}.management-small{padding:10px}.management-tab{font-size:13px}}
button:disabled{opacity:.5;cursor:wait}.management-dialog input:focus,.management-input:focus{outline:2px solid #f9a8d4;outline-offset:2px}
</style>`
export const managementScript = String.raw`
${sharedTestdateScript}
var managementTab = 'students', managementStudent = null, managementRecords = [], managementTimers = [], managementAccounts = [], managementAttentionOffset = 0, managementHistoryOffset = 0, managementEpoch = 0;
var managementReadAllBusy=false, managementReadAllSnapshot=0, managementUnreadCount=0;
var managementAttentionOpen=false, managementAttentionItems=[], managementAttentionReadThrough=0, managementTestdate=null, managementTestdateCount=0, testdateDialogState=null;
var managementDialogState = null, managementBusy = false, managementToastTimer;
function managementEl(id) { return document.getElementById(id); }
function managementSummary(seconds) { var h=Math.floor(seconds/3600),m=Math.floor((seconds%3600)/60); return (h?'<span style="display:inline-block;white-space:nowrap">'+h+'時間</span>':'')+(m||!h?'<span style="display:inline-block;white-space:nowrap">'+m+'分</span>':''); }
function managementMinutes(seconds) { return Math.floor((seconds || 0) / 60) + '分'; }
function managementDate(row) { return row.study_date || row.learning_date || isoToJstDateKey(row.original_started_at || row.started_at); }
function autoHistoryLabel(row) { if (!row.auto_stopped)
    return ''; var raw = row.auto_stop_seconds; if (raw == null)
    return '自動停止（原計測時間は未記録）'; return Math.round(raw / 60) + '分で自動停止 → ' + Math.round(row.total_seconds / 60) + '分' + (raw === row.total_seconds ? 'のまま保存' : 'に修正して保存'); }
async function managementRequest(path, method, body) { var r = await fetch('/api/admin' + path, { method: method || 'GET', credentials: 'include', headers: body === undefined ? {} : { 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) }).catch(function(){throw new Error('通信できませんでした。接続を確認して、もう一度お試しください。');}); var j = await r.json().catch(function () { return { success: false, error: '処理できませんでした。もう一度お試しください。' }; }); if (!r.ok || !j.success)
    throw new Error(j.error || '処理できませんでした。もう一度お試しください。'); return j; }
function managementError(e) { var el = managementEl('management-error'); el.textContent = e.message || String(e); el.classList.remove('hidden'); }
function managementToast(text) { var el = managementEl('management-toast'); clearTimeout(managementToastTimer); el.textContent = text; el.classList.remove('hidden'); managementToastTimer = setTimeout(function () { el.classList.add('hidden'); }, 2000); }
async function initAdminPage() { if (!currentUser || !currentUser.is_teacher)
    return; managementEl('management-month').value = new Date(Date.now() + 9 * 3600000).toISOString().slice(0, 7); managementStudent = null; await managementSwitch('students'); await managementBadge(); }
async function managementSwitch(tab) { managementTab = tab; managementEpoch++; managementEl('management-detail').classList.add('hidden'); document.querySelectorAll('.management-panel').forEach(function (el) { el.classList.toggle('hidden', el.id !== 'management-' + tab); }); document.querySelectorAll('.management-tab').forEach(function (el) { el.setAttribute('aria-selected', String(el.dataset.tab === tab)); }); await refreshManagement(); }
async function refreshManagement() { managementEl('management-error').classList.add('hidden'); try {
    if (managementStudent) {
        await openManagementStudent(managementStudent);
        return;
    }
    if (managementTab === 'students')
        await managementStudents(false);
    if (managementTab === 'accounts')
        await managementStudents(true);
    if (managementTab === 'timers')
        await managementLoadTimers();
    if (managementTab === 'testdate')
        await managementLoadTestdate();
    if (managementTab === 'history')
        await managementHistory(false);
    await managementBadge();
}
catch (e) {
    managementError(e);
} }
async function managementStudents(accounts) { var epoch = managementEpoch; var j = await managementRequest('/monthly-students?month=' + managementEl('management-month').value + '&archived=' + (accounts && managementEl('management-archived').checked ? '1' : '0')); if (epoch !== managementEpoch)
    return; managementAccounts = j.data; var select = managementEl('admin-student-select'); select.innerHTML = '<option value="">-- 生徒を選択 --</option>'; j.data.forEach(function (s) { var op = document.createElement('option'); op.value = s.user_id; op.textContent = s.display_name + '（' + s.user_id + '）'; select.appendChild(op); }); var html = j.data.map(function (s, i) { return '<div class="management-row"><div><button data-management="student" data-user="' + escapeHtml(s.user_id) + '" class="management-name">' + (!accounts ? '<span class="text-xs text-gray-400 mr-2">' + (i + 1) + '</span>' : '') + escapeHtml(s.display_name) + ' ›</button><p class="text-xs text-gray-400">' + escapeHtml(s.user_id) + (accounts ? '' : ' ・ ' + s.study_days + '日学習') + '</p></div>' + (accounts ? '<div class="flex gap-2"><button class="management-small" data-management="archive" data-user="' + escapeHtml(s.user_id) + '">' + (s.archived_at ? '解除' : 'アーカイブ') + '</button><button class="management-small" data-management="account-detail" data-user="' + escapeHtml(s.user_id) + '">詳細</button></div>' : '<span class="font-bold text-indigo-500 whitespace-nowrap">' + formatSecondsJaShort(s.month_seconds) + '</span>') + '</div>'; }).join(''); managementEl(accounts ? 'management-account-list' : 'management-student-list').innerHTML = html || '<p class="text-sm text-gray-400 py-5">対象の生徒はいません。</p>'; }
async function openManagementStudent(user, readThrough) { if (!user)
    return; managementStudent = user; managementEpoch++; var openEpoch=managementEpoch; document.querySelectorAll('.management-panel').forEach(function (el) { el.classList.add('hidden'); }); managementEl('management-detail').classList.remove('hidden'); managementEl('admin-student-select').value = user; await loadAdminStudent(user); if(managementStudent!==user||managementEpoch!==openEpoch)return; try {
    await managementLoadRecords(false);
    if(readThrough!=null && managementStudent===user && managementEpoch===openEpoch && !managementEl('admin-student-detail').classList.contains('hidden')){
      await managementRequest('/attention/read','POST',{student_user_id:user,read_through:readThrough});
      await managementBadge();
    }
}
catch (e) {
    managementError(e);
} }
async function managementLoadRecords(more) { var user = managementStudent, epoch = managementEpoch; var j = await managementRequest('/student/' + encodeURIComponent(user) + '/records?offset=' + (more ? managementRecords.length : 0)); if (epoch !== managementEpoch || user !== managementStudent)
    return; managementRecords = more ? managementRecords.concat(j.data) : j.data; managementEl('admin-sessions').innerHTML = managementRecords.map(function (s) { return '<div class="py-3 border-b border-gray-100"><div class="flex flex-wrap justify-between gap-2"><div><span class="text-sm text-gray-500">' + escapeHtml(managementDate(s)) + '</span> <span class="font-medium text-gray-700 text-sm">' + escapeHtml(formatSubjects(s.subject)) + '</span></div><span class="font-bold text-indigo-500">' + managementMinutes(s.total_seconds) + '</span></div><p class="text-sm text-gray-500 mt-2" style="white-space:pre-wrap;overflow-wrap:anywhere">' + escapeHtml(s.memo || '') + '</p>' + (s.auto_stopped ? '<p class="text-xs text-amber-600 mt-2">' + escapeHtml(autoHistoryLabel(s)) + '</p>' : '') + sessionFactsHtml(s,true) + '<div class="flex gap-2 mt-3"><button data-management="edit" data-id="' + s.id + '" class="management-small">編集</button><button data-management="delete-record" data-id="' + s.id + '" class="management-small text-red-500">削除</button></div></div>'; }).join('') || '<p class="text-sm text-gray-400">保存済みの記録はありません。</p>'; if (j.has_more)
    managementEl('admin-sessions').insertAdjacentHTML('beforeend', '<button data-management="records-more" class="management-small mt-3">以前の記録を読む</button>'); }
async function managementLoadTimers() {
  var epoch=managementEpoch,j=await managementRequest('/timers');if(epoch!==managementEpoch)return;
  managementTimers=j.data;managementEl('management-observed').textContent='最終取得：'+sessionTime(j.observed_at,'');
  managementEl('management-timer-list').innerHTML=j.data.map(function(s){
    var pending=s.status==='finished', labels={running:'計測中',paused:'一時停止中',frozen:'計測停止・再開待ち'};
    var label=pending?(s.timeline.finish_kind==='teacher'?'先生が終了・保存待ち':s.timeline.finish_kind==='auto'?'自動停止・保存待ち':'通常終了・保存待ち'):labels[s.status];
    return '<div class="rounded-xl bg-purple-50 p-4" data-timer-id="'+s.id+'"><div class="flex flex-wrap justify-between gap-2"><button data-management="student" data-user="'+escapeHtml(s.student_user_id)+'" class="management-name">'+escapeHtml(s.display_name)+' ›</button><span class="text-sm font-bold text-purple-600">'+label+'</span></div>'+(s.status==='frozen'?'<p class="text-xs text-gray-500 mt-2">計測時間を保護しています。生徒による再開または終了の操作を待っています。</p>':'')+'<p class="text-sm font-bold text-purple-600 mt-2">'+(pending?'未保存の学習時間：':'学習時間：')+managementMinutes(s.measured_seconds)+'</p>'+sessionFactsHtml(s)+(pending&&s.waiting_seconds!=null?'<p class="text-xs text-gray-500 mt-2">保存待ちになってから '+managementMinutes(s.waiting_seconds)+'</p>':'')+'<button data-management="'+(pending?'pending-record':'finish')+'" data-id="'+s.id+'" class="management-small management-timer-action mt-3">'+(pending?'未保存記録を確認して保存':'時間を確認して終了')+'</button></div>';
  }).join('')||'<p class="text-sm text-gray-400 py-4">稼働中・未保存のタイマーはありません 🌸</p>';
  if(managementAttentionOpen)await managementAttention(false);
}
async function managementBadge() { var j=await managementRequest('/attention');managementUnreadCount=j.new_count;if(!managementAttentionOpen)managementReadAllSnapshot=j.read_through;managementEl('management-attention-read-all').disabled=managementReadAllBusy||!j.new_count;var el=managementEl('management-new-badge');el.textContent=j.new_count;el.classList.toggle('hidden',j.new_count===0);managementEl('management-attention-badge').textContent=j.new_count?'（新着 '+j.new_count+'件）':''; }
async function managementAttention(more) {
  if(!more){managementAttentionOffset=0;managementAttentionItems=[];}
  var epoch=managementEpoch,j=await managementRequest('/attention?offset='+managementAttentionOffset);if(epoch!==managementEpoch||managementTab!=='timers')return;
  managementAttentionReadThrough=j.read_through;managementReadAllSnapshot=j.read_through;managementUnreadCount=j.new_count;managementEl('management-attention-read-all').disabled=managementReadAllBusy||!j.new_count;managementAttentionOffset+=j.data.length;
  j.data.forEach(function(e){var old=managementAttentionItems.findIndex(function(x){return x.session_id===e.session_id;});if(old>=0)managementAttentionItems[old]=e;else managementAttentionItems.push(e);});
  var groups=Object.create(null);managementAttentionItems.forEach(function(e){if(!groups[e.student_user_id])groups[e.student_user_id]=[];groups[e.student_user_id].push(e);});
  managementEl('management-attention-list').innerHTML=Object.keys(groups).map(function(user){var entries=groups[user];return '<div class="rounded-xl bg-amber-50 p-4"><button data-management="attention-student" data-user="'+escapeHtml(user)+'" data-read-through="'+managementAttentionReadThrough+'" class="management-name">'+escapeHtml(entries[0].display_name)+'の詳細を見る ›</button><p class="text-xs text-amber-700 mt-1">新着 '+entries.length+'件</p>'+entries.map(function(e){var a=JSON.parse(e.after_json||'{}'),raw=e.auto_stop_seconds||a.auto_stop_seconds,sec=e.total_seconds==null?a.total_seconds:e.total_seconds;return '<p class="text-xs text-gray-600 mt-2">'+escapeHtml(e.learning_date||isoToJstDateKey(e.occurred_at))+' ｜ '+(raw==null?'原計測値は未記録':managementMinutes(raw))+' → '+managementMinutes(sec)+' ／ '+(e.subject?'保存済み':e.status?'未保存':'記録削除済み')+'</p>';}).join('')+'</div>';}).join('')||'<p class="text-sm text-gray-400">新着はありません 🌸</p>';
  managementAttentionOpen=true;managementEl('management-attention-list').classList.remove('hidden');managementEl('management-attention-more').classList.toggle('hidden',!j.has_more);managementEl('management-attention-toggle-label').textContent='閉じる';managementEl('management-attention-toggle-label').parentElement.setAttribute('aria-expanded','true');
}
async function managementReadAll(){
  if(managementReadAllBusy||!managementUnreadCount)return;
  var through=managementReadAllSnapshot;managementReadAllBusy=true;managementEl('management-attention-read-all').disabled=true;
  try{
    await managementRequest('/attention/read-all','POST',{read_through:through});
    managementAttentionItems=[];managementEl('management-attention-list').innerHTML='';
    await managementBadge();
    if(managementAttentionOpen&&managementTab==='timers'&&!managementStudent)await managementAttention(false);
    managementToast('すべて既読にしました');
  }finally{managementReadAllBusy=false;managementEl('management-attention-read-all').disabled=!managementUnreadCount;}
}
function managementCloseAttention(){managementAttentionOpen=false;managementEl('management-attention-list').classList.add('hidden');managementEl('management-attention-more').classList.add('hidden');managementEl('management-attention-toggle-label').textContent='一覧を見る';managementEl('management-attention-toggle-label').parentElement.setAttribute('aria-expanded','false');}
var managementActionLabels = { auto_stop: '自動停止', time_review: '生徒による時間修正', record_save: '生徒による保存', record_add: '学習記録追加', record_edit: '学習記録修正', record_delete: '学習記録削除', teacher_finish: '先生による終了', teacher_record: '先生による代理保存', archive: 'アーカイブ', unarchive: 'アーカイブ解除', account_delete: 'アカウント完全削除', testdate_set:'共通テスト日設定・編集',testdate_show:'共通テスト日を表示',testdate_hide:'共通テスト日を非表示',testdate_delete:'共通テスト日を削除' };
async function managementHistory(more) { if (!more)
    managementHistoryOffset = 0; var j = await managementRequest('/history?offset=' + managementHistoryOffset), el = managementEl('management-history-list'); var html = j.data.map(function (e) { var b = JSON.parse(e.before_json || '{}'), a = JSON.parse(e.after_json || '{}'); return '<div class="rounded-xl bg-gray-50 p-4"><p class="font-medium text-gray-700 text-sm">' + escapeHtml(managementActionLabels[e.action] || e.action) + ' ・ ' + escapeHtml(e.action.indexOf('testdate_')===0?'全生徒共通':e.display_name || '削除済みアカウント') + '</p><p class="text-xs text-gray-400 mt-1">' + escapeHtml(new Date(e.occurred_at).toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' })) + ' ｜ ' + escapeHtml(e.actor_name || '削除済み利用者') + '</p>' + (b.total_seconds != null || a.total_seconds != null ? '<p class="text-sm text-purple-600 mt-2">' + (b.total_seconds != null ? managementMinutes(b.total_seconds) : '追加') + ' → ' + (a.total_seconds != null ? managementMinutes(a.total_seconds) : '削除') + '</p>' : '') + '<details class="text-sm text-gray-500 mt-2"><summary>変更内容を見る</summary><p style="white-space:pre-wrap;overflow-wrap:anywhere">' + escapeHtml(managementSnapshotLabel(b) + ' → ' + managementSnapshotLabel(a)) + '</p></details>' + (e.reason ? '<p class="text-sm text-gray-500 mt-2">理由：' + escapeHtml(e.reason) + '</p>' : '') + '</div>'; }).join('') || '<p class="text-sm text-gray-400">変更履歴はありません。</p>'; if (more)
    el.insertAdjacentHTML('beforeend', html);
else
    el.innerHTML = html; managementHistoryOffset += j.data.length; managementEl('management-history-more').classList.toggle('hidden', !j.has_more); }
function managementSnapshotLabel(s) { return [s.display_message?'表示メッセージ：'+s.display_message:'',s.message_visible!=null?(s.message_visible?'メッセージ表示':'メッセージ非表示'):'',s.test_date ? 'テスト日 '+s.test_date : '',s.is_visible!=null?(s.is_visible?'表示':'非表示'):'',s.study_date || '', s.subject ? formatSubjects(s.subject) : '', s.total_seconds != null ? managementMinutes(s.total_seconds) : '', s.memo || ''].filter(Boolean).join(' ／ ') || '—'; }
function managementSubjectFields(values) { return '<div class="management-subjects">' + Object.keys(SUBJECT_LABELS_ADMIN).map(function (k) { return '<label><input type="checkbox" name="subjects" value="' + k + '" ' + (values && values.includes(k) ? 'checked' : '') + '> ' + SUBJECT_LABELS_ADMIN[k] + '</label>'; }).join('') + '</div>'; }
function managementOpenDialog(action, row) {
    managementEl('management-dialog-cancel').textContent = 'キャンセル';
    var d = managementEl('management-dialog');
    managementDialogState = { action: action, row: row, confirmed: false, requestId: crypto.randomUUID() };
    managementEl('management-dialog-error').classList.add('hidden');
    managementEl('management-dialog-submit').textContent = '確認する';
    var name = row ? (row.display_name || managementEl('admin-student-name').textContent) : managementEl('admin-student-name').textContent;
    var title = { add: '学習記録を追加', edit: '学習記録を編集', 'delete-record': '学習記録を削除', finish: 'タイマーを終了', 'pending-record': '未保存記録を保存', archive: row && row.archived_at ? 'アーカイブを解除' : 'アーカイブする', 'account-detail': 'アカウントの詳細', delete: '先生のパスワードで確認' }[action];
    managementEl('management-dialog-title').textContent = title;
    var html = '<p class="font-medium text-purple-600">' + escapeHtml(name) + '</p>';
    if(action==='pending-record') html+='<p class="text-sm text-gray-500 mt-2">記録 #'+row.id+' ／ '+escapeHtml(managementDate(row))+' ／ 未保存 '+managementMinutes(row.total_seconds)+'</p>'+sessionFactsHtml(row);
    if (['add', 'edit', 'pending-record'].includes(action)) {
        if (action !== 'pending-record')
            html += '<label>学習日</label><input class="management-input" type="date" name="study_date" required max="' + new Date(Date.now() + 9 * 3600000).toISOString().slice(0, 10) + '" value="' + (row ? managementDate(row) : new Date(Date.now() + 9 * 3600000).toISOString().slice(0, 10)) + '">';
        html += '<label>教科（複数選択できます）</label>' + managementSubjectFields(row && row.subject ? row.subject.split(',') : []) + '<label>学習時間（分）</label><input class="management-input" type="number" name="minutes" min="5" max="' + (action === 'pending-record' ? row.total_seconds / 60 : 1440) + '" step="any" required value="' + (row ? row.total_seconds / 60 : 50) + '" ' + '' + '><label>学習内容・メモ</label><textarea class="management-input" name="memo" maxlength="500" rows="3" required>' + escapeHtml(row && row.memo || '') + '</textarea><label>操作理由' + (action === 'pending-record' ? '（必須）' : '（任意）') + '</label><input class="management-input" name="reason" maxlength="500" ' + (action === 'pending-record' ? 'required' : '') + '>';
    }
    if (action === 'delete-record')
        html += '<p class="text-sm text-gray-500 mt-3">' + escapeHtml(managementDate(row) + ' ／ ' + formatSubjects(row.subject) + ' ／ ' + managementMinutes(row.total_seconds)) + '</p><label>削除理由</label><input class="management-input" name="reason" maxlength="500" required>';
    if (action === 'finish')
        html += '<p class="text-sm text-gray-500 mt-3">現在の計測値：' + managementMinutes(row.measured_seconds) + '。止め忘れた時間を含めず、実際の時間を確認してください。終了だけでは学習記録は保存されません。</p><label>保全する学習時間（分）</label><input class="management-input" name="minutes" type="number" step="any" min="' + (row.total_seconds / 60) + '" max="' + (row.measured_seconds / 60) + '" value="' + (row.measured_seconds / 60) + '" required><label>終了理由</label><input class="management-input" name="reason" maxlength="500" required>';
    if (action === 'archive')
        html += '<p class="text-sm text-gray-600 mt-3">' + (row.archived_at ? '以前のアカウントと記録で利用を再開できます。' : 'この生徒をアーカイブしますか？稼働中・未保存がある場合は先に処理してください。アーカイブ中はログインできません。') + '</p>';
    if (action === 'account-detail') {
        html += '<p class="text-sm text-gray-500 mt-3">' + escapeHtml(row.user_id) + ' ／ ' + (row.archived_at ? 'アーカイブ中' : '利用中') + '</p><details class="mt-4"><summary class="text-sm text-gray-500">詳細設定</summary><p class="text-sm text-red-500 mt-3">完全削除するとアカウント、学習・未保存記録、ログイン履歴、先生コメント、変更履歴に含まれる個人情報が削除され、元に戻せません。先にアーカイブしてください。</p><button type="button" data-management="delete-account" data-user="' + escapeHtml(row.user_id) + '" class="management-small text-red-500 mt-3">完全削除の確認へ</button></details>';
        managementEl('management-dialog-submit').classList.add('hidden');
    }
    else
        managementEl('management-dialog-submit').classList.remove('hidden');
    if (action === 'delete')
        html += '<p class="text-sm text-red-500 mt-3">完全削除は復旧できません。先生自身のログインパスワードで再認証します。</p><label>先生のログインパスワード</label><input class="management-input" type="password" name="password" autocomplete="current-password" required>';
    managementEl('management-dialog-body').innerHTML = html;
    if (!d.open)
        d.showModal();
}
async function managementSubmit(e) {
    e.preventDefault();
    if (managementBusy)
        return;
    var st = managementDialogState, f = new FormData(managementEl('management-form')), row = st.row, b = { request_id: st.requestId, revision: row && row.revision, subjects: f.getAll('subjects'), study_date: f.get('study_date'), total_seconds: Math.round(Number(f.get('minutes')) * 60), memo: f.get('memo'), reason: f.get('reason') || '' };
    var err = managementEl('management-dialog-error');
    err.classList.add('hidden');
    if (!st.confirmed && st.action !== 'delete') {
        if (['add', 'edit', 'pending-record'].includes(st.action) && !b.subjects.length) {
            err.textContent = '教科を1つ以上選択してください';
            err.classList.remove('hidden');
            return;
        }
        st.body = b;
        st.confirmed = true;
        managementEl('management-dialog-body').innerHTML = '<p class="font-bold text-gray-700">' + escapeHtml(managementEl('management-dialog-title').textContent) + 'しますか？</p><p class="text-sm text-gray-500 mt-3">対象：' + escapeHtml(row && row.display_name || managementEl('admin-student-name').textContent) + '</p><p class="text-sm text-purple-600 mt-3" style="white-space:pre-wrap">' + escapeHtml(managementSnapshotLabel(b)) + '</p>' + (row && st.action === 'edit' ? '<p class="text-sm text-gray-500 mt-2">変更前：' + escapeHtml(managementSnapshotLabel(row)) + '</p>' : '') + (st.action === 'delete-record' ? '<p class="text-sm text-red-500 mt-3">' + escapeHtml(managementDate(row) + ' ／ ' + formatSubjects(row.subject) + ' ／ ' + managementMinutes(row.total_seconds)) + 'を削除します。</p>' : '');
        managementEl('management-dialog-submit').textContent = st.action === 'archive' ? 'はい、確定する' : '確定する';
        managementEl('management-dialog-cancel').textContent = 'いいえ';
        return;
    }
    managementBusy = true;
    managementEl('management-dialog-submit').disabled = true;
    managementEl('management-dialog-cancel').disabled = true;
    try {
        var result;
        if (st.action === 'delete') {
            var j = await managementRequest('/accounts/' + encodeURIComponent(row.user_id) + '/delete-check', 'POST', { password: f.get('password') });
            st.action = 'delete-confirm';
            st.token = j.token;
            st.confirmed = true;
            managementEl('management-dialog-body').innerHTML = '<p class="font-bold text-red-500">本当にこの生徒のアカウントを削除しますか？</p><p class="text-sm text-gray-700 mt-3">' + escapeHtml(row.display_name + '（' + row.user_id + '）') + '</p><p class="text-sm text-gray-500 mt-3">アカウント、全学習記録、未保存記録、ログイン履歴、先生コメント、履歴内の個人情報が削除されます。復旧できません。</p>';
            managementEl('management-dialog-submit').textContent = '完全削除する';
            return;
        }
        b = st.body || b;
        if (st.action === 'add')
            result = await managementRequest('/student/' + encodeURIComponent(managementStudent) + '/records', 'POST', b);
        if (st.action === 'edit')
            result = await managementRequest('/records/' + row.id, 'PATCH', b);
        if (st.action === 'delete-record')
            result = await managementRequest('/records/' + row.id, 'DELETE', b);
        if (st.action === 'finish')
            result = await managementRequest('/timers/' + row.id + '/finish', 'POST', b);
        if (st.action === 'pending-record')
            result = await managementRequest('/timers/' + row.id + '/record', 'POST', b);
        if (st.action === 'archive')
            result = await managementRequest('/accounts/' + encodeURIComponent(row.user_id) + '/archive', 'POST', { archived: !row.archived_at, revision: row.management_revision });
        if (st.action === 'delete-confirm')
            result = await managementRequest('/accounts/' + encodeURIComponent(row.user_id), 'DELETE', { token: st.token, revision: row.management_revision });
        if (!result)
            throw new Error('操作を確認できませんでした');
        managementEl('management-dialog').close();
        managementToast(result.message || '操作が完了しました');
        await refreshManagement();
    }
    catch (ex) {
        err.textContent = ex.message;
        err.classList.remove('hidden');
    }
    finally {
        managementBusy = false;
        managementEl('management-dialog-submit').disabled = false;
        managementEl('management-dialog-cancel').disabled = false;
    }
}
document.addEventListener('click', async function (e) { var btn = e.target.closest('[data-management]'); if (!btn)
    return; try {
    var action = btn.dataset.management;
    if (action === 'tab') {
        managementStudent = null;
        await managementSwitch(btn.dataset.tab);
    }
    else if(action.indexOf('testdate-')===0)
        openTestdateDialog(action);
    else if(action==='attention-student')
        await openManagementStudent(btn.dataset.user,Number(btn.dataset.readThrough));
    else if (action === 'student')
        await openManagementStudent(btn.dataset.user);
    else if (action === 'back') {
        managementStudent = null;
        await managementSwitch('students');
    }
    else if (action === 'month') {
        var d = new Date(managementEl('management-month').value + '-01T00:00:00Z');
        d.setUTCMonth(d.getUTCMonth() + Number(btn.dataset.delta));
        managementEl('management-month').value = d.toISOString().slice(0, 7);
        await managementStudents(false);
    }
    else if(action==='attention-read-all')
        await managementReadAll();
    else if (action === 'attention')
        managementAttentionOpen ? managementCloseAttention() : await managementAttention(false);
    else if (action === 'attention-more')
        await managementAttention(true);
    else if (action === 'history-more')
        await managementHistory(true);
    else if (action === 'records-more')
        await managementLoadRecords(true);
    else if (action === 'add')
        managementOpenDialog(action, null);
    else if (['edit', 'delete-record'].includes(action))
        managementOpenDialog(action, managementRecords.find(function (r) { return r.id === Number(btn.dataset.id); }));
    else if (['finish', 'pending-record'].includes(action))
        managementOpenDialog(action, managementTimers.find(function (r) { return r.id === Number(btn.dataset.id); }));
    else if (['archive', 'account-detail', 'delete-account'].includes(action))
        managementOpenDialog(action === 'delete-account' ? 'delete' : action, managementAccounts.find(function (r) { return r.user_id === btn.dataset.user; }));
}
catch (ex) {
    managementError(ex);
} });
managementEl('management-month').addEventListener('change', function () { managementStudents(false).catch(managementError); });
managementEl('management-archived').addEventListener('change', function () { managementStudents(true).catch(managementError); });
managementEl('management-form').addEventListener('submit', managementSubmit);
managementEl('management-dialog-cancel').addEventListener('click', function () { if (!managementBusy) {
    managementEl('management-dialog').close();
    managementEl('management-dialog-cancel').textContent = 'キャンセル';
} });
managementEl('management-dialog').addEventListener('cancel', function (e) { if (managementBusy)
    e.preventDefault(); });
`
