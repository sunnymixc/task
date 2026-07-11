-- 任务执行过程管理字段
-- 执行状态：unplanned(未计划) / planning(计划中) / planned(已计划) / working(工作中) / completed(已完成)
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS execution_status VARCHAR(20) NOT NULL DEFAULT 'unplanned';
-- 执行计划：大文本，无字符上限
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS execution_plan TEXT;
-- 执行日志：大文本，无字符上限
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS execution_log TEXT;
-- 执行结果：大文本，无字符上限
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS execution_result TEXT;
