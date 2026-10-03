-- Seller, rider and admin workflows. Idempotent: safe to run on every boot.
SET search_path TO shop, public;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_schema = 'shop' AND table_name = 'delivery_agents' AND column_name = 'approval_status') THEN
    -- riders that already exist are treated as approved; new sign-ups start as pending
    ALTER TABLE delivery_agents ADD COLUMN approval_status vendor_status NOT NULL DEFAULT 'approved';
    ALTER TABLE delivery_agents ALTER COLUMN approval_status SET DEFAULT 'pending';
  END IF;
END $$;

-- seller marks a package packed before riders can claim it
ALTER TABLE shipments       ADD COLUMN IF NOT EXISTS packed_at       TIMESTAMPTZ;
-- return pickups are claimed by riders like deliveries
ALTER TABLE return_requests ADD COLUMN IF NOT EXISTS pickup_agent_id BIGINT REFERENCES delivery_agents(id);
ALTER TABLE return_requests ADD COLUMN IF NOT EXISTS refund_amount   NUMERIC(12,2);
ALTER TABLE return_requests ADD COLUMN IF NOT EXISTS picked_up_at    TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_shipments_open_jobs ON shipments(status) WHERE delivery_agent_id IS NULL;
CREATE INDEX IF NOT EXISTS idx_returns_status      ON return_requests(status);
