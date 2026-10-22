-- Agency-scoped injection intent, separate from time-dependent unit freshness.
-- Existing historical unit mutations cannot establish a previously enabled fault.
CREATE TABLE simulation_unit_faults (
  agency_id uuid PRIMARY KEY REFERENCES agencies(id),
  stale_locations boolean NOT NULL DEFAULT false,
  unit_unavailable boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now()
);
