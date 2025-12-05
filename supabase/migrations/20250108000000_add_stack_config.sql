-- =============================================================================
-- ADD STACK CONFIG TO TICKETS TABLE
-- =============================================================================

-- Add stack_config column to tickets
ALTER TABLE tickets 
ADD COLUMN IF NOT EXISTS stack_config JSONB DEFAULT '{
  "frontend": "nextjs-16",
  "backend": "none",
  "ui": "shadcn",
  "features": []
}'::jsonb;

-- Add priority column (if not exists)
ALTER TABLE tickets 
ADD COLUMN IF NOT EXISTS priority TEXT DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high'));

-- Add metadata column for ports and other runtime data
ALTER TABLE tickets 
ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;

-- Create index for stack queries
CREATE INDEX IF NOT EXISTS idx_tickets_stack_config 
ON tickets USING gin(stack_config);

-- Create index for priority queries
CREATE INDEX IF NOT EXISTS idx_tickets_priority 
ON tickets(priority);

-- Add comments
COMMENT ON COLUMN tickets.stack_config IS 'User-selected tech stack configuration (frontend, backend, UI library, features)';
COMMENT ON COLUMN tickets.metadata IS 'Runtime metadata (ports, timestamps, etc.)';
COMMENT ON COLUMN tickets.priority IS 'Ticket priority: low, medium, or high';

