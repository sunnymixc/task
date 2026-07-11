-- 任务链接表：URL 链接与任务间链接，随任务整体替换（硬删除，无 deleted_at）
CREATE TABLE IF NOT EXISTS task_links (
    id BIGSERIAL PRIMARY KEY,
    task_id VARCHAR(36) NOT NULL,
    link_type VARCHAR(10) NOT NULL,
    title VARCHAR(255) NOT NULL DEFAULT '',
    url TEXT NOT NULL DEFAULT '',
    target_task_id VARCHAR(36) NOT NULL DEFAULT '',
    position INT NOT NULL DEFAULT 0,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_task_links_type CHECK (link_type IN ('url', 'task')),
    CONSTRAINT chk_task_links_shape CHECK (
        (link_type = 'url'  AND url <> '' AND title <> '')
        OR
        (link_type = 'task' AND target_task_id <> '' AND target_task_id <> task_id)
    )
);

CREATE INDEX IF NOT EXISTS idx_task_links_task ON task_links(task_id);
CREATE INDEX IF NOT EXISTS idx_task_links_target_task ON task_links(target_task_id);
