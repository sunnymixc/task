package types

import (
	"time"

	"gorm.io/gorm"
)

// Tenant represents a tenant (organization/workspace) in the system
type Tenant struct {
	// Unique identifier of the tenant
	ID uint64 `json:"id" gorm:"primaryKey;autoIncrement"`
	// Name of the tenant
	Name string `json:"name" gorm:"type:varchar(255);not null"`
	// Description of the tenant
	Description string `json:"description" gorm:"type:text"`
	// Status of the tenant (active, suspended, etc.)
	Status string `json:"status" gorm:"type:varchar(50);default:'active'"`
	// Timestamps
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
	DeletedAt gorm.DeletedAt `json:"deleted_at,omitempty" gorm:"index"`

	// Associations (not stored in DB)
	Members []*TenantMember `json:"members,omitempty" gorm:"foreignKey:TenantID"`
}

// TableName specifies the table name for Tenant model
func (Tenant) TableName() string {
	return "tenants"
}

// TenantRole represents the role of a tenant member
type TenantRole string

const (
	TenantRoleOwner       TenantRole = "owner"       // Full control
	TenantRoleAdmin       TenantRole = "admin"       // Manage users, config
	TenantRoleContributor TenantRole = "contributor" // Can manage tasks
	TenantRoleViewer      TenantRole = "viewer"      // Read-only
)

// TenantMemberStatus represents the status of a tenant membership
type TenantMemberStatus string

const (
	TenantMemberStatusActive   TenantMemberStatus = "active"
	TenantMemberStatusPending  TenantMemberStatus = "pending"
	TenantMemberStatusRejected TenantMemberStatus = "rejected"
	TenantMemberStatusLeft     TenantMemberStatus = "left"
)

// TenantMember represents a user's membership in a tenant
type TenantMember struct {
	// Unique identifier
	ID uint64 `json:"id" gorm:"primaryKey;autoIncrement"`
	// User ID
	UserID string `json:"user_id" gorm:"type:varchar(36);not null;index"`
	// Tenant ID
	TenantID uint64 `json:"tenant_id" gorm:"not null;index"`
	// Role within the tenant
	Role TenantRole `json:"role" gorm:"type:varchar(20);not null;default:'contributor'"`
	// Status of the membership
	Status TenantMemberStatus `json:"status" gorm:"type:varchar(20);not null;default:'active'"`
	// When the user joined the tenant
	JoinedAt time.Time `json:"joined_at"`
	// Timestamps
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
	DeletedAt gorm.DeletedAt `json:"deleted_at,omitempty" gorm:"index"`

	// Associations (not stored in DB)
	User   *User   `json:"user,omitempty" gorm:"foreignKey:UserID"`
	Tenant *Tenant `json:"tenant,omitempty" gorm:"foreignKey:TenantID"`
}

// TableName specifies the table name for TenantMember model
func (TenantMember) TableName() string {
	return "tenant_members"
}

// HasPermission checks if the role has at least the given minimum permission level
func (r TenantRole) HasPermission(min TenantRole) bool {
	roleHierarchy := map[TenantRole]int{
		TenantRoleViewer:      1,
		TenantRoleContributor: 2,
		TenantRoleAdmin:       3,
		TenantRoleOwner:       4,
	}
	return roleHierarchy[r] >= roleHierarchy[min]
}

// CreateTenantRequest 创建租户请求
type CreateTenantRequest struct {
	Name        string `json:"name" binding:"required,min=1,max=255"`
	Description string `json:"description" binding:"max=1000"`
}

// UpdateTenantRequest 更新租户请求
type UpdateTenantRequest struct {
	Name        *string `json:"name"`
	Description *string `json:"description"`
	Status      *string `json:"status"`
}

// AddTenantMemberRequest 添加租户成员请求
type AddTenantMemberRequest struct {
	UserID string      `json:"user_id" binding:"required"`
	Role   TenantRole  `json:"role" binding:"required,oneof=owner admin contributor viewer"`
}

// UpdateTenantMemberRequest 更新租户成员请求
type UpdateTenantMemberRequest struct {
	Role *TenantRole `json:"role" binding:"omitempty,oneof=owner admin contributor viewer"`
}
