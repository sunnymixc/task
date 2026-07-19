package repository

import (
	"context"

	"github.com/task-management/task/internal/database"
	"github.com/task-management/task/internal/types"
	"github.com/task-management/task/internal/types/interfaces"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

// workbenchRepository implements interfaces.WorkbenchRepository
type workbenchRepository struct {
	db *gorm.DB
}

// NewWorkbenchRepository creates a new workbench repository
func NewWorkbenchRepository() interfaces.WorkbenchRepository {
	return &workbenchRepository{
		db: database.GetDB(),
	}
}

// ListItems 按加入顺序返回用户工作台中的所有记录
func (r *workbenchRepository) ListItems(ctx context.Context, tenantID uint64, userID string) ([]*types.TaskWorkbenchItem, error) {
	var items []*types.TaskWorkbenchItem
	err := r.db.WithContext(ctx).
		Where("tenant_id = ? AND user_id = ?", tenantID, userID).
		Order("created_at ASC, id ASC").
		Find(&items).Error
	return items, err
}

// AddItem 加入工作台；重复加入由唯一索引 + ON CONFLICT DO NOTHING 幂等吸收
func (r *workbenchRepository) AddItem(ctx context.Context, item *types.TaskWorkbenchItem) error {
	return r.db.WithContext(ctx).
		Clauses(clause.OnConflict{
			Columns:   []clause.Column{{Name: "tenant_id"}, {Name: "user_id"}, {Name: "task_id"}},
			DoNothing: true,
		}).
		Create(item).Error
}

// RemoveItem 从工作台移除任务；记录不存在时不报错（幂等）
func (r *workbenchRepository) RemoveItem(ctx context.Context, tenantID uint64, userID, taskID string) error {
	return r.db.WithContext(ctx).
		Where("tenant_id = ? AND user_id = ? AND task_id = ?", tenantID, userID, taskID).
		Delete(&types.TaskWorkbenchItem{}).Error
}
