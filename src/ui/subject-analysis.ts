const periodControls = (id: string) => `<div class="flex flex-wrap gap-2 items-center mt-4" data-analysis-controls="${id}"><button type="button" data-subject-period="current" data-analysis-owner="${id}" class="analysis-period">今月</button><button type="button" data-subject-period="previous" data-analysis-owner="${id}" class="analysis-period">先月</button><label class="text-xs text-gray-500" for="${id}-month">年月</label><input id="${id}-month" type="month" aria-label="${id === 'teacher-subject' ? '先生の分析' : '自分の分析'}の年月" class="analysis-month"><button type="button" data-subject-period="all" data-analysis-owner="${id}" class="analysis-period">累計</button></div>`;
export const studentSubjectPanel = `<div id="subject-stats-card" class="hidden mb-5"><div class="bg-white rounded-2xl shadow-sm p-4 sm:p-5"><h2 class="font-bold text-gray-700">📊 教科別の学習時間</h2><p class="text-xs text-gray-500 mt-1">自分の勉強を、教科ごとに振り返ろう</p>${periodControls('student-subject')}<div id="subject-stats-list" class="mt-4"></div></div></div>`;
export const teacherSubjectPanel = `<section id="management-subjects" class="management-panel hidden space-y-4"><div class="bg-white rounded-2xl shadow-sm p-4 sm:p-5"><h2 class="font-bold text-gray-700">📊 教科別学習</h2><p class="text-xs text-gray-500 mt-1">生徒ごとの学習時間と、教科の割合を確認できます。</p>${periodControls('teacher-subject')}<label class="text-xs text-gray-500 flex items-center gap-2 mt-3"><input id="subject-include-archived" type="checkbox"> アーカイブ済みも含める</label><div id="teacher-subject-legend" class="mt-4"></div></div><div id="teacher-subject-result" class="space-y-3"></div></section>`;
export const analysisStyles = String.raw`
.analysis-period{border:1px solid #ddd6fe;border-radius:12px;padding:9px 12px;min-height:44px;background:#fff;color:#7c6b9b;font-size:13px;font-weight:600}
.analysis-period[aria-pressed=true]{background:#ede9fe;color:#6b21a8;border-color:#c4b5fd}
.analysis-month{border:1px solid #e5e7eb;border-radius:12px;min-height:44px;max-width:160px;padding:8px;background:#fff;color:#6b7280;font:inherit;font-size:14px}
.subject-chart{display:flex;width:100%;height:22px;overflow:hidden;border-radius:999px;background:#f3f4f6;margin-top:12px}
.subject-chart>span{display:block;height:100%;flex-shrink:0}.subject-legend{display:flex;flex-wrap:wrap;gap:8px 14px;font-size:12px;color:#6b7280}
.subject-dot{display:inline-block;width:10px;height:10px;border-radius:4px;margin-right:5px}
.subject-values{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px 16px;margin-top:14px}.subject-value{min-width:0;display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:4px;font-size:12px;color:#6b7280}.subject-value strong{color:#6b5e9e;font-weight:700}
#subject-stats-list .subject-values{grid-template-columns:1fr;gap:10px;margin-top:16px}
#subject-stats-list .subject-value{display:grid;grid-template-columns:auto minmax(0,1fr);gap:8px;align-items:center;font-size:13px}
#subject-stats-list .subject-value>span:first-child{white-space:nowrap}
#subject-stats-list .subject-value>span:last-child{display:flex;justify-content:flex-end;align-items:baseline;gap:8px;white-space:nowrap}
#subject-stats-list .subject-value>span:last-child>span{min-width:3.8em;text-align:right}
.subject-learning-hint{background:#fdf2f8;border-radius:12px;padding:12px;margin-top:16px;font-size:12px;color:#8b5e83;line-height:1.8}
@media(min-width:640px){.subject-values{grid-template-columns:repeat(3,minmax(0,1fr))}}
`;
export const analysisScript = String.raw`
var SUBJECT_ANALYSIS_COLORS={japanese:'#f472b6',social:'#fb923c',math:'#a78bfa',science:'#34d399',english:'#60a5fa',other:'#94a3b8'};
var SUBJECT_ANALYSIS_ORDER=['japanese','social','math','science','english','other'];
var subjectAnalysisPeriods={'student-subject':null,'teacher-subject':null},subjectAnalysisEpoch={'student-subject':0,'teacher-subject':0},teacherSubjectFocus=null;
function subjectCurrentMonth(){return new Date(Date.now()+9*3600000).toISOString().slice(0,7)}
function subjectPreviousMonth(){var d=new Date(subjectCurrentMonth()+'-01T00:00:00Z');d.setUTCMonth(d.getUTCMonth()-1);return d.toISOString().slice(0,7)}
function subjectPeriodInit(id){var input=document.getElementById(id+'-month'),month=subjectAnalysisPeriods[id]||subjectCurrentMonth();subjectAnalysisPeriods[id]=month;input.max=subjectCurrentMonth();input.value=month==='all'?subjectCurrentMonth():month;subjectPeriodButtons(id);}
function subjectPeriodButtons(id){var period=subjectAnalysisPeriods[id];document.querySelectorAll('[data-analysis-owner="'+id+'"]').forEach(function(b){var target=b.dataset.subjectPeriod==='all'?'all':b.dataset.subjectPeriod==='previous'?subjectPreviousMonth():subjectCurrentMonth();b.setAttribute('aria-pressed',String(period===target))});}
function subjectPeriodLabel(month){return month==='all'?'これまでの累計':month.replace('-','年')+'月';}
function subjectLegend(){return'<div class="subject-legend">'+SUBJECT_ANALYSIS_ORDER.map(function(c){return'<span><i class="subject-dot" style="background:'+SUBJECT_ANALYSIS_COLORS[c]+'"></i>'+ALLOCATION_LABELS[c]+'</span>'}).join('')+'</div>';}
function subjectLearningHint(data){
 var general='少しずつの積み重ねが力になるよ。自分のペースで勉強を続けよう 🌸';
 var rows=SUBJECT_ANALYSIS_ORDER.filter(function(c){return c!=='other'}).map(function(c){return{code:c,seconds:Math.max(0,Number(data.subjects[c])||0)}}),sum=rows.reduce(function(n,r){return n+r.seconds},0);
 if(sum<300)return general;
 rows.sort(function(a,b){return b.seconds-a.seconds});var active=rows.filter(function(r){return r.seconds>0}),top=active.slice(0,2).map(function(r){return ALLOCATION_LABELS[r.code]}).join('と'),max=rows[0].seconds,min=rows[rows.length-1].seconds;
 if(min===max)return 'いろいろな教科をバランスよく頑張っているね！ この調子で続けよう 🌸';
 var low=SUBJECT_ANALYSIS_ORDER.find(function(c){return c!=='other'&&Math.max(0,Number(data.subjects[c])||0)===min});
 return top+'を頑張っているね！ '+ALLOCATION_LABELS[low]+'にも少し時間を使ってみよう 🌸';
}
function subjectChart(data,detail,student){var total=data.total_seconds||0;var description=SUBJECT_ANALYSIS_ORDER.map(function(c){return ALLOCATION_LABELS[c]+' '+allocationTime(data.subjects[c])}).join('、');var html='<div class="subject-chart" role="img" aria-label="'+escapeHtml(total?description:'この期間の学習時間は0分です')+'">';
 if(total){SUBJECT_ANALYSIS_ORDER.forEach(function(c){var sec=data.subjects[c]||0;if(sec)html+='<span title="'+ALLOCATION_LABELS[c]+' '+allocationTime(sec)+'" style="width:'+Math.max(0,Math.min(100,sec/total*100))+'%;background:'+SUBJECT_ANALYSIS_COLORS[c]+'"></span>'});if(data.legacy_rounding_seconds>0)html+='<span title="'+(student?'学習時間':'従来記録の秒端数')+'" style="background:#d1d5db;width:'+(data.legacy_rounding_seconds/total*100)+'%"></span>';}
 html+='</div>';if(!total)html+='<p class="text-xs text-gray-400 mt-2">この期間の学習記録はありません</p>';
 html+='<div class="subject-values">'+SUBJECT_ANALYSIS_ORDER.map(function(c){var sec=data.subjects[c]||0,p=total?sec/total*100:0;return'<div class="subject-value"><span><i class="subject-dot" style="background:'+SUBJECT_ANALYSIS_COLORS[c]+'"></i>'+ALLOCATION_LABELS[c]+'</span><span><strong>'+allocationTime(sec)+'</strong> <span class="text-gray-400">'+p.toFixed(1)+'%</span></span></div>'}).join('')+'</div>';
 if(detail&&!student)html+='<p class="text-xs text-gray-400 mt-4">時間を指定した記録：'+data.exact_record_count+'件 ／ 従来の均等配分：'+data.legacy_record_count+'件</p>';
 if(!student&&data.legacy_rounding_seconds>0)html+='<p class="text-xs text-gray-400 mt-2">従来の均等配分には、合計'+data.legacy_rounding_seconds+'秒の端数があります。過去の配分は変更していません。</p>';
 if(student)html+='<div class="subject-learning-hint"><p class="font-bold">🌸 学習のヒント</p><p data-learning-hint>'+escapeHtml(subjectLearningHint(data))+'</p></div>';
 return html;
}
async function loadStudentSubjectAnalysis(){var id='student-subject',epoch=++subjectAnalysisEpoch[id],owner=currentUser&&currentUser.user_id;subjectPeriodInit(id);var month=subjectAnalysisPeriods[id],el=document.getElementById('subject-stats-list');document.getElementById('subject-stats-card').classList.remove('hidden');el.innerHTML='<p class="text-sm text-gray-400">読み込み中…</p>';
 try{var r=await fetch('/api/stats/subject-analysis?month='+encodeURIComponent(month),{credentials:'include'}),j=await r.json();if(epoch!==subjectAnalysisEpoch[id]||!currentUser||owner!==currentUser.user_id)return;if(!r.ok||!j.success)throw new Error(j.error||'集計を読み込めませんでした');el.innerHTML='<div class="flex flex-wrap justify-between items-center gap-2"><span class="text-sm text-gray-500">'+subjectPeriodLabel(month)+'</span><strong class="text-purple-600">'+allocationTime(j.data.total_seconds)+'</strong></div>'+subjectChart(j.data,true,true);
 }catch(e){if(epoch===subjectAnalysisEpoch[id])el.innerHTML='<p role="alert" class="text-sm text-red-500">'+escapeHtml(e.message||'通信できませんでした。もう一度期間を選んでください。')+'</p>';}
}
async function loadTeacherSubjectAnalysis(){var id='teacher-subject';subjectPeriodInit(id);var epoch=++subjectAnalysisEpoch[id],managementAt=managementEpoch,month=subjectAnalysisPeriods[id],focus=teacherSubjectFocus,el=document.getElementById('teacher-subject-result');document.getElementById('teacher-subject-legend').innerHTML=subjectLegend();el.innerHTML='<div class="bg-white rounded-2xl p-5 text-sm text-gray-400">読み込み中…</div>';
 var path='/subject-analysis'+(focus?'/'+encodeURIComponent(focus):'')+'?month='+encodeURIComponent(month)+'&include_archived='+(document.getElementById('subject-include-archived').checked?'1':'0');
 try{var j=await managementRequest(path);if(epoch!==subjectAnalysisEpoch[id]||managementAt!==managementEpoch||managementTab!=='subjects')return;
 if(focus){var d=j.data;el.innerHTML='<button type="button" data-management="subject-analysis-back" class="management-small">‹ 教科別学習の一覧へ</button><div class="bg-white rounded-2xl shadow-sm p-4 sm:p-5"><h3 class="font-bold text-purple-600">'+escapeHtml(d.display_name)+'さんの教科別学習</h3><div class="flex flex-wrap justify-between gap-2 mt-3"><span class="text-sm text-gray-500">'+subjectPeriodLabel(month)+(d.archived?' ／ アーカイブ済み':'')+'</span><strong class="text-purple-600">'+allocationTime(d.total_seconds)+'</strong></div>'+subjectChart(d,true)+'<button type="button" class="management-small mt-4" data-management="student" data-user="'+escapeHtml(d.student_user_id)+'">学習記録を見る</button></div>';
 }else{el.innerHTML='<p class="text-xs text-gray-500 px-1">'+subjectPeriodLabel(month)+' ／ '+j.data.length+'人（学習時間が多い順）</p>'+j.data.map(function(d){return'<div class="bg-white rounded-2xl shadow-sm p-4 sm:p-5"><div class="flex flex-wrap justify-between gap-2"><button type="button" class="management-name" data-management="subject-analysis-detail" data-user="'+escapeHtml(d.student_user_id)+'">'+escapeHtml(d.display_name)+' ›</button><strong class="text-purple-600">'+allocationTime(d.total_seconds)+'</strong></div>'+(d.archived?'<p class="text-xs text-gray-400">アーカイブ済み</p>':'')+subjectChart(d,false)+'</div>'}).join('');if(!j.data.length)el.innerHTML+='<div class="bg-white rounded-2xl p-5 text-sm text-gray-400">対象の生徒はいません</div>';}
 }catch(e){if(epoch===subjectAnalysisEpoch[id]&&managementAt===managementEpoch)el.innerHTML='<p role="alert" class="bg-red-50 rounded-xl p-4 text-sm text-red-500">'+escapeHtml(e.message)+'</p>';}
}
async function subjectPeriodChange(id,value){subjectAnalysisPeriods[id]=value;subjectPeriodButtons(id);if(id==='student-subject')await loadStudentSubjectAnalysis();else await loadTeacherSubjectAnalysis();}
document.addEventListener('click',function(e){var b=e.target.closest('[data-subject-period]');if(!b)return;var mode=b.dataset.subjectPeriod,value=mode==='all'?'all':mode==='previous'?subjectPreviousMonth():subjectCurrentMonth();subjectPeriodChange(b.dataset.analysisOwner,value);});
document.addEventListener('change',function(e){if(e.target.id==='student-subject-month'||e.target.id==='teacher-subject-month')subjectPeriodChange(e.target.id.replace('-month',''),e.target.value);if(e.target.id==='subject-include-archived')loadTeacherSubjectAnalysis();});
`;
