import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

dotenv.config();

let supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.VITE_SUPABASE_URL || "https://abhcbjfueftnpkgituuv.supabase.co";
let supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || "";

async function testWorkerFetch() {
  if (!supabaseAnonKey) {
    try {
      const res = await fetch("http://localhost:3000/api/config");
      if (res.ok) {
        const config = await res.json();
        if (config.supabaseUrl) supabaseUrl = config.supabaseUrl;
        if (config.supabaseAnonKey) supabaseAnonKey = config.supabaseAnonKey;
      }
    } catch (e) {
      console.warn("Could not fetch config from localhost server:", e);
    }
  }

  console.log("Supabase URL:", supabaseUrl);
  console.log("Anon key present:", !!supabaseAnonKey);

  if (!supabaseAnonKey) {
    console.error("No anon key available.");
    return;
  }

  const client = createClient(supabaseUrl, supabaseAnonKey);

  console.log("\n--- Testing worker_directory View ---");
  const { data: directoryData, error: dirError } = await client
    .from('worker_directory')
    .select('*');

  console.log("worker_directory count:", directoryData?.length);
  if (dirError) console.error("worker_directory error:", dirError);
  else console.log("Sample worker_directory item:", JSON.stringify(directoryData?.[0], null, 2));

  if (directoryData && directoryData.length > 0) {
    const testId = directoryData[0].id;
    console.log(`\n--- Testing WorkerDetailPage Query for ID: ${testId} ---`);

    // Test old query
    const { data: oldData, error: oldError } = await client
      .from('worker_profiles')
      .select(`
        *,
        profiles(full_name, avatar_url, city, state, district, profile_type)
      `)
      .eq('id', testId)
      .eq('listing_enabled', true)
      .single();

    console.log("Old WorkerDetailPage query error:", oldError);
    console.log("Old WorkerDetailPage query data:", oldData);

    // Test worker_directory single query
    const { data: newDirData, error: newDirError } = await client
      .from('worker_directory')
      .select('*')
      .eq('id', testId)
      .single();

    console.log("worker_directory single query error:", newDirError);
    console.log("worker_directory single query data:", newDirData);
  }
}

testWorkerFetch();
