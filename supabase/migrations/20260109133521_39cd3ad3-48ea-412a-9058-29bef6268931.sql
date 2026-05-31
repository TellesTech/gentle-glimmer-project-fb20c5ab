-- Change status column from enum to text to allow free-form input
ALTER TABLE projects 
ALTER COLUMN status TYPE TEXT;