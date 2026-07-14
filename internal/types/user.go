package types

import (
	"database/sql/driver"
	"encoding/json"
	"errors"
	"time"

	"gorm.io/gorm"
)

// UserPreferences holds per-user UI/feature preferences
type UserPreferences struct {
	// LastActiveTenantID remembers the last tenant the user actively switched into
	LastActiveTenantID *uint64 `json:"last_active_tenant_id,omitempty"`
}

// Value implements driver.Valuer so GORM persists UserPreferences as JSON
func (p UserPreferences) Value() (driver.Value, error) {
	return json.Marshal(p)
}

// Scan implements sql.Scanner so GORM can hydrate UserPreferences back
func (p *UserPreferences) Scan(value interface{}) error {
	if value == nil {
		*p = UserPreferences{}
		return nil
	}
	var data []byte
	switch v := value.(type) {
	case []byte:
		data = v
	case string:
		data = []byte(v)
	default:
		return errors.New("UserPreferences.Scan: unsupported type")
	}
	if len(data) == 0 {
		*p = UserPreferences{}
		return nil
	}
	return json.Unmarshal(data, p)
}

// User represents a user in the system
type User struct {
	// Unique identifier of the user
	ID string `json:"id" gorm:"type:varchar(36);primaryKey"`
	// Username of the user
	Username string `json:"username" gorm:"type:varchar(100);uniqueIndex;not null"`
	// Email address of the user
	Email string `json:"email" gorm:"type:varchar(255);uniqueIndex;not null"`
	// Hashed password of the user
	PasswordHash string `json:"-" gorm:"type:varchar(255);not null"`
	// Avatar URL of the user
	Avatar string `json:"avatar" gorm:"type:varchar(500)"`
	// Tenant ID that the user belongs to (home tenant)
	TenantID uint64 `json:"tenant_id" gorm:"index"`
	// Whether the user is active
	IsActive bool `json:"is_active" gorm:"default:true"`
	// Whether the user is a global administrator (系统管理员)
	IsAdmin bool `json:"is_admin" gorm:"not null;default:false"`
	// Per-user UI/feature preferences
	Preferences UserPreferences `json:"preferences" gorm:"type:jsonb;not null;default:'{}'"`
	// Timestamps
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
	DeletedAt gorm.DeletedAt `json:"deleted_at,omitempty" gorm:"index"`

	// Associations (not stored in DB)
	Tenant *Tenant `json:"tenant,omitempty" gorm:"foreignKey:TenantID"`
}

// TableName specifies the table name for User model
func (User) TableName() string {
	return "users"
}

// RegisterRequest 用户注册请求
type RegisterRequest struct {
	Username string `json:"username" binding:"required,min=3,max=100"`
	Email    string `json:"email" binding:"required,email,max=255"`
	Password string `json:"password" binding:"required,min=6,max=100"`
}

// LoginRequest 用户登录请求
type LoginRequest struct {
	Email    string `json:"email" binding:"required,email"`
	Password string `json:"password" binding:"required"`
}

// LoginResponse 登录响应
type LoginResponse struct {
	Success      bool   `json:"success"`
	Message      string `json:"message"`
	User         *User  `json:"user,omitempty"`
	ActiveTenant *Tenant `json:"active_tenant,omitempty"`
	Memberships  []Membership `json:"memberships,omitempty"`
	Token        string `json:"token,omitempty"`
}

// Membership represents a user's membership in a tenant
type Membership struct {
	Tenant *Tenant `json:"tenant"`
	Role   string  `json:"role"`
}

// UpdateUserRequest 更新用户信息请求
type UpdateUserRequest struct {
	Username *string `json:"username"`
	Email    *string `json:"email"`
	Avatar   *string `json:"avatar"`
}

// UpdatePasswordRequest 修改密码请求
type UpdatePasswordRequest struct {
	OldPassword string `json:"old_password" binding:"required"`
	NewPassword string `json:"new_password" binding:"required,min=6,max=100"`
}
