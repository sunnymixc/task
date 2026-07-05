package repository

import (
	"context"
	"errors"

	"github.com/task-management/task/internal/database"
	"github.com/task-management/task/internal/types"
	"github.com/task-management/task/internal/types/interfaces"
	"gorm.io/gorm"
)

// taskListRepository implements interfaces.TaskListRepository
type taskListRepository struct {
	db *gorm.DB
}

// NewTaskListRepository creates a new task list repository
func NewTaskListRepository() interfaces.TaskListRepository {
	return &taskListRepository{
		db: database.GetDB(),
	}
}

// CreateTaskList creates a new task list
func (r *taskListRepository) CreateTaskList(ctx context.Context, list *types.TaskList) error {
	return r.db.WithContext(ctx).Create(list).Error
}

// GetTaskListByID retrieves a task list by ID
func (r *taskListRepository) GetTaskListByID(ctx context.Context, id string) (*types.TaskList, error) {
	var list types.TaskList
	err := r.db.WithContext(ctx).
		Preload("Creator").
		Where("id = ?", id).
		First(&list).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, nil
		}
		return nil, err
	}
	return &list, nil
}

// GetTaskListsByTenantID retrieves task lists by tenant ID with pagination
func (r *taskListRepository) GetTaskListsByTenantID(ctx context.Context, tenantID uint64, offset, limit int) ([]*types.TaskList, int64, error) {
	var lists []*types.TaskList
	var total int64

	query := r.db.WithContext(ctx).Model(&types.TaskList{}).Where("tenant_id = ?", tenantID)

	if err := query.Count(&total).Error; err != nil {
		return nil, 0, err
	}

	err := query.Preload("Creator").
		Order("is_default DESC, created_at DESC").
		Offset(offset).
		Limit(limit).
		Find(&lists).Error

	return lists, total, err
}

// GetDefaultTaskList retrieves the tenant's default task list
func (r *taskListRepository) GetDefaultTaskList(ctx context.Context, tenantID uint64) (*types.TaskList, error) {
	var list types.TaskList
	err := r.db.WithContext(ctx).
		Where("tenant_id = ? AND is_default = ?", tenantID, true).
		First(&list).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, nil
		}
		return nil, err
	}
	return &list, nil
}

// UpdateTaskList updates a task list
func (r *taskListRepository) UpdateTaskList(ctx context.Context, list *types.TaskList) error {
	return r.db.WithContext(ctx).Save(list).Error
}

// DeleteTaskList soft deletes a task list
func (r *taskListRepository) DeleteTaskList(ctx context.Context, id string) error {
	return r.db.WithContext(ctx).Delete(&types.TaskList{}, "id = ?", id).Error
}
