-- Phase 1: Observability - Usage metrics tracking
--
-- Separate table for analytics: enables clean aggregation queries
-- without joining message content. Retention: indefinite for historical
-- cost analysis (Decision Log: Retention policy).

CREATE TABLE usage_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- CASCADE DELETE: privacy compliance over analytics preservation
  -- (Decision Log: CASCADE DELETE for metrics). When conversation deleted,
  -- metrics also removed for GDPR-style data minimization.
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  -- Invariant: Nullable to allow usage tracking without message binding (e.g., tool calls, agent reasoning).
  message_id UUID REFERENCES messages(id) ON DELETE CASCADE,
  model TEXT NOT NULL,
  -- Invariant: All token counts must be non-negative. totalTokens >= inputTokens + outputTokens is valid (reasoning tokens).
  input_tokens INTEGER NOT NULL CHECK (input_tokens >= 0),
  output_tokens INTEGER NOT NULL CHECK (output_tokens >= 0),
  total_tokens INTEGER NOT NULL CHECK (total_tokens >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for conversation-level aggregations (cost tracking dashboard queries)
CREATE INDEX idx_usage_metrics_conversation_created
  ON usage_metrics(conversation_id, created_at DESC);

-- Partial index: only when message_id exists (reduces index size)
CREATE INDEX idx_usage_metrics_message_id
  ON usage_metrics(message_id)
  WHERE message_id IS NOT NULL;
