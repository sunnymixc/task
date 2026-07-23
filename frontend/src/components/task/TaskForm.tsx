import { useEffect, useImperativeHandle, useRef, useState, type Ref } from 'react'
import { Button, Form, Input, Modal, Radio, Select, Tabs, TabPane, Toast } from '@douyinfe/semi-ui-19'
import type { FormApi } from '@douyinfe/semi-ui-19/lib/es/form'
import { IconDelete, IconPlus } from '@douyinfe/semi-icons'
import type {
  Task,
  CreateTaskRequest,
  UpdateTaskRequest,
  TaskStatus,
  TaskExecutionStatus,
  TaskLinkType,
  TaskLinkInput
} from '@/types'
import { useTaskListStore } from '@/stores/taskList'
import { useAuthStore } from '@/stores/auth'
import { taskAPI } from '@/api/task'
import { useDebouncedCallback } from '@/hooks/useDebouncedCallback'
import TaskLogList from './TaskLogList'
import TaskTerminal, { type TaskTerminalHandle } from './TaskTerminal'
import { hasSession } from '@/terminal/sessionRegistry'
import styles from './TaskForm.module.css'

export interface TaskFormHandle {
  // submit: 提交并由父组件关闭弹窗；save: 仅保存入库,不关闭弹窗
  submit: () => void
  save: () => void
  // 弹窗打开后由父组件调用,聚焦标题输入框
  focusTitle: () => void
  // 弹窗底部"拷贝"用:取表单当前标题+描述,格式与列表操作列的拷贝一致
  getCopyText: () => string
}

interface Props {
  task?: Task | null
  // 新建模式下的默认清单(如清单作用域页面传入当前清单),优先于默认清单
  defaultTaskListId?: string
  // keepOpen: 仅保存入库,父组件不关闭弹窗
  onSubmit: (data: CreateTaskRequest | UpdateTaskRequest, keepOpen?: boolean) => void
  // 父级弹窗底部按钮经此句柄驱动；编辑/新建切换时父级用 key 重挂载本组件
  ref?: Ref<TaskFormHandle>
}

// 链接行(独立于 form,不进 Form rules)
interface LinkRow {
  link_type: TaskLinkType
  title: string
  url: string
  target_task_id: string
  // 行级远程搜索选项与加载态
  targetOptions: { label: string; value: string }[]
  searching: boolean
}

// Status workflow options
const statusSteps: { value: TaskStatus; title: string }[] = [
  { value: 'draft', title: '草稿' },
  { value: 'pending', title: '待执行' },
  { value: 'executing', title: '执行中' },
  { value: 'completed', title: '已完成' }
]

// 执行状态选项(任务执行过程的细化管理)
const executionStatusOptions: { value: TaskExecutionStatus; label: string }[] = [
  { value: 'unplanned', label: '未计划' },
  { value: 'planning', label: '计划中' },
  { value: 'planned', label: '已计划' },
  { value: 'working', label: '工作中' },
  { value: 'completed', label: '已完成' }
]

// 任务 id → 上次停留的 tab,跨组件重挂载保留(仅本次会话内存)
const lastActiveTab = new Map<string, string>()

// 编辑模式回填链接行;丢弃目标任务已被删除的行(原样提交会被后端拒绝)
const linksFromTask = (task?: Task | null): LinkRow[] =>
  (task?.links ?? [])
    .filter((l) => l.link_type === 'url' || l.target_task)
    .map((l) => ({
      link_type: l.link_type,
      title: l.title || '',
      url: l.url || '',
      target_task_id: l.target_task_id || '',
      // 用已知目标任务标题播种选项,否则 select 显示裸 id
      targetOptions: l.target_task ? [{ label: l.target_task.title, value: l.target_task_id! }] : [],
      searching: false
    }))

export default function TaskForm({ task, defaultTaskListId, onSubmit, ref }: Props) {
  const formApiRef = useRef<FormApi | null>(null)
  const containerRef = useRef<HTMLDivElement | null>(null)
  // 基础 / 详情 / AI终端 / 日志 tab。
  // 本组件会被外部操作(工作台保存后换 key、弹窗关闭重开)强制重挂载,
  // 用模块级记忆恢复 tab 位置,使终端会话常驻的同时视觉上也"没被打断"
  const [activeTab, setActiveTab] = useState(() => (task?.id && lastActiveTab.get(task.id)) || 'basic')
  const allLists = useTaskListStore((s) => s.allLists)

  // AI 终端为 root shell,仅管理员可见/可用(真正的访问控制在后端 RequireAdmin)
  const isAdmin = useAuthStore((s) => s.user?.is_admin === true)
  // useModal 渲染在组件树内,避免静态 Modal.confirm 在 React 19 下同步卸载 root 的告警
  const [modal, modalContextHolder] = Modal.useModal()
  const terminalRef = useRef<TaskTerminalHandle>(null)
  // 首次激活终端 tab 才建连;已有常驻会话时(本组件被重挂载)立即恢复显示
  const [terminalMounted, setTerminalMounted] = useState(() => !!task?.id && hasSession(task.id))

  const [links, setLinks] = useState<LinkRow[]>(() => linksFromTask(task))

  const initValues = {
    title: task?.title ?? '',
    description: task?.description ?? '',
    result: task?.result ?? '',
    priority: task?.priority ?? 'high',
    // 0 表示未设置,回填为空
    sort_order: task && task.sort_order > 0 ? task.sort_order : undefined,
    status: task?.status ?? 'draft',
    execution_status: task?.execution_status || 'unplanned',
    execution_plan: task?.execution_plan ?? '',
    execution_log: task?.execution_log ?? '',
    execution_result: task?.execution_result ?? '',
    task_list_id: task?.task_list_id || '',
    due_date: task?.due_date ? new Date(task.due_date) : undefined
  }

  // 清单选项(默认清单置顶,后端已按 is_default DESC 排序)
  const taskListOptions = allLists.map((list) => ({
    label: list.is_default ? `${list.title}（默认）` : list.title,
    value: list.id
  }))

  // 弹窗打开(本组件挂载)后聚焦标题输入框;等一帧避开 Modal 自身的焦点管理
  useEffect(() => {
    const timer = setTimeout(() => {
      containerRef.current?.querySelector('input')?.focus()
    }, 100)
    return () => clearTimeout(timer)
  }, [])

  // 加载清单选项;新建模式下预选传入的默认清单或全局默认清单
  useEffect(() => {
    useTaskListStore
      .getState()
      .fetchAllLists()
      .then((lists) => {
        const api = formApiRef.current
        if (!task && api && !api.getValue('task_list_id')) {
          api.setValue('task_list_id', defaultTaskListId || lists.find((l) => l.is_default)?.id || '')
        }
      })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const patchLink = (index: number, patch: Partial<LinkRow>) => {
    setLinks((prev) => prev.map((row, i) => (i === index ? { ...row, ...patch } : row)))
  }

  const addLink = () => {
    setLinks((prev) => [
      ...prev,
      { link_type: 'url', title: '', url: '', target_task_id: '', targetOptions: [], searching: false }
    ])
  }

  const removeLink = (index: number) => {
    setLinks((prev) => prev.filter((_, i) => i !== index))
  }

  // 任务链接远程搜索(防抖 300ms),排除当前编辑的任务自身
  const searchTask = useDebouncedCallback(async (index: number, keyword: string) => {
    patchLink(index, { searching: true })
    try {
      const res = await taskAPI.search({ q: keyword.trim(), page_size: 20 })
      patchLink(index, {
        targetOptions: (res.data || [])
          .filter((t) => t.id !== task?.id)
          .map((t) => ({ label: t.title, value: t.id }))
      })
    } finally {
      patchLink(index, { searching: false })
    }
  }, 300)

  const onTaskSearch = (index: number, keyword: string) => {
    if (!keyword.trim()) return
    searchTask(index, keyword)
  }

  const handleSubmit = async (keepOpen = false) => {
    const api = formApiRef.current
    if (!api) return
    try {
      await api.validate()
    } catch {
      return
    }
    const values = api.getValues()

    // 校验并组装链接:跳过完全空行,非法行阻断提交
    const linkInputs: TaskLinkInput[] = []
    for (let i = 0; i < links.length; i++) {
      const row = links[i]
      if (row.link_type === 'url') {
        const title = row.title.trim()
        const url = row.url.trim()
        if (!title && !url) continue
        if (!title || !/^https?:\/\//.test(url)) {
          Toast.error(`链接 ${i + 1} 格式不正确：标题不能为空，URL 需以 http:// 或 https:// 开头`)
          return
        }
        linkInputs.push({ link_type: 'url', title, url })
      } else {
        if (!row.target_task_id) continue
        linkInputs.push({ link_type: 'task', target_task_id: row.target_task_id })
      }
    }

    const data: CreateTaskRequest | UpdateTaskRequest = {
      title: values.title,
      // 描述/结果/执行相关字段无条件携带:编辑时空串可正确清空
      description: values.description,
      result: values.result,
      status: values.status,
      execution_status: values.execution_status,
      execution_plan: values.execution_plan,
      execution_log: values.execution_log,
      execution_result: values.execution_result,
      priority: values.priority,
      // 无条件携带:编辑时清空输入框提交 0 = 清除序号恢复默认(排最前)
      sort_order: values.sort_order ?? 0,
      task_list_id: values.task_list_id || undefined,
      // 编辑模式无条件携带:空数组即清空(后端 nil=不动/[]=清空 语义)
      links: linkInputs
    }

    if (values.due_date) {
      // Convert Date to ISO string
      data.due_date = values.due_date instanceof Date ? values.due_date.toISOString() : values.due_date
    }

    onSubmit(data, keepOpen)
  }

  const handleTabChange = (key: string) => {
    setActiveTab(key)
    if (task?.id) lastActiveTab.set(task.id, key)
    if (key === 'terminal') setTerminalMounted(true)
  }

  // 终止:二次确认后通知后端结束终端会话(连接断开后面板显示"已断开",历史保留可重连)
  const confirmTerminate = () => {
    modal.confirm({
      title: '确认终止',
      content: '终止后将结束当前终端会话并关闭连接,确定继续吗?',
      okText: '终止',
      okButtonProps: { type: 'danger' },
      cancelText: '取消',
      onOk: () => terminalRef.current?.terminate()
    })
  }

  useImperativeHandle(ref, () => ({
    submit: () => handleSubmit(false),
    save: () => handleSubmit(true),
    focusTitle: () => {
      containerRef.current?.querySelector('input')?.focus()
    },
    getCopyText: () => {
      const values = formApiRef.current?.getValues() || {}
      return values.description ? `${values.title}\n\n${values.description}` : values.title || ''
    }
  }))

  return (
    <div ref={containerRef}>
      {modalContextHolder}
      {/* Form 包裹整个 Tabs:基础/详情两个 tab 的字段共用同一表单与 formApi */}
      <Form
        getFormApi={(api) => (formApiRef.current = api)}
        initValues={initValues}
        labelPosition="left"
        labelWidth={80}
        onSubmit={() => handleSubmit()}
      >
        <Tabs tabPosition="left" activeKey={activeTab} onChange={handleTabChange}>
          {/* Semi Tabs 默认 keepDOM:切 tab 不销毁表单,未保存输入与命令式句柄均保持有效 */}
          <TabPane tab="基础" itemKey="basic">
            <div className={styles.tabBody}>
              <Form.Input
                field="title"
                label="标题"
                placeholder="请输入任务标题"
                maxLength={255}
                rules={[
                  { required: true, message: '请输入任务标题' },
                  { min: 1, max: 255, message: '标题长度应为1-255个字符' }
                ]}
              />

              <Form.TextArea
                field="description"
                label="描述"
                placeholder="请输入任务描述"
                maxCount={5000}
                autosize={{ minRows: 2 }}
                rules={[{ max: 5000, message: '描述最多5000个字符' }]}
              />

              <Form.Select
                field="task_list_id"
                label="任务清单"
                placeholder="请选择任务清单"
                optionList={taskListOptions}
                style={{ width: '100%' }}
              />

              <Form.RadioGroup field="priority" label="优先级">
                <Radio value="high">高</Radio>
                <Radio value="medium">中</Radio>
                <Radio value="low">低</Radio>
              </Form.RadioGroup>

              <Form.RadioGroup field="status" label="任务状态">
                {statusSteps.map((step) => (
                  <Radio key={step.value} value={step.value}>
                    {step.title}
                  </Radio>
                ))}
              </Form.RadioGroup>

              <Form.RadioGroup field="execution_status" label="执行状态">
                {executionStatusOptions.map((option) => (
                  <Radio key={option.value} value={option.value}>
                    {option.label}
                  </Radio>
                ))}
              </Form.RadioGroup>

              <Form.Slot label="链接">
                <div className={styles.linkRows}>
                  {links.map((row, i) => (
                    <div key={i} className={styles.linkRow}>
                      <Select
                        value={row.link_type}
                        optionList={[
                          { label: 'URL', value: 'url' },
                          { label: '任务', value: 'task' }
                        ]}
                        className={styles.linkTypeSelect}
                        onChange={(v) => patchLink(i, { link_type: v as TaskLinkType })}
                      />
                      {row.link_type === 'url' ? (
                        <>
                          <Input
                            className={styles.linkTitleInput}
                            placeholder="链接标题"
                            value={row.title}
                            onChange={(v) => patchLink(i, { title: v })}
                          />
                          <Input
                            className={styles.linkFlex}
                            placeholder="https://..."
                            value={row.url}
                            onChange={(v) => patchLink(i, { url: v })}
                          />
                        </>
                      ) : (
                        <Select
                          value={row.target_task_id || undefined}
                          optionList={row.targetOptions}
                          filter
                          remote
                          loading={row.searching}
                          placeholder="输入关键词搜索任务"
                          className={styles.linkFlex}
                          onSearch={(kw) => onTaskSearch(i, kw)}
                          onChange={(v) => patchLink(i, { target_task_id: (v as string) || '' })}
                        />
                      )}
                      <Button
                        type="danger"
                        theme="borderless"
                        icon={<IconDelete />}
                        onClick={() => removeLink(i)}
                      />
                    </div>
                  ))}
                  <Button icon={<IconPlus />} onClick={addLink}>
                    添加链接
                  </Button>
                </div>
              </Form.Slot>
            </div>
          </TabPane>
          <TabPane tab="详情" itemKey="detail">
            <div className={styles.tabBody}>
              <Form.TextArea
                field="result"
                label="结果"
                placeholder="请输入任务结果"
                autosize={{ minRows: 1, maxRows: 14 }}
              />

              <Form.InputNumber
                field="sort_order"
                label="序号"
                min={1}
                max={100000000}
                placeholder="留空默认排在最前"
                style={{ width: '100%' }}
                rules={[
                  {
                    validator: (_rule: unknown, val: unknown) =>
                      val === undefined || val === null || val === '' ||
                      (Number.isInteger(val) && (val as number) >= 1 && (val as number) <= 100000000),
                    message: '序号应为1-100000000的整数'
                  }
                ]}
              />

              <Form.TextArea
                field="execution_plan"
                label="执行计划"
                placeholder="请输入执行计划"
                autosize={{ minRows: 1, maxRows: 14 }}
              />

              <Form.TextArea
                field="execution_log"
                label="执行日志"
                placeholder="请输入执行日志"
                autosize={{ minRows: 1, maxRows: 14 }}
              />

              <Form.TextArea
                field="execution_result"
                label="执行结果"
                placeholder="请输入执行结果"
                autosize={{ minRows: 1, maxRows: 14 }}
              />

              <Form.DatePicker
                field="due_date"
                label="截止日期"
                placeholder="请选择截止日期"
                showClear
                style={{ width: '100%' }}
              />
            </div>
          </TabPane>
          {/* AI 终端:仅管理员且任务已保存时显示(语义同旧任务列表的 AI终端 按钮,后端 RequireAdmin 兜底)。
              终端实例常驻 sessionRegistry:切 tab、保存、关弹窗、面板重挂载都不中断会话 */}
          {isAdmin && task?.id && (
            <TabPane tab="AI终端" itemKey="terminal">
              <div className={styles.terminalBody}>
                {terminalMounted && (
                  <>
                    <div className={styles.terminalActions}>
                      <Button type="danger" size="small" onClick={confirmTerminate}>
                        终止
                      </Button>
                    </div>
                    <TaskTerminal
                      sessionKey={task.id}
                      cwd={task.task_list?.project_path?.trim() || '~'}
                      ref={terminalRef}
                    />
                  </>
                )}
              </div>
            </TabPane>
          )}
          {/* 日志面板每次激活重新挂载(条件渲染),保证保存后数据新鲜 */}
          <TabPane tab="日志" itemKey="logs">
            <div className={styles.tabBody}>
              {activeTab === 'logs' &&
                (task?.id ? (
                  <TaskLogList taskId={task.id} />
                ) : (
                  <div className={styles.logPlaceholder}>任务创建后可查看变更日志</div>
                ))}
            </div>
          </TabPane>
        </Tabs>
      </Form>
    </div>
  )
}
