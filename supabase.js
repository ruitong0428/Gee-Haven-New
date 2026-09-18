// ============================================================
// Gee Haven - Supabase connection
// ============================================================
// Get these from:
// Supabase Dashboard -> Project Settings -> API
// Replace the two values below.

const SUPABASE_URL = "https://nkrrzuuioakhitpcndje.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_lZK9pLdZXRlodk8V8-3Jug_MIKZsf--";

const db = window.supabase.createClient(
  SUPABASE_URL,
  SUPABASE_ANON_KEY
);

window.GEE = { db };
