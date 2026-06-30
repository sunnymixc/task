<script setup lang="ts">
import type { TaskPriority } from '@/types'

interface Props {
  priority: TaskPriority
}

const props = defineProps<Props>()

const priorityConfig: Record<TaskPriority, { label: string; theme: 'default' | 'primary' | 'warning' | 'success' | 'error' }> = {
  high: { label: '高', theme: 'error' },
  medium: { label: '中', theme: 'warning' },
  low: { label: '低', theme: 'success' }
}

const config = priorityConfig[props.priority]
</script>

<template>
  <t-tag :theme="config.theme" variant="light">{{ config.label }}</t-tag>
</template>
