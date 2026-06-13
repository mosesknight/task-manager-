
-- Add tags column as text array with empty default
ALTER TABLE tasks ADD COLUMN tags text[] NOT NULL DEFAULT '{}';

-- Add index for tag filtering
CREATE INDEX tasks_tags_idx ON tasks USING GIN(tags);
