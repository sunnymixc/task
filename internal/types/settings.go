package types

import (
	"database/sql/driver"
	"encoding/json"
	"errors"
	"time"
)

// SystemSettingsData 系统级全局设置文档（JSONB），加字段无需再迁移
type SystemSettingsData struct {
	// UIRadius 全局 UI 圆角（px）
	UIRadius int `json:"ui_radius"`
}

// Value implements driver.Valuer so GORM persists SystemSettingsData as JSON
func (d SystemSettingsData) Value() (driver.Value, error) {
	return json.Marshal(d)
}

// Scan implements sql.Scanner so GORM can hydrate SystemSettingsData back
func (d *SystemSettingsData) Scan(value interface{}) error {
	if value == nil {
		*d = SystemSettingsData{}
		return nil
	}
	var data []byte
	switch v := value.(type) {
	case []byte:
		data = v
	case string:
		data = []byte(v)
	default:
		return errors.New("SystemSettingsData.Scan: unsupported type")
	}
	if len(data) == 0 {
		*d = SystemSettingsData{}
		return nil
	}
	return json.Unmarshal(data, d)
}

// SystemSettings 系统设置单行表（id 恒为 1）
type SystemSettings struct {
	ID        int16              `json:"id" gorm:"primaryKey"`
	Data      SystemSettingsData `json:"data" gorm:"type:jsonb;not null;default:'{}'"`
	UpdatedBy string             `json:"updated_by" gorm:"type:varchar(36);not null;default:''"`
	CreatedAt time.Time          `json:"created_at"`
	UpdatedAt time.Time          `json:"updated_at"`
}

// TableName specifies the table name for SystemSettings model
func (SystemSettings) TableName() string {
	return "system_settings"
}

// UpdateSystemSettingsRequest 更新系统设置请求（指针字段 = 局部更新）
type UpdateSystemSettingsRequest struct {
	UIRadius *int `json:"ui_radius" binding:"omitempty,min=0,max=32"`
}
