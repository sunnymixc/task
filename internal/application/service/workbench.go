package service

import (
	"context"
	"errors"
	"fmt"

	"github.com/task-management/task/internal/application/repository"
	"github.com/task-management/task/internal/types"
	"github.com/task-management/task/internal/types/interfaces"
)

// workbenchService implements interfaces.WorkbenchService
type workbenchService struct {
	workbenchRepo interfaces.WorkbenchRepository
	taskRepo      interfaces.TaskRepository
	userRepo      interfaces.UserRepository
}

// NewWorkbenchService creates a new workbench service
func NewWorkbenchService() interfaces.WorkbenchService {
	return &workbenchService{
		workbenchRepo: repository.NewWorkbenchRepository(),
		taskRepo:      repository.NewTaskRepository(),
		userRepo:      repository.NewUserRepository(),
	}
}

// currentUser resolves the calling user (and thus tenant) from the request context
func (s *workbenchService) currentUser(ctx context.Context) (*types.User, error) {
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

// ListWorkbenchTasks 按加入顺序返回工作台任务；软删任务被查询 scope 过滤后直接跳过
func (s *workbenchService) ListWorkbenchTasks(ctx context.Context) ([]*types.WorkbenchTaskResponse, error) {
	user, err := s.currentUser(ctx)
	if err != nil {
		return nil, err
	}

	items, err := s.workbenchRepo.ListItems(ctx, user.TenantID, user.ID)
	if err != nil {
		return nil, fmt.Errorf("failed to list workbench items: %w", err)
	}

	responses := make([]*types.WorkbenchTaskResponse, 0, len(items))
	if len(items) == 0 {
		return responses, nil
	}

	ids := make([]string, 0, len(items))
	for _, item := range items {
		ids = append(ids, item.TaskID)
	}
	tasks, err := s.taskRepo.GetTasksByIDs(ctx, user.TenantID, ids)
	if err != nil {
		return nil, fmt.Errorf("failed to get workbench tasks: %w", err)
	}

	byID := make(map[string]*types.Task, len(tasks))
	for _, task := range tasks {
		byID[task.ID] = task
	}
	for _, item := range items {
		if task, ok := byID[item.TaskID]; ok {
			responses = append(responses, &types.WorkbenchTaskResponse{
				TaskResponse: task.ToResponse(),
				Collapsed:    item.Collapsed,
			})
		}
	}
	return responses, nil
}

// AddTask 将任务加入当前用户的工作台；重复加入静默成功
func (s *workbenchService) AddTask(ctx context.Context, taskID string) (*types.TaskResponse, error) {
	user, err := s.currentUser(ctx)
	if err != nil {
		return nil, err
	}

	task, err := s.taskRepo.GetTaskByID(ctx, taskID)
	if err != nil {
		return nil, fmt.Errorf("failed to get task: %w", err)
	}
	// 跨租户任务按不存在处理，不泄露存在性
	if task == nil || task.TenantID != user.TenantID {
		return nil, ErrTaskNotFound
	}

	item := &types.TaskWorkbenchItem{
		TenantID: user.TenantID,
		UserID:   user.ID,
		TaskID:   taskID,
	}
	if err := s.workbenchRepo.AddItem(ctx, item); err != nil {
		return nil, fmt.Errorf("failed to add workbench item: %w", err)
	}
	return task.ToResponse(), nil
}

// SetTaskCollapsed 设置当前用户工作台中某任务面板的折叠状态（幂等；不在工作台时静默成功）
func (s *workbenchService) SetTaskCollapsed(ctx context.Context, taskID string, collapsed bool) error {
	user, err := s.currentUser(ctx)
	if err != nil {
		return err
	}
	if err := s.workbenchRepo.UpdateCollapsed(ctx, user.TenantID, user.ID, taskID, collapsed); err != nil {
		return fmt.Errorf("failed to update workbench collapsed state: %w", err)
	}
	return nil
}

// RemoveTask 从当前用户的工作台移除任务（幂等）
func (s *workbenchService) RemoveTask(ctx context.Context, taskID string) error {
	user, err := s.currentUser(ctx)
	if err != nil {
		return err
	}
	if err := s.workbenchRepo.RemoveItem(ctx, user.TenantID, user.ID, taskID); err != nil {
		return fmt.Errorf("failed to remove workbench item: %w", err)
	}
	return nil
}
