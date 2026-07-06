-- 任务清单序号：正整数 1-1000，列表按 is_default DESC, sort_order ASC 排序
ALTER TABLE task_lists ADD COLUMN sort_order INTEGER NOT NULL DEFAULT 1;

-- 存量清单按创建时间升序依次回填 1、2、3…（超出 1000 封顶）
WITH ranked AS (
    SELECT id, ROW_NUMBER() OVER (PARTITION BY tenant_id ORDER BY created_at ASC) AS rn
    FROM task_lists
)
UPDATE task_lists SET sort_order = LEAST(ranked.rn, 1000)
FROM ranked WHERE task_lists.id = ranked.id;
