-- Remove legacy one-time receipt material from retry results; capability derivation is keyed at runtime.
UPDATE client_commands SET result_json=result_json-'receiptToken' WHERE result_json ? 'receiptToken';
ALTER TABLE incidents ADD CONSTRAINT incident_status_valid CHECK(status IN ('RECEIVED','TRIAGED','WAITING_FOR_UNIT','OFFERED','ACCEPTED','EN_ROUTE_REPORTED','ARRIVAL_REPORTED','RESOLVED','CLOSED','CANCELLED'));
ALTER TABLE incidents ADD CONSTRAINT incident_category_valid CHECK(category IN ('TRAFFIC','MEDICAL','FIRE','PUBLIC_SAFETY','OTHER'));
ALTER TABLE assignments ADD CONSTRAINT assignment_status_valid CHECK(status IN ('OFFERED','ACCEPTED','ACTIVE','COMPLETED','DECLINED','EXPIRED','WITHDRAWN','REASSIGNED','ABORTED'));
