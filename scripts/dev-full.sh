#!/bin/bash
set -e

echo "Starting Supabase..."
docker compose up -d

echo "Waiting for Supabase to be ready..."
until docker compose exec -T db pg_isready -U postgres > /dev/null 2>&1; do
  sleep 1
done

echo "Supabase ready!"
echo "  Dashboard: http://localhost:54323"
echo "  API: http://localhost:54321"
echo ""
echo "Starting dev server..."
pnpm dev
