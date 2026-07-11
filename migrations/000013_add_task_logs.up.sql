-- 任务日志表：记录任务生命周期内的字段/状态变更（一行一个字段变更；create/delete 为独立事件行）
CREATE TABLE IF NOT EXISTS task_logs (
    id BIGSERIAL PRIMARY KEY,
    task_id VARCHAR(36) NOT NULL,
    tenant_id BIGINT NOT NULL,
    operator_id VARCHAR(36) NOT NULL DEFAULT '',
    action VARCHAR(20) NOT NULL,
    field_name VARCHAR(50) NOT NULL DEFAULT '',
    old_value TEXT NOT NULL DEFAULT '',
    new_value TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_task_logs_action CHECK (action IN ('create', 'update', 'status_change', 'delete'))
);

CREATE INDEX IF NOT EXISTS idx_task_logs_task ON task_logs(task_id, id DESC);
