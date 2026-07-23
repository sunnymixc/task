package types

import (
	"time"

	"gorm.io/gorm"
)

// TaskStatus represents the status of a task
type TaskStatus string

const (
	TaskStatusDraft     TaskStatus = "draft"
	TaskStatusPending   TaskStatus = "pending"
	TaskStatusExecuting TaskStatus = "executing"
	TaskStatusCompleted TaskStatus = "completed"
)

// TaskExecutionStatus 任务执行状态（status = executing 时对执行过程的细化管理）
type TaskExecutionStatus string

const (
	TaskExecutionStatusUnplanned TaskExecutionStatus = "unplanned" // 未计划
	TaskExecutionStatusPlanning  TaskExecutionStatus = "planning"  // 计划中
	TaskExecutionStatusPlanned   TaskExecutionStatus = "planned"   // 已计划
	TaskExecutionStatusWorking   TaskExecutionStatus = "working"   // 工作中
	TaskExecutionStatusCompleted TaskExecutionStatus = "completed" // 已完成
)

// TaskPriority represents the priority of a task
type TaskPriority string

const (
	TaskPriorityLow    TaskPriority = "low"
	TaskPriorityMedium TaskPriority = "medium"
	TaskPriorityHigh   TaskPriority = "high"
)

// Valid status transitions for tasks
// Draft -> Pending
// Pending -> Executing
// Executing -> Completed
// Completed -> (no transitions)
var ValidStatusTransitions = map[TaskStatus][]TaskStatus{
	TaskStatusDraft:     {TaskStatusPending},
	TaskStatusPending:   {TaskStatusExecuting},
	TaskStatusExecuting: {TaskStatusCompleted},
	TaskStatusCompleted: {},
}

// statusPriorities 状态排序优先级，数值越小排序越靠前（与 000008 迁移中的 CASE 保持一致）
var statusPriorities = map[TaskStatus]int{
	TaskStatusExecuting: 1,
	TaskStatusPending:   2,
	TaskStatusDraft:     3,
	TaskStatusCompleted: 4,
}

// SortPriority returns the sort priority for the status (unknown statuses fall back to draft's)
func (s TaskStatus) SortPriority() int {
	if p, ok := statusPriorities[s]; ok {
		return p
	}
	return statusPriorities[TaskStatusDraft]
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
	// Result of the task (大文本，无字符上限)
	Result string `json:"result" gorm:"type:text"`
	// Current status of the task
	Status TaskStatus `json:"status" gorm:"type:varchar(20);not null;default:'draft'"`
	// Execution status (细化管理执行过程)
	ExecutionStatus TaskExecutionStatus `json:"execution_status" gorm:"type:varchar(20);not null;default:'unplanned'"`
	// Execution plan (大文本，无字符上限)
	ExecutionPlan string `json:"execution_plan" gorm:"type:text"`
	// Execution log (大文本，无字符上限)
	ExecutionLog string `json:"execution_log" gorm:"type:text"`
	// Execution result (大文本，无字符上限)
	ExecutionResult string `json:"execution_result" gorm:"type:text"`
	// Priority of the task
	Priority TaskPriority `json:"priority" gorm:"type:varchar(20);default:'medium'"`
	// Status sort priority derived from Status (internal, kept in sync by BeforeSave)
	StatusPriority int `json:"-" gorm:"type:integer;not null;default:3;index"`
	// 序号（1-100000000），0 表示未设置（默认，排最前），列表按序号升序优先排序
	SortOrder int `json:"sort_order" gorm:"type:integer;not null;default:0;index"`
	// ID of the user who created this task
	CreatorID string `json:"creator_id" gorm:"type:varchar(36);not null"`
	// ID of the task list this task belongs to (每个任务只属于一个清单)
	TaskListID string `json:"task_list_id" gorm:"type:varchar(24);not null;index"`
	// Due date for the task (nullable)
	DueDate *time.Time `json:"due_date"`
	// Timestamps
	CreatedAt time.Time      `json:"created_at"`
	UpdatedAt time.Time      `json:"updated_at"`
	DeletedAt gorm.DeletedAt `json:"deleted_at,omitempty" gorm:"index"`

	// Associations (not stored in DB)
	Creator  *User      `json:"creator,omitempty" gorm:"foreignKey:CreatorID"`
	Tenant   *Tenant    `json:"tenant,omitempty" gorm:"foreignKey:TenantID"`
	TaskList *TaskList  `json:"task_list,omitempty" gorm:"foreignKey:TaskListID"`
	Links    []TaskLink `json:"links,omitempty" gorm:"foreignKey:TaskID"`
}

// TableName specifies the table name for Task model
func (Task) TableName() string {
	return "tasks"
}

// BeforeSave 保存前由 Status 派生 StatusPriority（Create/Save 均触发，保证两者不脱节）
func (t *Task) BeforeSave(tx *gorm.DB) error {
	t.StatusPriority = t.Status.SortPriority()
	return nil
}

// CreateTaskRequest 创建任务请求
type CreateTaskRequest struct {
	Title           string              `json:"title" binding:"required,min=1,max=255"`
	Description     string              `json:"description" binding:"max=5000"`
	Result          string              `json:"result"`
	Status          TaskStatus          `json:"status" binding:"omitempty,oneof=draft pending executing completed"`
	ExecutionStatus TaskExecutionStatus `json:"execution_status" binding:"omitempty,oneof=unplanned planning planned working completed"`
	ExecutionPlan   string              `json:"execution_plan"`
	ExecutionLog    string              `json:"execution_log"`
	ExecutionResult string              `json:"execution_result"`
	Priority        TaskPriority        `json:"priority" binding:"omitempty,oneof=low medium high"`
	SortOrder       int                 `json:"sort_order" binding:"omitempty,min=1,max=100000000"`
	TaskListID      string              `json:"task_list_id" binding:"omitempty,len=24,alpha"`
	DueDate         *time.Time          `json:"due_date"`
	Links           []TaskLinkInput     `json:"links" binding:"omitempty,dive"`
}

// UpdateTaskRequest 更新任务请求
type UpdateTaskRequest struct {
	Title           *string              `json:"title" binding:"omitempty,min=1,max=255"`
	Description     *string              `json:"description" binding:"omitempty,max=5000"`
	Result          *string              `json:"result"`
	Status          *TaskStatus          `json:"status" binding:"omitempty,oneof=draft pending executing completed"`
	ExecutionStatus *TaskExecutionStatus `json:"execution_status" binding:"omitempty,oneof=unplanned planning planned working completed"`
	ExecutionPlan   *string              `json:"execution_plan"`
	ExecutionLog    *string              `json:"execution_log"`
	ExecutionResult *string              `json:"execution_result"`
	Priority        *TaskPriority        `json:"priority" binding:"omitempty,oneof=low medium high"`
	// 传 0 表示清除序号恢复默认（排最前），nil 表示不修改
	SortOrder  *int       `json:"sort_order" binding:"omitempty,min=0,max=100000000"`
	TaskListID *string    `json:"task_list_id" binding:"omitempty,len=24,alpha"`
	DueDate    *time.Time `json:"due_date"`
	// Links 为 nil 表示不修改链接；空数组表示清空；非空表示整体替换
	Links *[]TaskLinkInput `json:"links" binding:"omitempty,dive"`
}

// UpdateTaskStatusRequest 更新任务状态请求
type UpdateTaskStatusRequest struct {
	Status TaskStatus `json:"status" binding:"required,oneof=draft pending executing completed"`
}

// ListTasksRequest 列出任务请求
type ListTasksRequest struct {
	Status     []TaskStatus   `form:"status" binding:"omitempty,dive,oneof=draft pending executing completed"`
	CreatorID  *string        `form:"creator_id" binding:"omitempty,uuid"`
	Priority   []TaskPriority `form:"priority" binding:"omitempty,dive,oneof=low medium high"`
	TaskListID []string       `form:"task_list_id" binding:"omitempty,dive,len=24,alpha"`
	Page       int            `form:"page" binding:"min=1"`
	PageSize   int            `form:"page_size" binding:"min=1,max=100"`
}

// SearchTasksRequest 搜索任务请求
type SearchTasksRequest struct {
	Query    string `form:"q" binding:"required,min=1,max=100"`
	Page     int    `form:"page" binding:"min=1"`
	PageSize int    `form:"page_size" binding:"min=1,max=100"`
}

// TaskFilters represents filters for querying tasks
type TaskFilters struct {
	Status     []TaskStatus
	CreatorID  *string
	Priority   []TaskPriority
	TaskListID []string
}

// TaskResponse represents the response for a task
type TaskResponse struct {
	ID              string              `json:"id"`
	TenantID        uint64              `json:"tenant_id"`
	Title           string              `json:"title"`
	Description     string              `json:"description"`
	Result          string              `json:"result"`
	Status          TaskStatus          `json:"status"`
	ExecutionStatus TaskExecutionStatus `json:"execution_status"`
	ExecutionPlan   string              `json:"execution_plan"`
	ExecutionLog    string              `json:"execution_log"`
	ExecutionResult string              `json:"execution_result"`
	Priority        TaskPriority        `json:"priority"`
	SortOrder       int                 `json:"sort_order"`
	CreatorID       string              `json:"creator_id"`
	TaskListID      string              `json:"task_list_id"`
	DueDate         *time.Time          `json:"due_date"`
	CreatedAt       time.Time           `json:"created_at"`
	UpdatedAt       time.Time           `json:"updated_at"`

	// Nested objects
	Creator  *UserInfo      `json:"creator,omitempty"`
	TaskList *TaskListInfo  `json:"task_list,omitempty"`
	Links    []TaskLinkInfo `json:"links"`
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
		ID:              t.ID,
		TenantID:        t.TenantID,
		Title:           t.Title,
		Description:     t.Description,
		Result:          t.Result,
		Status:          t.Status,
		ExecutionStatus: t.ExecutionStatus,
		ExecutionPlan:   t.ExecutionPlan,
		ExecutionLog:    t.ExecutionLog,
		ExecutionResult: t.ExecutionResult,
		Priority:        t.Priority,
		SortOrder:       t.SortOrder,
		CreatorID:       t.CreatorID,
		TaskListID:      t.TaskListID,
		DueDate:         t.DueDate,
		CreatedAt:       t.CreatedAt,
		UpdatedAt:       t.UpdatedAt,
	}

	if t.Creator != nil {
		resp.Creator = &UserInfo{
			ID:       t.Creator.ID,
			Username: t.Creator.Username,
			Email:    t.Creator.Email,
			Avatar:   t.Creator.Avatar,
		}
	}

	if t.TaskList != nil {
		resp.TaskList = &TaskListInfo{
			ID:          t.TaskList.ID,
			Title:       t.TaskList.Title,
			IsDefault:   t.TaskList.IsDefault,
			ProjectPath: t.TaskList.ProjectPath,
		}
	}

	for _, l := range t.Links {
		info := TaskLinkInfo{
			ID:           l.ID,
			LinkType:     l.LinkType,
			Title:        l.Title,
			URL:          l.URL,
			TargetTaskID: l.TargetTaskID,
		}
		if l.TargetTask != nil {
			info.TargetTask = &LinkedTaskInfo{
				ID:     l.TargetTask.ID,
				Title:  l.TargetTask.Title,
				Status: l.TargetTask.Status,
			}
		}
		resp.Links = append(resp.Links, info)
	}

	return resp
}
