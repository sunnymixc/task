<script setup lang="ts">
import { ref, reactive, watch, onMounted } from 'vue'
import type { Task, CreateTaskRequest, UpdateTaskRequest, TaskPriority, TaskStatus } from '@/types'

interface Props {
  task?: Task | null
}

interface Emits {
  (e: 'submit', data: CreateTaskRequest | UpdateTaskRequest): void
  (e: 'cancel'): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

const formRef = ref()
const loading = ref(false)

const form = reactive({
  title: '',
  description: '',
  priority: 'medium' as TaskPriority,
  status: 'draft' as TaskStatus,
  assignee_id: '',
  due_date: ''
})

// Status workflow for the steps component
const statusSteps: { value: TaskStatus; title: string; content: string }[] = [
  { value: 'draft', title: '草稿', content: '任务已创建，尚未发布' },
  { value: 'published', title: '待执行', content: '任务待执行，等待处理' },
  { value: 'in_progress', title: '执行中', content: '任务执行中' },
  { value: 'completed', title: '已完成', content: '任务已完成' },
  { value: 'ended', title: '已结束', content: '任务已结束归档' }
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

const priorityOptions = [
  { label: '高', value: 'high' },
  { label: '中', value: 'medium' },
  { label: '低', value: 'low' }
]

// Watch for task changes (edit mode)
watch(() => props.task, (task) => {
  if (task) {
    form.title = task.title
    form.description = task.description || ''
    form.priority = task.priority
    form.status = task.status
    form.assignee_id = task.assignee_id || ''
    // Format date string for date picker
    form.due_date = task.due_date ? new Date(task.due_date) : ''
  }
}, { immediate: true })

// Reset form when dialog opens
watch(() => props.task, (task) => {
  if (!task) {
    form.title = ''
    form.description = ''
    form.priority = 'medium'
    form.status = 'draft'
    form.assignee_id = ''
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
    priority: form.priority
  }

  if (form.assignee_id) {
    data.assignee_id = form.assignee_id
  }
  if (form.due_date) {
    // Convert Date to ISO string
    const dateValue = form.due_date instanceof Date ? form.due_date.toISOString() : form.due_date
    data.due_date = dateValue
  }

  emit('submit', data)
}

const handleCancel = () => {
  emit('cancel')
}

// Expose submit so the dialog footer can trigger validation + submit
defineExpose({ submit: handleSubmit })
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

    <t-form-item label="指派给" name="assignee_id">
      <t-input
        v-model="form.assignee_id"
        placeholder="请输入用户ID"
        clearable
      />
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
