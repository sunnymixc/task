-- Rename task status value: running -> executing
UPDATE tasks SET status = 'executing' WHERE status = 'running';
