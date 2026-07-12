package interfaces

import (
	"context"

	"github.com/task-management/task/internal/types"
)

// UserRepository defines the interface for user data operations
type UserRepository interface {
	CreateUser(ctx context.Context, user *types.User) error
	// CreateUserGrantingFirstAdmin creates the user, setting IsAdmin=true when it is
	// the first user in the system (count guarded by an advisory lock in one tx)
	CreateUserGrantingFirstAdmin(ctx context.Context, user *types.User) error
	GetUserByID(ctx context.Context, id string) (*types.User, error)
	GetUserByEmail(ctx context.Context, email string) (*types.User, error)
	GetUserByUsername(ctx context.Context, username string) (*types.User, error)
	UpdateUser(ctx context.Context, user *types.User) error
	DeleteUser(ctx context.Context, id string) error
	ListUsers(ctx context.Context, tenantID uint64, offset, limit int) ([]*types.User, int64, error)
}

// UserService defines the interface for user business logic
type UserService interface {
	Register(ctx context.Context, req *types.RegisterRequest) (*types.LoginResponse, error)
	Login(ctx context.Context, req *types.LoginRequest) (*types.LoginResponse, error)
	RefreshToken(ctx context.Context, refreshToken string) (*types.LoginResponse, error)
	GetUserByID(ctx context.Context, id string) (*types.User, error)
	UpdateUser(ctx context.Context, id string, req *types.UpdateUserRequest) (*types.User, error)
	UpdatePassword(ctx context.Context, id string, req *types.UpdatePasswordRequest) error
	GetCurrentTenant(ctx context.Context) (*types.Tenant, error)
}
