<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import { useTaskStore } from '@/stores/task'
import { useTaskListStore } from '@/stores/taskList'
import { useTaskFilterStore } from '@/stores/taskFilter'
import type { Task, TaskStatus } from '@/types'
import { DialogPlugin, MessagePlugin } from 'tdesign-vue-next'
import type { PrimaryTableCol } from 'tdesign-vue-next'
import TaskForm from '@/components/task/TaskForm.vue'
import StatusBadge from '@/components/task/StatusBadge.vue'
import ExecutionStatusBadge from '@/components/task/ExecutionStatusBadge.vue'
import PriorityBadge from '@/components/task/PriorityBadge.vue'
import StatusActions, { hasStatusActions } from '@/components/task/StatusActions.vue'
import TaskLinkList from '@/components/task/TaskLinkList.vue'

// 清单作用域模式:由路由 /task-lists/:listId/tasks 传入,只展示该清单下的任务
const props = defineProps<{ taskListId?: string }>()

const taskStore = useTaskStore()
const taskListStore = useTaskListStore()
const taskFilterStore = useTaskFilterStore()

const isListScoped = computed(() => !!props.taskListId)
// 状态筛选缓存的作用域:清单 id,全局任务视图用 'all'
const filterScopeKey = computed(() => props.taskListId ?? 'all')

const tasks = computed(() => taskStore.tasks)
const loading = computed(() => taskStore.loading)
const total = computed(() => taskStore.total)

// Filter states(状态筛选初始值从缓存恢复,覆盖刷新/直达路由场景)
const currentStatus = ref<TaskStatus[]>(taskFilterStore.getStatusFilter(props.taskListId ?? 'all'))
const currentTaskLists = ref<string[]>([])
const searchQuery = ref('')

// Pagination
const pagination = ref({
  current: 1,
  pageSize: 20
})

// Status filter options
const statusOptions = [
  { label: '草稿', value: 'draft' },
  { label: '待执行', value: 'pending' },
  { label: '执行中', value: 'executing' },
  { label: '已完成', value: 'completed' }
]

// Task list filter options
const taskListOptions = computed(() =>
  taskListStore.allLists.map(list => ({
    label: list.is_default ? `${list.title}（默认）` : list.title,
    value: list.id
  }))
)

// 页头标题:清单作用域下显示清单名称
const pageTitle = computed(() => {
  if (props.taskListId) {
    return taskListStore.allLists.find(l => l.id === props.taskListId)?.title || '任务清单'
  }
  return '任务列表'
})

// Table columns(清单作用域下省略任务清单列)
// 各列均为固定宽度,标题列取 420 避免宽屏下独占剩余空间;
// 容器更宽时剩余宽度由浏览器按各列宽度比例分摊
const columns = computed<PrimaryTableCol[]>(() => [
  { colKey: 'sort_order', title: '序号', width: 64 },
  { colKey: 'title', title: '标题和描述', width: 420 },
  { colKey: 'status', title: '任务状态', width: 90 },
  { colKey: 'execution_status', title: '执行状态', width: 90 },
  { colKey: 'priority', title: '优先级', width: 80 },
  { colKey: 'action', title: '操作', width: 316 },
  ...(isListScoped.value ? [] : [{ colKey: 'task_list', title: '任务清单', width: 110, ellipsis: true }]),
  { colKey: 'links', title: '链接', width: 140 },
  { colKey: 'due_date', title: '截止时间', width: 110 },
  { colKey: 'creator', title: '创建者', width: 90, ellipsis: true },
  { colKey: 'created_at', title: '创建时间', width: 110 },
  { colKey: 'updated_at', title: '更新时间', width: 110 }
])

// Fetch tasks
const fetchTasks = async () => {
  const params: any = {
    page: pagination.value.current,
    page_size: pagination.value.pageSize
  }

  if (currentStatus.value.length) {
    params.status = currentStatus.value
  }

  if (props.taskListId) {
    params.task_list_id = [props.taskListId]
  } else if (currentTaskLists.value.length) {
    params.task_list_id = currentTaskLists.value
  }

  await taskStore.fetchTasks(params)
}

// Handle status filter change
const handleStatusChange = () => {
  taskFilterStore.setStatusFilter(filterScopeKey.value, currentStatus.value)
  pagination.value.current = 1
  fetchTasks()
}

// 重置:仅恢复状态筛选为默认值(不动清单多选与搜索框),并刷新列表
const handleResetFilter = () => {
  currentStatus.value = taskFilterStore.resetStatusFilter(filterScopeKey.value)
  pagination.value.current = 1
  fetchTasks()
}

// Handle task list filter change
const handleTaskListChange = () => {
  pagination.value.current = 1
  fetchTasks()
}

// Handle search
const handleSearch = () => {
  if (searchQuery.value.trim()) {
    taskStore.searchTasks(searchQuery.value.trim(), 1)
  } else {
    fetchTasks()
  }
}

// Debounced search
let searchTimer: ReturnType<typeof setTimeout> | null = null
const onSearchInput = () => {
  if (searchTimer) {
    clearTimeout(searchTimer)
  }
  searchTimer = setTimeout(() => {
    handleSearch()
  }, 300)
}

// Clear search
const clearSearch = () => {
  searchQuery.value = ''
  fetchTasks()
}

// Open create dialog
const createFormRef = ref<InstanceType<typeof TaskForm>>()
const showCreateDialog = ref(false)
// "保存"(不关窗)后记住已入库的任务,后续保存/确定改走更新,避免重复建单
const createdTask = ref<Task | null>(null)
const openCreateDialog = () => {
  createdTask.value = null
  showCreateDialog.value = true
}

// Handle create task（keepOpen=true 仅保存入库不关窗；保存成功才关闭弹窗，失败保留弹窗与已填内容）
const handleCreateTask = async (data: any, keepOpen = false) => {
  const saved = createdTask.value
    ? await taskStore.updateTask(createdTask.value.id, data)
    : await taskStore.createTask(data)
  if (!saved) return
  createdTask.value = saved
  fetchTasks()
  if (!keepOpen) {
    showCreateDialog.value = false
    createdTask.value = null
  }
}

// Open edit dialog
const editFormRef = ref<InstanceType<typeof TaskForm>>()
const editingTask = ref<Task | null>(null)
const showEditDialog = ref(false)
const openEditDialog = (task: Task) => {
  editingTask.value = task
  showEditDialog.value = true
}

// Handle update task（keepOpen=true 仅保存入库不关窗；保存成功才关闭弹窗，失败保留弹窗与已填内容）
const handleUpdateTask = async (data: any, keepOpen = false) => {
  if (!editingTask.value) return
  const updated = await taskStore.updateTask(editingTask.value.id, data)
  if (!updated) return
  fetchTasks()
  if (!keepOpen) {
    showEditDialog.value = false
    editingTask.value = null
  }
}

// 原地编辑标题/描述:同一时刻只允许编辑一处(行 id + 字段),避免多处草稿状态
const inlineEdit = ref<{ id: string; field: 'title' | 'description' } | null>(null)
const inlineDraft = ref('')
const inlineSaving = ref(false)

const isInlineEditing = (row: Task, field: 'title' | 'description') =>
  inlineEdit.value?.id === row.id && inlineEdit.value?.field === field

const startInlineEdit = (task: Task, field: 'title' | 'description') => {
  inlineEdit.value = { id: task.id, field }
  inlineDraft.value = field === 'title' ? task.title : (task.description || '')
}

const cancelInlineEdit = () => {
  inlineEdit.value = null
}

// 保存原地编辑:仅提交被编辑的单个字段;失败时保留编辑态与草稿
const saveInlineEdit = async (task: Task) => {
  if (!inlineEdit.value || inlineSaving.value) return
  const field = inlineEdit.value.field
  const value = field === 'title' ? inlineDraft.value.trim() : inlineDraft.value
  if (field === 'title' && !value) {
    MessagePlugin.warning('任务标题不能为空')
    return
  }
  const original = field === 'title' ? task.title : (task.description || '')
  if (value === original) {
    inlineEdit.value = null
    return
  }
  inlineSaving.value = true
  try {
    const updated = await taskStore.updateTask(
      task.id,
      field === 'title' ? { title: value } : { description: value }
    )
    if (updated) {
      inlineEdit.value = null
    }
  } finally {
    inlineSaving.value = false
  }
}

// Handle delete task
const handleDeleteTask = (task: Task) => {
  const dialog = DialogPlugin.confirm({
    header: '确认删除',
    body: `确定要删除任务 "${task.title}" 吗？`,
    confirmBtn: '确定',
    cancelBtn: '取消',
    onConfirm: async () => {
      const success = await taskStore.deleteTask(task.id)
      dialog.hide()
      if (success) {
        fetchTasks()
      }
    },
  })
}

// Copy text to clipboard (falls back for non-secure contexts, e.g. LAN http access)
const copyToClipboard = async (text: string) => {
  if (navigator.clipboard && window.isSecureContext) {
    await navigator.clipboard.writeText(text)
    return
  }
  const ta = document.createElement('textarea')
  ta.value = text
  ta.style.position = 'fixed'
  ta.style.opacity = '0'
  document.body.appendChild(ta)
  ta.select()
  document.execCommand('copy')
  document.body.removeChild(ta)
}

// Copy task title + description to clipboard (title/description separated by 2 newlines)
const handleCopyTask = async (task: Task) => {
  const text = task.description
    ? `${task.title}\n\n${task.description}`
    : task.title
  try {
    await copyToClipboard(text)
    MessagePlugin.success('已复制到剪贴板')
  } catch {
    MessagePlugin.error('复制失败')
  }
}

// 弹窗底部"拷贝":复制表单当前标题+描述到剪贴板(未保存的输入也会被复制)
const handleCopyForm = async (formRef: InstanceType<typeof TaskForm> | undefined) => {
  const text = formRef?.getCopyText()?.trim()
  if (!text) {
    MessagePlugin.warning('暂无内容可复制')
    return
  }
  try {
    await copyToClipboard(text)
    MessagePlugin.success('已复制到剪贴板')
  } catch {
    MessagePlugin.error('复制失败')
  }
}

// 复制任务：以原任务内容创建副本（标题加“-副本”，状态重置为草稿），成功后刷新列表并打开副本编辑弹窗
const handleDuplicateTask = async (task: Task) => {
  const created = await taskStore.createTask({
    title: `${task.title}-副本`,
    description: task.description || undefined,
    status: 'draft',
    priority: task.priority,
    task_list_id: task.task_list_id || undefined,
    due_date: task.due_date || undefined,
  })
  if (created) {
    await fetchTasks()
    openEditDialog(created)
  }
}

// Handle status update
const handleStatusUpdate = async (taskId: string, status: TaskStatus) => {
  await taskStore.updateStatus(taskId, status)
  fetchTasks()
}

// Format date(列宽有限,只显示日期)
const formatDate = (dateStr: string) => {
  const date = new Date(dateStr)
  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  })
}

// Pagination change
const onPageChange = (pageInfo: any) => {
  pagination.value.current = pageInfo.current
  fetchTasks()
}

// 路由在 /tasks 与各清单子路由之间切换时复用同一组件实例,监听 prop 重置状态并刷新
watch(() => props.taskListId, () => {
  pagination.value.current = 1
  currentTaskLists.value = []
  searchQuery.value = ''
  currentStatus.value = taskFilterStore.getStatusFilter(filterScopeKey.value)
  fetchTasks()
})

// On mounted
onMounted(() => {
  fetchTasks()
  taskListStore.fetchAllLists()
})
</script>

<template>
  <div class="task-list-container">
    <!-- Header -->
    <div class="page-header">
      <div class="title">{{ pageTitle }}</div>
      <t-button theme="primary" @click="openCreateDialog">
        <template #icon><t-icon name="add" /></template>
        新建任务
      </t-button>
    </div>

    <!-- Filters -->
    <div class="filters">
      <div class="filter-group">
        <t-select
          v-model="currentStatus"
          :options="statusOptions"
          placeholder="选择任务状态"
          multiple
          clearable
          auto-width
          style="min-width: 120px"
          @change="handleStatusChange"
        />
        <t-select
          v-if="!isListScoped"
          v-model="currentTaskLists"
          :options="taskListOptions"
          placeholder="选择任务清单"
          multiple
          clearable
          auto-width
          style="min-width: 140px"
          @change="handleTaskListChange"
        />
        <t-button theme="default" variant="outline" @click="handleResetFilter">重置</t-button>
      </div>
      <div class="search-group">
        <t-input
          v-model="searchQuery"
          placeholder="搜索任务..."
          clearable
          style="width: 300px"
          @clear="clearSearch"
          @input="onSearchInput"
        >
          <template #prefix-icon>
            <t-icon name="search" />
          </template>
        </t-input>
      </div>
    </div>

    <!-- Task Table -->
    <div class="table-container">
      <t-table
        :data="tasks"
        :columns="columns"
        :loading="loading"
        :header-affixed-top="{ container: '.table-container' }"
        :pagination="{
          current: pagination.current,
          pageSize: pagination.pageSize,
          total: total,
          showPageSize: false
        }"
        row-key="id"
        hover
        @page-change="onPageChange"
      >
        <template #sort_order="{ row }">
          {{ row.sort_order > 0 ? row.sort_order : '-' }}
        </template>

        <template #title="{ row }">
          <!-- 标题:展示态(末尾悬停显示编辑图标) / 编辑态(输入框 + 保存/取消) -->
          <div v-if="!isInlineEditing(row, 'title')" class="task-title">
            {{ row.title }}
            <t-button
              class="inline-edit-btn"
              theme="default"
              variant="text"
              shape="square"
              size="small"
              @click="startInlineEdit(row, 'title')"
            >
              <t-icon name="edit" />
            </t-button>
            <t-button
              v-if="!row.description && !isInlineEditing(row, 'description')"
              class="inline-edit-btn inline-add-desc-btn"
              theme="default"
              variant="text"
              shape="rectangle"
              size="small"
              @click="startInlineEdit(row, 'description')"
            >
              <t-icon name="edit" /><span>添加描述</span>
            </t-button>
          </div>
          <div v-else class="inline-edit-box inline-edit-box--row" @keydown.esc="cancelInlineEdit">
            <t-input
              v-model="inlineDraft"
              size="small"
              :maxlength="255"
              autofocus
              style="flex: 1"
              @enter="saveInlineEdit(row)"
            />
            <t-button theme="primary" size="small" :loading="inlineSaving" @click="saveInlineEdit(row)">保存</t-button>
            <t-button theme="default" size="small" @click="cancelInlineEdit">取消</t-button>
          </div>

          <!-- 描述:有描述时文本末尾跟编辑图标;无描述时不渲染,"添加描述"入口在标题行 -->
          <div
            v-if="!isInlineEditing(row, 'description') && row.description"
            class="task-desc"
          >{{ row.description }}<t-button
              class="inline-edit-btn"
              theme="default"
              variant="text"
              shape="square"
              size="small"
              @click="startInlineEdit(row, 'description')"
            >
              <t-icon name="edit" />
            </t-button>
          </div>
          <div v-else-if="isInlineEditing(row, 'description')" class="inline-edit-box" @keydown.esc="cancelInlineEdit">
            <t-textarea
              v-model="inlineDraft"
              :maxlength="5000"
              :autosize="{ minRows: 2, maxRows: 8 }"
              autofocus
            />
            <div class="inline-edit-actions">
              <t-button theme="primary" size="small" :loading="inlineSaving" @click="saveInlineEdit(row)">保存</t-button>
              <t-button theme="default" size="small" @click="cancelInlineEdit">取消</t-button>
            </div>
          </div>
        </template>

        <template #status="{ row }">
          <StatusBadge :status="row.status" />
        </template>

        <template #execution_status="{ row }">
          <ExecutionStatusBadge :status="row.execution_status" />
        </template>

        <template #priority="{ row }">
          <PriorityBadge :priority="row.priority" />
        </template>

        <template #task_list="{ row }">
          {{ row.task_list?.title || '-' }}
        </template>

        <template #links="{ row }">
          <TaskLinkList :links="row.links" />
        </template>

        <template #due_date="{ row }">
          {{ row.due_date ? formatDate(row.due_date) : '-' }}
        </template>

        <template #creator="{ row }">
          <span class="creator-info">{{ row.creator?.username || '-' }}</span>
        </template>

        <template #created_at="{ row }">
          {{ formatDate(row.created_at) }}
        </template>

        <template #updated_at="{ row }">
          {{ formatDate(row.updated_at) }}
        </template>

        <template #action="{ row }">
          <t-space size="small">
            <StatusActions
              v-if="hasStatusActions(row.status)"
              :task="row"
              @status-change="(status) => handleStatusUpdate(row.id, status)"
            />
            <t-button theme="default" size="small" @click="handleCopyTask(row)">
              拷贝
            </t-button>
            <t-button theme="default" size="small" @click="handleDuplicateTask(row)">
              复制
            </t-button>
            <t-button theme="default" size="small" @click="openEditDialog(row)">
              编辑
            </t-button>
            <t-button theme="default" size="small" @click="handleDeleteTask(row)">
              删除
            </t-button>
          </t-space>
        </template>
      </t-table>

      <!-- Empty State -->
      <div v-if="!loading && tasks.length === 0" class="empty-state">
        <t-icon name="info-circle" size="48px" />
        <p>暂无任务</p>
        <t-button theme="primary" variant="outline" @click="openCreateDialog">
          创建第一个任务
        </t-button>
      </div>
    </div>

    <!-- Create Dialog -->
    <t-dialog
      v-model:visible="showCreateDialog"
      header="新建任务"
      placement="center"
      width="min(92vw, 760px)"
      dialog-class-name="task-form-dialog"
      @opened="createFormRef?.focusTitle()"
    >
      <TaskForm ref="createFormRef" :default-task-list-id="taskListId" @submit="handleCreateTask" />
      <template #footer>
        <t-button theme="default" @click="showCreateDialog = false">关闭</t-button>
        <t-button theme="default" @click="handleCopyForm(createFormRef)">拷贝</t-button>
        <t-button theme="primary" variant="outline" @click="createFormRef?.save()">保存</t-button>
        <t-button theme="primary" @click="createFormRef?.submit()">确定</t-button>
      </template>
    </t-dialog>

    <!-- Edit Dialog -->
    <t-dialog
      v-model:visible="showEditDialog"
      header="编辑任务"
      placement="center"
      width="min(92vw, 760px)"
      dialog-class-name="task-form-dialog"
      @opened="editFormRef?.focusTitle()"
    >
      <TaskForm
        ref="editFormRef"
        :task="editingTask"
        @submit="handleUpdateTask"
      />
      <template #footer>
        <t-button theme="default" @click="showEditDialog = false; editingTask = null">关闭</t-button>
        <t-button theme="default" @click="handleCopyForm(editFormRef)">拷贝</t-button>
        <t-button theme="primary" variant="outline" @click="editFormRef?.save()">保存</t-button>
        <t-button theme="primary" @click="editFormRef?.submit()">确定</t-button>
      </template>
    </t-dialog>
  </div>
</template>

<style scoped>
.task-list-container {
  display: flex;
  flex-direction: column;
  height: 100%;
  padding: 24px;
  box-sizing: border-box;
  background: var(--td-bg-color-page);
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
  flex-shrink: 0;
}

.title {
  font-size: 24px;
  font-weight: 600;
  color: var(--td-text-color-primary);
}

.filters {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
  gap: 16px;
  flex-shrink: 0;
}

.filter-group {
  display: flex;
  flex-wrap: nowrap;
  align-items: center;
  gap: 12px;
}

.filter-group > * {
  flex: 0 0 auto;
}

.table-container {
  flex: 1;
  min-height: 0;
  overflow: auto;
  position: relative;
  background: var(--td-bg-color-container);
  border: 0;
  border-radius: var(--td-radius-default);
  box-shadow: var(--td-shadow-1);
  padding: 0;
  scrollbar-width: thin;
  scrollbar-color: var(--td-gray-color-4) transparent;
}

/* 定制滚动条：透明轨道 + 内缩圆角滑块，轨道两端避开圆角区，保住右上/右下圆角 */
.table-container::-webkit-scrollbar {
  width: 8px;
  height: 8px;
}

.table-container::-webkit-scrollbar-track {
  background: transparent;
  margin: var(--td-radius-default);
}

.table-container::-webkit-scrollbar-thumb {
  background-color: var(--td-gray-color-4);
  border-radius: 4px;
  border: 2px solid transparent;
  background-clip: content-box;
}

.table-container::-webkit-scrollbar-thumb:hover {
  background-color: rgba(0, 0, 0, 0.35);
}

.table-container::-webkit-scrollbar-corner {
  background: transparent;
}

/* pin 置顶表头脱离容器 overflow 裁剪，需自带顶部圆角 */
.table-container :deep(.t-table__affixed-header-elm-wrap) {
  border-radius: var(--td-radius-default) var(--td-radius-default) 0 0;
  background: var(--td-bg-color-container);
}

/* 兜底：窄窗口下保住各列宽度，此时才允许出现横向滚动。
   1730 = 各列固定宽合计（其余列 1310 + 标题列 420） */
.table-container :deep(.t-table__content > table),
.table-container :deep(.t-table__affixed-header-elm-wrap table) {
  min-width: 1730px;
}

.task-title {
  font-weight: 500;
  color: var(--td-text-color-primary);
}

/* 仅当下方还有描述块/编辑框时才留间距,空描述时标题单独存在以保证垂直居中 */
.task-title:not(:last-child) {
  margin-bottom: 4px;
}

.task-desc {
  font-size: 12px;
  color: var(--td-text-color-secondary);
  white-space: pre-line;
  word-break: break-word;
}

/* 原地编辑入口:默认隐藏,悬停所在行或获得焦点时显示;不参与 pre-line 排版 */
.inline-edit-btn {
  white-space: nowrap;
  vertical-align: middle;
  margin-left: 4px;
  opacity: 0;
  transition: opacity 0.2s;
}

.inline-add-desc-btn {
  font-size: 12px;
}

/* 图标与文字垂直居中,对齐方式与描述行的编辑按钮一致 */
.inline-add-desc-btn :deep(.t-button__text) {
  align-items: center;
}

.table-container :deep(tr:hover) .inline-edit-btn,
.inline-edit-btn:focus {
  opacity: 1;
}

/* 原地编辑态:标题为一行(输入框+按钮),描述为纵向(文本域在上、按钮行在下) */
.inline-edit-box {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin: 4px 0;
}

.inline-edit-box--row {
  flex-direction: row;
  align-items: center;
}

.inline-edit-actions {
  display: flex;
  gap: 8px;
}

.creator-info {
  font-size: 13px;
  color: var(--td-text-color-primary);
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 60px 24px;
  color: var(--td-text-color-secondary);
}

.empty-state p {
  margin: 16px 0;
  font-size: 14px;
}
</style>

<style>
/* 任务表单弹窗:正文区随视口高度伸缩,超出时滚动,标题与底部按钮始终可见;
   预留约 220px 给标题栏、底部按钮和上下留白,保证居中后小视口下弹窗不超出屏幕 */
.task-form-dialog .t-dialog__body {
  max-height: min(62vh, calc(100vh - 220px));
  overflow-y: auto;
}
</style>
