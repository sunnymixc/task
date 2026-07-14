package repository

import (
	"context"
	"errors"

	"github.com/task-management/task/internal/database"
	"github.com/task-management/task/internal/types"
	"github.com/task-management/task/internal/types/interfaces"
	"gorm.io/gorm"
)

// userRepository implements interfaces.UserRepository
type userRepository struct {
	db *gorm.DB
}

// NewUserRepository creates a new user repository
func NewUserRepository() interfaces.UserRepository {
	return &userRepository{
		db: database.GetDB(),
	}
}

// CreateUser creates a new user
func (r *userRepository) CreateUser(ctx context.Context, user *types.User) error {
	return r.db.WithContext(ctx).Create(user).Error
}

// firstAdminLockKey 是首管理员判定用的 advisory lock 键（区别于 migrate.go 的迁移锁）
const firstAdminLockKey = 762001

// CreateUserGrantingFirstAdmin creates the user; inside one transaction it takes an
// advisory lock and counts existing users (including soft-deleted, so a deleted first
// user never promotes a later one), setting IsAdmin=true only when the count is zero.
func (r *userRepository) CreateUserGrantingFirstAdmin(ctx context.Context, user *types.User) error {
	return r.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		if err := tx.Exec("SELECT pg_advisory_xact_lock(?)", firstAdminLockKey).Error; err != nil {
			return err
		}
		var count int64
		if err := tx.Unscoped().Model(&types.User{}).Count(&count).Error; err != nil {
			return err
		}
		user.IsAdmin = count == 0
		return tx.Create(user).Error
	})
}

// GetUserByID retrieves a user by ID
func (r *userRepository) GetUserByID(ctx context.Context, id string) (*types.User, error) {
	var user types.User
	err := r.db.WithContext(ctx).Where("id = ?", id).First(&user).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, nil
		}
		return nil, err
	}
	return &user, nil
}

// GetUserByEmail retrieves a user by email
func (r *userRepository) GetUserByEmail(ctx context.Context, email string) (*types.User, error) {
	var user types.User
	err := r.db.WithContext(ctx).Where("email = ?", email).First(&user).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, nil
		}
		return nil, err
	}
	return &user, nil
}

// GetUserByUsername retrieves a user by username
func (r *userRepository) GetUserByUsername(ctx context.Context, username string) (*types.User, error) {
	var user types.User
	err := r.db.WithContext(ctx).Where("username = ?", username).First(&user).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, nil
		}
		return nil, err
	}
	return &user, nil
}

// UpdateUser updates a user
func (r *userRepository) UpdateUser(ctx context.Context, user *types.User) error {
	return r.db.WithContext(ctx).Save(user).Error
}

// DeleteUser soft deletes a user
func (r *userRepository) DeleteUser(ctx context.Context, id string) error {
	return r.db.WithContext(ctx).Delete(&types.User{}, "id = ?", id).Error
}

// ListUsers lists users with pagination
func (r *userRepository) ListUsers(ctx context.Context, tenantID uint64, offset, limit int) ([]*types.User, int64, error) {
	var users []*types.User
	var total int64

	query := r.db.WithContext(ctx).Model(&types.User{})
	if tenantID > 0 {
		query = query.Where("tenant_id = ?", tenantID)
	}

	if err := query.Count(&total).Error; err != nil {
		return nil, 0, err
	}

	err := query.Offset(offset).Limit(limit).Find(&users).Error
	return users, total, err
}
