-- 任务工作台：用户钉选任务的 membership 表（硬删除，无 deleted_at）
CREATE TABLE IF NOT EXISTS task_workbench (
    id BIGSERIAL PRIMARY KEY,
    tenant_id BIGINT NOT NULL,
    user_id VARCHAR(36) NOT NULL,
    task_id VARCHAR(36) NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 去重交给数据库：重复加入由 ON CONFLICT DO NOTHING 幂等处理
CREATE UNIQUE INDEX IF NOT EXISTS uq_task_workbench_user_task
    ON task_workbench(tenant_id, user_id, task_id);

CREATE INDEX IF NOT EXISTS idx_task_workbench_user
    ON task_workbench(tenant_id, user_id, created_at);
