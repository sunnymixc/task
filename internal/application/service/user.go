package service

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/google/uuid"
	"golang.org/x/crypto/bcrypt"

	"github.com/task-management/task/internal/application/repository"
	"github.com/task-management/task/internal/config"
	"github.com/task-management/task/internal/types"
	"github.com/task-management/task/internal/types/interfaces"
	"github.com/task-management/task/internal/util"
)

// userService implements interfaces.UserService
type userService struct {
	userRepo       interfaces.UserRepository
	tenantRepo     interfaces.TenantRepository
	memberRepo     interfaces.TenantMemberRepository
	taskListRepo   interfaces.TaskListRepository
	config         *config.Config
}

var (
	// ErrUserNotFound is returned when a user is not found
	ErrUserNotFound = errors.New("user not found")
	// ErrInvalidCredentials is returned when credentials are invalid
	ErrInvalidCredentials = errors.New("invalid credentials")
	// ErrUserExists is returned when a user already exists
	ErrUserExists = errors.New("user already exists")
)

// NewUserService creates a new user service
func NewUserService(cfg *config.Config) interfaces.UserService {
	return &userService{
		userRepo:     repository.NewUserRepository(),
		tenantRepo:   repository.NewTenantRepository(),
		memberRepo:   repository.NewTenantMemberRepository(),
		taskListRepo: repository.NewTaskListRepository(),
		config:       cfg,
	}
}

// Register creates a new user with a home tenant
func (s *userService) Register(ctx context.Context, req *types.RegisterRequest) (*types.LoginResponse, error) {
	// Check if user already exists by email
	existingUser, err := s.userRepo.GetUserByEmail(ctx, req.Email)
	if err != nil {
		return nil, fmt.Errorf("failed to check existing user: %w", err)
	}
	if existingUser != nil {
		return nil, ErrUserExists
	}

	// Check if username is taken
	existingUser, err = s.userRepo.GetUserByUsername(ctx, req.Username)
	if err != nil {
		return nil, fmt.Errorf("failed to check username: %w", err)
	}
	if existingUser != nil {
		return nil, ErrUserExists
	}

	// Hash password
	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
	if err != nil {
		return nil, fmt.Errorf("failed to hash password: %w", err)
	}

	// Create home tenant
	tenant := &types.Tenant{
		Name:        fmt.Sprintf("%s's Workspace", req.Username),
		Description: "Personal workspace",
		Status:      "active",
	}
	if err := s.tenantRepo.CreateTenant(ctx, tenant); err != nil {
		return nil, fmt.Errorf("failed to create tenant: %w", err)
	}

	// Create user
	user := &types.User{
		ID:           uuid.New().String(),
		Username:     req.Username,
		Email:        req.Email,
		PasswordHash: string(hashedPassword),
		TenantID:     tenant.ID,
		IsActive:     true,
		Preferences:  types.UserPreferences{},
	}
	// 首个注册用户自动成为系统管理员
	if err := s.userRepo.CreateUserGrantingFirstAdmin(ctx, user); err != nil {
		return nil, fmt.Errorf("failed to create user: %w", err)
	}

	// Create tenant membership as owner
	member := &types.TenantMember{
		UserID:    user.ID,
		TenantID:  tenant.ID,
		Role:      types.TenantRoleOwner,
		Status:    types.TenantMemberStatusActive,
		JoinedAt:  time.Now(),
	}
	if err := s.memberRepo.CreateTenantMember(ctx, member); err != nil {
		return nil, fmt.Errorf("failed to create membership: %w", err)
	}

	// Create the tenant's default task list (CreateTask 亦有懒建兜底)
	if _, err := getOrCreateDefaultTaskList(ctx, s.taskListRepo, tenant.ID, user.ID); err != nil {
		return nil, fmt.Errorf("failed to create default task list: %w", err)
	}

	// Generate JWT token
	token, err := s.generateToken(user.ID, user.Email, tenant.ID)
	if err != nil {
		return nil, fmt.Errorf("failed to generate token: %w", err)
	}
	refreshToken, err := s.generateRefreshToken(user.ID, user.Email, tenant.ID)
	if err != nil {
		return nil, fmt.Errorf("failed to generate refresh token: %w", err)
	}

	// Get memberships for response
	memberships, err := s.getMemberships(ctx, user.ID)
	if err != nil {
		return nil, fmt.Errorf("failed to get memberships: %w", err)
	}

	return &types.LoginResponse{
		Success:      true,
		Message:      "Registration successful",
		User:         user,
		ActiveTenant: tenant,
		Memberships:  memberships,
		Token:        token,
		RefreshToken: refreshToken,
	}, nil
}

// Login authenticates a user and returns a token
func (s *userService) Login(ctx context.Context, req *types.LoginRequest) (*types.LoginResponse, error) {
	// Get user by email
	user, err := s.userRepo.GetUserByEmail(ctx, req.Email)
	if err != nil {
		return nil, fmt.Errorf("failed to get user: %w", err)
	}
	if user == nil {
		return nil, ErrInvalidCredentials
	}

	// Check password
	if err := bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(req.Password)); err != nil {
		return nil, ErrInvalidCredentials
	}

	// Check if user is active
	if !user.IsActive {
		return nil, errors.New("user account is inactive")
	}

	// Get active tenant
	tenant, err := s.tenantRepo.GetTenantByID(ctx, user.TenantID)
	if err != nil {
		return nil, fmt.Errorf("failed to get tenant: %w", err)
	}
	if tenant == nil {
		return nil, errors.New("home tenant not found")
	}

	// Generate JWT token
	token, err := s.generateToken(user.ID, user.Email, tenant.ID)
	if err != nil {
		return nil, fmt.Errorf("failed to generate token: %w", err)
	}
	refreshToken, err := s.generateRefreshToken(user.ID, user.Email, tenant.ID)
	if err != nil {
		return nil, fmt.Errorf("failed to generate refresh token: %w", err)
	}

	// Get memberships for response
	memberships, err := s.getMemberships(ctx, user.ID)
	if err != nil {
		return nil, fmt.Errorf("failed to get memberships: %w", err)
	}

	return &types.LoginResponse{
		Success:      true,
		Message:      "Login successful",
		User:         user,
		ActiveTenant: tenant,
		Memberships:  memberships,
		Token:        token,
		RefreshToken: refreshToken,
	}, nil
}

// RefreshToken exchanges a valid refresh token for a new access token,
// rotating the refresh token as well (sliding window).
func (s *userService) RefreshToken(ctx context.Context, refreshToken string) (*types.LoginResponse, error) {
	// Parse and validate the refresh token
	claims, err := util.ParseRefreshToken(refreshToken, s.config.Auth.JWTSecret)
	if err != nil {
		return nil, fmt.Errorf("invalid token: %w", err)
	}

	// Get user
	user, err := s.userRepo.GetUserByID(ctx, claims.UserID)
	if err != nil {
		return nil, fmt.Errorf("failed to get user: %w", err)
	}
	if user == nil {
		return nil, ErrUserNotFound
	}
	if !user.IsActive {
		return nil, errors.New("user account is inactive")
	}

	// Get tenant
	tenant, err := s.tenantRepo.GetTenantByID(ctx, claims.TenantID)
	if err != nil {
		return nil, fmt.Errorf("failed to get tenant: %w", err)
	}
	if tenant == nil {
		return nil, errors.New("tenant not found")
	}

	// Generate new token pair
	token, err := s.generateToken(user.ID, user.Email, tenant.ID)
	if err != nil {
		return nil, fmt.Errorf("failed to generate token: %w", err)
	}
	newRefreshToken, err := s.generateRefreshToken(user.ID, user.Email, tenant.ID)
	if err != nil {
		return nil, fmt.Errorf("failed to generate refresh token: %w", err)
	}

	// Get memberships
	memberships, err := s.getMemberships(ctx, user.ID)
	if err != nil {
		return nil, fmt.Errorf("failed to get memberships: %w", err)
	}

	return &types.LoginResponse{
		Success:      true,
		Message:      "Token refreshed",
		User:         user,
		ActiveTenant: tenant,
		Memberships:  memberships,
		Token:        token,
		RefreshToken: newRefreshToken,
	}, nil
}

// GetUserByID retrieves a user by ID
func (s *userService) GetUserByID(ctx context.Context, id string) (*types.User, error) {
	user, err := s.userRepo.GetUserByID(ctx, id)
	if err != nil {
		return nil, fmt.Errorf("failed to get user: %w", err)
	}
	if user == nil {
		return nil, ErrUserNotFound
	}
	return user, nil
}

// UpdateUser updates a user
func (s *userService) UpdateUser(ctx context.Context, id string, req *types.UpdateUserRequest) (*types.User, error) {
	user, err := s.userRepo.GetUserByID(ctx, id)
	if err != nil {
		return nil, fmt.Errorf("failed to get user: %w", err)
	}
	if user == nil {
		return nil, ErrUserNotFound
	}

	// Update fields if provided
	if req.Username != nil {
		// Check if username is taken by another user
		existing, err := s.userRepo.GetUserByUsername(ctx, *req.Username)
		if err != nil {
			return nil, fmt.Errorf("failed to check username: %w", err)
		}
		if existing != nil && existing.ID != id {
			return nil, ErrUserExists
		}
		user.Username = *req.Username
	}
	if req.Email != nil {
		// Check if email is taken by another user
		existing, err := s.userRepo.GetUserByEmail(ctx, *req.Email)
		if err != nil {
			return nil, fmt.Errorf("failed to check email: %w", err)
		}
		if existing != nil && existing.ID != id {
			return nil, ErrUserExists
		}
		user.Email = *req.Email
	}
	if req.Avatar != nil {
		user.Avatar = *req.Avatar
	}

	if err := s.userRepo.UpdateUser(ctx, user); err != nil {
		return nil, fmt.Errorf("failed to update user: %w", err)
	}

	return user, nil
}

// UpdatePassword updates a user's password
func (s *userService) UpdatePassword(ctx context.Context, id string, req *types.UpdatePasswordRequest) error {
	user, err := s.userRepo.GetUserByID(ctx, id)
	if err != nil {
		return fmt.Errorf("failed to get user: %w", err)
	}
	if user == nil {
		return ErrUserNotFound
	}

	// Verify old password
	if err := bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(req.OldPassword)); err != nil {
		return ErrInvalidCredentials
	}

	// Hash new password
	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(req.NewPassword), bcrypt.DefaultCost)
	if err != nil {
		return fmt.Errorf("failed to hash password: %w", err)
	}

	user.PasswordHash = string(hashedPassword)
	if err := s.userRepo.UpdateUser(ctx, user); err != nil {
		return fmt.Errorf("failed to update password: %w", err)
	}

	return nil
}

// GetCurrentTenant gets the current tenant for the user
func (s *userService) GetCurrentTenant(ctx context.Context) (*types.Tenant, error) {
	// This would typically get the tenant from the context
	// For now, return an error as this needs to be implemented with context
	return nil, errors.New("not implemented")
}

// generateToken generates an access JWT for a user
func (s *userService) generateToken(userID, email string, tenantID uint64) (string, error) {
	lifetime := time.Duration(s.config.Auth.JWTExpiration) * time.Minute
	return util.GenerateToken(s.config.Auth.JWTSecret, lifetime, userID, email, tenantID)
}

// generateRefreshToken generates a long-lived refresh JWT for a user
func (s *userService) generateRefreshToken(userID, email string, tenantID uint64) (string, error) {
	lifetime := time.Duration(s.config.Auth.JWTRefreshExpiration) * time.Minute
	return util.GenerateRefreshToken(s.config.Auth.JWTSecret, lifetime, userID, email, tenantID)
}

// getMemberships gets all memberships for a user
func (s *userService) getMemberships(ctx context.Context, userID string) ([]types.Membership, error) {
	members, err := s.memberRepo.GetMembershipsByUserID(ctx, userID)
	if err != nil {
		return nil, err
	}

	memberships := make([]types.Membership, len(members))
	for i, member := range members {
		memberships[i] = types.Membership{
			Tenant: member.Tenant,
			Role:   string(member.Role),
		}
	}

	return memberships, nil
}
