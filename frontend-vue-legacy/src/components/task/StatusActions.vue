<script lang="ts">
import type { TaskStatus } from '@/types'

// Define available status transitions based on current status
const statusActions: Record<TaskStatus, { label: string; value: TaskStatus }[]> = {
  draft: [
    { label: '确认', value: 'pending' },
    { label: '执行', value: 'executing' }
  ],
  pending: [
    { label: '执行', value: 'executing' },
    { label: '完成', value: 'completed' }
  ],
  executing: [
    { label: '完成', value: 'completed' },
    { label: '暂停', value: 'pending' }
  ],
  completed: []
}

// t-space 会为每个子节点包一层 item（即使组件渲染为空），
// 无操作的状态需在父级用 v-if 跳过渲染，否则产生多余间距
export function hasStatusActions(status: TaskStatus): boolean {
  return (statusActions[status] || []).length > 0
}
</script>

<script setup lang="ts">
import { computed } from 'vue'
import type { Task } from '@/types'

interface Props {
  task: Task
}

interface Emits {
  (e: 'status-change', status: TaskStatus): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

const availableActions = computed(() => statusActions[props.task.status] || [])

const handleStatusChange = (status: TaskStatus) => {
  emit('status-change', status)
}
</script>

<template>
  <t-space v-if="availableActions.length" size="small">
    <t-button
      v-for="action in availableActions"
      :key="action.value"
      theme="default"
      size="small"
      @click="handleStatusChange(action.value)"
    >
      {{ action.label }}
    </t-button>
  </t-space>
</template>
