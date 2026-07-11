<script setup lang="ts">
import { computed } from 'vue'
import type { TaskExecutionStatus } from '@/types'

interface Props {
  status: TaskExecutionStatus
}

const props = defineProps<Props>()

const statusConfig: Record<TaskExecutionStatus, { label: string; theme: 'default' | 'primary' | 'warning' | 'success' | 'danger' }> = {
  unplanned: { label: '未计划', theme: 'default' },
  planning: { label: '计划中', theme: 'warning' },
  planned: { label: '已计划', theme: 'primary' },
  working: { label: '工作中', theme: 'primary' },
  completed: { label: '已完成', theme: 'success' }
}

const config = computed(() => statusConfig[props.status] ?? { label: props.status, theme: 'default' as const })
</script>

<template>
  <t-tag :theme="config.theme" variant="light">{{ config.label }}</t-tag>
</template>
