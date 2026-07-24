// User Types
export interface User {
  id: string
  username: string
  email: string
  avatar: string
  tenant_id: number
  is_active: boolean
  is_admin: boolean
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

// System Settings Types（服务端全局设置，仅管理员可写）
export interface SystemSettings {
  ui_radius: number
}

export interface SystemSettingsResponse {
  success: boolean
  data: SystemSettings
}

// Task Types
export type TaskStatus = 'draft' | 'pending' | 'executing' | 'completed'
// 执行状态(任务执行过程的细化管理)
export type TaskExecutionStatus = 'unplanned' | 'planning' | 'planned' | 'working' | 'completed'
export type TaskPriority = 'low' | 'medium' | 'high'

export interface Task {
  id: string
  tenant_id: number
  title: string
  description: string
  result: string
  status: TaskStatus
  execution_status: TaskExecutionStatus
  execution_plan: string
  execution_log: string
  execution_result: string
  priority: TaskPriority
  // 序号(1-100000000),0 表示未设置(默认,排最前),列表按序号升序优先排序
  sort_order: number
  creator_id: string
  task_list_id: string
  due_date?: string | null
  created_at: string
  updated_at: string
  creator?: UserInfo
  task_list?: TaskListInfo
  links?: TaskLink[]
}

// 任务链接
export type TaskLinkType = 'url' | 'task'

// 链接目标任务的精简信息(列表接口返回完整 Task、详情接口返回精简对象,按交集定义)
export interface TaskLinkTargetInfo {
  id: string
  title: string
  status: TaskStatus
}

export interface TaskLink {
  id: number
  link_type: TaskLinkType
  title: string
  url?: string
  target_task_id?: string
  // 目标任务被删除时为 null/缺省
  target_task?: TaskLinkTargetInfo | null
}

// 提交任务时的链接输入
export interface TaskLinkInput {
  link_type: TaskLinkType
  title?: string
  url?: string
  target_task_id?: string
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
  result?: string
  status?: TaskStatus
  execution_status?: TaskExecutionStatus
  execution_plan?: string
  execution_log?: string
  execution_result?: string
  priority?: TaskPriority
  sort_order?: number
  task_list_id?: string
  due_date?: string
  links?: TaskLinkInput[]
}

export interface UpdateTaskRequest {
  title?: string
  description?: string
  result?: string
  status?: TaskStatus
  execution_status?: TaskExecutionStatus
  execution_plan?: string
  execution_log?: string
  execution_result?: string
  priority?: TaskPriority
  // 0 表示清除序号恢复默认(排最前),缺省表示不修改
  sort_order?: number
  task_list_id?: string
  due_date?: string
  // 缺省表示不修改链接;空数组表示清空;非空表示整体替换
  links?: TaskLinkInput[]
}

export interface UpdateTaskStatusRequest {
  status: TaskStatus
}

// 任务变更日志
export type TaskLogAction = 'create' | 'update' | 'status_change' | 'delete'

export interface TaskLog {
  id: number
  task_id: string
  action: TaskLogAction
  field_name: string
  old_value: string
  new_value: string
  operator?: UserInfo
  created_at: string
}

export interface TaskLogListResponse {
  success: boolean
  data: TaskLog[]
  total: number
  page: number
  page_size: number
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
  // 项目路径:任务的 AI 终端初始化时默认进入该目录,为空时进入主目录 ~
  project_path: string
  is_default: boolean
  // 序号(1-10000000),列表按序号升序;默认清单恒排最先
  sort_order: number
  creator_id: string
  created_at: string
  updated_at: string
  // 执行中任务数(列表接口动态返回)
  executing_count?: number
  creator?: UserInfo
}

// 任务响应中嵌套的清单精简信息
export interface TaskListInfo {
  id: string
  title: string
  is_default: boolean
  project_path: string
}

export interface CreateTaskListRequest {
  title: string
  description?: string
  project_path?: string
  // 不传则后端自动取当前租户最大序号+1
  sort_order?: number
}

export interface UpdateTaskListRequest {
  title?: string
  description?: string
  project_path?: string
  sort_order?: number
}

export interface ListTaskListsRequest {
  page?: number
  page_size?: number
  keyword?: string
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
