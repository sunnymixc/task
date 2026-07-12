package repository

import (
	"context"
	"errors"

	"github.com/task-management/task/internal/database"
	"github.com/task-management/task/internal/types"
	"github.com/task-management/task/internal/types/interfaces"
	"gorm.io/gorm"
)

// settingsRepository implements interfaces.SettingsRepository
type settingsRepository struct {
	db *gorm.DB
}

// NewSettingsRepository creates a new settings repository
func NewSettingsRepository() interfaces.SettingsRepository {
	return &settingsRepository{
		db: database.GetDB(),
	}
}

// GetSettings retrieves the singleton settings row (id = 1);
// 迁移已初始化该行，缺失时防御性返回默认值
func (r *settingsRepository) GetSettings(ctx context.Context) (*types.SystemSettings, error) {
	var settings types.SystemSettings
	err := r.db.WithContext(ctx).Where("id = ?", 1).First(&settings).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return &types.SystemSettings{ID: 1}, nil
		}
		return nil, err
	}
	return &settings, nil
}

// SaveSettings persists the singleton settings row
func (r *settingsRepository) SaveSettings(ctx context.Context, settings *types.SystemSettings) error {
	settings.ID = 1
	return r.db.WithContext(ctx).Save(settings).Error
}
