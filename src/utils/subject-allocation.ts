import { SUBJECT_CODES, jstToday, validDate } from './study-management';

export type SubjectAllocation = { subject: string; seconds: number };
export type AllocationRecord = { subject: string | null; total_seconds: number; allocation_version?: number; subject_allocations?: string | null };
export type StoredAllocation = { allocation_version: number; subject_allocations: string | null };
export const allocationError = '教科ごとに1分以上を割り当て、合計を学習時間に合わせてください。最後の教科は残り時間になります。';

// 指定は分単位、最後の教科だけ秒の端数をすべて受け持つ。1教科は操作不要。
export function validateAllocation(selected: unknown, total: number, input: unknown): SubjectAllocation[] | null {
  if (!Number.isSafeInteger(total) || !Array.isArray(selected) || selected.length < 1 || selected.length > SUBJECT_CODES.length ||
      new Set(selected).size !== selected.length || selected.some(s => typeof s !== 'string' || !SUBJECT_CODES.includes(s)) || total < selected.length * 60) return null;
  if (input === undefined && selected.length === 1) return [{ subject: selected[0], seconds: total }];
  if (!Array.isArray(input) || input.length !== selected.length) return null;
  const result: SubjectAllocation[] = [];
  let sum = 0;
  for (let i = 0; i < input.length; i++) {
    const a = input[i];
    if (!a || typeof a !== 'object' || a.subject !== selected[i] || !Number.isSafeInteger(a.seconds) || a.seconds < 60 || (i < input.length - 1 && a.seconds % 60 !== 0)) return null;
    sum += a.seconds;
    if (!Number.isSafeInteger(sum) || sum > total - (input.length - i - 1) * 60) return null;
    result.push({ subject: a.subject, seconds: a.seconds });
  }
  return sum === total ? result : null;
}
export function saveAllocation(selected: unknown, total: number, input: unknown, previous?: AllocationRecord): StoredAllocation | null {
  const subject = Array.isArray(selected) ? selected.join(',') : '';
  if (previous && input === undefined && subject === previous.subject && total === previous.total_seconds && Array.isArray(selected) && new Set(selected).size === selected.length) {
    // 日付・内容だけの編集では、従来の配分を新方式へ変換しない。
    return { allocation_version: previous.allocation_version ?? 0, subject_allocations: previous.subject_allocations ?? null };
  }
  const allocation = validateAllocation(selected, total, input);
  return allocation ? { allocation_version: 1, subject_allocations: JSON.stringify(allocation) } : null;
}
export function storedAllocation(row: AllocationRecord): SubjectAllocation[] | null {
  if (row.allocation_version !== 1) return null;
  const parsed = JSON.parse(row.subject_allocations ?? 'null');
  const checked = validateAllocation(row.subject?.split(','), row.total_seconds, parsed);
  if (!checked) throw new Error('保存済みの教科配分を確認できません');
  return checked;
}
export function analysisMonth(value: string | undefined): string | null {
  const month = value ?? jstToday().slice(0, 7);
  return month === 'all' || (validDate(month + '-01') && month <= jstToday().slice(0, 7)) ? month : null;
}
export const studyDaySQL = "COALESCE(ss.study_date,date(COALESCE(ss.original_started_at,ss.started_at),'+9 hours'))";
export function summarizeSubjects(rows: AllocationRecord[]) {
  const exact: Record<string, number> = Object.fromEntries(SUBJECT_CODES.map(k => [k, 0]));
  const legacy: Record<string, number> = Object.fromEntries(SUBJECT_CODES.map(k => [k, 0]));
  let total = 0, exactCount = 0, legacyCount = 0;
  for (const row of rows) {
    total += row.total_seconds;
    const allocation = storedAllocation(row);
    if (allocation) { exactCount++; for (const a of allocation) exact[a.subject] += a.seconds; }
    else {
      legacyCount++;
      // 過去の均等配分と最後のfloorを維持。既存行には一切書き込まない。
      const codes = (row.subject ?? '').split(',').map(s => s.trim()).filter(Boolean);
      for (const code of codes) legacy[SUBJECT_CODES.includes(code) ? code : 'other'] += row.total_seconds / codes.length;
    }
  }
  const data = Object.fromEntries(SUBJECT_CODES.map(k => [k, exact[k] + Math.floor(legacy[k])]));
  const allocated = Object.values(data).reduce((a, b) => a + b, 0);
  return { total_seconds: total, subjects: data, record_count: rows.length, exact_record_count: exactCount, legacy_record_count: legacyCount,
    legacy_rounding_seconds: total - allocated,
    percentages: Object.fromEntries(SUBJECT_CODES.map(k => [k, total ? data[k] / total * 100 : 0])) };
}
export async function subjectAnalysis(db: D1Database, userId: number, month: string) {
  const rows = await db.prepare(`SELECT ss.subject,ss.total_seconds,ss.allocation_version,ss.subject_allocations FROM study_sessions ss
    WHERE ss.user_id=? AND ss.status='finished' AND ss.subject IS NOT NULL ${month === 'all' ? '' : `AND substr(${studyDaySQL},1,7)=?`} ORDER BY ss.id`)
    .bind(userId, ...(month === 'all' ? [] : [month])).all<AllocationRecord>();
  return { ...summarizeSubjects(rows.results), month };
}
