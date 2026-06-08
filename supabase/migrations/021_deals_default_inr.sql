-- Default new deals to INR for this fork's deployment.
UPDATE deals
SET currency = 'INR'
WHERE currency IS NULL OR currency = '';

ALTER TABLE deals
  ALTER COLUMN currency SET DEFAULT 'INR';
