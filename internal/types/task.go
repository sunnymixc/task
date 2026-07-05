package types

import (
	"time"

	"gorm.io/gorm"
)

// TaskStatus represents the status of a task
type TaskStatus string

const (
	TaskStatusDraft      TaskStatus = "draft"
	TaskStatusPublished  TaskStatus = "published"
	TaskStatusInProgress TaskStatus = "in_progress"
	TaskStatusCompleted  TaskStatus = "completed"
	TaskStatusEnded      TaskStatus = "ended"
)

// TaskPriority represents the priority of a task
type TaskPriority string

const (
	TaskPriorityLow    TaskPriority = "low"
	TaskPriorityMedium TaskPriority = "medium"
	TaskPriorityHigh   TaskPriority = "high"
)

// Valid status transitions for tasks
// Draft -> Published, Ended
// Published -> InProgress, Ended
// InProgress -> Completed, Ended
// Completed -> Ended
// Ended -> (no transitions)
var ValidStatusTransitions = map[TaskStatus][]TaskStatus{
	TaskStatusDraft:      {TaskStatusPublished, TaskStatusEnded},
	TaskStatusPublished:  {TaskStatusInProgress, TaskStatusEnded},
	TaskStatusInProgress: {TaskStatusCompleted, TaskStatusEnded},
	TaskStatusCompleted:  {TaskStatusEnded},
	TaskStatusEnded:      {},
}

// IsValidTransition checks if a status transition from current to new is valid
func IsValidTransition(current, new TaskStatus) bool {
	allowed, ok := ValidStatusTransitions[current]
	if !ok {
		return false
	}
	for _, status := range allowed {
		if status == new {
			return true
		}
	}
	return false
}

// Task represents a task in the system
type Task struct {
	// Unique identifier of the task
	ID string `json:"id" gorm:"type:varchar(36);primaryKey"`
	// Tenant ID (for multi-tenant isolation)
	TenantID uint64 `json:"tenant_id" gorm:"index;not null"`
	// Title of the task
	Title string `json:"title" gorm:"type:varchar(255);not null"`
	// Description of the task
	Description string `json:"description" gorm:"type:text"`
	// Current status of the task
	Status TaskStatus `json:"status" gorm:"type:varchar(20);not null;default:'draft'"`
	// Priority of the task
	Priority TaskPriority `json:"priority" gorm:"type:varchar(20);default:'medium'"`
	// ID of the user assigned to this task (nullable)
	AssigneeID *string `json:"assignee_id" gorm:"type:varchar(36)"`
	// ID of the user who created this task
	CreatorID string `json:"creator_id" gorm:"type:varchar(36);not null"`
	// Due date for the task (nullable)
	DueDate *time.Time `json:"due_date"`
	// Timestamps
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
	DeletedAt gorm.DeletedAt `json:"deleted_at,omitempty" gorm:"index"`

	// Associations (not stored in DB)
	Assignee *User   `json:"assignee,omitempty" gorm:"foreignKey:AssigneeID"`
	Creator  *User   `json:"creator,omitempty" gorm:"foreignKey:CreatorID"`
	Tenant   *Tenant `json:"tenant,omitempty" gorm:"foreignKey:TenantID"`
}

// TableName specifies the table name for Task model
func (Task) TableName() string {
	return "tasks"
}

// CreateTaskRequest 创建任务请求
type CreateTaskRequest struct {
	Title       string       `json:"title" binding:"required,min=1,max=255"`
	Description string       `json:"description" binding:"max=5000"`
	Status      TaskStatus   `json:"status" binding:"omitempty,oneof=draft published in_progress completed ended"`
	Priority    TaskPriority `json:"priority" binding:"omitempty,oneof=low medium high"`
	AssigneeID  *string      `json:"assignee_id" binding:"omitempty,uuid"`
	DueDate     *time.Time   `json:"due_date"`
}

// UpdateTaskRequest 更新任务请求
type UpdateTaskRequest struct {
	Title       *string       `json:"title" binding:"omitempty,min=1,max=255"`
	Description *string       `json:"description" binding:"omitempty,max=5000"`
	Status      *TaskStatus   `json:"status" binding:"omitempty,oneof=draft published in_progress completed ended"`
	Priority    *TaskPriority `json:"priority" binding:"omitempty,oneof=low medium high"`
	AssigneeID  *string       `json:"assignee_id" binding:"omitempty,uuid"`
	DueDate     *time.Time    `json:"due_date"`
}

// UpdateTaskStatusRequest 更新任务状态请求
type UpdateTaskStatusRequest struct {
	Status TaskStatus `json:"status" binding:"required,oneof=draft published in_progress completed ended"`
}

// ListTasksRequest 列出任务请求
type ListTasksRequest struct {
	Status     []TaskStatus  `form:"status" binding:"omitempty,dive,oneof=draft published in_progress completed ended"`
	AssigneeID *string       `form:"assignee_id" binding:"omitempty,uuid"`
	CreatorID  *string       `form:"creator_id" binding:"omitempty,uuid"`
	Priority   []TaskPriority `form:"priority" binding:"omitempty,dive,oneof=low medium high"`
	Page       int          `form:"page" binding:"min=1"`
	PageSize   int          `form:"page_size" binding:"min=1,max=100"`
}

// SearchTasksRequest 搜索任务请求
type SearchTasksRequest struct {
	Query   string `form:"q" binding:"required,min=1,max=100"`
	Page    int    `form:"page" binding:"min=1"`
	PageSize int   `form:"page_size" binding:"min=1,max=100"`
}

// TaskFilters represents filters for querying tasks
type TaskFilters struct {
	Status     []TaskStatus
	AssigneeID *string
	CreatorID  *string
	Priority   []TaskPriority
}

// TaskResponse represents the response for a task
type TaskResponse struct {
	ID          string       `json:"id"`
	TenantID    uint64       `json:"tenant_id"`
	Title       string       `json:"title"`
	Description string       `json:"description"`
	Status      TaskStatus   `json:"status"`
	Priority    TaskPriority `json:"priority"`
	AssigneeID  *string      `json:"assignee_id"`
	CreatorID   string       `json:"creator_id"`
	DueDate     *time.Time   `json:"due_date"`
	CreatedAt   time.Time    `json:"created_at"`
	UpdatedAt   time.Time    `json:"updated_at"`

	// Nested objects
	Assignee *UserInfo `json:"assignee,omitempty"`
	Creator  *UserInfo `json:"creator,omitempty"`
}

// UserInfo represents a simplified user info
type UserInfo struct {
	ID       string `json:"id"`
	Username string `json:"username"`
	Email    string `json:"email"`
	Avatar   string `json:"avatar"`
}

// ToResponse converts a Task to TaskResponse
func (t *Task) ToResponse() *TaskResponse {
	resp := &TaskResponse{
		ID:          t.ID,
		TenantID:    t.TenantID,
		Title:       t.Title,
		Description: t.Description,
		Status:      t.Status,
		Priority:    t.Priority,
		AssigneeID:  t.AssigneeID,
		CreatorID:   t.CreatorID,
		DueDate:     t.DueDate,
		CreatedAt:   t.CreatedAt,
		UpdatedAt:   t.UpdatedAt,
	}

	if t.Assignee != nil {
		resp.Assignee = &UserInfo{
			ID:       t.Assignee.ID,
			Username: t.Assignee.Username,
			Email:    t.Assignee.Email,
			Avatar:   t.Assignee.Avatar,
		}
	}

	if t.Creator != nil {
		resp.Creator = &UserInfo{
			ID:       t.Creator.ID,
			Username: t.Creator.Username,
			Email:    t.Creator.Email,
			Avatar:   t.Creator.Avatar,
		}
	}

	return resp
}
