-- Enable Row Level Security (RLS) for Alert table
ALTER TABLE alert ENABLE ROW LEVEL SECURITY;

-- Create policy for org_id isolation on Alert table
CREATE POLICY alert_org_isolation ON alert
  USING (org_id = current_setting('app.current_org_id')::uuid)
  WITH CHECK (org_id = current_setting('app.current_org_id')::uuid);

-- Enable RLS for AlertEvent table
ALTER TABLE alert_event ENABLE ROW LEVEL SECURITY;

-- Create policy for org_id isolation on AlertEvent table
CREATE POLICY alert_event_org_isolation ON alert_event
  USING (org_id = current_setting('app.current_org_id')::uuid)
  WITH CHECK (org_id = current_setting('app.current_org_id')::uuid);

-- Make sure postgres role can bypass RLS
ALTER DEFAULT ROLE postgres IN SECURITY LABEL for 'rls' IS 'bypass';
