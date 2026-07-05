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
export type TaskStatus = 'draft' | 'pending' | 'running' | 'completed'
export type TaskPriority = 'low' | 'medium' | 'high'

export interface Task {
  id: string
  tenant_id: number
  title: string
  description: string
  status: TaskStatus
  priority: TaskPriority
  creator_id: string
  task_list_id: string
  due_date?: string | null
  created_at: string
  updated_at: string
  creator?: UserInfo
  task_list?: TaskListInfo
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
  task_list_id?: string
  due_date?: string
}

export interface UpdateTaskRequest {
  title?: string
  description?: string
  status?: TaskStatus
  priority?: TaskPriority
  task_list_id?: string
  due_date?: string
}

export interface UpdateTaskStatusRequest {
  status: TaskStatus
}

export interface ListTasksRequest {
  status?: TaskStatus[]
  creator_id?: string
  priority?: TaskPriority[]
  task_list_id?: string[]
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

// Task List (任务清单) Types
export interface TaskList {
  id: string
  tenant_id: number
  title: string
  description: string
  is_default: boolean
  creator_id: string
  created_at: string
  updated_at: string
  creator?: UserInfo
}

// 任务响应中嵌套的清单精简信息
export interface TaskListInfo {
  id: string
  title: string
  is_default: boolean
}

export interface CreateTaskListRequest {
  title: string
  description?: string
}

export interface UpdateTaskListRequest {
  title?: string
  description?: string
}

export interface ListTaskListsRequest {
  page?: number
  page_size?: number
}

// 任务清单分页响应(区别于 TaskListResponse = 任务分页响应)
export interface TaskListsResponse {
  success: boolean
  data: TaskList[]
  total: number
  page: number
  page_size: number
}

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
