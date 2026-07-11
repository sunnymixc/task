package interfaces

import (
	"context"

	"github.com/task-management/task/internal/types"
)

// TaskRepository defines the interface for task data operations
type TaskRepository interface {
	CreateTask(ctx context.Context, task *types.Task) error
	GetTaskByID(ctx context.Context, id string) (*types.Task, error)
	GetTasksByTenantID(ctx context.Context, tenantID uint64, offset, limit int) ([]*types.Task, int64, error)
	UpdateTask(ctx context.Context, task *types.Task) error
	DeleteTask(ctx context.Context, id string) error
	SearchTasks(ctx context.Context, tenantID uint64, query string, filters types.TaskFilters, offset, limit int) ([]*types.Task, int64, error)
	FilterTasks(ctx context.Context, tenantID uint64, filters types.TaskFilters, offset, limit int) ([]*types.Task, int64, error)
	MoveTasksToList(ctx context.Context, tenantID uint64, fromListID, toListID string) error
	CountTasksByStatusPerList(ctx context.Context, tenantID uint64, status types.TaskStatus) (map[string]int64, error)
	ReplaceTaskLinks(ctx context.Context, taskID string, links []*types.TaskLink) error
}

// TaskService defines the interface for task business logic
type TaskService interface {
	CreateTask(ctx context.Context, req *types.CreateTaskRequest) (*types.TaskResponse, error)
	GetTaskByID(ctx context.Context, id string) (*types.TaskResponse, error)
	ListTasks(ctx context.Context, req *types.ListTasksRequest) ([]*types.Task, int64, error)
	UpdateTask(ctx context.Context, id string, req *types.UpdateTaskRequest) (*types.TaskResponse, error)
	DeleteTask(ctx context.Context, id string) error
	UpdateTaskStatus(ctx context.Context, id string, status types.TaskStatus) (*types.TaskResponse, error)
	SearchTasks(ctx context.Context, req *types.SearchTasksRequest) ([]*types.Task, int64, error)
}
