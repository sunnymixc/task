-- Remove the "ended" task status: migrate existing ended tasks to completed
UPDATE tasks SET status = 'completed' WHERE status = 'ended';
