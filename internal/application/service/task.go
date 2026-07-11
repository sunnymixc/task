package service

import (
	"context"
	"errors"
	"fmt"
	"strings"

	"github.com/google/uuid"

	"github.com/task-management/task/internal/application/repository"
	"github.com/task-management/task/internal/types"
	"github.com/task-management/task/internal/types/interfaces"
)

// taskService implements interfaces.TaskService
type taskService struct {
	taskRepo     interfaces.TaskRepository
	userRepo     interfaces.UserRepository
	tenantRepo   interfaces.TenantRepository
	taskListRepo interfaces.TaskListRepository
}

var (
	// ErrTaskNotFound is returned when a task is not found
	ErrTaskNotFound = errors.New("task not found")
	// ErrInvalidStatusTransition is returned when a status transition is invalid
	ErrInvalidStatusTransition = errors.New("invalid status transition")
	// ErrLinkTargetTaskNotFound is returned when a task link's target task does not exist in the caller's tenant
	ErrLinkTargetTaskNotFound = errors.New("链接的目标任务不存在")
	// ErrInvalidTaskLink is returned when a task link input is malformed
	ErrInvalidTaskLink = errors.New("无效的任务链接")
)

// NewTaskService creates a new task service
func NewTaskService() interfaces.TaskService {
	return &taskService{
		taskRepo:     repository.NewTaskRepository(),
		userRepo:     repository.NewUserRepository(),
		tenantRepo:   repository.NewTenantRepository(),
		taskListRepo: repository.NewTaskListRepository(),
	}
}

// CreateTask creates a new task
func (s *taskService) CreateTask(ctx context.Context, req *types.CreateTaskRequest) (*types.TaskResponse, error) {
	// Get user ID from context (for now, we'll use a placeholder)
	// In production, this would come from the JWT middleware
	userID := getContextUserID(ctx)
	if userID == "" {
		return nil, errors.New("unauthorized")
	}

	// Get user's tenant ID
	user, err := s.userRepo.GetUserByID(ctx, userID)
	if err != nil {
		return nil, fmt.Errorf("failed to get user: %w", err)
	}
	if user == nil {
		return nil, errors.New("user not found")
	}

	// Set default priority if not provided
	priority := req.Priority
	if priority == "" {
		priority = types.TaskPriorityHigh
	}

	// Set default status if not provided
	status := req.Status
	if status == "" {
		status = types.TaskStatusDraft
	}

	// Set default execution status if not provided
	executionStatus := req.ExecutionStatus
	if executionStatus == "" {
		executionStatus = types.TaskExecutionStatusUnplanned
	}

	// Resolve the task list: validate the given one, or fall back to the tenant's default
	taskListID := req.TaskListID
	if taskListID != "" {
		list, err := s.taskListRepo.GetTaskListByID(ctx, taskListID)
		if err != nil {
			return nil, fmt.Errorf("failed to get task list: %w", err)
		}
		if list == nil || list.TenantID != user.TenantID {
			return nil, ErrTaskListNotFound
		}
	} else {
		defaultList, err := getOrCreateDefaultTaskList(ctx, s.taskListRepo, user.TenantID, userID)
		if err != nil {
			return nil, fmt.Errorf("failed to resolve default task list: %w", err)
		}
		taskListID = defaultList.ID
	}

	taskID := uuid.New().String()

	// 先校验链接（含目标任务同租户校验），再落库，避免部分写入
	links, err := s.validateAndBuildLinks(ctx, user.TenantID, taskID, req.Links)
	if err != nil {
		return nil, err
	}

	task := &types.Task{
		ID:              taskID,
		TenantID:        user.TenantID,
		Title:           req.Title,
		Description:     req.Description,
		Result:          req.Result,
		Status:          status,
		ExecutionStatus: executionStatus,
		ExecutionPlan:   req.ExecutionPlan,
		ExecutionLog:    req.ExecutionLog,
		ExecutionResult: req.ExecutionResult,
		Priority:        priority,
		SortOrder:       req.SortOrder,
		CreatorID:       userID,
		TaskListID:      taskListID,
		DueDate:         req.DueDate,
	}

	if err := s.taskRepo.CreateTask(ctx, task); err != nil {
		return nil, fmt.Errorf("failed to create task: %w", err)
	}

	if len(links) > 0 {
		if err := s.taskRepo.ReplaceTaskLinks(ctx, taskID, links); err != nil {
			return nil, fmt.Errorf("failed to create task links: %w", err)
		}
	}

	// Reload with associations
	task, err = s.taskRepo.GetTaskByID(ctx, task.ID)
	if err != nil {
		return nil, fmt.Errorf("failed to reload task: %w", err)
	}

	return task.ToResponse(), nil
}

// validateAndBuildLinks 校验链接输入并构造 TaskLink 实体，position 按输入顺序。
// task 类型链接强制校验目标任务存在且与当前任务同租户，并禁止链接自身。
func (s *taskService) validateAndBuildLinks(ctx context.Context, tenantID uint64, taskID string, inputs []types.TaskLinkInput) ([]*types.TaskLink, error) {
	if len(inputs) == 0 {
		return nil, nil
	}

	links := make([]*types.TaskLink, 0, len(inputs))
	for i, in := range inputs {
		link := &types.TaskLink{
			TaskID:   taskID,
			LinkType: in.LinkType,
			Position: i,
		}
		switch in.LinkType {
		case types.TaskLinkTypeURL:
			title := strings.TrimSpace(in.Title)
			if title == "" || (!strings.HasPrefix(in.URL, "http://") && !strings.HasPrefix(in.URL, "https://")) {
				return nil, ErrInvalidTaskLink
			}
			link.Title = title
			link.URL = in.URL
		case types.TaskLinkTypeTask:
			if in.TargetTaskID == "" || in.TargetTaskID == taskID {
				return nil, ErrInvalidTaskLink
			}
			target, err := s.taskRepo.GetTaskByID(ctx, in.TargetTaskID)
			if err != nil {
				return nil, fmt.Errorf("failed to get link target task: %w", err)
			}
			if target == nil || target.TenantID != tenantID {
				return nil, ErrLinkTargetTaskNotFound
			}
			// 不挂 TargetTask 关联，避免 Create 时级联写目标任务
			link.TargetTaskID = in.TargetTaskID
		default:
			return nil, ErrInvalidTaskLink
		}
		links = append(links, link)
	}
	return links, nil
}

// GetTaskByID retrieves a task by ID
func (s *taskService) GetTaskByID(ctx context.Context, id string) (*types.TaskResponse, error) {
	task, err := s.taskRepo.GetTaskByID(ctx, id)
	if err != nil {
		return nil, fmt.Errorf("failed to get task: %w", err)
	}
	if task == nil {
		return nil, ErrTaskNotFound
	}

	// TODO: Verify tenant access

	return task.ToResponse(), nil
}

// ListTasks lists tasks with pagination and filters
func (s *taskService) ListTasks(ctx context.Context, req *types.ListTasksRequest) ([]*types.Task, int64, error) {
	// Get user ID from context
	userID := getContextUserID(ctx)
	if userID == "" {
		return nil, 0, errors.New("unauthorized")
	}

	// Get user's tenant ID
	user, err := s.userRepo.GetUserByID(ctx, userID)
	if err != nil {
		return nil, 0, fmt.Errorf("failed to get user: %w", err)
	}
	if user == nil {
		return nil, 0, errors.New("user not found")
	}

	// Set default pagination
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

	// Build filters
	filters := types.TaskFilters{
		Status:     req.Status,
		CreatorID:  req.CreatorID,
		Priority:   req.Priority,
		TaskListID: req.TaskListID,
	}

	// If any filters are set, use FilterTasks, otherwise use GetTasksByTenantID
	var tasks []*types.Task
	var total int64

	if len(filters.Status) > 0 || filters.CreatorID != nil || len(filters.Priority) > 0 || len(filters.TaskListID) > 0 {
		tasks, total, err = s.taskRepo.FilterTasks(ctx, user.TenantID, filters, offset, pageSize)
	} else {
		tasks, total, err = s.taskRepo.GetTasksByTenantID(ctx, user.TenantID, offset, pageSize)
	}

	if err != nil {
		return nil, 0, fmt.Errorf("failed to list tasks: %w", err)
	}

	return tasks, total, nil
}

// UpdateTask updates a task
func (s *taskService) UpdateTask(ctx context.Context, id string, req *types.UpdateTaskRequest) (*types.TaskResponse, error) {
	task, err := s.taskRepo.GetTaskByID(ctx, id)
	if err != nil {
		return nil, fmt.Errorf("failed to get task: %w", err)
	}
	if task == nil {
		return nil, ErrTaskNotFound
	}

	// TODO: Verify tenant access

	// Update fields if provided
	if req.Title != nil {
		task.Title = *req.Title
	}
	if req.Description != nil {
		task.Description = *req.Description
	}
	if req.Result != nil {
		task.Result = *req.Result
	}
	if req.ExecutionStatus != nil {
		task.ExecutionStatus = *req.ExecutionStatus
	}
	if req.ExecutionPlan != nil {
		task.ExecutionPlan = *req.ExecutionPlan
	}
	if req.ExecutionLog != nil {
		task.ExecutionLog = *req.ExecutionLog
	}
	if req.ExecutionResult != nil {
		task.ExecutionResult = *req.ExecutionResult
	}
	if req.Priority != nil {
		task.Priority = *req.Priority
	}
	// 0 表示清除序号恢复默认（排最前）
	if req.SortOrder != nil {
		task.SortOrder = *req.SortOrder
	}
	if req.DueDate != nil {
		task.DueDate = req.DueDate
	}
	if req.TaskListID != nil && *req.TaskListID != task.TaskListID {
		// Validate the target list exists and belongs to the task's tenant
		list, err := s.taskListRepo.GetTaskListByID(ctx, *req.TaskListID)
		if err != nil {
			return nil, fmt.Errorf("failed to get task list: %w", err)
		}
		if list == nil || list.TenantID != task.TenantID {
			return nil, ErrTaskListNotFound
		}
		task.TaskListID = *req.TaskListID
	}

	// Update status if provided (no transition restriction)
	if req.Status != nil {
		task.Status = *req.Status
	}

	// Links: nil 表示不修改；空数组表示清空；非空整体替换。校验放在落库前。
	var newLinks []*types.TaskLink
	if req.Links != nil {
		newLinks, err = s.validateAndBuildLinks(ctx, task.TenantID, task.ID, *req.Links)
		if err != nil {
			return nil, err
		}
	}

	if err := s.taskRepo.UpdateTask(ctx, task); err != nil {
		return nil, fmt.Errorf("failed to update task: %w", err)
	}

	if req.Links != nil {
		if err := s.taskRepo.ReplaceTaskLinks(ctx, task.ID, newLinks); err != nil {
			return nil, fmt.Errorf("failed to replace task links: %w", err)
		}
	}

	// Reload with associations
	task, err = s.taskRepo.GetTaskByID(ctx, id)
	if err != nil {
		return nil, fmt.Errorf("failed to reload task: %w", err)
	}

	return task.ToResponse(), nil
}

// DeleteTask deletes a task
func (s *taskService) DeleteTask(ctx context.Context, id string) error {
	task, err := s.taskRepo.GetTaskByID(ctx, id)
	if err != nil {
		return fmt.Errorf("failed to get task: %w", err)
	}
	if task == nil {
		return ErrTaskNotFound
	}

	// TODO: Verify tenant access and permissions

	// 任务是软删，task_links 物理行有意保留：links 只经 task 查询，不存在泄漏路径
	if err := s.taskRepo.DeleteTask(ctx, id); err != nil {
		return fmt.Errorf("failed to delete task: %w", err)
	}

	return nil
}

// UpdateTaskStatus updates a task's status
func (s *taskService) UpdateTaskStatus(ctx context.Context, id string, status types.TaskStatus) (*types.TaskResponse, error) {
	task, err := s.taskRepo.GetTaskByID(ctx, id)
	if err != nil {
		return nil, fmt.Errorf("failed to get task: %w", err)
	}
	if task == nil {
		return nil, ErrTaskNotFound
	}

	task.Status = status

	if err := s.taskRepo.UpdateTask(ctx, task); err != nil {
		return nil, fmt.Errorf("failed to update task status: %w", err)
	}

	// Reload with associations
	task, err = s.taskRepo.GetTaskByID(ctx, id)
	if err != nil {
		return nil, fmt.Errorf("failed to reload task: %w", err)
	}

	return task.ToResponse(), nil
}

// SearchTasks searches tasks by query
func (s *taskService) SearchTasks(ctx context.Context, req *types.SearchTasksRequest) ([]*types.Task, int64, error) {
	// Get user ID from context
	userID := getContextUserID(ctx)
	if userID == "" {
		return nil, 0, errors.New("unauthorized")
	}

	// Get user's tenant ID
	user, err := s.userRepo.GetUserByID(ctx, userID)
	if err != nil {
		return nil, 0, fmt.Errorf("failed to get user: %w", err)
	}
	if user == nil {
		return nil, 0, errors.New("user not found")
	}

	// Set default pagination
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

	tasks, total, err := s.taskRepo.SearchTasks(ctx, user.TenantID, req.Query, types.TaskFilters{}, offset, pageSize)
	if err != nil {
		return nil, 0, fmt.Errorf("failed to search tasks: %w", err)
	}

	return tasks, total, nil
}

// Context key for user ID
type contextKey string

const userIDKey contextKey = "user_id"

// getContextUserID gets the user ID from context
func getContextUserID(ctx context.Context) string {
	if userID, ok := ctx.Value(userIDKey).(string); ok {
		return userID
	}
	return ""
}

// SetContextUserID sets the user ID in context (helper for middleware)
func SetContextUserID(ctx context.Context, userID string) context.Context {
	return context.WithValue(ctx, userIDKey, userID)
}
