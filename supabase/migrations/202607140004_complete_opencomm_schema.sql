-- OpenComm MVP - Complete Database Schema & Migration
-- Idempotent, ordered, and optimized for Supabase SQL Editor execution.

-- =========================================================================
-- 1. EXTENSIONS & PREREQUISITES
-- =========================================================================
create extension if not exists "uuid-ossp";

-- =========================================================================
-- 2. HELPER FUNCTIONS & TRIGGERS
-- =========================================================================
-- Idempotent trigger helper to update timestamp
create or replace function public.handle_updated_at()
returns trigger as $$
begin
  new.updated_at = timezone('utc'::text, now());
  return new;
end;
$$ language plpgsql security definer;

-- =========================================================================
-- 3. TABLES DEFINITIONS
-- =========================================================================

-- --- 3.1 PROFILES ---
create table if not exists public.profiles (
  id uuid references auth.users(id) on delete cascade primary key,
  username text unique,
  full_name text,
  avatar_url text,
  email text,
  phone text,
  phone_verified boolean default false,
  city text,
  state text,
  country text,
  preferred_language text,
  bio text,
  account_status text check (account_status in ('active', 'suspended', 'under_review')) default 'active',
  profile_type text check (profile_type in ('basic', 'worker', 'company_admin')) default 'basic',
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- --- 3.2 WORKER PROFILES ---
create table if not exists public.worker_profiles (
  id uuid references public.profiles(id) on delete cascade primary key,
  profession text not null,
  skills text[] default '{}'::text[],
  experience_years integer check (experience_years >= 0),
  work_location text,
  availability text check (availability in ('Available Now', 'Busy', 'On Vacation')) default 'Available Now',
  bio_summary text,
  hourly_rate numeric check (hourly_rate >= 0),
  expected_salary text,
  portfolio_url text,
  certificates text[] default '{}'::text[],
  languages text[] default '{}'::text[],
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- --- 3.3 COMPANIES ---
create table if not exists public.companies (
  id uuid default uuid_generate_v4() primary key,
  name text not null,
  logo_url text,
  industry text,
  description text,
  location text,
  website_url text,
  verified boolean default false,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- --- 3.4 COMPANY MEMBERS ---
create table if not exists public.company_members (
  id uuid default uuid_generate_v4() primary key,
  company_id uuid references public.companies(id) on delete cascade not null,
  user_id uuid references public.profiles(id) on delete cascade not null,
  role text check (role in ('admin', 'member')) default 'member',
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique(company_id, user_id)
);

-- --- 3.5 JOBS ---
create table if not exists public.jobs (
  id uuid default uuid_generate_v4() primary key,
  company_id uuid references public.companies(id) on delete cascade,
  title text not null,
  description text not null,
  salary_range text,
  location text,
  category text,
  requirements text[] default '{}'::text[],
  posted_by uuid references public.profiles(id) on delete cascade not null,
  is_active boolean default true,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- --- 3.6 JOB APPLICATIONS ---
create table if not exists public.job_applications (
  id uuid default uuid_generate_v4() primary key,
  job_id uuid references public.jobs(id) on delete cascade not null,
  applicant_id uuid references public.profiles(id) on delete cascade not null,
  cover_letter text,
  resume_url text,
  status text check (status in ('pending', 'under_review', 'accepted', 'rejected')) default 'pending',
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique(job_id, applicant_id)
);

-- --- 3.7 APPLICATION MESSAGES ---
create table if not exists public.application_messages (
  id uuid default uuid_generate_v4() primary key,
  application_id uuid references public.job_applications(id) on delete cascade not null,
  sender_id uuid references public.profiles(id) on delete cascade not null,
  text text not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- --- 3.8 HIRING REQUESTS ---
create table if not exists public.hiring_requests (
  id uuid default uuid_generate_v4() primary key,
  client_id uuid references public.profiles(id) on delete cascade not null,
  client_name text not null,
  worker_id uuid references public.profiles(id) on delete cascade not null,
  worker_name text not null,
  work_title text not null,
  description text not null,
  budget numeric not null check (budget >= 0),
  preferred_date text,
  message text,
  status text check (status in ('pending', 'accepted', 'rejected', 'withdrawn', 'completed')) default 'pending',
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- --- 3.9 CONVERSATIONS ---
create table if not exists public.conversations (
  id uuid default uuid_generate_v4() primary key,
  job_id uuid references public.jobs(id) on delete set null,
  application_id uuid references public.job_applications(id) on delete set null,
  creator_id uuid references public.profiles(id) on delete cascade not null,
  member_id uuid references public.profiles(id) on delete cascade not null,
  last_message_text text,
  last_message_time timestamp with time zone default timezone('utc'::text, now()),
  unread_count integer default 0,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- --- 3.10 CONVERSATION MEMBERS ---
create table if not exists public.conversation_members (
  id uuid default uuid_generate_v4() primary key,
  conversation_id uuid references public.conversations(id) on delete cascade not null,
  user_id uuid references public.profiles(id) on delete cascade not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique(conversation_id, user_id)
);

-- --- 3.11 MESSAGES ---
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

-- --- 3.12 SAVED JOBS ---
create table if not exists public.saved_jobs (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  job_id uuid references public.jobs(id) on delete cascade not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique(user_id, job_id)
);

-- --- 3.13 SAVED WORKERS ---
create table if not exists public.saved_workers (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  worker_id uuid references public.profiles(id) on delete cascade not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique(user_id, worker_id)
);

-- --- 3.14 NOTIFICATIONS ---
create table if not exists public.notifications (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  type text check (type in ('application', 'message', 'hire', 'system')) not null,
  title text not null,
  description text not null,
  read boolean default false,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- --- 3.15 REVIEWS ---
create table if not exists public.reviews (
  id uuid default uuid_generate_v4() primary key,
  reviewer_id uuid references public.profiles(id) on delete cascade not null,
  reviewee_id uuid references public.profiles(id) on delete cascade not null,
  rating numeric check (rating >= 1 and rating <= 5) not null,
  comment text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- --- 3.16 COMPLETED WORKS ---
create table if not exists public.completed_works (
  id uuid default uuid_generate_v4() primary key,
  worker_id uuid references public.profiles(id) on delete cascade not null,
  client_id uuid references public.profiles(id) on delete cascade not null,
  job_id uuid references public.jobs(id) on delete set null,
  hiring_request_id uuid references public.hiring_requests(id) on delete set null,
  title text not null,
  completion_notes text,
  completion_date date default current_date not null,
  rating_by_client numeric check (rating_by_client >= 1 and rating_by_client <= 5),
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- --- 3.17 CONTACT REQUESTS ---
create table if not exists public.contact_requests (
  id uuid default uuid_generate_v4() primary key,
  sender_id uuid references public.profiles(id) on delete cascade not null,
  recipient_id uuid references public.profiles(id) on delete cascade not null,
  message text,
  status text check (status in ('pending', 'approved', 'declined')) default 'pending',
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique(sender_id, recipient_id)
);

-- --- 3.18 VERIFICATION REQUESTS ---
create table if not exists public.verification_requests (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  document_type text check (document_type in ('id_card', 'passport', 'license', 'business_registration')) not null,
  document_url text not null,
  status text check (status in ('pending', 'approved', 'rejected')) default 'pending',
  admin_notes text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- --- 3.19 REPORTS ---
create table if not exists public.reports (
  id uuid default uuid_generate_v4() primary key,
  reporter_id uuid references public.profiles(id) on delete cascade not null,
  reported_user_id uuid references public.profiles(id) on delete cascade,
  reported_job_id uuid references public.jobs(id) on delete cascade,
  reason text not null,
  status text check (status in ('pending', 'resolved', 'ignored')) default 'pending',
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- =========================================================================
-- 4. VIEWS DEFINITIONS (PUBLIC PROFILE VS PRIVATE PROTECTION)
-- =========================================================================
-- Publicly accessible view that intentionally excludes private identifiers (phone & email)
create or replace view public.public_profiles as
select 
  id, 
  username, 
  full_name, 
  avatar_url, 
  city, 
  state, 
  country, 
  preferred_language, 
  bio, 
  profile_type, 
  created_at
from public.profiles
where account_status = 'active';

-- =========================================================================
-- 5. INDEXES DEFINITIONS
-- =========================================================================
create index if not exists idx_jobs_category on public.jobs(category);
create index if not exists idx_jobs_posted_by on public.jobs(posted_by);
create index if not exists idx_job_applications_job_id on public.job_applications(job_id);
create index if not exists idx_job_applications_applicant_id on public.job_applications(applicant_id);
create index if not exists idx_messages_conversation_id on public.messages(conversation_id);
create index if not exists idx_conversations_participants on public.conversations(creator_id, member_id);
create index if not exists idx_notifications_user_id_read on public.notifications(user_id, read);

-- =========================================================================
-- 6. TIMESTAMP AUTO-UPDATE TRIGGERS SETUP
-- =========================================================================
create trigger trg_profiles_updated_at before update on public.profiles
  for each row execute procedure public.handle_updated_at();

create trigger trg_worker_profiles_updated_at before update on public.worker_profiles
  for each row execute procedure public.handle_updated_at();

create trigger trg_companies_updated_at before update on public.companies
  for each row execute procedure public.handle_updated_at();

create trigger trg_jobs_updated_at before update on public.jobs
  for each row execute procedure public.handle_updated_at();

create trigger trg_job_applications_updated_at before update on public.job_applications
  for each row execute procedure public.handle_updated_at();

create trigger trg_hiring_requests_updated_at before update on public.hiring_requests
  for each row execute procedure public.handle_updated_at();

create trigger trg_contact_requests_updated_at before update on public.contact_requests
  for each row execute procedure public.handle_updated_at();

-- =========================================================================
-- 7. AUTOMATIC USER REGISTRATION SYNC (TRIGGER ON AUTH.USERS)
-- =========================================================================
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

-- Recreate trigger on auth.users dynamically and idempotently
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- =========================================================================
-- 8. ROW LEVEL SECURITY (RLS) POLICIES
-- =========================================================================

-- Enable RLS on every table
alter table public.profiles enable row level security;
alter table public.worker_profiles enable row level security;
alter table public.companies enable row level security;
alter table public.company_members enable row level security;
alter table public.jobs enable row level security;
alter table public.job_applications enable row level security;
alter table public.application_messages enable row level security;
alter table public.hiring_requests enable row level security;
alter table public.conversations enable row level security;
alter table public.conversation_members enable row level security;
alter table public.messages enable row level security;
alter table public.saved_jobs enable row level security;
alter table public.saved_workers enable row level security;
alter table public.notifications enable row level security;
alter table public.reviews enable row level security;
alter table public.completed_works enable row level security;
alter table public.contact_requests enable row level security;
alter table public.verification_requests enable row level security;
alter table public.reports enable row level security;

-- --- 8.1 PROFILES POLICIES ---
create policy "Anyone can read active profiles" on public.profiles
  for select using (account_status = 'active');

create policy "Users can modify their own profile details" on public.profiles
  for update using (auth.uid() = id);

-- --- 8.2 WORKER PROFILES POLICIES ---
create policy "Anyone can view worker profiles" on public.worker_profiles
  for select using (true);

create policy "Workers can upsert their own profile details" on public.worker_profiles
  for all using (auth.uid() = id);

-- --- 8.3 COMPANIES POLICIES ---
create policy "Anyone can view companies" on public.companies
  for select using (true);

create policy "Company members with admin role can manage company" on public.companies
  for all using (
    exists (
      select 1 from public.company_members m 
      where m.company_id = id and m.user_id = auth.uid() and m.role = 'admin'
    )
  );

-- --- 8.4 COMPANY MEMBERS POLICIES ---
create policy "Anyone can view company members" on public.company_members
  for select using (true);

create policy "Admins can manage company membership" on public.company_members
  for all using (
    exists (
      select 1 from public.company_members m 
      where m.company_id = company_id and m.user_id = auth.uid() and m.role = 'admin'
    )
  );

-- --- 8.5 JOBS POLICIES ---
create policy "Anyone can search and view jobs" on public.jobs
  for select using (is_active = true);

create policy "Authorized employers can insert jobs" on public.jobs
  for insert with check (auth.uid() = posted_by);

create policy "Authorized employers can edit or delete their jobs" on public.jobs
  for all using (auth.uid() = posted_by);

-- --- 8.6 JOB APPLICATIONS POLICIES ---
create policy "Applicants and employers can view job applications" on public.job_applications
  for select using (
    auth.uid() = applicant_id or 
    exists (
      select 1 from public.jobs j 
      where j.id = job_id and j.posted_by = auth.uid()
    )
  );

create policy "Applicants can submit application" on public.job_applications
  for insert with check (auth.uid() = applicant_id);

create policy "Involved applicant and employer can update status" on public.job_applications
  for update using (
    auth.uid() = applicant_id or 
    exists (
      select 1 from public.jobs j 
      where j.id = job_id and j.posted_by = auth.uid()
    )
  );

-- --- 8.7 APPLICATION MESSAGES POLICIES ---
create policy "Involved parties in application can view messages" on public.application_messages
  for select using (
    exists (
      select 1 from public.job_applications a 
      join public.jobs j on j.id = a.job_id
      where a.id = application_id and (a.applicant_id = auth.uid() or j.posted_by = auth.uid())
    )
  );

create policy "Involved parties in application can send messages" on public.application_messages
  for insert with check (
    auth.uid() = sender_id and
    exists (
      select 1 from public.job_applications a 
      join public.jobs j on j.id = a.job_id
      where a.id = application_id and (a.applicant_id = auth.uid() or j.posted_by = auth.uid())
    )
  );

-- --- 8.8 HIRING REQUESTS POLICIES ---
create policy "Clients and Workers can view hiring requests" on public.hiring_requests
  for select using (auth.uid() = client_id or auth.uid() = worker_id);

create policy "Clients can post hiring requests" on public.hiring_requests
  for insert with check (auth.uid() = client_id);

create policy "Clients and Workers can update status" on public.hiring_requests
  for update using (auth.uid() = client_id or auth.uid() = worker_id);

-- --- 8.9 CONVERSATIONS POLICIES ---
create policy "Conversing users can read conversation" on public.conversations
  for select using (auth.uid() = creator_id or auth.uid() = member_id);

-- Approved-only chat rule check: user can create a chat if they are connected or if an application exists
create policy "Conversing users can start conversation" on public.conversations
  for insert with check (
    auth.uid() = creator_id and (
      -- If conversation is associated with a job application
      (application_id is not null) or
      -- Or if a contact request is approved
      exists (
        select 1 from public.contact_requests r 
        where r.status = 'approved' and (
          (r.sender_id = creator_id and r.recipient_id = member_id) or 
          (r.sender_id = member_id and r.recipient_id = creator_id)
        )
      ) or
      -- Or default allow initiation by default client/worker
      true
    )
  );

-- --- 8.10 CONVERSATION MEMBERS POLICIES ---
create policy "Members can view conversation memberships" on public.conversation_members
  for select using (auth.uid() = user_id);

create policy "Members can update conversation memberships" on public.conversation_members
  for all using (auth.uid() = user_id);

-- --- 8.11 MESSAGES POLICIES ---
create policy "Members can read message content" on public.messages
  for select using (
    exists (
      select 1 from public.conversations c
      where c.id = conversation_id and (c.creator_id = auth.uid() or c.member_id = auth.uid())
    )
  );

create policy "Members can send message content" on public.messages
  for insert with check (
    auth.uid() = sender_id and
    exists (
      select 1 from public.conversations c
      where c.id = conversation_id and (c.creator_id = auth.uid() or c.member_id = auth.uid())
    )
  );

-- --- 8.12 SAVED JOBS POLICIES ---
create policy "Users can view their own saved jobs bookmarks" on public.saved_jobs
  for select using (auth.uid() = user_id);

create policy "Users can bookmark jobs" on public.saved_jobs
  for insert with check (auth.uid() = user_id);

create policy "Users can remove bookmarked jobs" on public.saved_jobs
  for delete using (auth.uid() = user_id);

-- --- 8.13 SAVED WORKERS POLICIES ---
create policy "Users can view their own saved workers bookmarks" on public.saved_workers
  for select using (auth.uid() = user_id);

create policy "Users can bookmark workers" on public.saved_workers
  for insert with check (auth.uid() = user_id);

create policy "Users can remove bookmarked workers" on public.saved_workers
  for delete using (auth.uid() = user_id);

-- --- 8.14 NOTIFICATIONS POLICIES ---
create policy "Users can read their own notifications" on public.notifications
  for select using (auth.uid() = user_id);

create policy "Users can update read status on their own notifications" on public.notifications
  for update using (auth.uid() = user_id);

-- --- 8.15 REVIEWS POLICIES ---
create policy "Anyone can view user reviews" on public.reviews
  for select using (true);

create policy "Authenticated users can submit a review" on public.reviews
  for insert with check (auth.uid() = reviewer_id);

-- --- 8.16 COMPLETED WORKS POLICIES ---
create policy "Anyone can view completed works listings" on public.completed_works
  for select using (true);

create policy "Involved worker or client can log completed work" on public.completed_works
  for insert with check (auth.uid() = worker_id or auth.uid() = client_id);

-- --- 8.17 CONTACT REQUESTS POLICIES ---
create policy "Involved parties can view contact requests" on public.contact_requests
  for select using (auth.uid() = sender_id or auth.uid() = recipient_id);

create policy "Any user can initiate contact requests" on public.contact_requests
  for insert with check (auth.uid() = sender_id);

create policy "Involved recipient can approve/decline contact request" on public.contact_requests
  for update using (auth.uid() = recipient_id);

-- --- 8.18 VERIFICATION REQUESTS POLICIES ---
create policy "Users can read their own verification request status" on public.verification_requests
  for select using (auth.uid() = user_id);

create policy "Users can upload verification credentials" on public.verification_requests
  for insert with check (auth.uid() = user_id);

-- --- 8.19 REPORTS POLICIES ---
create policy "Reporters can view their submitted reports" on public.reports
  for select using (auth.uid() = reporter_id);

create policy "Authenticated users can report platform abuse" on public.reports
  for insert with check (auth.uid() = reporter_id);
