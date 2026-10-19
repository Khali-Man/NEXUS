ALTER TABLE audit_checkpoints ADD COLUMN signed_payload jsonb;
ALTER TABLE audit_checkpoints ADD COLUMN algorithm text;
CREATE TRIGGER audit_checkpoints_append_only BEFORE UPDATE OR DELETE ON audit_checkpoints
FOR EACH ROW EXECUTE FUNCTION protect_events();
