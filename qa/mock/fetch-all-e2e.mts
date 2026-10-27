/**
 * LOCAL CHECK — real supabase-js against the mock PostgREST (which caps
 * each request at 1000 rows, like Supabase). Proves .range() sends
 * offset/limit the way lib/supabase/fetch-all.ts expects, and that a
 * plain select really is silently truncated.
 *
 *   npx tsx qa/mock/supabase-mock.mts &     # :54321
 *   npx tsx qa/mock/fetch-all-e2e.mts
 */
import { createClient } from "@supabase/supabase-js";
import { fetchAll } from "../../lib/supabase/fetch-all";

const supabase = createClient("http://127.0.0.1:54321", "mock-anon", { auth: { persistSession: false } });

const plain = await supabase.from("big_rows").select("*");
console.log("plain select('*') rows:", plain.data?.length, "(expected: 1000 — the silent cap)");

const paged = await fetchAll(supabase.from("big_rows").select("*"));
console.log("fetchAll rows:", paged.data?.length, "error:", paged.error, "(expected: 2345)");
const ids = new Set(paged.data?.map((r: { id: string }) => r.id));
console.log("distinct ids:", ids.size, "(expected: 2345)");

const small = await fetchAll(supabase.from("office_users").select("*").order("full_name"));
console.log("small table via fetchAll:", small.data?.length, "rows, error:", small.error);
