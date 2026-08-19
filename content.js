// ============================================================================
// TIB Systems — SAP Testing Execution Guide
// Course 5 — "SOX Using AI" — Draymoor Global Holdings, Inc. (Premium, Optional)
// Supabase-backed content, auth, and progress module
// Project: blfgwysgekfqhcafofhe  (tables: sapexec_v5_books, sapexec_v5_enrollments, sapexec_v5_progress)
// ============================================================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = 'https://blfgwysgekfqhcafofhe.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJsZmd3eXNnZWtmcWhjYWZvZmhlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAyODY0NDksImV4cCI6MjA5NTg2MjQ0OX0.HPdIMd-X30QBufoL9BVSVte6s_Fc-OOKIq9MbwLrzcI';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

/** Fetch the full book set (Parts + Books), ordered exactly as the source guide. */
export async function fetchCourseData() {
  const { data, error } = await supabase
    .from('sapexec_v5_books')
    .select('*')
    .order('sort_order', { ascending: true });
  if (error) throw error;

  const parts = [];
  const byPart = new Map();
  for (const row of data) {
    if (!byPart.has(row.part_numeral)) {
      const part = { numeral: row.part_numeral, title: row.part_title, books: [] };
      byPart.set(row.part_numeral, part);
      parts.push(part);
    }
    byPart.get(row.part_numeral).books.push({
      num: row.book_num,
      shortname: row.shortname,
      subtitle: row.subtitle,
      intro: row.scenario_brief,
      execTable: row.exec_table || [],
      // Derive Quick Reference entries from exec_table (unique tool+code pairs, skipping non-SAP "—" steps) —
      // V4's table has no separate `transactions` column, unlike sapexec_books.
      transactions: (() => {
        const seen = new Set();
        const out = [];
        for (const s of (row.exec_table || [])) {
          if (!s.code || s.code === '—') continue;
          const key = s.tool + '|' + s.code;
          if (seen.has(key)) continue;
          seen.add(key);
          out.push({ tool: s.tool, code: s.code, purpose: s.directions });
        }
        return out;
      })(),
      steps: row.steps || [],
      evidence: row.evidence || '',
      pitfall: row.pitfall || '',
    });
  }
  return parts;
}

/** Rows: { book_num }[] of every book this trainee has completed. */
export async function fetchProgress(email) {
  const { data, error } = await supabase
    .from('sapexec_v5_progress')
    .select('book_num')
    .eq('email', email);
  if (error) throw error;
  return new Set((data || []).map(r => r.book_num));
}

/** Presence-based completion marker — inserting the row IS "complete". Safe to call repeatedly. */
export async function markBookComplete(email, bookNum) {
  const { error } = await supabase
    .from('sapexec_v5_progress')
    .upsert({ email, book_num: bookNum }, { onConflict: 'email,book_num', ignoreDuplicates: true });
  if (error) console.warn('markBookComplete failed:', error.message);
}

/** Null if not enrolled in this course. */
export async function fetchEnrollment(email) {
  const { data, error } = await supabase
    .from('sapexec_v5_enrollments')
    .select('email, tier, created_at')
    .eq('email', email)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function signInWithPassword(email, password) {
  return supabase.auth.signInWithPassword({ email, password });
}

export async function signUpWithPassword(email, password) {
  return supabase.auth.signUp({ email, password });
}

export async function signOut() {
  return supabase.auth.signOut();
}

export async function getSession() {
  const { data } = await supabase.auth.getSession();
  return data.session;
}
