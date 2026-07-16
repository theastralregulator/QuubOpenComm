-- Migration 202607140002: Create Companies, Jobs, Worker Skills and Applications

-- Create Companies Table
create table public.companies (
  id uuid default uuid_generate_v4() primary key,
  name text not null,
  logo_url text,
  website_url text,
  description text,
  location text,
  verified boolean default false,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Create Jobs Table
create table public.jobs (
  id uuid default uuid_generate_v4() primary key,
  title text not null,
  description text not null,
  salary_range text,
  location text,
  category text not null,
  requirements text[],
  company_id uuid references public.companies(id) on delete cascade,
  posted_by uuid references public.profiles(id) on delete cascade,
  is_active boolean default true,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Create Worker Skills & Directory Table
create table public.workers_directory (
  id uuid references public.profiles(id) on delete cascade primary key,
  title text,
  hourly_rate numeric,
  experience_years integer,
  rating numeric(3, 2) default 5.0,
  skills text[],
  completed_jobs_count integer default 0,
  availability_status text default 'available',
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Create Applications Table
create table public.job_applications (
  id uuid default uuid_generate_v4() primary key,
  job_id uuid references public.jobs(id) on delete cascade,
  applicant_id uuid references public.profiles(id) on delete cascade,
  cover_letter text,
  status text check (status in ('pending', 'reviewed', 'shortlisted', 'rejected', 'accepted')) default 'pending',
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique(job_id, applicant_id)
);

-- Enable RLS on all Tables
alter table public.companies enable row level security;
alter table public.jobs enable row level security;
alter table public.workers_directory enable row level security;
alter table public.job_applications enable row level security;

-- Policies
create policy "Anyone can read companies" on public.companies for select using (true);
create policy "Anyone can read active jobs" on public.jobs for select using (is_active = true);
create policy "Profile owners/companies can modify jobs" on public.jobs for all using (auth.uid() = posted_by);
create policy "Anyone can view workers directory" on public.workers_directory for select using (true);
create policy "Workers can update their own entry" on public.workers_directory for all using (auth.uid() = id);
create policy "Applicants and employers can view applications" on public.job_applications for select using (
  auth.uid() = applicant_id or 
  auth.uid() in (select posted_by from public.jobs where id = job_id)
);
create policy "Users can apply to jobs" on public.job_applications for insert with check (auth.uid() = applicant_id);
