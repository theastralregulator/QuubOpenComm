#!/bin/bash
# OpenComm Supabase Migrations Deploy Script

set -e

# Load environment variables
if [ -f .env ]; then
  export $(cat .env | xargs)
fi

SUPABASE_PROJECT_REF=${SUPABASE_PROJECT_REF:-""}

if [ -z "$SUPABASE_PROJECT_REF" ]; then
  echo "Error: SUPABASE_PROJECT_REF environment variable is not set."
  exit 1
fi

echo "🚀 Linking local Supabase configuration..."
supabase link --project-ref "$SUPABASE_PROJECT_REF"

echo "📤 Pushing database migrations to remote project..."
supabase db push

echo "✅ Database schema sync completed successfully!"
