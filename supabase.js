import { createClient } from "@supabase/supabase-js";

const supabaseUrl = "https://fjjibdveryoqzcjjxtix.supabase.co";

const supabaseAnonKey = "sb_publishable_zyXA_rk8zPD3wlW0dLUgTQ_qFyAKFYY";

export const supabase = createClient(
  supabaseUrl,
  supabaseAnonKey
);