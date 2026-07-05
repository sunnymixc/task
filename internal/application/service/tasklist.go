package service

import (
	"context"
	"errors"
	"fmt"

	"github.com/task-management/task/internal/application/repository"
	"github.com/task-management/task/internal/types"
	"github.com/task-management/task/internal/types/interfaces"
	"github.com/task-management/task/internal/util"
)

// taskListService implements interfaces.TaskListService
type taskListService struct {
	taskListRepo interfaces.TaskListRepository
	taskRepo     interfaces.TaskRepository
	userRepo     interfaces.UserRepository
}

var (
	// ErrTaskListNotFound is returned when a task list is not found
	ErrTaskListNotFound = errors.New("task list not found")
	// ErrCannotDeleteDefaultList is returned when trying to delete the default task list
	ErrCannotDeleteDefaultList = errors.New("cannot delete the default task list")
)

// NewTaskListService creates a new task list service
func NewTaskListService() interfaces.TaskListService {
	return &taskListService{
		taskListRepo: repository.NewTaskListRepository(),
		taskRepo:     repository.NewTaskRepository(),
		userRepo:     repository.NewUserRepository(),
	}
}

// currentUser resolves the calling user from the request context
func (s *taskListService) currentUser(ctx context.Context) (*types.User, error) {
	userID := getContextUserID(ctx)
	if userID == "" {
		return nil, errors.New("unauthorized")
	}
	user, err := s.userRepo.GetUserByID(ctx, userID)
	if err != nil {
		return nil, fmt.Errorf("failed to get user: %w", err)
	}
	if user == nil {
		return nil, errors.New("user not found")
	}
	return user, nil
}

// CreateTaskList creates a new task list
func (s *taskListService) CreateTaskList(ctx context.Context, req *types.CreateTaskListRequest) (*types.TaskListDetailResponse, error) {
	user, err := s.currentUser(ctx)
	if err != nil {
		return nil, err
	}

	id, err := util.RandomLetters(24)
	if err != nil {
		return nil, fmt.Errorf("failed to generate task list ID: %w", err)
	}

	list := &types.TaskList{
		ID:          id,
		TenantID:    user.TenantID,
		Title:       req.Title,
		Description: req.Description,
		IsDefault:   false,
		CreatorID:   user.ID,
	}

	if err := s.taskListRepo.CreateTaskList(ctx, list); err != nil {
		return nil, fmt.Errorf("failed to create task list: %w", err)
	}

	// Reload with associations
	list, err = s.taskListRepo.GetTaskListByID(ctx, list.ID)
	if err != nil {
		return nil, fmt.Errorf("failed to reload task list: %w", err)
	}

	return list.ToResponse(), nil
}

// GetTaskListByID retrieves a task list by ID (tenant scoped)
func (s *taskListService) GetTaskListByID(ctx context.Context, id string) (*types.TaskListDetailResponse, error) {
	user, err := s.currentUser(ctx)
	if err != nil {
		return nil, err
	}

	list, err := s.taskListRepo.GetTaskListByID(ctx, id)
	if err != nil {
		return nil, fmt.Errorf("failed to get task list: %w", err)
	}
	if list == nil || list.TenantID != user.TenantID {
		return nil, ErrTaskListNotFound
	}

	return list.ToResponse(), nil
}

// ListTaskLists lists task lists for the caller's tenant with pagination
func (s *taskListService) ListTaskLists(ctx context.Context, req *types.ListTaskListsRequest) ([]*types.TaskList, int64, error) {
	user, err := s.currentUser(ctx)
	if err != nil {
		return nil, 0, err
	}

	page := req.Page
	if page <= 0 {
		page = 1
	}
	pageSize := req.PageSize
	if pageSize <= 0 {
		pageSize = 20
	}
	if pageSize > 100 {
		pageSize = 100
	}

	offset := (page - 1) * pageSize

	lists, total, err := s.taskListRepo.GetTaskListsByTenantID(ctx, user.TenantID, offset, pageSize)
	if err != nil {
		return nil, 0, fmt.Errorf("failed to list task lists: %w", err)
	}

	return lists, total, nil
}

// UpdateTaskList updates a task list (tenant scoped)
func (s *taskListService) UpdateTaskList(ctx context.Context, id string, req *types.UpdateTaskListRequest) (*types.TaskListDetailResponse, error) {
	user, err := s.currentUser(ctx)
	if err != nil {
		return nil, err
	}

	list, err := s.taskListRepo.GetTaskListByID(ctx, id)
	if err != nil {
		return nil, fmt.Errorf("failed to get task list: %w", err)
	}
	if list == nil || list.TenantID != user.TenantID {
		return nil, ErrTaskListNotFound
	}

	if req.Title != nil {
		list.Title = *req.Title
	}
	if req.Description != nil {
		list.Description = *req.Description
	}

	if err := s.taskListRepo.UpdateTaskList(ctx, list); err != nil {
		return nil, fmt.Errorf("failed to update task list: %w", err)
	}

	// Reload with associations
	list, err = s.taskListRepo.GetTaskListByID(ctx, id)
	if err != nil {
		return nil, fmt.Errorf("failed to reload task list: %w", err)
	}

	return list.ToResponse(), nil
}

// DeleteTaskList deletes a task list; its tasks are moved to the tenant's default list
func (s *taskListService) DeleteTaskList(ctx context.Context, id string) error {
	user, err := s.currentUser(ctx)
	if err != nil {
		return err
	}

	list, err := s.taskListRepo.GetTaskListByID(ctx, id)
	if err != nil {
		return fmt.Errorf("failed to get task list: %w", err)
	}
	if list == nil || list.TenantID != user.TenantID {
		return ErrTaskListNotFound
	}
	if list.IsDefault {
		return ErrCannotDeleteDefaultList
	}

	defaultList, err := getOrCreateDefaultTaskList(ctx, s.taskListRepo, user.TenantID, user.ID)
	if err != nil {
		return fmt.Errorf("failed to resolve default task list: %w", err)
	}

	if err := s.taskRepo.MoveTasksToList(ctx, user.TenantID, list.ID, defaultList.ID); err != nil {
		return fmt.Errorf("failed to move tasks to default list: %w", err)
	}

	if err := s.taskListRepo.DeleteTaskList(ctx, id); err != nil {
		return fmt.Errorf("failed to delete task list: %w", err)
	}

	return nil
}

// getOrCreateDefaultTaskList returns the tenant's default task list, creating it if missing.
// 并发创建时依赖部分唯一索引 uniq_task_lists_default_per_tenant 兜底,冲突后重查返回胜者。
func getOrCreateDefaultTaskList(ctx context.Context, repo interfaces.TaskListRepository, tenantID uint64, creatorID string) (*types.TaskList, error) {
	list, err := repo.GetDefaultTaskList(ctx, tenantID)
	if err != nil {
		return nil, fmt.Errorf("failed to get default task list: %w", err)
	}
	if list != nil {
		return list, nil
	}

	id, err := util.RandomLetters(24)
	if err != nil {
		return nil, fmt.Errorf("failed to generate task list ID: %w", err)
	}

	list = &types.TaskList{
		ID:          id,
		TenantID:    tenantID,
		Title:       "默认",
		Description: "系统默认任务清单",
		IsDefault:   true,
		CreatorID:   creatorID,
	}

	if createErr := repo.CreateTaskList(ctx, list); createErr != nil {
		// Likely lost a race on the partial unique index; re-fetch the winner
		list, err = repo.GetDefaultTaskList(ctx, tenantID)
		if err != nil {
			return nil, fmt.Errorf("failed to get default task list: %w", err)
		}
		if list == nil {
			return nil, fmt.Errorf("failed to create default task list: %w", createErr)
		}
	}

	return list, nil
}
