-- Preserve existing tickets and replies while adding a distinct triage state.
ALTER TABLE support_tickets ADD COLUMN processing INTEGER NOT NULL DEFAULT 0 CHECK(processing IN (0,1));
