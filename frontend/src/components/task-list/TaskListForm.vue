<script setup lang="ts">
import { ref, reactive, watch } from 'vue'
import type { TaskList, CreateTaskListRequest, UpdateTaskListRequest } from '@/types'
import type { FormRules } from 'tdesign-vue-next'

interface Props {
  list?: TaskList | null
}

interface Emits {
  (e: 'submit', data: CreateTaskListRequest | UpdateTaskListRequest): void
  (e: 'cancel'): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

const formRef = ref()

const form = reactive({
  title: '',
  description: '',
  sort_order: undefined as number | undefined
})

const formRules: FormRules = {
  title: [
    { required: true, message: '请输入清单标题' },
    { min: 1, max: 255, message: '标题长度应为1-255个字符', type: 'warning' }
  ],
  description: [
    { max: 5000, message: '描述最多5000个字符', type: 'warning' }
  ],
  sort_order: [
    {
      validator: (val: unknown) =>
        val === undefined || val === null ||
        (Number.isInteger(val) && (val as number) >= 1 && (val as number) <= 1000),
      message: '序号应为1-1000的整数'
    }
  ]
}

// Populate in edit mode, reset in create mode
watch(() => props.list, (list) => {
  if (list) {
    form.title = list.title
    form.description = list.description || ''
    form.sort_order = list.sort_order
  } else {
    form.title = ''
    form.description = ''
    form.sort_order = undefined
  }
  formRef.value?.reset()
}, { immediate: true })

const handleSubmit = async () => {
  const valid = await formRef.value?.validate()
  if (valid !== true) return

  emit('submit', {
    title: form.title,
    description: form.description || undefined,
    sort_order: form.sort_order ?? undefined
  })
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
        placeholder="请输入清单标题"
        :maxlength="255"
        show-limit-number
      />
    </t-form-item>

    <t-form-item label="序号" name="sort_order">
      <t-input-number
        v-model="form.sort_order"
        theme="normal"
        :min="1"
        :max="1000"
        :allow-input-over-limit="false"
        placeholder="留空自动排在最后"
        style="width: 100%"
      />
    </t-form-item>

    <t-form-item label="描述" name="description">
      <t-textarea
        v-model="form.description"
        placeholder="请输入清单描述"
        :maxlength="5000"
        :autosize="{ minRows: 4, maxRows: 14 }"
        show-limit-number
      />
    </t-form-item>
  </t-form>
</template>

<style scoped>
.t-form-item {
  margin-bottom: 24px;
}
</style>
