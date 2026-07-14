-- 全局管理员标记
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_admin BOOLEAN NOT NULL DEFAULT FALSE;

-- 回填：已有用户且无管理员时，最早注册的未删除用户成为管理员
UPDATE users SET is_admin = TRUE
WHERE id = (SELECT id FROM users WHERE deleted_at IS NULL ORDER BY created_at ASC, id ASC LIMIT 1)
  AND NOT EXISTS (SELECT 1 FROM users WHERE is_admin = TRUE);

-- 系统设置（单行表，data 为 JSONB 设置文档）
CREATE TABLE IF NOT EXISTS system_settings (
    id SMALLINT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
    data JSONB NOT NULL DEFAULT '{}',
    updated_by VARCHAR(36) NOT NULL DEFAULT '',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO system_settings (id, data) VALUES (1, '{"ui_radius": 1}')
ON CONFLICT (id) DO NOTHING;
