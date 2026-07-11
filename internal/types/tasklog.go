package types

import "time"

// TaskLogAction 任务日志动作类型
type TaskLogAction string

const (
	TaskLogActionCreate       TaskLogAction = "create"
	TaskLogActionUpdate       TaskLogAction = "update"
	TaskLogActionStatusChange TaskLogAction = "status_change"
	TaskLogActionDelete       TaskLogAction = "delete"
)

// TaskLog 任务变更日志（仅追加；任务软删后保留）
type TaskLog struct {
	ID         uint64        `json:"id" gorm:"primaryKey;autoIncrement"`
	TaskID     string        `json:"task_id" gorm:"type:varchar(36);not null;index"`
	TenantID   uint64        `json:"tenant_id" gorm:"not null"`
	OperatorID string        `json:"operator_id" gorm:"type:varchar(36);not null;default:''"`
	Action     TaskLogAction `json:"action" gorm:"type:varchar(20);not null"`
	FieldName  string        `json:"field_name" gorm:"type:varchar(50);not null;default:''"`
	OldValue   string        `json:"old_value" gorm:"type:text;not null;default:''"`
	NewValue   string        `json:"new_value" gorm:"type:text;not null;default:''"`
	CreatedAt  time.Time     `json:"created_at"`

	// Associations
	Operator *User `json:"operator,omitempty" gorm:"foreignKey:OperatorID"`
}

// TableName specifies the table name for TaskLog
func (TaskLog) TableName() string {
	return "task_logs"
}

// TaskLogResponse represents a task log in API responses
type TaskLogResponse struct {
	ID        uint64        `json:"id"`
	TaskID    string        `json:"task_id"`
	Action    TaskLogAction `json:"action"`
	FieldName string        `json:"field_name"`
	OldValue  string        `json:"old_value"`
	NewValue  string        `json:"new_value"`
	Operator  *UserInfo     `json:"operator,omitempty"`
	CreatedAt time.Time     `json:"created_at"`
}

// ToResponse converts a TaskLog to TaskLogResponse
func (l *TaskLog) ToResponse() *TaskLogResponse {
	resp := &TaskLogResponse{
		ID:        l.ID,
		TaskID:    l.TaskID,
		Action:    l.Action,
		FieldName: l.FieldName,
		OldValue:  l.OldValue,
		NewValue:  l.NewValue,
		CreatedAt: l.CreatedAt,
	}

	if l.Operator != nil {
		resp.Operator = &UserInfo{
			ID:       l.Operator.ID,
			Username: l.Operator.Username,
			Email:    l.Operator.Email,
			Avatar:   l.Operator.Avatar,
		}
	}

	return resp
}
