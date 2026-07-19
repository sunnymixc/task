package types

import "time"

// TaskWorkbenchItem 用户工作台中的一条任务记录（纯 membership，硬删除）
type TaskWorkbenchItem struct {
	ID        uint64    `json:"id" gorm:"primaryKey"`
	TenantID  uint64    `json:"tenant_id" gorm:"not null"`
	UserID    string    `json:"user_id" gorm:"type:varchar(36);not null"`
	TaskID    string    `json:"task_id" gorm:"type:varchar(36);not null"`
	CreatedAt time.Time `json:"created_at"`
}

// TableName returns the table name for TaskWorkbenchItem
func (TaskWorkbenchItem) TableName() string {
	return "task_workbench"
}
