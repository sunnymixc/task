<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useTaskStore } from '@/stores/task'
import type { Task, TaskStatus, TaskPriority } from '@/types'
import { DialogPlugin, MessagePlugin } from 'tdesign-vue-next'
import TaskForm from '@/components/task/TaskForm.vue'
import StatusBadge from '@/components/task/StatusBadge.vue'
import PriorityBadge from '@/components/task/PriorityBadge.vue'
import StatusActions from '@/components/task/StatusActions.vue'

const taskStore = useTaskStore()

const tasks = computed(() => taskStore.tasks)
const loading = computed(() => taskStore.loading)
const total = computed(() => taskStore.total)

// Filter states
const currentStatus = ref<TaskStatus[]>([])
const currentPriority = ref<TaskPriority[]>([])
const searchQuery = ref('')

// Pagination
const pagination = ref({
  current: 1,
  pageSize: 20
})

// Status filter options
const statusOptions = [
  { label: '草稿', value: 'draft' },
  { label: '待执行', value: 'published' },
  { label: '执行中', value: 'in_progress' },
  { label: '已完成', value: 'completed' }
]

// Priority filter options
const priorityOptions = [
  { label: '高', value: 'high' },
  { label: '中', value: 'medium' },
  { label: '低', value: 'low' }
]

// Table columns
const columns = [
  { colKey: 'title', title: '标题', width: 300 },
  { colKey: 'status', title: '状态', width: 100 },
  { colKey: 'priority', title: '优先级', width: 100 },
  { colKey: 'due_date', title: '截止时间', width: 180 },
  { colKey: 'assignee', title: '指派人', width: 120 },
  { colKey: 'creator', title: '创建者', width: 120 },
  { colKey: 'created_at', title: '创建时间', width: 180 },
  { colKey: 'updated_at', title: '更新时间', width: 180 },
  { colKey: 'action', title: '操作', width: 320, fixed: 'right' }
]

// Fetch tasks
const fetchTasks = async () => {
  const params: any = {
    page: pagination.value.current,
    page_size: pagination.value.pageSize
  }

  if (currentStatus.value.length) {
    params.status = currentStatus.value
  }
  if (currentPriority.value.length) {
    params.priority = currentPriority.value
  }

  await taskStore.fetchTasks(params)
}

// Handle status filter change
const handleStatusChange = () => {
  pagination.value.current = 1
  fetchTasks()
}

// Handle priority filter change
const handlePriorityChange = () => {
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
const openCreateDialog = () => {
  showCreateDialog.value = true
}

// Handle create task
const handleCreateTask = async (data: any) => {
  await taskStore.createTask(data)
  showCreateDialog.value = false
  fetchTasks()
}

// Open edit dialog
const editFormRef = ref<InstanceType<typeof TaskForm>>()
const editingTask = ref<Task | null>(null)
const showEditDialog = ref(false)
const openEditDialog = (task: Task) => {
  editingTask.value = task
  showEditDialog.value = true
}

// Handle update task
const handleUpdateTask = async (data: any) => {
  if (editingTask.value) {
    await taskStore.updateTask(editingTask.value.id, data)
    showEditDialog.value = false
    editingTask.value = null
    fetchTasks()
  }
}

// Handle delete task
const handleDeleteTask = async (task: Task) => {
  const dialog = DialogPlugin.confirm({
    header: '确认删除',
    body: `确定要删除任务 "${task.title}" 吗？`,
    confirmBtn: '确定',
    cancelBtn: '取消'
  })

  dialog.onConfirm(async () => {
    const success = await taskStore.deleteTask(task.id)
    if (success) {
      fetchTasks()
    }
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

// Handle status update
const handleStatusUpdate = async (taskId: string, status: TaskStatus) => {
  await taskStore.updateStatus(taskId, status)
  fetchTasks()
}

// Format date
const formatDate = (dateStr: string) => {
  const date = new Date(dateStr)
  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  })
}

// Pagination change
const onPageChange = (pageInfo: any) => {
  pagination.value.current = pageInfo.current
  fetchTasks()
}

// On mounted
onMounted(() => {
  fetchTasks()
})
</script>

<template>
  <div class="task-list-container">
    <!-- Header -->
    <div class="page-header">
      <div class="title">任务列表</div>
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
          placeholder="选择状态"
          multiple
          clearable
          :min-collapsed-num="1"
          style="min-width: 120px"
          @change="handleStatusChange"
        />
        <t-select
          v-model="currentPriority"
          :options="priorityOptions"
          placeholder="选择优先级"
          multiple
          clearable
          :min-collapsed-num="1"
          style="min-width: 100px"
          @change="handlePriorityChange"
        />
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
        @page-change="onPageChange"
      >
        <template #title="{ row }">
          <div class="task-title">{{ row.title }}</div>
          <div v-if="row.description" class="task-desc">{{ row.description }}</div>
        </template>

        <template #status="{ row }">
          <StatusBadge :status="row.status" />
        </template>

        <template #priority="{ row }">
          <PriorityBadge :priority="row.priority" />
        </template>

        <template #due_date="{ row }">
          {{ row.due_date ? formatDate(row.due_date) : '-' }}
        </template>

        <template #assignee="{ row }">
          <div v-if="row.assignee" class="creator-info">
            <t-avatar :image="row.assignee?.avatar || ''" size="24">
              {{ row.assignee?.username?.charAt(0) || 'U' }}
            </t-avatar>
            <span>{{ row.assignee?.username || '-' }}</span>
          </div>
          <span v-else>未分配</span>
        </template>

        <template #creator="{ row }">
          <div class="creator-info">
            <t-avatar :image="row.creator?.avatar || ''" size="24">
              {{ row.creator?.username?.charAt(0) || 'U' }}
            </t-avatar>
            <span>{{ row.creator?.username || '-' }}</span>
          </div>
        </template>

        <template #created_at="{ row }">
          {{ formatDate(row.created_at) }}
        </template>

        <template #updated_at="{ row }">
          {{ formatDate(row.updated_at) }}
        </template>

        <template #action="{ row }">
          <t-space>
            <StatusActions
              :task="row"
              @status-change="(status) => handleStatusUpdate(row.id, status)"
            />
            <t-button size="medium" theme="default" variant="outline" @click="handleCopyTask(row)">
              拷贝
            </t-button>
            <t-button size="medium" theme="default" variant="outline" @click="openEditDialog(row)">
              编辑
            </t-button>
            <t-button size="medium" theme="default" variant="outline" @click="handleDeleteTask(row)">
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
      width="min(92vw, 760px)"
      dialog-class-name="task-form-dialog"
      cancel-btn="取消"
      confirm-btn="确定"
      @confirm="createFormRef?.submit()"
      @cancel="showCreateDialog = false"
    >
      <TaskForm ref="createFormRef" @submit="handleCreateTask" />
    </t-dialog>

    <!-- Edit Dialog -->
    <t-dialog
      v-model:visible="showEditDialog"
      header="编辑任务"
      width="min(92vw, 760px)"
      dialog-class-name="task-form-dialog"
      cancel-btn="取消"
      confirm-btn="确定"
      @confirm="editFormRef?.submit()"
      @cancel="showEditDialog = false; editingTask = null"
    >
      <TaskForm
        ref="editFormRef"
        :task="editingTask"
        @submit="handleUpdateTask"
      />
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
  gap: 12px;
}

.table-container {
  flex: 1;
  min-height: 0;
  overflow: auto;
  position: relative;
  background: var(--td-bg-color-container);
  border: 0;
  border-radius: var(--td-radius-default);
  padding: 0;
}

.task-title {
  font-weight: 500;
  color: var(--td-text-color-primary);
  margin-bottom: 4px;
}

.task-desc {
  font-size: 12px;
  color: var(--td-text-color-secondary);
  white-space: normal;
  word-break: break-word;
}

.creator-info {
  display: flex;
  align-items: center;
  gap: 8px;
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
/* 任务表单弹窗:正文区随视口高度伸缩,超出时滚动,标题与底部按钮始终可见 */
.task-form-dialog .t-dialog__body {
  max-height: 72vh;
  overflow-y: auto;
}
</style>
