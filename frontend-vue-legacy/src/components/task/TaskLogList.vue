<script setup lang="ts">
import { ref, onMounted } from 'vue'
import type { TaskLog } from '@/types'
import { taskAPI } from '@/api/task'

interface Props {
  taskId: string
}

const props = defineProps<Props>()

const logs = ref<TaskLog[]>([])
const loading = ref(false)

onMounted(async () => {
  loading.value = true
  try {
    const res = await taskAPI.listLogs(props.taskId, { page: 1, page_size: 200 })
    logs.value = res.data || []
  } finally {
    loading.value = false
  }
})

// 字段名 → 中文标签(与基础表单的措辞一致)
const fieldLabels: Record<string, string> = {
  title: '标题',
  description: '描述',
  result: '结果',
  status: '任务状态',
  execution_status: '执行状态',
  execution_plan: '执行计划',
  execution_log: '执行日志',
  execution_result: '执行结果',
  priority: '优先级',
  task_list_id: '任务清单',
  due_date: '截止日期'
}

// 枚举 wire 值 → 中文(status/execution_status/priority 之外的字段原样展示)
const enumLabels: Record<string, Record<string, string>> = {
  status: { draft: '草稿', pending: '待执行', executing: '执行中', completed: '已完成' },
  execution_status: { unplanned: '未计划', planning: '计划中', planned: '已计划', working: '工作中', completed: '已完成' },
  priority: { high: '高', medium: '中', low: '低' }
}

const actionText = (log: TaskLog) => {
  switch (log.action) {
    case 'create':
      return '创建了任务'
    case 'delete':
      return '删除了任务'
    default:
      return `修改了「${fieldLabels[log.field_name] ?? log.field_name}」`
  }
}

const MAX_VALUE_LEN = 120

// 变更值展示:空值占位、枚举翻译、长文本截断(完整内容走 title 提示)
const displayValue = (log: TaskLog, value: string) => {
  if (!value) return '（空）'
  const mapped = enumLabels[log.field_name]?.[value] ?? value
  return mapped.length > MAX_VALUE_LEN ? mapped.slice(0, MAX_VALUE_LEN) + '…' : mapped
}

const fullValue = (log: TaskLog, value: string) =>
  enumLabels[log.field_name]?.[value] ?? value

const formatTime = (dateString: string) => {
  return new Date(dateString).toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  })
}
</script>

<template>
  <t-loading :loading="loading" size="small" class="task-log-list">
    <div v-if="!loading && logs.length === 0" class="log-empty">暂无日志</div>
    <t-timeline v-else mode="same" label-align="left">
      <t-timeline-item
        v-for="log in logs"
        :key="log.id"
        :label="formatTime(log.created_at)"
      >
        <div class="log-line">
          <span class="log-operator">{{ log.operator?.username || '-' }}</span>
          <span>{{ actionText(log) }}</span>
        </div>
        <div
          v-if="log.action === 'update' || log.action === 'status_change'"
          class="log-diff"
        >
          <span class="log-old" :title="fullValue(log, log.old_value)">{{ displayValue(log, log.old_value) }}</span>
          <span class="log-arrow">→</span>
          <span class="log-new" :title="fullValue(log, log.new_value)">{{ displayValue(log, log.new_value) }}</span>
        </div>
      </t-timeline-item>
    </t-timeline>
  </t-loading>
</template>

<style scoped>
.task-log-list {
  width: 100%;
  min-height: 120px;
}

.log-empty {
  padding: 48px 0;
  text-align: center;
  color: var(--td-text-color-placeholder);
}

.log-line {
  display: flex;
  gap: 6px;
  align-items: baseline;
}

.log-operator {
  font-weight: 600;
}

.log-diff {
  margin-top: 4px;
  display: flex;
  gap: 8px;
  align-items: baseline;
  flex-wrap: wrap;
  font-size: 13px;
}

.log-old {
  color: var(--td-text-color-placeholder);
  text-decoration: line-through;
  word-break: break-all;
}

.log-arrow {
  color: var(--td-text-color-placeholder);
  flex-shrink: 0;
}

.log-new {
  color: var(--td-text-color-primary);
  word-break: break-all;
}
</style>
