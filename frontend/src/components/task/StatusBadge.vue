<script setup lang="ts">
import { computed } from 'vue'
import type { TaskStatus } from '@/types'

interface Props {
  status: TaskStatus
}

const props = defineProps<Props>()

const statusConfig: Record<TaskStatus, { label: string; theme: 'default' | 'primary' | 'warning' | 'success' | 'danger' }> = {
  draft: { label: '草稿', theme: 'default' },
  pending: { label: '待执行', theme: 'warning' },
  executing: { label: '执行中', theme: 'primary' },
  completed: { label: '已完成', theme: 'success' }
}

const config = computed(() => statusConfig[props.status] ?? { label: props.status, theme: 'default' as const })
</script>

<template>
  <t-tag :theme="config.theme" variant="light">{{ config.label }}</t-tag>
</template>
