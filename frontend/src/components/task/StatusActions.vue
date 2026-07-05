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
    { label: '发布', value: 'published' },
    { label: '开始', value: 'in_progress' }
  ],
  published: [
    { label: '开始', value: 'in_progress' }
  ],
  in_progress: [
    { label: '完成', value: 'completed' },
    { label: '暂停', value: 'published' }
  ],
  completed: [
    { label: '重新开始', value: 'in_progress' }
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
