-- 工作台面板折叠状态：按 (tenant,user,task) 行级持久化的视图偏好
ALTER TABLE task_workbench ADD COLUMN IF NOT EXISTS collapsed BOOLEAN NOT NULL DEFAULT FALSE;
