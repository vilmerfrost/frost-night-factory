-- =============================================================================
-- INVOICES TABLE MIGRATION
-- Matches Invoice interface from templates/fortress/types.ts
-- Uses snake_case for database columns (Postgres standard)
-- =============================================================================

-- Create invoices table with snake_case columns
CREATE TABLE IF NOT EXISTS invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- File metadata
  file_path TEXT NOT NULL,
  file_name TEXT,
  
  -- Status tracking (matches InvoiceStatus type)
  status TEXT NOT NULL DEFAULT 'uploaded' 
    CHECK (status IN ('uploaded', 'processing', 'processed', 'failed')),
  
  -- Headline fields (denormalized for quick table views)
  -- These match the Invoice interface fields
  invoice_number TEXT,
  vendor_name TEXT,
  invoice_date DATE,
  due_date DATE,
  total DECIMAL(15,2),
  currency TEXT DEFAULT 'SEK' 
    CHECK (currency IN ('SEK', 'EUR', 'USD')),
  
  -- Full extracted data as JSONB (matches InvoiceData interface)
  -- Structure: { invoiceNumber, vendorName, lineItems[], etc. }
  extracted JSONB,
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Users can only access their own invoices
CREATE POLICY "Users can view their own invoices"
  ON invoices FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own invoices"
  ON invoices FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own invoices"
  ON invoices FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own invoices"
  ON invoices FOR DELETE
  USING (auth.uid() = user_id);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_invoices_user_id ON invoices(user_id);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status);
CREATE INDEX IF NOT EXISTS idx_invoices_created_at ON invoices(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_invoices_invoice_number ON invoices(invoice_number);
CREATE INDEX IF NOT EXISTS idx_invoices_vendor_name ON invoices(vendor_name);

-- GIN index for JSONB extracted field (for querying invoice data)
CREATE INDEX IF NOT EXISTS idx_invoices_extracted_gin ON invoices USING GIN (extracted);

-- Trigger function to auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically update updated_at on row updates
CREATE TRIGGER update_invoices_updated_at
  BEFORE UPDATE ON invoices
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- =============================================================================
-- HELPER FUNCTIONS FOR JSONB QUERIES
-- =============================================================================

-- Function to search invoices by extracted invoice number
CREATE OR REPLACE FUNCTION search_invoices_by_number(search_text TEXT)
RETURNS TABLE (
  id UUID,
  user_id UUID,
  invoice_number TEXT,
  vendor_name TEXT,
  total DECIMAL(15,2),
  status TEXT,
  created_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    i.id,
    i.user_id,
    i.invoice_number,
    i.vendor_name,
    i.total,
    i.status,
    i.created_at
  FROM invoices i
  WHERE 
    i.invoice_number ILIKE '%' || search_text || '%'
    OR (i.extracted->>'invoiceNumber') ILIKE '%' || search_text || '%'
  ORDER BY i.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get invoice statistics for a user
CREATE OR REPLACE FUNCTION get_user_invoice_stats(p_user_id UUID)
RETURNS TABLE (
  total_count BIGINT,
  processed_count BIGINT,
  total_amount DECIMAL(15,2),
  currency TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COUNT(*)::BIGINT as total_count,
    COUNT(*) FILTER (WHERE status = 'processed')::BIGINT as processed_count,
    COALESCE(SUM(total), 0) as total_amount,
    COALESCE(MODE() WITHIN GROUP (ORDER BY currency), 'SEK') as currency
  FROM invoices
  WHERE user_id = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================================================
-- COMMENTS FOR DOCUMENTATION
-- =============================================================================

COMMENT ON TABLE invoices IS 'Stores invoice files and extracted invoice data';
COMMENT ON COLUMN invoices.extracted IS 'JSONB field containing InvoiceData structure: { invoiceNumber, vendorName, lineItems[], etc. }';
COMMENT ON COLUMN invoices.status IS 'Invoice processing status: uploaded, processing, processed, or failed';
COMMENT ON COLUMN invoices.currency IS 'Currency code: SEK, EUR, or USD';
