export default function handler(req: any, res: any) {
  res.status(200).json({
    supabaseUrl: process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || "",
    supabaseAnonKey: process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || "",
    appUrl: process.env.VITE_APP_URL || process.env.APP_URL || ""
  });
}
