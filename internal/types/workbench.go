package types

import "time"

// TaskWorkbenchItem 用户工作台中的一条任务记录（membership + 行级视图偏好，硬删除）
type TaskWorkbenchItem struct {
	ID        uint64    `json:"id" gorm:"primaryKey"`
	TenantID  uint64    `json:"tenant_id" gorm:"not null"`
	UserID    string    `json:"user_id" gorm:"type:varchar(36);not null"`
	TaskID    string    `json:"task_id" gorm:"type:varchar(36);not null"`
	Collapsed bool      `json:"collapsed" gorm:"not null;default:false"`
	CreatedAt time.Time `json:"created_at"`
}

// WorkbenchTaskResponse 工作台任务响应：任务字段 + 行级折叠状态
type WorkbenchTaskResponse struct {
	*TaskResponse
	Collapsed bool `json:"collapsed"`
}

// TableName returns the table name for TaskWorkbenchItem
func (TaskWorkbenchItem) TableName() string {
	return "task_workbench"
}
