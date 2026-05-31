-- Add new status values to report_status enum
ALTER TYPE report_status ADD VALUE IF NOT EXISTS 'sent';
ALTER TYPE report_status ADD VALUE IF NOT EXISTS 'signed';
ALTER TYPE report_status ADD VALUE IF NOT EXISTS 'finalized';