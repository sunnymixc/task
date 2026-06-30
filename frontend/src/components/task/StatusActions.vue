<script setup lang="ts">
import type { Task, TaskStatus } from '@/types'

interface Props {
  task: Task
}

interface Emits {
  (e: 'status-change', status: TaskStatus): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

// Define available status transitions based on current status
const statusActions: Record<TaskStatus, { label: string; value: TaskStatus; theme: 'default' | 'primary' | 'warning' | 'success' }[]> = {
  draft: [
    { label: '发布', value: 'published', theme: 'primary' },
    { label: '开始', value: 'in_progress', theme: 'success' }
  ],
  published: [
    { label: '开始', value: 'in_progress', theme: 'success' },
    { label: '结束', value: 'ended', theme: 'default' }
  ],
  in_progress: [
    { label: '完成', value: 'completed', theme: 'success' },
    { label: '暂停', value: 'published', theme: 'warning' }
  ],
  completed: [
    { label: '重新开始', value: 'in_progress', theme: 'primary' },
    { label: '结束', value: 'ended', theme: 'default' }
  ],
  ended: [
    { label: '重新打开', value: 'published', theme: 'primary' }
  ]
}

const availableActions = statusActions[props.task.status] || []

const handleStatusChange = (status: TaskStatus) => {
  emit('status-change', status)
}
</script>

<template>
  <t-space size="small">
    <t-button
      v-for="action in availableActions"
      :key="action.value"
      size="small"
      :theme="action.theme"
      variant="outline"
      @click="handleStatusChange(action.value)"
    >
      {{ action.label }}
    </t-button>
  </t-space>
</template>
