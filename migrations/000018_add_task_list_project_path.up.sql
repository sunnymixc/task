-- 任务清单增加项目路径：任务的 AI 终端初始化时默认进入该目录
ALTER TABLE task_lists ADD COLUMN IF NOT EXISTS project_path VARCHAR(1024) NOT NULL DEFAULT '';
