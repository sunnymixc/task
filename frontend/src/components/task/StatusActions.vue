<script setup lang="ts">
import { computed } from 'vue'
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
    { label: '确认', value: 'pending' },
    { label: '执行', value: 'running' }
  ],
  pending: [
    { label: '执行', value: 'running' },
    { label: '完成', value: 'completed' }
  ],
  running: [
    { label: '暂停', value: 'pending' },
    { label: '完成', value: 'completed' }
  ],
  completed: []
}

const availableActions = computed(() => statusActions[props.task.status] || [])

const handleStatusChange = (status: TaskStatus) => {
  emit('status-change', status)
}
</script>

<template>
  <t-space size="small">
    <t-link
      v-for="action in availableActions"
      :key="action.value"
      theme="primary"
      hover="color"
      @click="handleStatusChange(action.value)"
    >
      {{ action.label }}
    </t-link>
  </t-space>
</template>
