package types

import (
	"time"

	"gorm.io/gorm"
)

// TaskList represents a task list (任务清单); a task belongs to exactly one list
type TaskList struct {
	// Unique identifier: 24-character random English-letter code
	ID string `json:"id" gorm:"type:varchar(24);primaryKey"`
	// Tenant ID (for multi-tenant isolation)
	TenantID uint64 `json:"tenant_id" gorm:"index;not null"`
	// Title of the task list
	Title string `json:"title" gorm:"type:varchar(255);not null"`
	// Description of the task list
	Description string `json:"description" gorm:"type:text"`
	// Whether this is the tenant's default list (不可删除)
	IsDefault bool `json:"is_default" gorm:"not null;default:false"`
	// ID of the user who created this task list
	CreatorID string `json:"creator_id" gorm:"type:varchar(36);not null"`
	// Timestamps
	CreatedAt time.Time      `json:"created_at"`
	UpdatedAt time.Time      `json:"updated_at"`
	DeletedAt gorm.DeletedAt `json:"deleted_at,omitempty" gorm:"index"`

	// Associations (not stored in DB)
	Creator *User   `json:"creator,omitempty" gorm:"foreignKey:CreatorID"`
	Tenant  *Tenant `json:"tenant,omitempty" gorm:"foreignKey:TenantID"`
}

// TableName specifies the table name for TaskList model
func (TaskList) TableName() string {
	return "task_lists"
}

// CreateTaskListRequest 创建任务清单请求
type CreateTaskListRequest struct {
	Title       string `json:"title" binding:"required,min=1,max=255"`
	Description string `json:"description" binding:"max=5000"`
}

// UpdateTaskListRequest 更新任务清单请求
type UpdateTaskListRequest struct {
	Title       *string `json:"title" binding:"omitempty,min=1,max=255"`
	Description *string `json:"description" binding:"omitempty,max=5000"`
}

// ListTaskListsRequest 列出任务清单请求
type ListTaskListsRequest struct {
	Page     int `form:"page" binding:"min=1"`
	PageSize int `form:"page_size" binding:"min=1,max=100"`
}

// TaskListDetailResponse represents the response for a task list
type TaskListDetailResponse struct {
	ID          string    `json:"id"`
	TenantID    uint64    `json:"tenant_id"`
	Title       string    `json:"title"`
	Description string    `json:"description"`
	IsDefault   bool      `json:"is_default"`
	CreatorID   string    `json:"creator_id"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`

	// Nested objects
	Creator *UserInfo `json:"creator,omitempty"`
}

// TaskListInfo represents a simplified task list info (embedded in task responses)
type TaskListInfo struct {
	ID        string `json:"id"`
	Title     string `json:"title"`
	IsDefault bool   `json:"is_default"`
}

// ToResponse converts a TaskList to TaskListDetailResponse
func (l *TaskList) ToResponse() *TaskListDetailResponse {
	resp := &TaskListDetailResponse{
		ID:          l.ID,
		TenantID:    l.TenantID,
		Title:       l.Title,
		Description: l.Description,
		IsDefault:   l.IsDefault,
		CreatorID:   l.CreatorID,
		CreatedAt:   l.CreatedAt,
		UpdatedAt:   l.UpdatedAt,
	}

	if l.Creator != nil {
		resp.Creator = &UserInfo{
			ID:       l.Creator.ID,
			Username: l.Creator.Username,
			Email:    l.Creator.Email,
			Avatar:   l.Creator.Avatar,
		}
	}

	return resp
}
