-- 任务清单(task_lists)及 tasks.task_list_id 关联

-- 1) 创建 task_lists 表
CREATE TABLE IF NOT EXISTS task_lists (
    id VARCHAR(24) PRIMARY KEY,
    tenant_id BIGINT NOT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    is_default BOOLEAN NOT NULL DEFAULT FALSE,
    creator_id VARCHAR(36) NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_task_lists_tenant ON task_lists(tenant_id);
CREATE INDEX IF NOT EXISTS idx_task_lists_creator ON task_lists(creator_id);
CREATE INDEX IF NOT EXISTS idx_task_lists_deleted_at ON task_lists(deleted_at);

-- 每个租户仅允许一个未删除的默认清单(并发创建时由该索引兜底)
CREATE UNIQUE INDEX IF NOT EXISTS uniq_task_lists_default_per_tenant
    ON task_lists(tenant_id) WHERE is_default = TRUE AND deleted_at IS NULL;

-- 2) 为每个已有租户回填一条默认清单
--    随机码子查询必须与租户行相关联(LATERAL 内引用 t.id),否则整条语句只求值一次随机码
INSERT INTO task_lists (id, tenant_id, title, description, is_default, creator_id)
SELECT code.v, t.id, '默认', '系统默认任务清单', TRUE,
       COALESCE((SELECT u.id FROM users u WHERE u.tenant_id = t.id ORDER BY u.created_at LIMIT 1), '')
FROM tenants t
CROSS JOIN LATERAL (
    SELECT string_agg(substr('ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz',
                             (floor(random() * 52) + 1)::int, 1), '') AS v
    FROM generate_series(1, 24)
    WHERE t.id IS NOT NULL
) code
WHERE t.deleted_at IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM task_lists tl
    WHERE tl.tenant_id = t.id AND tl.is_default = TRUE AND tl.deleted_at IS NULL
  );

-- 3) tasks 增加 task_list_id:先可空回填,再收紧为 NOT NULL
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS task_list_id VARCHAR(24);

UPDATE tasks
SET task_list_id = tl.id
FROM task_lists tl
WHERE tl.tenant_id = tasks.tenant_id
  AND tl.is_default = TRUE
  AND tl.deleted_at IS NULL
  AND tasks.task_list_id IS NULL;

ALTER TABLE tasks ALTER COLUMN task_list_id SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_tasks_task_list ON tasks(task_list_id);
