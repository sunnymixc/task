-- Rename task status values: published -> pending, in_progress -> running
UPDATE tasks SET status = 'pending' WHERE status = 'published';
UPDATE tasks SET status = 'running' WHERE status = 'in_progress';
