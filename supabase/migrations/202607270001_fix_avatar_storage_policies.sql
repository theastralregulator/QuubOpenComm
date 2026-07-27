-- Fix Avatar Storage Policies to support upsert correctly and prevent RLS violations

-- Drop the old overly strict or incorrectly scoped policies
DROP POLICY IF EXISTS "Authenticated Upload Avatars" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated Update Avatars" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated Delete Avatars" ON storage.objects;

-- 1. INSERT POLICY
-- We use auth.uid() = owner which is automatically populated by Supabase Storage API
CREATE POLICY "Authenticated Upload Avatars" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (
    bucket_id = 'avatars' AND
    auth.uid() = owner
  );

-- 2. UPDATE POLICY
-- upsert: true requires both USING and WITH CHECK on the UPDATE policy
CREATE POLICY "Authenticated Update Avatars" ON storage.objects
  FOR UPDATE TO authenticated USING (
    bucket_id = 'avatars' AND
    auth.uid() = owner
  ) WITH CHECK (
    bucket_id = 'avatars' AND
    auth.uid() = owner
  );

-- 3. DELETE POLICY
CREATE POLICY "Authenticated Delete Avatars" ON storage.objects
  FOR DELETE TO authenticated USING (
    bucket_id = 'avatars' AND
    auth.uid() = owner
  );
