/**
 * Integration Test Setup
 *
 * Connects to ISOLATED test Supabase (localhost:55321) - NOT dev database!
 * Requires: `docker compose -f docker-compose.test.yml up -d`
 *
 * ISOLATION:
 * - Separate Docker Compose (docker-compose.test.yml)
 * - Different ports: 55321 (API), 55322 (PostgreSQL)
 * - Separate volume (supabase-test-db-data)
 *
 * Usage:
 * 1. Start test env: docker compose -f docker-compose.test.yml up -d
 * 2. Run tests: pnpm test:integration
 * 3. Stop test env: docker compose -f docker-compose.test.yml down -v
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@ai-life-os/supabase';

// TEST Supabase credentials - ISOLATED from dev (docker-compose.test.yml)
// Port 55321 instead of 54321
const SUPABASE_URL = 'http://localhost:55321';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0';

// Direct PostgreSQL connection - Port 55322 instead of 54322
export const DATABASE_URL = 'postgresql://postgres:postgres@localhost:55322/postgres';

// Phase 1 default IDs
export const TEST_USER_ID = '00000000-0000-0000-0000-000000000001';
export const TEST_ASSISTANT_ID = '00000000-0000-0000-0000-000000000001';

// Test data prefix for identification
export const TEST_PREFIX = '[INTEGRATION_TEST]';

let testClient: SupabaseClient<Database> | null = null;

/**
 * Get or create test Supabase client
 */
export function getTestClient(): SupabaseClient<Database> {
  if (!testClient) {
    testClient = createClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY);
  }
  return testClient;
}

/**
 * Generate unique test ID prefix to isolate test data
 */
export function generateTestPrefix(): string {
  return `${TEST_PREFIX}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Clean up ALL old test data before starting new test
 * This ensures clean state even if previous test failed
 */
export async function cleanupOldTestData(
  client: SupabaseClient<Database>
): Promise<void> {
  // Find all test conversations by prefix
  const { data: conversations } = await client
    .from('conversations')
    .select('id')
    .like('title', `${TEST_PREFIX}%`);

  if (conversations && conversations.length > 0) {
    // Delete messages first (foreign key)
    for (const conv of conversations) {
      await client
        .from('messages')
        .delete()
        .eq('conversation_id', conv.id);
    }

    // Delete conversations
    await client
      .from('conversations')
      .delete()
      .like('title', `${TEST_PREFIX}%`);
  }
}

/**
 * Create a test conversation
 */
export async function createTestConversation(
  client: SupabaseClient<Database>,
  prefix: string
): Promise<string> {
  const { data, error } = await client
    .from('conversations')
    .insert({
      user_id: TEST_USER_ID,
      assistant_id: TEST_ASSISTANT_ID,
      title: prefix, // prefix already includes TEST_PREFIX
    })
    .select('id')
    .single();

  if (error) throw new Error(`Failed to create test conversation: ${error.message}`);
  return data.id;
}

/**
 * Create a test message
 */
export async function createTestMessage(
  client: SupabaseClient<Database>,
  conversationId: string,
  content: string,
  role: 'user' | 'assistant' = 'user',
  parentId: string | null = null
): Promise<string> {
  const { data, error } = await client
    .from('messages')
    .insert({
      conversation_id: conversationId,
      parent_id: parentId,
      role,
      content,
      status: 'complete',
    })
    .select('id')
    .single();

  if (error) throw new Error(`Failed to create test message: ${error.message}`);
  return data.id;
}

/**
 * Cleanup test conversation and all its messages
 */
export async function cleanupTestConversation(
  client: SupabaseClient<Database>,
  conversationId: string
): Promise<void> {
  // Delete messages first (foreign key constraint)
  await client
    .from('messages')
    .delete()
    .eq('conversation_id', conversationId);

  // Delete conversation
  await client
    .from('conversations')
    .delete()
    .eq('id', conversationId);
}

/**
 * Cleanup all test conversations (by title prefix)
 */
export async function cleanupAllTestData(
  client: SupabaseClient<Database>
): Promise<void> {
  // Find all test conversations
  const { data: conversations } = await client
    .from('conversations')
    .select('id')
    .like('title', '[TEST]%');

  if (conversations) {
    for (const conv of conversations) {
      await cleanupTestConversation(client, conv.id);
    }
  }
}

/**
 * Check if Supabase is available
 */
export async function isSupabaseAvailable(): Promise<boolean> {
  try {
    const client = getTestClient();
    const { error } = await client.from('assistants').select('id').limit(1);
    return !error;
  } catch {
    return false;
  }
}
