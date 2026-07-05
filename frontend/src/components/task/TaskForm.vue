<script setup lang="ts">
import { ref, reactive, computed, watch, onMounted } from 'vue'
import type { Task, CreateTaskRequest, UpdateTaskRequest, TaskPriority, TaskStatus } from '@/types'
import { useTaskListStore } from '@/stores/taskList'

interface Props {
  task?: Task | null
  // 新建模式下的默认清单(如清单作用域页面传入当前清单),优先于默认清单
  defaultTaskListId?: string
}

interface Emits {
  (e: 'submit', data: CreateTaskRequest | UpdateTaskRequest): void
  (e: 'cancel'): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

const formRef = ref()
// tdesign Input 实例在运行时暴露 focus(),但当前版本未导出实例类型
const titleInputRef = ref<{ focus?: () => void } | null>(null)
const taskListStore = useTaskListStore()

const form = reactive({
  title: '',
  description: '',
  priority: 'high' as TaskPriority,
  status: 'draft' as TaskStatus,
  task_list_id: '',
  due_date: '' as string | Date
})

// 清单选项(默认清单置顶,后端已按 is_default DESC 排序)
const taskListOptions = computed(() =>
  taskListStore.allLists.map(list => ({
    label: list.is_default ? `${list.title}（默认）` : list.title,
    value: list.id
  }))
)

// 加载清单选项;新建模式下预选传入的默认清单或全局默认清单
onMounted(async () => {
  const lists = await taskListStore.fetchAllLists()
  if (!props.task && !form.task_list_id) {
    form.task_list_id = props.defaultTaskListId || lists.find(l => l.is_default)?.id || ''
  }
})

// Status workflow for the steps component
const statusSteps: { value: TaskStatus; title: string; content: string }[] = [
  { value: 'draft', title: '草稿', content: '任务已创建，尚未发布' },
  { value: 'pending', title: '待执行', content: '任务待执行，等待处理' },
  { value: 'running', title: '执行中', content: '任务执行中' },
  { value: 'completed', title: '已完成', content: '任务已完成' }
]

const formRules = {
  title: [
    { required: true, message: '请输入任务标题' },
    { min: 1, max: 255, message: '标题长度应为1-255个字符', type: 'warning' }
  ],
  description: [
    { max: 5000, message: '描述最多5000个字符', type: 'warning' }
  ]
}

// Watch for task changes (edit mode)
watch(() => props.task, (task) => {
  if (task) {
    form.title = task.title
    form.description = task.description || ''
    form.priority = task.priority
    form.status = task.status
    form.task_list_id = task.task_list_id || ''
    // Format date string for date picker
    form.due_date = task.due_date ? new Date(task.due_date) : ''
  }
}, { immediate: true })

// Reset form when dialog opens
watch(() => props.task, (task) => {
  if (!task) {
    form.title = ''
    form.description = ''
    form.priority = 'high'
    form.status = 'draft'
    form.task_list_id = props.defaultTaskListId || taskListStore.allLists.find(l => l.is_default)?.id || ''
    form.due_date = ''
  }
  formRef.value?.reset()
}, { immediate: false })

const handleSubmit = async () => {
  const valid = await formRef.value?.validate()
  if (valid !== true) return

  const data: CreateTaskRequest | UpdateTaskRequest = {
    title: form.title,
    description: form.description || undefined,
    status: form.status,
    priority: form.priority,
    task_list_id: form.task_list_id || undefined
  }

  if (form.due_date) {
    // Convert Date to ISO string
    const dateValue = form.due_date instanceof Date ? form.due_date.toISOString() : form.due_date
    data.due_date = dateValue
  }

  emit('submit', data)
}

// 弹窗打开后由父组件调用,聚焦标题输入框
const focusTitle = () => titleInputRef.value?.focus?.()

// Expose submit so the dialog footer can trigger validation + submit
defineExpose({ submit: handleSubmit, focusTitle })
</script>

<template>
  <t-form
    ref="formRef"
    :data="form"
    :rules="formRules"
    label-width="80px"
    @submit="handleSubmit"
  >
    <t-form-item label="标题" name="title">
      <t-input
        ref="titleInputRef"
        v-model="form.title"
        placeholder="请输入任务标题"
        :maxlength="255"
        show-limit-number
      />
    </t-form-item>

    <t-form-item label="描述" name="description">
      <t-textarea
        v-model="form.description"
        placeholder="请输入任务描述"
        :maxlength="5000"
        :autosize="{ minRows: 4, maxRows: 14 }"
        show-limit-number
      />
    </t-form-item>

    <t-form-item label="任务清单" name="task_list_id">
      <t-select
        v-model="form.task_list_id"
        :options="taskListOptions"
        placeholder="请选择任务清单"
      />
    </t-form-item>

    <t-form-item label="优先级" name="priority">
      <t-radio-group v-model="form.priority">
        <t-radio value="high">高</t-radio>
        <t-radio value="medium">中</t-radio>
        <t-radio value="low">低</t-radio>
      </t-radio-group>
    </t-form-item>

    <t-form-item label="状态" name="status">
      <t-radio-group v-model="form.status">
        <t-radio
          v-for="step in statusSteps"
          :key="step.value"
          :value="step.value"
        >
          {{ step.title }}
        </t-radio>
      </t-radio-group>
    </t-form-item>

    <t-form-item label="截止日期" name="due_date">
      <t-date-picker
        v-model="form.due_date"
        placeholder="请选择截止日期"
        clearable
        style="width: 100%"
      />
    </t-form-item>

  </t-form>
</template>

<style scoped>
.t-form-item {
  margin-bottom: 24px;
}
</style>
