package repository

import (
	"context"
	"errors"

	"github.com/task-management/task/internal/database"
	"github.com/task-management/task/internal/types"
	"gorm.io/gorm"
)

// userRepository implements types.UserRepository
type userRepository struct {
	db *gorm.DB
}

// NewUserRepository creates a new user repository
func NewUserRepository() types.UserRepository {
	return &userRepository{
		db: database.GetDB(),
	}
}

// CreateUser creates a new user
func (r *userRepository) CreateUser(ctx context.Context, user *types.User) error {
	return r.db.WithContext(ctx).Create(user).Error
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
