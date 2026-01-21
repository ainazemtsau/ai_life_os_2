-- Supabase roles password setup
-- This script runs AFTER the Supabase image init scripts
-- It sets passwords for roles that need them for external connections

-- Set passwords for roles (roles are created by Supabase image)
-- These passwords must match what's configured in docker-compose.yml
ALTER ROLE authenticator WITH PASSWORD 'postgres';
ALTER ROLE supabase_auth_admin WITH PASSWORD 'postgres';
