const env = (import.meta as any).env ?? {};

export const SUPABASE_URL =
  env.VITE_SUPABASE_URL || "https://akhbywrlzlehpzeiggqw.supabase.co";
export const SUPABASE_PUBLISHABLE_KEY =
  env.VITE_SUPABASE_PUBLISHABLE_KEY || "sb_publishable_PFmXGelsHXTrPk05n9sxVg_ZlJ740U2";

