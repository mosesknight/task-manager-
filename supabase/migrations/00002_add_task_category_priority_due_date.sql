
-- Add category column with check constraint
ALTER TABLE tasks ADD COLUMN category text NOT NULL DEFAULT 'Personal';
ALTER TABLE tasks ADD CONSTRAINT tasks_category_check CHECK (category IN ('Work', 'Personal', 'Shopping', 'Health'));

-- Add priority column with check constraint
ALTER TABLE tasks ADD COLUMN priority text NOT NULL DEFAULT 'Medium';
ALTER TABLE tasks ADD CONSTRAINT tasks_priority_check CHECK (priority IN ('High', 'Medium', 'Low'));

-- Add due_date column (nullable)
ALTER TABLE tasks ADD COLUMN due_date timestamptz;

-- Add index for due_date filtering
CREATE INDEX tasks_due_date_idx ON tasks(due_date);
