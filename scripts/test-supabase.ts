import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

dotenv.config();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://abhcbjfueftnpkgituuv.supabase.co";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

async function test() {
  console.log("Anon key present:", !!supabaseAnonKey);
  const supabase = createClient(supabaseUrl, supabaseAnonKey);

  // Test creating storage bucket
  try {
    console.log("Creating bucket 'avatars'...");
    const { data, error } = await supabase.storage.createBucket('avatars', {
      public: true,
      allowedMimeTypes: ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'],
      fileSizeLimit: 5242880
    });
    if (error) {
      console.error("Error creating bucket 'avatars':", error);
    } else {
      console.log("Success creating bucket:", data);
    }
  } catch (err) {
    console.error("Exception creating bucket:", err);
  }

  // Test listing storage buckets
  try {
    const { data: buckets, error: storageError } = await supabase.storage.listBuckets();
    if (storageError) {
      console.error("Error listing buckets:", storageError);
    } else {
      console.log("Buckets:", buckets?.map(b => b.name));
    }
  } catch (err) {
    console.error("Exception listing buckets:", err);
  }
}

test();
