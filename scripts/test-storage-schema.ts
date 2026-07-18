import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

dotenv.config();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

async function test() {
  console.log("Testing direct storage schema access...");
  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    db: { schema: 'storage' }
  });

  try {
    const { data, error } = await supabase.from('buckets').select('*');
    if (error) {
      console.error("Error fetching buckets from storage schema:", error.message);
    } else {
      console.log("Successfully fetched buckets:", data);
    }
  } catch (err: any) {
    console.error("Exception:", err.message);
  }

  try {
    console.log("Attempting to insert 'avatars' bucket...");
    const { data, error } = await supabase.from('buckets').insert({
      id: 'avatars',
      name: 'avatars',
      public: true
    }).select();

    if (error) {
      console.error("Error inserting bucket:", error.message);
    } else {
      console.log("Successfully inserted bucket:", data);
    }
  } catch (err: any) {
    console.error("Exception on insert:", err.message);
  }
}

test();
