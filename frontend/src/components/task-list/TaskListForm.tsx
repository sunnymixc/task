import { useImperativeHandle, useRef, type Ref } from 'react'
import { Form } from '@douyinfe/semi-ui-19'
import type { FormApi } from '@douyinfe/semi-ui-19/lib/es/form'
import type { TaskList, CreateTaskListRequest, UpdateTaskListRequest } from '@/types'

export interface TaskListFormHandle {
  submit: () => void
}

interface Props {
  list?: TaskList | null
  onSubmit: (data: CreateTaskListRequest | UpdateTaskListRequest) => void
  // 父级弹窗底部按钮经此句柄触发校验+提交；编辑/新建切换时父级用 key 重挂载本组件
  ref?: Ref<TaskListFormHandle>
}

export default function TaskListForm({ list, onSubmit, ref }: Props) {
  const formApiRef = useRef<FormApi | null>(null)

  const initValues = {
    title: list?.title ?? '',
    description: list?.description ?? '',
    project_path: list?.project_path ?? '',
    sort_order: list?.sort_order ?? undefined
  }

  const handleSubmit = async () => {
    const api = formApiRef.current
    if (!api) return
    try {
      await api.validate()
    } catch {
      return
    }
    const values = api.getValues()
    onSubmit({
      title: values.title,
      description: values.description || undefined,
      // 始终带上该键(空串而非 undefined),使清空路径也能提交生效
      project_path: (values.project_path ?? '').trim(),
      sort_order: values.sort_order ?? undefined
    })
  }

  useImperativeHandle(ref, () => ({ submit: handleSubmit }))

  return (
    <Form
      getFormApi={(api) => (formApiRef.current = api)}
      initValues={initValues}
      labelPosition="left"
      labelWidth={80}
      onSubmit={handleSubmit}
    >
      <Form.Input
        field="title"
        label="标题"
        placeholder="请输入清单标题"
        maxLength={255}
        rules={[
          { required: true, message: '请输入清单标题' },
          { min: 1, max: 255, message: '标题长度应为1-255个字符' }
        ]}
      />

      <Form.InputNumber
        field="sort_order"
        label="序号"
        min={1}
        max={10000000}
        placeholder="留空自动排在最后"
        style={{ width: '100%' }}
        rules={[
          {
            validator: (_rule: unknown, val: unknown) =>
              val === undefined || val === null || val === '' ||
              (Number.isInteger(val) && (val as number) >= 1 && (val as number) <= 10000000),
            message: '序号应为1-10000000的整数'
          }
        ]}
      />

      <Form.Input
        field="project_path"
        label="项目路径"
        placeholder="/path/to/project(留空则终端进入主目录 ~)"
        maxLength={1024}
        rules={[{ max: 1024, message: '项目路径最多1024个字符' }]}
      />

      <Form.TextArea
        field="description"
        label="描述"
        placeholder="请输入清单描述"
        maxCount={5000}
        autosize={{ minRows: 4, maxRows: 14 }}
        rules={[{ max: 5000, message: '描述最多5000个字符' }]}
      />
    </Form>
  )
}
