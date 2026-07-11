package types

import (
	"time"
)

// TaskLinkType 任务链接类型
type TaskLinkType string

const (
	TaskLinkTypeURL  TaskLinkType = "url"
	TaskLinkTypeTask TaskLinkType = "task"
)

// TaskLink 任务链接（硬删除，随任务保存整体替换，无软删字段）
type TaskLink struct {
	ID           uint64       `json:"id" gorm:"primaryKey;autoIncrement"`
	TaskID       string       `json:"task_id" gorm:"type:varchar(36);not null;index"`
	LinkType     TaskLinkType `json:"link_type" gorm:"type:varchar(10);not null"`
	Title        string       `json:"title" gorm:"type:varchar(255);not null;default:''"`
	URL          string       `json:"url,omitempty" gorm:"type:text;not null;default:''"`
	TargetTaskID string       `json:"target_task_id,omitempty" gorm:"type:varchar(36);not null;default:''"`
	Position     int          `json:"position" gorm:"not null;default:0"`
	CreatedAt    time.Time    `json:"created_at"`
	UpdatedAt    time.Time    `json:"updated_at"`

	// 目标任务（仅 task 类型；目标任务被软删后 Preload 结果为 nil，前端据此降级展示）
	TargetTask *Task `json:"target_task,omitempty" gorm:"foreignKey:TargetTaskID"`
}

// TableName specifies the table name for TaskLink model
func (TaskLink) TableName() string {
	return "task_links"
}

// TaskLinkInput 创建/更新任务时提交的链接
type TaskLinkInput struct {
	LinkType     TaskLinkType `json:"link_type" binding:"required,oneof=url task"`
	Title        string       `json:"title" binding:"max=255"`
	URL          string       `json:"url" binding:"omitempty,max=2048"`
	TargetTaskID string       `json:"target_task_id" binding:"omitempty,uuid"`
}

// LinkedTaskInfo 任务链接目标任务的精简信息
type LinkedTaskInfo struct {
	ID     string     `json:"id"`
	Title  string     `json:"title"`
	Status TaskStatus `json:"status"`
}

// TaskLinkInfo 任务链接响应
type TaskLinkInfo struct {
	ID           uint64          `json:"id"`
	LinkType     TaskLinkType    `json:"link_type"`
	Title        string          `json:"title"`
	URL          string          `json:"url,omitempty"`
	TargetTaskID string          `json:"target_task_id,omitempty"`
	TargetTask   *LinkedTaskInfo `json:"target_task,omitempty"` // 目标任务被删时为 null
}
