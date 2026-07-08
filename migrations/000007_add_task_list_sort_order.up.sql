-- 任务清单序号：正整数 1-1000，列表按 is_default DESC, sort_order ASC 排序
-- 幂等守护：仅当 sort_order 列不存在时才新增并回填，重放时不覆盖用户已调整的排序
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'task_lists' AND column_name = 'sort_order'
    ) THEN
        ALTER TABLE task_lists ADD COLUMN sort_order INTEGER NOT NULL DEFAULT 1;

        -- 存量清单按创建时间升序依次回填 1、2、3…（超出 1000 封顶）
        WITH ranked AS (
            SELECT id, ROW_NUMBER() OVER (PARTITION BY tenant_id ORDER BY created_at ASC) AS rn
            FROM task_lists
        )
        UPDATE task_lists SET sort_order = LEAST(ranked.rn, 1000)
        FROM ranked WHERE task_lists.id = ranked.id;
    END IF;
END $$;
