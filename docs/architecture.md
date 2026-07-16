# OpenComm System Architecture Document

This document outlines the high-level architecture and monorepo structure of **OpenComm**—the premium AI-powered professional networking and local marketplace platform.

---

## 🏗️ Monorepo Design & Module Breakdown

To maintain maximum velocity across platform targets, the OpenComm codebase is organized into a clean monorepo workspace:

```
opencomm/
├── apps/
│   ├── web/                # Next.js & React 19 web application (configured with Tailwind v4 & Vite)
│   └── mobile/             # Flutter mobile app targeting iOS, Android, and Web
├── supabase/               # Backend-as-a-Service schemas, migrations, policies, and Edge Functions
├── packages/
│   └── shared/             # Shared typescript models, types, schemas, and verification logic
├── docs/                   # Architectural blueprints, API docs, and guides
└── scripts/                # Automated CI/CD, backup, and sync automation scripts
```

---

## 🌐 Web Architecture (`apps/web`)

The web client is built using React 19, TypeScript, and Tailwind CSS.
- **State Management**: Built on top of robust React hooks, tracking dynamic listings, instant messaging states, and bookmark local configurations.
- **Routing**: Ready for Next.js App Router folders inside `/src/app/` (with layouts, routing paths, and error states), coupled with our Vite-integrated local preview environment.
- **Glow and Motion**: Interactive and micro-animated layouts utilizing `motion` (Framer Motion).

---

## 📱 Mobile Architecture (`apps/mobile`)

The mobile client is built on **Flutter (Dart)** following standard clean-code architecture patterns:
- **State Management**: Managed via **Riverpod** for robust, reactive, and easily testable decoupled components.
- **Navigation**: Uses **GoRouter** for type-safe routing.
- **Services**: Interacts directly with the Supabase client using `supabase_flutter`.

---

## 🗄️ Backend Architecture (`supabase`)

The database tier is powered by **Supabase PostgreSQL** with strict data protection layers:
- **Row-Level Security (RLS)**: Enforces that users can only read public data or modify their own authenticated profiles and posts.
- **Triggers**: Automates table synchronization (e.g., syncing auth user credentials to profiles upon signup).
- **Edge Functions**: Offloads high-computation operations (like notification broadcasts or payment gateway webhooks).
