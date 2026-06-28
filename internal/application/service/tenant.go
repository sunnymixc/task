package service

import (
	"context"
	"errors"
	"fmt"

	"github.com/task-management/task/internal/application/repository"
	"github.com/task-management/task/internal/types"
	"github.com/task-management/task/internal/types/interfaces"
)

// tenantService implements interfaces.TenantService
type tenantService struct {
	repo interfaces.TenantRepository
}

// NewTenantService creates a new tenant service
func NewTenantService() interfaces.TenantService {
	return &tenantService{
		repo: repository.NewTenantRepository(),
	}
}

// CreateTenant creates a new tenant
func (s *tenantService) CreateTenant(ctx context.Context, req *types.CreateTenantRequest) (*types.Tenant, error) {
	tenant := &types.Tenant{
		Name:        req.Name,
		Description: req.Description,
		Status:      "active",
	}

	if err := s.repo.CreateTenant(ctx, tenant); err != nil {
		return nil, fmt.Errorf("failed to create tenant: %w", err)
	}

	return tenant, nil
}

// GetTenantByID retrieves a tenant by ID
func (s *tenantService) GetTenantByID(ctx context.Context, id uint64) (*types.Tenant, error) {
	tenant, err := s.repo.GetTenantByID(ctx, id)
	if err != nil {
		return nil, fmt.Errorf("failed to get tenant: %w", err)
	}
	if tenant == nil {
		return nil, errors.New("tenant not found")
	}
	return tenant, nil
}

// UpdateTenant updates a tenant
func (s *tenantService) UpdateTenant(ctx context.Context, id uint64, req *types.UpdateTenantRequest) (*types.Tenant, error) {
	tenant, err := s.repo.GetTenantByID(ctx, id)
	if err != nil {
		return nil, fmt.Errorf("failed to get tenant: %w", err)
	}
	if tenant == nil {
		return nil, errors.New("tenant not found")
	}

	if req.Name != nil {
		tenant.Name = *req.Name
	}
	if req.Description != nil {
		tenant.Description = *req.Description
	}
	if req.Status != nil {
		tenant.Status = *req.Status
	}

	if err := s.repo.UpdateTenant(ctx, tenant); err != nil {
		return nil, fmt.Errorf("failed to update tenant: %w", err)
	}

	return tenant, nil
}

// DeleteTenant deletes a tenant
func (s *tenantService) DeleteTenant(ctx context.Context, id uint64) error {
	if err := s.repo.DeleteTenant(ctx, id); err != nil {
		return fmt.Errorf("failed to delete tenant: %w", err)
	}
	return nil
}

// ListTenants lists tenants with pagination
func (s *tenantService) ListTenants(ctx context.Context, page, pageSize int) ([]*types.Tenant, int64, error) {
	offset := (page - 1) * pageSize
	return s.repo.ListTenants(ctx, offset, pageSize)
}

// tenantMemberService implements interfaces.TenantMemberService
type tenantMemberService struct {
	repo       interfaces.TenantMemberRepository
	tenantRepo interfaces.TenantRepository
	userRepo   interfaces.UserRepository
}

// NewTenantMemberService creates a new tenant member service
func NewTenantMemberService() interfaces.TenantMemberService {
	return &tenantMemberService{
		repo:       repository.NewTenantMemberRepository(),
		tenantRepo: repository.NewTenantRepository(),
		userRepo:   repository.NewUserRepository(),
	}
}

// AddMember adds a member to a tenant
func (s *tenantMemberService) AddMember(ctx context.Context, tenantID uint64, req *types.AddTenantMemberRequest) (*types.TenantMember, error) {
	// Verify tenant exists
	tenant, err := s.tenantRepo.GetTenantByID(ctx, tenantID)
	if err != nil {
		return nil, fmt.Errorf("failed to get tenant: %w", err)
	}
	if tenant == nil {
		return nil, errors.New("tenant not found")
	}

	// Verify user exists
	user, err := s.userRepo.GetUserByID(ctx, req.UserID)
	if err != nil {
		return nil, fmt.Errorf("failed to get user: %w", err)
	}
	if user == nil {
		return nil, errors.New("user not found")
	}

	// Check if membership already exists
	existing, err := s.repo.GetTenantMember(ctx, req.UserID, tenantID)
	if err != nil {
		return nil, fmt.Errorf("failed to check membership: %w", err)
	}
	if existing != nil {
		return nil, errors.New("user is already a member of this tenant")
	}

	member := &types.TenantMember{
		UserID:    req.UserID,
		TenantID:  tenantID,
		Role:      req.Role,
		Status:    types.TenantMemberStatusActive,
		JoinedAt:  tenant.CreatedAt,
	}

	if err := s.repo.CreateTenantMember(ctx, member); err != nil {
		return nil, fmt.Errorf("failed to create member: %w", err)
	}

	return member, nil
}

// UpdateMemberRole updates a member's role
func (s *tenantMemberService) UpdateMemberRole(ctx context.Context, userID string, tenantID uint64, req *types.UpdateTenantMemberRequest) (*types.TenantMember, error) {
	member, err := s.repo.GetTenantMember(ctx, userID, tenantID)
	if err != nil {
		return nil, fmt.Errorf("failed to get member: %w", err)
	}
	if member == nil {
		return nil, errors.New("member not found")
	}

	if req.Role != nil {
		member.Role = *req.Role
	}

	if err := s.repo.UpdateTenantMember(ctx, member); err != nil {
		return nil, fmt.Errorf("failed to update member: %w", err)
	}

	return member, nil
}

// RemoveMember removes a member from a tenant
func (s *tenantMemberService) RemoveMember(ctx context.Context, userID string, tenantID uint64) error {
	if err := s.repo.DeleteTenantMember(ctx, userID, tenantID); err != nil {
		return fmt.Errorf("failed to remove member: %w", err)
	}
	return nil
}

// GetMembers gets all members of a tenant
func (s *tenantMemberService) GetMembers(ctx context.Context, tenantID uint64) ([]*types.TenantMember, error) {
	members, err := s.repo.GetMembersByTenantID(ctx, tenantID)
	if err != nil {
		return nil, fmt.Errorf("failed to get members: %w", err)
	}
	return members, nil
}

// GetMemberships gets all memberships for a user
func (s *tenantMemberService) GetMemberships(ctx context.Context, userID string) ([]*types.TenantMember, error) {
	memberships, err := s.repo.GetMembershipsByUserID(ctx, userID)
	if err != nil {
		return nil, fmt.Errorf("failed to get memberships: %w", err)
	}
	return memberships, nil
}

// HasPermission checks if a user has at least the given minimum role in a tenant
func (s *tenantMemberService) HasPermission(ctx context.Context, userID string, tenantID uint64, minRole types.TenantRole) bool {
	member, err := s.repo.GetTenantMember(ctx, userID, tenantID)
	if err != nil || member == nil {
		return false
	}
	return member.Status == types.TenantMemberStatusActive && member.Role.HasPermission(minRole)
}
