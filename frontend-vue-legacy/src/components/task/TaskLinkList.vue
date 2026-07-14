<script setup lang="ts">
import { useRouter } from 'vue-router'
import type { TaskLink } from '@/types'

defineProps<{
  links?: TaskLink[]
}>()

const router = useRouter()

// URL 链接直接打开;任务链接新窗口打开任务详情页;目标任务已删除的不可点
const openTaskLink = (link: TaskLink) => {
  if (link.link_type === 'url' && link.url) {
    window.open(link.url, '_blank', 'noopener')
  } else if (link.link_type === 'task' && link.target_task_id && link.target_task) {
    const href = router.resolve({ name: 'TaskDetail', params: { id: link.target_task_id } }).href
    window.open(href, '_blank', 'noopener')
  }
}
</script>

<template>
  <template v-if="links?.length">
    <div v-for="link in links" :key="link.id" class="task-link-item">
      <t-link
        v-if="link.link_type === 'url' || link.target_task"
        theme="primary"
        hover="color"
        @click="openTaskLink(link)"
      >
        <t-icon :name="link.link_type === 'url' ? 'link' : 'task'" size="14px" class="task-link-icon" />
        {{ link.link_type === 'url' ? link.title : link.target_task!.title }}
      </t-link>
      <span v-else class="task-link-dead">
        <t-icon name="task" size="14px" class="task-link-icon" />
        已删除的任务
      </span>
    </div>
  </template>
  <template v-else>-</template>
</template>

<style scoped>
.task-link-item {
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  line-height: 22px;
}

.task-link-icon {
  margin-right: 4px;
  vertical-align: -2px;
}

.task-link-dead {
  color: var(--td-text-color-disabled);
  font-size: 14px;
}
</style>
