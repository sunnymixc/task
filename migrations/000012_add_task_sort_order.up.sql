-- 任务序号：正整数 1-100000000；0 表示未设置（默认，排最前），列表按 sort_order ASC 优先排序
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS sort_order INTEGER NOT NULL DEFAULT 0;
CREATE INDEX IF NOT EXISTS idx_tasks_sort_order ON tasks(sort_order);
