package interfaces

import (
	"context"

	"github.com/task-management/task/internal/types"
)

// TaskListRepository defines the interface for task list data operations
type TaskListRepository interface {
	CreateTaskList(ctx context.Context, list *types.TaskList) error
	GetTaskListByID(ctx context.Context, id string) (*types.TaskList, error)
	GetTaskListsByTenantID(ctx context.Context, tenantID uint64, offset, limit int) ([]*types.TaskList, int64, error)
	GetDefaultTaskList(ctx context.Context, tenantID uint64) (*types.TaskList, error)
	GetMaxSortOrder(ctx context.Context, tenantID uint64) (int, error)
	UpdateTaskList(ctx context.Context, list *types.TaskList) error
	DeleteTaskList(ctx context.Context, id string) error
}

// TaskListService defines the interface for task list business logic
type TaskListService interface {
	CreateTaskList(ctx context.Context, req *types.CreateTaskListRequest) (*types.TaskListDetailResponse, error)
	GetTaskListByID(ctx context.Context, id string) (*types.TaskListDetailResponse, error)
	ListTaskLists(ctx context.Context, req *types.ListTaskListsRequest) ([]*types.TaskList, int64, error)
	UpdateTaskList(ctx context.Context, id string, req *types.UpdateTaskListRequest) (*types.TaskListDetailResponse, error)
	DeleteTaskList(ctx context.Context, id string) error
}
