-- Migration 202607140003: Create Remaining Tables, Add Missing Columns to Profiles, and Define RLS Policies

-- 1. Extend public.profiles with fields needed by OpenComm
alter table public.profiles add column if not exists phone text;
alter table public.profiles add column if not exists phone_verified boolean default false;
alter table public.profiles add column if not exists email text;
alter table public.profiles add column if not exists city text;
alter table public.profiles add column if not exists state text;
alter table public.profiles add column if not exists country text;
alter table public.profiles add column if not exists preferred_language text;
alter table public.profiles add column if not exists account_status text default 'active';
alter table public.profiles add column if not exists profile_type text default 'basic';

-- Update trigger handler function to sync email as well
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (
    id, 
    username, 
    full_name, 
    avatar_url, 
    email,
    phone,
    profile_type,
    account_status
  )
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'username', substring(new.email from '([^@]+)')),
    coalesce(new.raw_user_meta_data->>'full_name', substring(new.email from '([^@]+)')),
    coalesce(new.raw_user_meta_data->>'avatar_url', 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=150&h=150&q=80'),
    new.email,
    coalesce(new.raw_user_meta_data->>'phone', ''),
    'basic',
    'active'
  );
  return new;
end;
$$ language plpgsql security definer;

-- 2. Create worker_profiles Table
create table if not exists public.worker_profiles (
  id uuid references public.profiles(id) on delete cascade primary key,
  profession text,
  skills text[],
  experience_years integer,
  work_location text,
  availability text default 'Available Now',
  bio_summary text,
  hourly_rate numeric,
  expected_salary text,
  portfolio_url text,
  certificates text[],
  languages text[],
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 3. Create hiring_requests Table
create table if not exists public.hiring_requests (
  id uuid default uuid_generate_v4() primary key,
  client_id uuid references public.profiles(id) on delete cascade not null,
  client_name text not null,
  worker_id uuid references public.profiles(id) on delete cascade not null,
  worker_name text not null,
  work_title text not null,
  description text not null,
  budget numeric not null,
  preferred_date text,
  message text,
  status text check (status in ('pending', 'accepted', 'rejected', 'withdrawn')) default 'pending',
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 4. Create conversations Table
create table if not exists public.conversations (
  id uuid default uuid_generate_v4() primary key,
  job_id uuid references public.jobs(id) on delete set null,
  application_id uuid references public.job_applications(id) on delete set null,
  member_id uuid references public.profiles(id) on delete cascade not null, -- other party
  creator_id uuid references public.profiles(id) on delete cascade not null, -- initiating party
  last_message_text text,
  last_message_time timestamp with time zone default timezone('utc'::text, now()),
  unread_count integer default 0,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 5. Create messages Table
create table if not exists public.messages (
  id uuid default uuid_generate_v4() primary key,
  conversation_id uuid references public.conversations(id) on delete cascade not null,
  sender_id uuid references public.profiles(id) on delete cascade not null,
  sender_name text not null,
  sender_avatar text,
  text text not null,
  unread boolean default true,
  role text check (role in ('user', 'assistant')) default 'user',
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 6. Create saved_jobs Table
create table if not exists public.saved_jobs (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  job_id uuid references public.jobs(id) on delete cascade not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique(user_id, job_id)
);

-- 7. Create saved_workers Table
create table if not exists public.saved_workers (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  worker_id uuid references public.profiles(id) on delete cascade not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique(user_id, worker_id)
);

-- 8. Create notifications Table
create table if not exists public.notifications (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  type text check (type in ('application', 'message', 'hire', 'system')) not null,
  title text not null,
  description text not null,
  read boolean default false,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 9. Create reviews Table
create table if not exists public.reviews (
  id uuid default uuid_generate_v4() primary key,
  reviewer_id uuid references public.profiles(id) on delete cascade not null,
  reviewee_id uuid references public.profiles(id) on delete cascade not null,
  rating numeric check (rating >= 1 and rating <= 5) not null,
  comment text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS on all tables
alter table public.worker_profiles enable row level security;
alter table public.hiring_requests enable row level security;
alter table public.conversations enable row level security;
alter table public.messages enable row level security;
alter table public.saved_jobs enable row level security;
alter table public.saved_workers enable row level security;
alter table public.notifications enable row level security;
alter table public.reviews enable row level security;

-- 10. Configure secure RLS Policies

-- worker_profiles
create policy "Anyone can read worker profiles" on public.worker_profiles
  for select using (true);

create policy "Workers can insert/update their own profile" on public.worker_profiles
  for all using (auth.uid() = id);

-- hiring_requests
create policy "Users involved in hiring request can read" on public.hiring_requests
  for select using (auth.uid() = client_id or auth.uid() = worker_id);

create policy "Clients can initiate hiring requests" on public.hiring_requests
  for insert with check (auth.uid() = client_id);

create policy "Involved parties can update hiring requests" on public.hiring_requests
  for update using (auth.uid() = client_id or auth.uid() = worker_id);

-- conversations
create policy "Involved parties can read conversations" on public.conversations
  for select using (auth.uid() = creator_id or auth.uid() = member_id);

create policy "Anyone can create conversations" on public.conversations
  for insert with check (auth.uid() = creator_id);

-- messages
create policy "Users in conversation can view messages" on public.messages
  for select using (
    exists (
      select 1 from public.conversations c 
      where c.id = conversation_id and (c.creator_id = auth.uid() or c.member_id = auth.uid())
    )
  );

create policy "Users in conversation can send messages" on public.messages
  for insert with check (
    auth.uid() = sender_id and
    exists (
      select 1 from public.conversations c 
      where c.id = conversation_id and (c.creator_id = auth.uid() or c.member_id = auth.uid())
    )
  );

-- saved_jobs
create policy "Users can view their own saved jobs" on public.saved_jobs
  for select using (auth.uid() = user_id);

create policy "Users can save jobs" on public.saved_jobs
  for insert with check (auth.uid() = user_id);

create policy "Users can remove saved jobs" on public.saved_jobs
  for delete using (auth.uid() = user_id);

-- saved_workers
create policy "Users can view their own saved workers" on public.saved_workers
  for select using (auth.uid() = user_id);

create policy "Users can save workers" on public.saved_workers
  for insert with check (auth.uid() = user_id);

create policy "Users can remove saved workers" on public.saved_workers
  for delete using (auth.uid() = user_id);

-- notifications
create policy "Users can view their own notifications" on public.notifications
  for select using (auth.uid() = user_id);

create policy "Users can update their own notifications" on public.notifications
  for update using (auth.uid() = user_id);

-- reviews
create policy "Anyone can read reviews" on public.reviews
  for select using (true);

create policy "Users can write reviews" on public.reviews
  for insert with check (auth.uid() = reviewer_id);
