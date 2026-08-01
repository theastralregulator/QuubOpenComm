import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

dotenv.config();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.VITE_SUPABASE_URL || "https://abhcbjfueftnpkgituuv.supabase.co";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || "";
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

console.log("Supabase Project URL:", supabaseUrl);
console.log("Anon Key present:", !!supabaseAnonKey);
console.log("Service Role Key present:", !!serviceRoleKey);

async function runTest() {
  // 1. Fetch live jobs older than 5 hours to find a test candidate
  const anonClient = createClient(supabaseUrl, supabaseAnonKey);
  const fiveHoursAgo = new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString();

  console.log("\nSearching for live jobs posted before:", fiveHoursAgo);
  
  const { data: jobs, error: jobsError } = await anonClient
    .from('jobs')
    .select('id, title, created_at, is_active, posted_by')
    .eq('is_active', true)
    .lt('created_at', fiveHoursAgo)
    .limit(5);

  if (jobsError) {
    console.error("Error querying jobs:", jobsError);
    return;
  }

  console.log(`Found ${jobs?.length || 0} jobs older than 5 hours:`);
  console.dir(jobs, { depth: null });

  if (!jobs || jobs.length === 0) {
    // Check if there are any jobs at all
    const { data: allJobs } = await anonClient.from('jobs').select('id, title, created_at, is_active, posted_by').limit(5);
    console.log("All sample jobs in database:", allJobs);
  }
}

runTest();
