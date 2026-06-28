package interfaces

import (
	"context"

	"github.com/task-management/task/internal/types"
)

// TenantRepository defines the interface for tenant data operations
type TenantRepository interface {
	CreateTenant(ctx context.Context, tenant *types.Tenant) error
	GetTenantByID(ctx context.Context, id uint64) (*types.Tenant, error)
	UpdateTenant(ctx context.Context, tenant *types.Tenant) error
	DeleteTenant(ctx context.Context, id uint64) error
	ListTenants(ctx context.Context, offset, limit int) ([]*types.Tenant, int64, error)
}

// TenantService defines the interface for tenant business logic
type TenantService interface {
	CreateTenant(ctx context.Context, req *types.CreateTenantRequest) (*types.Tenant, error)
	GetTenantByID(ctx context.Context, id uint64) (*types.Tenant, error)
	UpdateTenant(ctx context.Context, id uint64, req *types.UpdateTenantRequest) (*types.Tenant, error)
	DeleteTenant(ctx context.Context, id uint64) error
	ListTenants(ctx context.Context, page, pageSize int) ([]*types.Tenant, int64, error)
}

// TenantMemberRepository defines the interface for tenant member data operations
type TenantMemberRepository interface {
	CreateTenantMember(ctx context.Context, member *types.TenantMember) error
	GetTenantMember(ctx context.Context, userID string, tenantID uint64) (*types.TenantMember, error)
	GetMembersByTenantID(ctx context.Context, tenantID uint64) ([]*types.TenantMember, error)
	UpdateTenantMember(ctx context.Context, member *types.TenantMember) error
	DeleteTenantMember(ctx context.Context, userID string, tenantID uint64) error
	GetMembershipsByUserID(ctx context.Context, userID string) ([]*types.TenantMember, error)
}

// TenantMemberService defines the interface for tenant member business logic
type TenantMemberService interface {
	AddMember(ctx context.Context, tenantID uint64, req *types.AddTenantMemberRequest) (*types.TenantMember, error)
	UpdateMemberRole(ctx context.Context, userID string, tenantID uint64, req *types.UpdateTenantMemberRequest) (*types.TenantMember, error)
	RemoveMember(ctx context.Context, userID string, tenantID uint64) error
	GetMembers(ctx context.Context, tenantID uint64) ([]*types.TenantMember, error)
	GetMemberships(ctx context.Context, userID string) ([]*types.TenantMember, error)
	HasPermission(ctx context.Context, userID string, tenantID uint64, minRole types.TenantRole) bool
}
