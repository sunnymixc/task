-- 圆角默认值改为「默认」(6px)；仅更新从未被手动修改过的旧默认值
UPDATE system_settings
SET data = jsonb_set(data, '{ui_radius}', '6'),
    updated_at = CURRENT_TIMESTAMP
WHERE id = 1
  AND updated_by = ''
  AND (data->>'ui_radius')::int = 14;
