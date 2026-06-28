package repository

import (
	"context"
	"errors"

	"github.com/task-management/task/internal/database"
	"github.com/task-management/task/internal/types"
	"github.com/task-management/task/internal/types/interfaces"
	"gorm.io/gorm"
)

// tenantRepository implements interfaces.TenantRepository
type tenantRepository struct {
	db *gorm.DB
}

// NewTenantRepository creates a new tenant repository
func NewTenantRepository() interfaces.TenantRepository {
	return &tenantRepository{
		db: database.GetDB(),
	}
}

// CreateTenant creates a new tenant
func (r *tenantRepository) CreateTenant(ctx context.Context, tenant *types.Tenant) error {
	return r.db.WithContext(ctx).Create(tenant).Error
}

// GetTenantByID retrieves a tenant by ID
func (r *tenantRepository) GetTenantByID(ctx context.Context, id uint64) (*types.Tenant, error) {
	var tenant types.Tenant
	err := r.db.WithContext(ctx).Where("id = ?", id).First(&tenant).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, nil
		}
		return nil, err
	}
	return &tenant, nil
}

// UpdateTenant updates a tenant
func (r *tenantRepository) UpdateTenant(ctx context.Context, tenant *types.Tenant) error {
	return r.db.WithContext(ctx).Save(tenant).Error
}

// DeleteTenant soft deletes a tenant
func (r *tenantRepository) DeleteTenant(ctx context.Context, id uint64) error {
	return r.db.WithContext(ctx).Delete(&types.Tenant{}, "id = ?", id).Error
}

// ListTenants lists tenants with pagination
func (r *tenantRepository) ListTenants(ctx context.Context, offset, limit int) ([]*types.Tenant, int64, error) {
	var tenants []*types.Tenant
	var total int64

	if err := r.db.WithContext(ctx).Model(&types.Tenant{}).Count(&total).Error; err != nil {
		return nil, 0, err
	}

	err := r.db.WithContext(ctx).Offset(offset).Limit(limit).Find(&tenants).Error
	return tenants, total, err
}

// tenantMemberRepository implements interfaces.TenantMemberRepository
type tenantMemberRepository struct {
	db *gorm.DB
}

// NewTenantMemberRepository creates a new tenant member repository
func NewTenantMemberRepository() interfaces.TenantMemberRepository {
	return &tenantMemberRepository{
		db: database.GetDB(),
	}
}

// CreateTenantMember creates a new tenant member
func (r *tenantMemberRepository) CreateTenantMember(ctx context.Context, member *types.TenantMember) error {
	return r.db.WithContext(ctx).Create(member).Error
}

// GetTenantMember retrieves a tenant member by user ID and tenant ID
func (r *tenantMemberRepository) GetTenantMember(ctx context.Context, userID string, tenantID uint64) (*types.TenantMember, error) {
	var member types.TenantMember
	err := r.db.WithContext(ctx).
		Where("user_id = ? AND tenant_id = ?", userID, tenantID).
		First(&member).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, nil
		}
		return nil, err
	}
	return &member, nil
}

// GetMembersByTenantID retrieves all members of a tenant
func (r *tenantMemberRepository) GetMembersByTenantID(ctx context.Context, tenantID uint64) ([]*types.TenantMember, error) {
	var members []*types.TenantMember
	err := r.db.WithContext(ctx).
		Where("tenant_id = ?", tenantID).
		Find(&members).Error
	return members, err
}

// UpdateTenantMember updates a tenant member
func (r *tenantMemberRepository) UpdateTenantMember(ctx context.Context, member *types.TenantMember) error {
	return r.db.WithContext(ctx).Save(member).Error
}

// DeleteTenantMember deletes a tenant member
func (r *tenantMemberRepository) DeleteTenantMember(ctx context.Context, userID string, tenantID uint64) error {
	return r.db.WithContext(ctx).
		Where("user_id = ? AND tenant_id = ?", userID, tenantID).
		Delete(&types.TenantMember{}).Error
}

// GetMembershipsByUserID retrieves all memberships for a user
func (r *tenantMemberRepository) GetMembershipsByUserID(ctx context.Context, userID string) ([]*types.TenantMember, error) {
	var memberships []*types.TenantMember
	err := r.db.WithContext(ctx).
		Preload("Tenant").
		Where("user_id = ? AND status = ?", userID, types.TenantMemberStatusActive).
		Find(&memberships).Error
	return memberships, err
}
