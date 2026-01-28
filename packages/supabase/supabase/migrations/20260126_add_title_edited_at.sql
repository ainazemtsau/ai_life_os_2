-- Add title editing tracking to conversations
ALTER TABLE conversations
  ADD COLUMN title_edited_at TIMESTAMPTZ;
CREATE INDEX conversations_title_edited_at_idx ON conversations(title_edited_at);
