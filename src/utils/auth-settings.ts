import type { Bindings } from '../types'

// 保護されたサーバー設定だけを使う。未設定時の固定値・架空値への代替はしない。
function configuredValue(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim().length > 0 ? value : undefined
}

export function registrationPasswordMatches(env: Bindings, supplied: unknown): boolean {
  const expected = configuredValue(env.REGISTRATION_PASSWORD)
  return expected !== undefined && typeof supplied === 'string' && supplied === expected
}

export function isTeacherUser(env: Bindings, userId: string): boolean {
  const expected = configuredValue(env.TEACHER_USER_ID)
  return expected !== undefined && userId === expected
}
