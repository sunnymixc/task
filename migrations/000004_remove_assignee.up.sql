-- 000004_remove_assignee.up.sql
-- 移除任务的指派人字段
DROP INDEX IF EXISTS idx_tasks_assignee;
ALTER TABLE tasks DROP COLUMN IF EXISTS assignee_id;
