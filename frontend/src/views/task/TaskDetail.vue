<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import type { Task } from '@/types'
import { taskAPI } from '@/api/task'
import StatusBadge from '@/components/task/StatusBadge.vue'
import PriorityBadge from '@/components/task/PriorityBadge.vue'
import TaskLinkList from '@/components/task/TaskLinkList.vue'

const props = defineProps<{ taskId: string }>()

const router = useRouter()
const task = ref<Task | null>(null)
const loading = ref(true)
const loadFailed = ref(false)

// 直接走 API 不进 store:详情页只读,失败时本地降级为空态
const fetchTask = async () => {
  loading.value = true
  loadFailed.value = false
  try {
    task.value = await taskAPI.getById(props.taskId)
  } catch {
    task.value = null
    loadFailed.value = true
  } finally {
    loading.value = false
  }
}

onMounted(fetchTask)

// 详情页内打开另一个任务详情(同窗口路由跳转)时复用组件实例
watch(() => props.taskId, fetchTask)

const goBack = () => {
  if (window.history.length > 1) {
    router.back()
  } else {
    router.push({ name: 'TaskList' })
  }
}

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
</script>

<template>
  <div class="task-detail-container">
    <t-loading :loading="loading" show-overlay>
      <template v-if="task">
        <div class="page-header">
          <t-button theme="default" variant="text" shape="square" @click="goBack">
            <t-icon name="arrow-left" size="20px" />
          </t-button>
          <div class="title">{{ task.title }}</div>
          <StatusBadge :status="task.status" />
          <PriorityBadge :priority="task.priority" />
        </div>

        <t-card :bordered="false" class="detail-card">
          <div class="meta-grid">
            <div class="meta-item">
              <div class="meta-label">任务清单</div>
              <div class="meta-value">{{ task.task_list?.title || '-' }}</div>
            </div>
            <div class="meta-item">
              <div class="meta-label">创建者</div>
              <div class="meta-value creator-info">
                <t-avatar :image="task.creator?.avatar || ''" size="24">
                  {{ task.creator?.username?.charAt(0) || 'U' }}
                </t-avatar>
                <span>{{ task.creator?.username || '-' }}</span>
              </div>
            </div>
            <div class="meta-item">
              <div class="meta-label">截止时间</div>
              <div class="meta-value">{{ task.due_date ? formatDate(task.due_date) : '-' }}</div>
            </div>
            <div class="meta-item">
              <div class="meta-label">创建时间</div>
              <div class="meta-value">{{ formatDate(task.created_at) }}</div>
            </div>
            <div class="meta-item">
              <div class="meta-label">更新时间</div>
              <div class="meta-value">{{ formatDate(task.updated_at) }}</div>
            </div>
          </div>

          <div class="section">
            <div class="section-title">描述</div>
            <div class="description">{{ task.description || '-' }}</div>
          </div>

          <div class="section">
            <div class="section-title">结果</div>
            <div class="description">{{ task.result || '-' }}</div>
          </div>

          <div class="section">
            <div class="section-title">链接</div>
            <TaskLinkList :links="task.links" />
          </div>
        </t-card>
      </template>

      <div v-else-if="loadFailed" class="empty-state">
        <t-icon name="info-circle" size="48px" />
        <p>任务不存在或已被删除</p>
        <t-button theme="primary" variant="outline" @click="router.push({ name: 'TaskList' })">
          返回任务列表
        </t-button>
      </div>
    </t-loading>
  </div>
</template>

<style scoped>
.task-detail-container {
  height: 100%;
  padding: 24px;
  box-sizing: border-box;
  background: var(--td-bg-color-page);
  overflow: auto;
}

.page-header {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 20px;
}

.title {
  font-size: 24px;
  font-weight: 600;
  color: var(--td-text-color-primary);
  word-break: break-word;
}

.detail-card {
  background: var(--td-bg-color-container);
  border-radius: var(--td-radius-default);
}

.meta-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 16px 24px;
  margin-bottom: 24px;
}

.meta-label {
  font-size: 12px;
  color: var(--td-text-color-secondary);
  margin-bottom: 4px;
}

.meta-value {
  font-size: 14px;
  color: var(--td-text-color-primary);
}

.creator-info {
  display: flex;
  align-items: center;
  gap: 8px;
}

.section {
  margin-bottom: 24px;
}

.section:last-child {
  margin-bottom: 0;
}

.section-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--td-text-color-primary);
  margin-bottom: 8px;
}

.description {
  font-size: 14px;
  color: var(--td-text-color-primary);
  white-space: pre-line;
  word-break: break-word;
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
