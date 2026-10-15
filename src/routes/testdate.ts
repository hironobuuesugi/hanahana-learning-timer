import { Hono } from 'hono'
import { authMiddleware } from '../middleware/auth'
import { isTeacherUser } from '../utils/auth-settings'
import type { Bindings, Variables } from '../types'
const testdate = new Hono<{ Bindings: Bindings; Variables: Variables }>()
testdate.use('*', authMiddleware)
testdate.get('/', async c => {
  c.header('Cache-Control','no-store')
  const row=await c.env.DB.prepare('SELECT test_date,is_visible,display_message,message_visible FROM shared_test_date WHERE id=1').first<{test_date:string|null;is_visible:number;display_message:string;message_visible:number}>()
  const visible=!!row?.is_visible&&!isTeacherUser(c.env,c.get('userInfo').user_id)
  return c.json({success:true,managed:true,test_date:visible?row?.test_date??null:null,display_message:visible&&row?.message_visible?row.display_message:''})
})
for(const method of ['post','put','patch','delete'] as const) testdate[method]('/', c => c.json({success:false,error:'テスト日は先生が共通設定します。生徒による変更はできません。'},403))
export default testdate
