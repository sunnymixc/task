<script setup lang="ts">
import { computed } from 'vue'
import type { TaskStatus } from '@/types'

interface Props {
  status: TaskStatus
}

const props = defineProps<Props>()

const statusConfig: Record<TaskStatus, { label: string; theme: 'default' | 'primary' | 'warning' | 'success' | 'error' }> = {
  draft: { label: '草稿', theme: 'default' },
  published: { label: '已发布', theme: 'primary' },
  in_progress: { label: '进行中', theme: 'warning' },
  completed: { label: '已完成', theme: 'success' },
  ended: { label: '已结束', theme: 'default' }
}

const config = computed(() => statusConfig[props.status] ?? { label: props.status, theme: 'default' as const })
</script>

<template>
  <t-tag :theme="config.theme" variant="light">{{ config.label }}</t-tag>
</template>
