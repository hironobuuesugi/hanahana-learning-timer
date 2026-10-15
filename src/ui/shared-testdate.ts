export const sharedTestdateDialog = String.raw`
<dialog id="shared-testdate-dialog" class="management-dialog" aria-labelledby="shared-testdate-title"><form id="shared-testdate-form">
<div class="bg-gradient-to-r from-pink-400 to-purple-400 text-white px-5 py-4"><h2 id="shared-testdate-title" class="font-bold text-lg">共通テスト日</h2></div>
<div class="p-5 space-y-4"><div id="shared-testdate-body"></div><p id="shared-testdate-error" role="alert" class="hidden text-red-500 text-sm"></p>
<div class="flex gap-3"><button id="shared-testdate-cancel" type="button" class="management-small flex-1">キャンセル</button><button id="shared-testdate-submit" type="submit" class="management-primary flex-1">確認する</button></div></div></form></dialog>`;
export const sharedTestdateScript = String.raw`
async function managementLoadTestdate(){
  var epoch=managementEpoch,j=await managementRequest('/testdate');if(epoch!==managementEpoch)return;
  managementTestdate=j.data;managementTestdateCount=j.eligible_count;var s=j.data;
  managementEl('management-testdate-summary').innerHTML='<p class="font-bold text-purple-600">'+(s.test_date?escapeHtml(s.test_date)+' ・ '+(s.is_visible?'表示中':'非表示中'):'日付は未設定です')+'</p><p class="mt-2">対象：'+j.eligible_count+'人（先生・アーカイブ済みを除く）</p><p class="mt-2" style="white-space:pre-wrap;overflow-wrap:anywhere">表示メッセージ：'+escapeHtml(s.display_message||'未設定')+(s.display_message?(s.message_visible?'（表示）':'（非表示）'):'')+'</p>';
  managementEl('management-testdate-edit').textContent=s.test_date?'日付を編集':'日付設定';
  managementEl('management-testdate-visibility').textContent=s.is_visible?'非表示にする':'表示にする';
  managementEl('management-testdate-visibility').disabled=!s.test_date;
  managementEl('management-testdate-delete').disabled=!s.test_date;
}
function openTestdateDialog(action){
  if(!managementTestdate)return;
  var s=managementTestdate;testdateDialogState={action:action,confirmed:false,busy:false,body:{revision:s.revision,test_date:s.test_date,visible:!!s.is_visible,display_message:s.display_message||'',message_visible:!!s.message_visible}};
  managementEl('shared-testdate-error').classList.add('hidden');managementEl('shared-testdate-submit').textContent='確認する';
  managementEl('shared-testdate-title').textContent=action==='testdate-edit'?(s.test_date?'共通テスト日を編集':'共通テスト日を設定'):action==='testdate-delete'?'共通テスト日を削除':s.is_visible?'共通テスト日を非表示':'共通テスト日を表示';
  managementEl('shared-testdate-body').innerHTML=action==='testdate-edit'?'<label for="shared-testdate-date">テスト日</label><input id="shared-testdate-date" name="test_date" type="date" class="management-input" required value="'+escapeHtml(s.test_date||'')+'"><label><input name="visible" type="checkbox" '+(!s.test_date||s.is_visible?'checked':'')+'> 生徒のホームに表示する</label><label for="shared-testdate-message">表示メッセージ（任意・120文字以内）</label><textarea id="shared-testdate-message" name="display_message" class="management-input" maxlength="120" rows="3" placeholder="例：2学期期末テスト">'+escapeHtml(s.display_message||'')+'</textarea><label><input name="message_visible" type="checkbox" '+(s.message_visible?'checked':'')+'> メッセージを表示する</label>':'<p class="text-sm text-gray-600">'+escapeHtml(s.test_date||'')+'</p><p class="text-sm text-gray-500 mt-3">'+(action==='testdate-delete'?'日付と表示メッセージの設定を解除し、カウントダウンも表示しません。':s.is_visible?'日付を保持したまま、テスト日とカウントダウンを非表示にします。':'保持している日付とカウントダウンを再表示します。')+'</p>';
  managementEl('shared-testdate-dialog').showModal();
}
managementEl('shared-testdate-form').addEventListener('submit',async function(e){
  e.preventDefault();var st=testdateDialogState;if(!st||st.busy)return;
  if(!st.confirmed){
    if(st.action==='testdate-edit'){var f=new FormData(e.target);st.body.test_date=f.get('test_date');st.body.visible=f.has('visible');st.body.display_message=String(f.get('display_message')||'');st.body.message_visible=f.has('message_visible');}
    else if(st.action==='testdate-visibility')st.body.visible=!st.body.visible;
    else {st.body.test_date=null;st.body.visible=false;}
    managementEl('shared-testdate-body').innerHTML='<p class="font-bold text-purple-600">'+(st.body.test_date?escapeHtml(st.body.test_date)+' ／ '+(st.body.visible?'表示':'非表示'):'日付設定を削除')+'</p>'+((st.action==='testdate-edit'&&st.body.display_message)?'<p class="text-sm text-gray-600 mt-3" style="white-space:pre-wrap;overflow-wrap:anywhere">表示メッセージ：'+escapeHtml(st.body.display_message)+(st.body.message_visible?'（表示）':'（非表示）')+'</p>':'')+'<p class="text-sm text-gray-600 mt-3">対象の生徒 '+managementTestdateCount+'人の表示を変更します。</p><p class="text-sm text-gray-500 mt-2">以前の個別設定は再表示されません。</p>';
    st.confirmed=true;managementEl('shared-testdate-submit').textContent=st.action==='testdate-delete'?'削除する':'変更を確定';return;
  }
  st.busy=true;managementEl('shared-testdate-submit').disabled=true;managementEl('shared-testdate-cancel').disabled=true;
  try{var r=await managementRequest('/testdate',st.action==='testdate-delete'?'DELETE':st.action==='testdate-edit'?'POST':'PATCH',st.body);managementEl('shared-testdate-dialog').close();managementToast(r.message);await managementLoadTestdate();}
  catch(ex){managementEl('shared-testdate-error').textContent=ex.message;managementEl('shared-testdate-error').classList.remove('hidden');}
  finally{st.busy=false;managementEl('shared-testdate-submit').disabled=false;managementEl('shared-testdate-cancel').disabled=false;}
});
managementEl('shared-testdate-cancel').addEventListener('click',function(){if(!testdateDialogState?.busy)managementEl('shared-testdate-dialog').close();});
managementEl('shared-testdate-dialog').addEventListener('cancel',function(e){if(testdateDialogState?.busy)e.preventDefault();});
`;
