-- 任务状态优先级：列表按 status_priority ASC 排序（执行中=1、待执行=2、草稿=3、已完成=4）
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS status_priority INTEGER NOT NULL DEFAULT 3;

-- 刷新存量数据：按状态回填优先级
UPDATE tasks SET status_priority = CASE status
    WHEN 'running'   THEN 1
    WHEN 'pending'   THEN 2
    WHEN 'draft'     THEN 3
    WHEN 'completed' THEN 4
    ELSE 3
END;

CREATE INDEX IF NOT EXISTS idx_tasks_status_priority ON tasks(status_priority);
