// 本人・先生で同じ事実、同じJST/24時間表記を使う。
export const sessionDetailsScript = String.raw`
function sessionTime(value, day) {
  if (!value) return '記録なし';
  var normalized = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(value) ? value.replace(' ', 'T') + 'Z' : value;
  var ms = Date.parse(normalized);
  if (!Number.isFinite(ms)) return '記録なし';
  var jst = new Date(ms + 9*3600000), key = jst.toISOString().slice(0,10);
  var time = String(jst.getUTCHours()).padStart(2,'0') + ':' + String(jst.getUTCMinutes()).padStart(2,'0');
  return key === day ? time : key.replace(/-/g,'/') + ' ' + time;
}
function sessionPauseLabel(t) {
  if (t.manual) return '手動追加';
  if (t.pause_count == null) return '記録なし';
  var seconds = t.pause_seconds || 0;
  return t.pause_count + '回・合計' + (seconds>0 && seconds<60 ? '1分未満' : Math.floor(seconds/60)+'分');
}
function sessionFactsHtml(row, collapsible) {
  var t = row.timeline;
  if (!t) return '';
  var day = row.study_date || isoToJstDateKey(row.original_started_at || row.started_at);
  var start=t.manual?'手動追加':sessionTime(t.started_at,day);
  var count=t.manual?'手動追加':t.pause_count==null?'記録なし':t.pause_count+'回';
  var seconds=t.pause_seconds||0;
  var duration=t.manual?'手動追加':t.pause_count==null?'記録なし':'合計'+(seconds>0&&seconds<60?'1分未満':Math.floor(seconds/60)+'分');
  var end=t.manual?'手動追加':row.status!=='finished'?'未終了':sessionTime(t.finished_at,day);
  var save=row.subject?sessionTime(t.saved_at,day):'未保存';
  var facts='<div class="session-facts rounded-xl bg-purple-50 p-3 text-xs text-gray-500 space-y-1">'
    +'<p>開始：'+escapeHtml(start)+'</p>'
    +'<p class="session-facts-pair"><span>一時停止：'+escapeHtml(count)+'</span><span>／ 一時停止時間：'+escapeHtml(duration)+'</span></p>';
  if(row.status==='paused')facts+='<p>一時停止開始：'+escapeHtml(sessionTime(t.paused_at,day))+'</p>';
  if(row.status==='frozen')facts+='<p>計測停止：'+escapeHtml(sessionTime(t.stopped_at,day))+'</p>';
  facts+='<p class="session-facts-pair"><span>タイマー終了：'+escapeHtml(end)+'</span><span>／ 記録保存：'+escapeHtml(save)+'</span></p></div>';
  if(!collapsible)return '<div class="mt-3">'+facts+'</div>';
  return '<details class="session-details mt-3"><summary class="text-xs font-medium text-purple-500 cursor-pointer py-2"><span class="session-details-closed">詳細を見る</span><span class="session-details-open">詳細を閉じる</span></summary>'+facts+'</details>';
}
`;
