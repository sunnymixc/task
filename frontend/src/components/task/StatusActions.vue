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
const statusActions: Record<TaskStatus, { label: string; value: TaskStatus }[]> = {
  draft: [
    { label: '发布', value: 'pending' },
    { label: '开始', value: 'running' }
  ],
  pending: [
    { label: '开始', value: 'running' }
  ],
  running: [
    { label: '完成', value: 'completed' },
    { label: '暂停', value: 'pending' }
  ],
  completed: [
    { label: '重新开始', value: 'running' }
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
      size="medium"
      theme="default"
      variant="outline"
      @click="handleStatusChange(action.value)"
    >
      {{ action.label }}
    </t-button>
  </t-space>
</template>
