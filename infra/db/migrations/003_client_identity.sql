ALTER TABLE incidents ADD COLUMN client_request_id uuid;
ALTER TABLE incidents ADD COLUMN client_request_fingerprint text;
CREATE UNIQUE INDEX one_source_per_client_request ON incidents(client_request_id) WHERE client_request_id IS NOT NULL;
