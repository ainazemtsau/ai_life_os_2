-- Phase 1: Chat application tables

-- Assistants: AI agent configurations
CREATE TABLE assistants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  system_prompt TEXT,
  provider TEXT NOT NULL DEFAULT 'openai',
  model TEXT NOT NULL DEFAULT 'gpt-5-mini',
  temperature NUMERIC(3,2) NOT NULL DEFAULT 0.7 CHECK (temperature >= 0 AND temperature <= 2),
  max_tokens INTEGER CHECK (max_tokens > 0),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  metadata JSONB
);

CREATE INDEX assistants_user_id_idx ON assistants(user_id);
CREATE INDEX assistants_status_idx ON assistants(status);

-- Conversations: chat threads
CREATE TABLE conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  assistant_id UUID NOT NULL REFERENCES assistants(id) ON DELETE CASCADE,
  title TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  metadata JSONB
);

CREATE INDEX conversations_user_id_idx ON conversations(user_id);
CREATE INDEX conversations_assistant_id_idx ON conversations(assistant_id);
CREATE INDEX conversations_updated_at_idx ON conversations(updated_at DESC);

-- Messages: tree structure with parent_id
CREATE TABLE messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  parent_id UUID REFERENCES messages(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'complete' CHECK (status IN ('pending', 'streaming', 'complete', 'error', 'stopped')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  metadata JSONB
);

CREATE INDEX messages_conversation_id_idx ON messages(conversation_id);
CREATE INDEX messages_parent_id_idx ON messages(parent_id);

-- Seed default assistant
INSERT INTO assistants (
  user_id,
  name,
  description,
  model,
  temperature,
  status
)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  'Assistant',
  'General-purpose AI assistant',
  'gpt-5-mini',
  0.7,
  'active'
);
