-- =============================================================================
-- ADD STACK CONFIG TO FROST_TICKETS
-- =============================================================================

-- Add stack_config column to frost_tickets
ALTER TABLE frost_tickets 
ADD COLUMN IF NOT EXISTS stack_config JSONB DEFAULT '{
  "frontend": "nextjs-16",
  "backend": "none",
  "ui": "shadcn",
  "features": []
}'::jsonb;

-- Add metadata column for ports and other runtime data
ALTER TABLE frost_tickets 
ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;

-- Create index for stack queries
CREATE INDEX IF NOT EXISTS idx_frost_tickets_stack_config 
ON frost_tickets USING gin(stack_config);

-- Add comment
COMMENT ON COLUMN frost_tickets.stack_config IS 'User-selected tech stack configuration (frontend, backend, UI library, features)';
COMMENT ON COLUMN frost_tickets.metadata IS 'Runtime metadata (ports, timestamps, etc.)';

