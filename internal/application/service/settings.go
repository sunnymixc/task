package service

import (
	"context"
	"fmt"

	"github.com/task-management/task/internal/application/repository"
	"github.com/task-management/task/internal/types"
	"github.com/task-management/task/internal/types/interfaces"
)

// settingsService implements interfaces.SettingsService
type settingsService struct {
	settingsRepo interfaces.SettingsRepository
}

// NewSettingsService creates a new settings service
func NewSettingsService() interfaces.SettingsService {
	return &settingsService{
		settingsRepo: repository.NewSettingsRepository(),
	}
}

// GetSettings returns the current system settings
func (s *settingsService) GetSettings(ctx context.Context) (*types.SystemSettingsData, error) {
	settings, err := s.settingsRepo.GetSettings(ctx)
	if err != nil {
		return nil, fmt.Errorf("failed to get settings: %w", err)
	}
	return &settings.Data, nil
}

// UpdateSettings applies the non-nil fields of the request and persists them
func (s *settingsService) UpdateSettings(ctx context.Context, userID string, req *types.UpdateSystemSettingsRequest) (*types.SystemSettingsData, error) {
	settings, err := s.settingsRepo.GetSettings(ctx)
	if err != nil {
		return nil, fmt.Errorf("failed to get settings: %w", err)
	}

	if req.UIRadius != nil {
		settings.Data.UIRadius = *req.UIRadius
	}
	settings.UpdatedBy = userID

	if err := s.settingsRepo.SaveSettings(ctx, settings); err != nil {
		return nil, fmt.Errorf("failed to save settings: %w", err)
	}
	return &settings.Data, nil
}
