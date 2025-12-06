-- =============================================================================
-- PRODUCTION ALERTS TABLE - Track cost spikes and success rate drops
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.production_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  alert_type TEXT NOT NULL, -- 'cost_spike', 'success_rate_drop', 'model_failure'
  severity TEXT NOT NULL, -- 'warning', 'critical'
  message TEXT NOT NULL,
  details JSONB DEFAULT '{}'::JSONB,
  acknowledged BOOLEAN DEFAULT false,
  acknowledged_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for fast queries
CREATE INDEX IF NOT EXISTS idx_production_alerts_type ON public.production_alerts(alert_type);
CREATE INDEX IF NOT EXISTS idx_production_alerts_severity ON public.production_alerts(severity);
CREATE INDEX IF NOT EXISTS idx_production_alerts_acknowledged ON public.production_alerts(acknowledged);
CREATE INDEX IF NOT EXISTS idx_production_alerts_created_at ON public.production_alerts(created_at DESC);

