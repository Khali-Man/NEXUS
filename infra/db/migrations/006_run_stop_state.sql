-- Reset retains run history and records why a workflow can no longer advance.
ALTER TABLE scenario_runs ADD COLUMN stopped_at timestamptz;
ALTER TABLE scenario_runs ADD COLUMN stop_reason text;
