<script setup lang="ts">
import { ref, reactive, computed, watch, onMounted } from 'vue'
import type { Task, CreateTaskRequest, UpdateTaskRequest, TaskPriority, TaskStatus, TaskExecutionStatus, TaskLinkType, TaskLinkInput } from '@/types'
import type { FormRules } from 'tdesign-vue-next'
import { MessagePlugin } from 'tdesign-vue-next'
import { useTaskListStore } from '@/stores/taskList'
import { taskAPI } from '@/api/task'

interface Props {
  task?: Task | null
  // 新建模式下的默认清单(如清单作用域页面传入当前清单),优先于默认清单
  defaultTaskListId?: string
}

interface Emits {
  // keepOpen: 仅保存入库,父组件不关闭弹窗
  (e: 'submit', data: CreateTaskRequest | UpdateTaskRequest, keepOpen?: boolean): void
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
  result: '',
  priority: 'high' as TaskPriority,
  sort_order: undefined as number | undefined,
  status: 'draft' as TaskStatus,
  execution_status: 'unplanned' as TaskExecutionStatus,
  execution_plan: '',
  execution_log: '',
  execution_result: '',
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

// 链接行(独立于 form,不进 t-form rules)
interface LinkRow {
  link_type: TaskLinkType
  title: string
  url: string
  target_task_id: string
  // 行级远程搜索选项与加载态
  targetOptions: { label: string; value: string }[]
  searching: boolean
}

const links = ref<LinkRow[]>([])

const addLink = () => {
  links.value.push({ link_type: 'url', title: '', url: '', target_task_id: '', targetOptions: [], searching: false })
}

const removeLink = (index: number) => {
  links.value.splice(index, 1)
}

// 任务链接远程搜索(防抖 300ms),排除当前编辑的任务自身
let linkSearchTimer: ReturnType<typeof setTimeout> | null = null
const onTaskSearch = (row: LinkRow, keyword: string) => {
  if (linkSearchTimer) clearTimeout(linkSearchTimer)
  if (!keyword.trim()) return
  linkSearchTimer = setTimeout(async () => {
    row.searching = true
    try {
      const res = await taskAPI.search({ q: keyword.trim(), page_size: 20 })
      row.targetOptions = (res.data || [])
        .filter(t => t.id !== props.task?.id)
        .map(t => ({ label: t.title, value: t.id }))
    } finally {
      row.searching = false
    }
  }, 300)
}

// 编辑模式回填链接行;丢弃目标任务已被删除的行(原样提交会被后端拒绝)
const fillLinks = (task: Task) => {
  links.value = (task.links ?? [])
    .filter(l => l.link_type === 'url' || l.target_task)
    .map(l => ({
      link_type: l.link_type,
      title: l.title || '',
      url: l.url || '',
      target_task_id: l.target_task_id || '',
      // 用已知目标任务标题播种选项,否则 select 显示裸 id
      targetOptions: l.target_task ? [{ label: l.target_task.title, value: l.target_task_id! }] : [],
      searching: false
    }))
}

// Status workflow for the steps component
const statusSteps: { value: TaskStatus; title: string; content: string }[] = [
  { value: 'draft', title: '草稿', content: '任务已创建，尚未发布' },
  { value: 'pending', title: '待执行', content: '任务待执行，等待处理' },
  { value: 'executing', title: '执行中', content: '任务执行中' },
  { value: 'completed', title: '已完成', content: '任务已完成' }
]

// 执行状态选项(任务执行过程的细化管理)
const executionStatusOptions: { value: TaskExecutionStatus; label: string }[] = [
  { value: 'unplanned', label: '未计划' },
  { value: 'planning', label: '计划中' },
  { value: 'planned', label: '已计划' },
  { value: 'working', label: '工作中' },
  { value: 'completed', label: '已完成' }
]

const formRules: FormRules = {
  title: [
    { required: true, message: '请输入任务标题' },
    { min: 1, max: 255, message: '标题长度应为1-255个字符', type: 'warning' }
  ],
  description: [
    { max: 5000, message: '描述最多5000个字符', type: 'warning' }
  ],
  sort_order: [
    {
      validator: (val: unknown) =>
        val === undefined || val === null ||
        (Number.isInteger(val) && (val as number) >= 1 && (val as number) <= 100000000),
      message: '序号应为1-100000000的整数'
    }
  ]
}

// Watch for task changes (edit mode)
watch(() => props.task, (task) => {
  if (task) {
    form.title = task.title
    form.description = task.description || ''
    form.result = task.result || ''
    form.priority = task.priority
    // 0 表示未设置,回填为空
    form.sort_order = task.sort_order > 0 ? task.sort_order : undefined
    form.status = task.status
    form.execution_status = task.execution_status || 'unplanned'
    form.execution_plan = task.execution_plan || ''
    form.execution_log = task.execution_log || ''
    form.execution_result = task.execution_result || ''
    form.task_list_id = task.task_list_id || ''
    // Format date string for date picker
    form.due_date = task.due_date ? new Date(task.due_date) : ''
    fillLinks(task)
  }
}, { immediate: true })

// Reset form when dialog opens
watch(() => props.task, (task) => {
  if (!task) {
    form.title = ''
    form.description = ''
    form.result = ''
    form.priority = 'high'
    form.sort_order = undefined
    form.status = 'draft'
    form.execution_status = 'unplanned'
    form.execution_plan = ''
    form.execution_log = ''
    form.execution_result = ''
    form.task_list_id = props.defaultTaskListId || taskListStore.allLists.find(l => l.is_default)?.id || ''
    form.due_date = ''
    links.value = []
  }
  formRef.value?.reset()
}, { immediate: false })

const handleSubmit = async (keepOpen = false) => {
  const valid = await formRef.value?.validate()
  if (valid !== true) return

  // 校验并组装链接:跳过完全空行,非法行阻断提交
  const linkInputs: TaskLinkInput[] = []
  for (let i = 0; i < links.value.length; i++) {
    const row = links.value[i]
    if (row.link_type === 'url') {
      const title = row.title.trim()
      const url = row.url.trim()
      if (!title && !url) continue
      if (!title || !/^https?:\/\//.test(url)) {
        MessagePlugin.error(`链接 ${i + 1} 格式不正确：标题不能为空，URL 需以 http:// 或 https:// 开头`)
        return
      }
      linkInputs.push({ link_type: 'url', title, url })
    } else {
      if (!row.target_task_id) continue
      linkInputs.push({ link_type: 'task', target_task_id: row.target_task_id })
    }
  }

  const data: CreateTaskRequest | UpdateTaskRequest = {
    title: form.title,
    // 描述/结果/执行相关字段无条件携带:编辑时空串可正确清空
    description: form.description,
    result: form.result,
    status: form.status,
    execution_status: form.execution_status,
    execution_plan: form.execution_plan,
    execution_log: form.execution_log,
    execution_result: form.execution_result,
    priority: form.priority,
    // 无条件携带:编辑时清空输入框提交 0 = 清除序号恢复默认(排最前)
    sort_order: form.sort_order ?? 0,
    task_list_id: form.task_list_id || undefined,
    // 编辑模式无条件携带:空数组即清空(后端 nil=不动/[]=清空 语义)
    links: linkInputs
  }

  if (form.due_date) {
    // Convert Date to ISO string
    const dateValue = form.due_date instanceof Date ? form.due_date.toISOString() : form.due_date
    data.due_date = dateValue
  }

  emit('submit', data, keepOpen)
}

// 弹窗打开后由父组件调用,聚焦标题输入框
const focusTitle = () => titleInputRef.value?.focus?.()

// 弹窗底部"拷贝"用:取表单当前标题+描述,格式与列表操作列的拷贝一致
const getCopyText = () =>
  form.description ? `${form.title}\n\n${form.description}` : form.title

// Expose submit/save so the dialog footer can trigger validation + submit
// save: 仅保存入库,不关闭弹窗
defineExpose({ submit: () => handleSubmit(false), save: () => handleSubmit(true), focusTitle, getCopyText })
</script>

<template>
  <t-form
    ref="formRef"
    :data="form"
    :rules="formRules"
    label-width="80px"
    @submit="() => handleSubmit()"
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
        :autosize="{ minRows: 2, maxRows: 14 }"
        show-limit-number
      />
    </t-form-item>

    <t-form-item label="结果" name="result">
      <t-textarea
        v-model="form.result"
        placeholder="请输入任务结果"
        :autosize="{ minRows: 2, maxRows: 14 }"
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

    <t-form-item label="序号" name="sort_order">
      <t-input-number
        v-model="form.sort_order"
        theme="normal"
        :min="1"
        :max="100000000"
        :allow-input-over-limit="false"
        placeholder="留空默认排在最前"
        style="width: 100%"
      />
    </t-form-item>

    <t-form-item label="任务状态" name="status">
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

    <t-form-item label="执行状态" name="execution_status">
      <t-radio-group v-model="form.execution_status">
        <t-radio
          v-for="option in executionStatusOptions"
          :key="option.value"
          :value="option.value"
        >
          {{ option.label }}
        </t-radio>
      </t-radio-group>
    </t-form-item>

    <t-form-item label="执行计划" name="execution_plan">
      <t-textarea
        v-model="form.execution_plan"
        placeholder="请输入执行计划"
        :autosize="{ minRows: 2, maxRows: 14 }"
      />
    </t-form-item>

    <t-form-item label="执行日志" name="execution_log">
      <t-textarea
        v-model="form.execution_log"
        placeholder="请输入执行日志"
        :autosize="{ minRows: 2, maxRows: 14 }"
      />
    </t-form-item>

    <t-form-item label="执行结果" name="execution_result">
      <t-textarea
        v-model="form.execution_result"
        placeholder="请输入执行结果"
        :autosize="{ minRows: 2, maxRows: 14 }"
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

    <t-form-item label="链接">
      <div class="link-rows">
        <div v-for="(row, i) in links" :key="i" class="link-row">
          <t-select
            v-model="row.link_type"
            :options="[
              { label: 'URL', value: 'url' },
              { label: '任务', value: 'task' }
            ]"
            class="link-type-select"
          />
          <template v-if="row.link_type === 'url'">
            <t-input v-model="row.title" placeholder="链接标题" class="link-title-input" />
            <t-input v-model="row.url" placeholder="https://..." class="link-flex" />
          </template>
          <t-select
            v-else
            v-model="row.target_task_id"
            :options="row.targetOptions"
            filterable
            :loading="row.searching"
            :filter="() => true"
            placeholder="输入关键词搜索任务"
            class="link-flex"
            @search="(kw: string) => onTaskSearch(row, kw)"
          />
          <t-button theme="danger" variant="text" shape="square" @click="removeLink(i)">
            <t-icon name="delete" />
          </t-button>
        </div>
        <t-button theme="default" variant="dashed" @click="addLink">
          <template #icon><t-icon name="add" /></template>
          添加链接
        </t-button>
      </div>
    </t-form-item>

  </t-form>
</template>

<style scoped>
.t-form-item {
  margin-bottom: 24px;
}

.link-rows {
  display: flex;
  flex-direction: column;
  gap: 8px;
  width: 100%;
}

.link-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.link-type-select {
  width: 110px;
  flex-shrink: 0;
}

.link-title-input {
  width: 180px;
  flex-shrink: 0;
}

.link-flex {
  flex: 1;
  min-width: 0;
}
</style>
