package interfaces

import (
	"context"

	"github.com/task-management/task/internal/types"
)

// WorkbenchRepository defines the interface for task workbench data operations
type WorkbenchRepository interface {
	ListItems(ctx context.Context, tenantID uint64, userID string) ([]*types.TaskWorkbenchItem, error)
	AddItem(ctx context.Context, item *types.TaskWorkbenchItem) error
	RemoveItem(ctx context.Context, tenantID uint64, userID, taskID string) error
	UpdateCollapsed(ctx context.Context, tenantID uint64, userID, taskID string, collapsed bool) error
}

// WorkbenchService defines the interface for task workbench business logic
type WorkbenchService interface {
	ListWorkbenchTasks(ctx context.Context) ([]*types.WorkbenchTaskResponse, error)
	AddTask(ctx context.Context, taskID string) (*types.TaskResponse, error)
	RemoveTask(ctx context.Context, taskID string) error
	SetTaskCollapsed(ctx context.Context, taskID string, collapsed bool) error
}
