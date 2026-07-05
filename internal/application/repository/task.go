package repository

import (
	"context"
	"errors"

	"github.com/task-management/task/internal/database"
	"github.com/task-management/task/internal/types"
	"github.com/task-management/task/internal/types/interfaces"
	"gorm.io/gorm"
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

// CreateTask creates a new task
func (r *taskRepository) CreateTask(ctx context.Context, task *types.Task) error {
	return r.db.WithContext(ctx).Create(task).Error
}

// GetTaskByID retrieves a task by ID
func (r *taskRepository) GetTaskByID(ctx context.Context, id string) (*types.Task, error) {
	var task types.Task
	err := r.db.WithContext(ctx).
		Preload("Creator").
		Preload("Tenant").
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
		Order("created_at DESC").
		Offset(offset).
		Limit(limit).
		Find(&tasks).Error

	return tasks, total, err
}

// UpdateTask updates a task
func (r *taskRepository) UpdateTask(ctx context.Context, task *types.Task) error {
	return r.db.WithContext(ctx).Save(task).Error
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

	// Add search conditions for title and description
	searchPattern := "%" + query + "%"
	db = db.Where("title ILIKE ? OR description ILIKE ?", searchPattern, searchPattern)

	// Apply additional filters
	db = r.applyFilters(db, filters)

	if err := db.Count(&total).Error; err != nil {
		return nil, 0, err
	}

	err := db.Preload("Creator").
		Order("created_at DESC").
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
		Order("created_at DESC").
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
	return db
}
