<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useTaskListStore } from '@/stores/taskList'
import type { TaskList } from '@/types'
import { DialogPlugin } from 'tdesign-vue-next'
import TaskListForm from '@/components/task-list/TaskListForm.vue'

const taskListStore = useTaskListStore()

const lists = computed(() => taskListStore.lists)
const loading = computed(() => taskListStore.loading)
const total = computed(() => taskListStore.total)

// Pagination
const pagination = ref({
  current: 1,
  pageSize: 20
})

// Table columns
const columns = [
  { colKey: 'id', title: 'ID', width: 240 },
  { colKey: 'title', title: '标题', width: 220 },
  { colKey: 'description', title: '描述', width: 300 },
  { colKey: 'creator', title: '创建者', width: 120 },
  { colKey: 'created_at', title: '创建时间', width: 180 },
  { colKey: 'updated_at', title: '更新时间', width: 180 },
  { colKey: 'action', title: '操作', width: 160, fixed: 'right' }
]

// Fetch task lists
const fetchLists = async () => {
  await taskListStore.fetchLists({
    page: pagination.value.current,
    page_size: pagination.value.pageSize
  })
}

// Open create dialog
const createFormRef = ref<InstanceType<typeof TaskListForm>>()
const showCreateDialog = ref(false)
const openCreateDialog = () => {
  showCreateDialog.value = true
}

// Handle create task list
const handleCreateList = async (data: any) => {
  await taskListStore.createList(data)
  showCreateDialog.value = false
  fetchLists()
}

// Open edit dialog
const editFormRef = ref<InstanceType<typeof TaskListForm>>()
const editingList = ref<TaskList | null>(null)
const showEditDialog = ref(false)
const openEditDialog = (list: TaskList) => {
  editingList.value = list
  showEditDialog.value = true
}

// Handle update task list
const handleUpdateList = async (data: any) => {
  if (editingList.value) {
    await taskListStore.updateList(editingList.value.id, data)
    showEditDialog.value = false
    editingList.value = null
    fetchLists()
  }
}

// Handle delete task list
const handleDeleteList = (list: TaskList) => {
  const dialog = DialogPlugin.confirm({
    header: '确认删除',
    body: `确定要删除任务清单 "${list.title}" 吗？该清单下的任务将移动到默认清单。`,
    confirmBtn: '确定',
    cancelBtn: '取消',
    onConfirm: async () => {
      const success = await taskListStore.deleteList(list.id)
      dialog.hide()
      if (success) {
        fetchLists()
      }
    },
  })
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
  fetchLists()
}

// On mounted
onMounted(() => {
  fetchLists()
})
</script>

<template>
  <div class="task-list-manage-container">
    <!-- Header -->
    <div class="page-header">
      <div class="title">任务清单</div>
      <t-button theme="primary" @click="openCreateDialog">
        <template #icon><t-icon name="add" /></template>
        新建清单
      </t-button>
    </div>

    <!-- Task List Table -->
    <div class="table-container">
      <t-table
        :data="lists"
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
        <template #id="{ row }">
          <span class="list-id">{{ row.id }}</span>
        </template>

        <template #title="{ row }">
          <div class="list-title">
            <span>{{ row.title }}</span>
            <t-tag v-if="row.is_default" theme="primary" variant="light" size="small">默认</t-tag>
          </div>
        </template>

        <template #description="{ row }">
          <span class="list-desc">{{ row.description || '-' }}</span>
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
            <t-button size="medium" theme="default" variant="outline" @click="openEditDialog(row)">
              编辑
            </t-button>
            <t-button
              v-if="!row.is_default"
              size="medium"
              theme="default"
              variant="outline"
              @click="handleDeleteList(row)"
            >
              删除
            </t-button>
          </t-space>
        </template>
      </t-table>

      <!-- Empty State -->
      <div v-if="!loading && lists.length === 0" class="empty-state">
        <t-icon name="info-circle" size="48px" />
        <p>暂无任务清单</p>
        <t-button theme="primary" variant="outline" @click="openCreateDialog">
          创建第一个清单
        </t-button>
      </div>
    </div>

    <!-- Create Dialog -->
    <t-dialog
      v-model:visible="showCreateDialog"
      header="新建清单"
      width="min(92vw, 640px)"
      cancel-btn="取消"
      confirm-btn="确定"
      @confirm="createFormRef?.submit()"
      @cancel="showCreateDialog = false"
    >
      <TaskListForm ref="createFormRef" @submit="handleCreateList" />
    </t-dialog>

    <!-- Edit Dialog -->
    <t-dialog
      v-model:visible="showEditDialog"
      header="编辑清单"
      width="min(92vw, 640px)"
      cancel-btn="取消"
      confirm-btn="确定"
      @confirm="editFormRef?.submit()"
      @cancel="showEditDialog = false; editingList = null"
    >
      <TaskListForm
        ref="editFormRef"
        :list="editingList"
        @submit="handleUpdateList"
      />
    </t-dialog>
  </div>
</template>

<style scoped>
.task-list-manage-container {
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

.list-id {
  font-family: monospace;
  font-size: 12px;
  color: var(--td-text-color-secondary);
}

.list-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 500;
  color: var(--td-text-color-primary);
}

.list-desc {
  font-size: 13px;
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
