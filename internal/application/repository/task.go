package repository

import (
	"context"
	"errors"

	"github.com/task-management/task/internal/database"
	"github.com/task-management/task/internal/types"
	"github.com/task-management/task/internal/types/interfaces"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

// taskRepository implements interfaces.TaskRepository
type taskRepository struct {
	db *gorm.DB
}

// NewTaskRepository creates a new task repository
func NewTaskRepository() interfaces.TaskRepository {
	return &taskRepository{
		db: database.GetDB(),
	}
}

// orderLinks 链接按录入顺序返回
func orderLinks(db *gorm.DB) *gorm.DB {
	return db.Order("position ASC, id ASC")
}

// CreateTask creates a new task.
// Omit associations: 防止 task 上挂载的关联(如 Links)被 GORM 级联插入。
func (r *taskRepository) CreateTask(ctx context.Context, task *types.Task) error {
	return r.db.WithContext(ctx).Omit(clause.Associations).Create(task).Error
}

// GetTaskByID retrieves a task by ID
func (r *taskRepository) GetTaskByID(ctx context.Context, id string) (*types.Task, error) {
	var task types.Task
	err := r.db.WithContext(ctx).
		Preload("Creator").
		Preload("Tenant").
		Preload("TaskList").
		Preload("Links", orderLinks).
		Preload("Links.TargetTask").
		Where("id = ?", id).
		First(&task).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, nil
		}
		return nil, err
	}
	return &task, nil
}

// GetTasksByTenantID retrieves tasks by tenant ID with pagination
func (r *taskRepository) GetTasksByTenantID(ctx context.Context, tenantID uint64, offset, limit int) ([]*types.Task, int64, error) {
	var tasks []*types.Task
	var total int64

	query := r.db.WithContext(ctx).Model(&types.Task{}).Where("tenant_id = ?", tenantID)

	if err := query.Count(&total).Error; err != nil {
		return nil, 0, err
	}

	err := query.Preload("Creator").
		Preload("TaskList").
		Preload("Links", orderLinks).
		Preload("Links.TargetTask").
		Order("sort_order ASC, status_priority ASC, created_at DESC").
		Offset(offset).
		Limit(limit).
		Find(&tasks).Error

	return tasks, total, err
}

// UpdateTask updates a task.
// Omit associations: task 由 GetTaskByID 预加载了旧的 TaskList/Creator 等关联,
// 若不忽略,GORM Save 会用旧关联的主键回写外键(如 task_list_id),覆盖服务层刚设置的新值。
func (r *taskRepository) UpdateTask(ctx context.Context, task *types.Task) error {
	return r.db.WithContext(ctx).Omit(clause.Associations).Save(task).Error
}

// DeleteTask soft deletes a task
func (r *taskRepository) DeleteTask(ctx context.Context, id string) error {
	return r.db.WithContext(ctx).Delete(&types.Task{}, "id = ?", id).Error
}

// SearchTasks searches tasks by query string
func (r *taskRepository) SearchTasks(ctx context.Context, tenantID uint64, query string, filters types.TaskFilters, offset, limit int) ([]*types.Task, int64, error) {
	var tasks []*types.Task
	var total int64

	db := r.db.WithContext(ctx).Model(&types.Task{}).Where("tenant_id = ?", tenantID)

	// Add search conditions for title, description and result
	searchPattern := "%" + query + "%"
	db = db.Where("title ILIKE ? OR description ILIKE ? OR result ILIKE ?", searchPattern, searchPattern, searchPattern)

	// Apply additional filters
	db = r.applyFilters(db, filters)

	if err := db.Count(&total).Error; err != nil {
		return nil, 0, err
	}

	err := db.Preload("Creator").
		Preload("TaskList").
		Preload("Links", orderLinks).
		Preload("Links.TargetTask").
		Order("sort_order ASC, status_priority ASC, created_at DESC").
		Offset(offset).
		Limit(limit).
		Find(&tasks).Error

	return tasks, total, err
}

// FilterTasks filters tasks by given criteria
func (r *taskRepository) FilterTasks(ctx context.Context, tenantID uint64, filters types.TaskFilters, offset, limit int) ([]*types.Task, int64, error) {
	var tasks []*types.Task
	var total int64

	db := r.db.WithContext(ctx).Model(&types.Task{}).Where("tenant_id = ?", tenantID)

	// Apply filters
	db = r.applyFilters(db, filters)

	if err := db.Count(&total).Error; err != nil {
		return nil, 0, err
	}

	err := db.Preload("Creator").
		Preload("TaskList").
		Preload("Links", orderLinks).
		Preload("Links.TargetTask").
		Order("sort_order ASC, status_priority ASC, created_at DESC").
		Offset(offset).
		Limit(limit).
		Find(&tasks).Error

	return tasks, total, err
}

// applyFilters applies filters to the query
func (r *taskRepository) applyFilters(db *gorm.DB, filters types.TaskFilters) *gorm.DB {
	if len(filters.Status) > 0 {
		db = db.Where("status IN ?", filters.Status)
	}
	if filters.CreatorID != nil {
		db = db.Where("creator_id = ?", *filters.CreatorID)
	}
	if len(filters.Priority) > 0 {
		db = db.Where("priority IN ?", filters.Priority)
	}
	if len(filters.TaskListID) > 0 {
		db = db.Where("task_list_id IN ?", filters.TaskListID)
	}
	return db
}

// ReplaceTaskLinks 在单事务内整体替换某任务的链接（物理删除旧行后重插）
func (r *taskRepository) ReplaceTaskLinks(ctx context.Context, taskID string, links []*types.TaskLink) error {
	return r.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		if err := tx.Where("task_id = ?", taskID).Delete(&types.TaskLink{}).Error; err != nil {
			return err
		}
		if len(links) == 0 {
			return nil
		}
		return tx.Omit(clause.Associations).Create(&links).Error
	})
}

// CreateTaskLogs 批量写入任务日志
func (r *taskRepository) CreateTaskLogs(ctx context.Context, logs []*types.TaskLog) error {
	if len(logs) == 0 {
		return nil
	}
	return r.db.WithContext(ctx).Omit(clause.Associations).Create(&logs).Error
}

// GetTaskLogsByTaskID 分页查询任务日志（新的在前）
func (r *taskRepository) GetTaskLogsByTaskID(ctx context.Context, taskID string, offset, limit int) ([]*types.TaskLog, int64, error) {
	var logs []*types.TaskLog
	var total int64

	query := r.db.WithContext(ctx).Model(&types.TaskLog{}).Where("task_id = ?", taskID)

	if err := query.Count(&total).Error; err != nil {
		return nil, 0, err
	}

	err := query.
		Preload("Operator").
		Order("id DESC").
		Offset(offset).
		Limit(limit).
		Find(&logs).Error
	if err != nil {
		return nil, 0, err
	}

	return logs, total, nil
}

// MoveTasksToList reassigns all tasks in a list to another list (within a tenant)
func (r *taskRepository) MoveTasksToList(ctx context.Context, tenantID uint64, fromListID, toListID string) error {
	return r.db.WithContext(ctx).
		Model(&types.Task{}).
		Where("tenant_id = ? AND task_list_id = ?", tenantID, fromListID).
		Update("task_list_id", toListID).Error
}

// CountTasksByStatusPerList 按清单分组统计租户下指定状态的任务数（软删除任务自动排除）
func (r *taskRepository) CountTasksByStatusPerList(ctx context.Context, tenantID uint64, status types.TaskStatus) (map[string]int64, error) {
	var rows []struct {
		TaskListID string
		Count      int64
	}
	err := r.db.WithContext(ctx).
		Model(&types.Task{}).
		Select("task_list_id, COUNT(*) AS count").
		Where("tenant_id = ? AND status = ?", tenantID, status).
		Group("task_list_id").
		Scan(&rows).Error
	if err != nil {
		return nil, err
	}
	counts := make(map[string]int64, len(rows))
	for _, row := range rows {
		counts[row.TaskListID] = row.Count
	}
	return counts, nil
}
