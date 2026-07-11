-- 任务结果：大文本，无字符上限
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS result TEXT;
