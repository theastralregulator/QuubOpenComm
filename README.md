# OpenComm Monorepo Workspaces 🚀

Welcome to **OpenComm**, the premium, high-fidelity AI-powered professional networking and local career marketplace. 

This repository has been reorganized into a modular, production-ready full-stack monorepo, separating different layers of the technology stack into clear architectural domains.

---

## 📂 Repository Structure

The codebase is organized as a workspace:

```
opencomm/ (workspace root)
├── apps/
│   ├── web/               # Next.js & React 19 Web Client
│   └── mobile/            # Flutter (Riverpod + GoRouter) Mobile Client
├── supabase/              # Local & Remote Supabase Database configurations
│   ├── migrations/        # PostgreSQL schemas, triggers, and RLS policies
│   └── config.toml        # Supabase API/Auth development configurations
├── packages/
│   └── shared/            # Shared validations & helpers
├── docs/                  # Architecture blueprints & developer guides
├── scripts/               # Automation & CI/CD deployment scripts
└── .github/
    └── workflows/         # Automated Continuous Integration (CI) workflows
```

---

## 🛠️ Technology Stack & Workspaces

### 1. Web Application (`apps/web`)
*   **Framework**: React 19 / Vite
*   **Styling**: Tailwind CSS v4 (offering high-contrast dark visual aesthetics and fluid modern interfaces)
*   **Icons**: Lucide Icons
*   **Build Engine**: Vite (mapped to root so changes run instantly inside local containers)
*   **Server**: Express backend to proxy high-security operations (like the Gemini API)

### 2. Mobile Application (`apps/mobile`)
*   **Framework**: Flutter (Dart)
*   **State Management**: Riverpod (for decoupled, testable components)
*   **Routing**: GoRouter (for deep-linking and clean multi-screen setups)
*   **BaaS SDK**: Supabase Flutter SDK

### 3. Backend Database (`supabase`)
*   **Storage**: PostgreSQL
*   **Authentication**: Supabase Auth (with automatic profile triggers)
*   **Security**: Row-Level Security (RLS) policies

---

## 💻 Quick Start & Development

To launch the local development environment:

### Web Client
Install dependencies and run the server at the root directory:
```bash
npm install
npm run dev
```
The application runs on the default port `3000` (and is served at http://localhost:3000).

### Mobile App
```bash
cd apps/mobile
flutter pub get
flutter run
```

### Database Sync
```bash
cd supabase
supabase start
supabase migration up
```
