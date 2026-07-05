// User Types
export interface User {
  id: string
  username: string
  email: string
  avatar: string
  tenant_id: number
  is_active: boolean
  preferences: UserPreferences
  created_at: string
  updated_at: string
}

export interface UserPreferences {
  last_active_tenant_id?: number
}

export interface Tenant {
  id: number
  name: string
  description: string
  status: string
  created_at: string
  updated_at: string
}

export interface Membership {
  tenant: Tenant
  role: string
}

// Auth Types
export interface LoginRequest {
  email: string
  password: string
}

export interface RegisterRequest {
  username: string
  email: string
  password: string
}

export interface LoginResponse {
  success: boolean
  message: string
  user?: User
  active_tenant?: Tenant
  memberships?: Membership[]
  token?: string
  refresh_token?: string
}

export interface RefreshTokenRequest {
  refresh_token: string
}

// Task Types
export type TaskStatus = 'draft' | 'published' | 'in_progress' | 'completed' | 'ended'
export type TaskPriority = 'low' | 'medium' | 'high'

export interface Task {
  id: string
  tenant_id: number
  title: string
  description: string
  status: TaskStatus
  priority: TaskPriority
  assignee_id?: string | null
  creator_id: string
  due_date?: string | null
  created_at: string
  updated_at: string
  assignee?: UserInfo
  creator?: UserInfo
}

export interface UserInfo {
  id: string
  username: string
  email: string
  avatar: string
}

export interface CreateTaskRequest {
  title: string
  description?: string
  status?: TaskStatus
  priority?: TaskPriority
  assignee_id?: string
  due_date?: string
}

export interface UpdateTaskRequest {
  title?: string
  description?: string
  status?: TaskStatus
  priority?: TaskPriority
  assignee_id?: string
  due_date?: string
}

export interface UpdateTaskStatusRequest {
  status: TaskStatus
}

export interface ListTasksRequest {
  status?: TaskStatus[]
  assignee_id?: string
  creator_id?: string
  priority?: TaskPriority[]
  page?: number
  page_size?: number
}

export interface SearchTasksRequest {
  q: string
  page?: number
  page_size?: number
}

export interface TaskListResponse {
  success: boolean
  data: Task[]
  total: number
  page: number
  page_size: number
}

export interface TaskResponse extends Task {}

// API Response Types
export interface ApiResponse<T = any> {
  success: boolean
  message?: string
  data?: T
}

// Pagination
export interface PaginationParams {
  page?: number
  page_size?: number
}
