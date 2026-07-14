package interfaces

import (
	"context"

	"github.com/task-management/task/internal/types"
)

// SettingsRepository defines the interface for system settings data operations
type SettingsRepository interface {
	GetSettings(ctx context.Context) (*types.SystemSettings, error)
	SaveSettings(ctx context.Context, settings *types.SystemSettings) error
}

// SettingsService defines the interface for system settings business logic
type SettingsService interface {
	GetSettings(ctx context.Context) (*types.SystemSettingsData, error)
	UpdateSettings(ctx context.Context, userID string, req *types.UpdateSystemSettingsRequest) (*types.SystemSettingsData, error)
}
