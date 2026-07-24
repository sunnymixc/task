import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { useParams } from 'react-router'
import { Button, Input, Modal, Select, Space, Table, Toast, Tooltip } from '@douyinfe/semi-ui-19'
import type { ColumnProps } from '@douyinfe/semi-ui-19/lib/es/table'
import { IconChevronDown, IconChevronUp, IconEdit, IconInfoCircle, IconPlus, IconRefresh, IconSearch } from '@douyinfe/semi-icons'
import { useTaskStore } from '@/stores/task'
import { useTaskListStore } from '@/stores/taskList'
import { useTaskFilterStore } from '@/stores/taskFilter'
import type { CreateTaskRequest, ListTasksRequest, Task, TaskStatus, UpdateTaskRequest } from '@/types'
import { copyToClipboard } from '@/utils/clipboard'
import { useDebouncedCallback } from '@/hooks/useDebouncedCallback'
import { useRefreshShortcut } from '@/hooks/useRefreshShortcut'
import { useTableScrollY } from '@/hooks/useTableScrollY'
import TaskForm, { presetTaskFormTab, type TaskFormHandle } from '@/components/task/TaskForm'
import TerminalStatusDot from '@/components/task/TerminalStatusDot'
import { useWorkbenchStore } from '@/stores/workbench'
import StatusSelect from '@/components/task/StatusSelect'
import TaskLinkList from '@/components/task/TaskLinkList'
import InlineEditable from '@/components/common/InlineEditable'
import styles from './TaskList.module.css'

// Status filter options
const statusOptions = [
  { label: '草稿', value: 'draft' },
  { label: '待执行', value: 'pending' },
  { label: '执行中', value: 'executing' },
  { label: '已完成', value: 'completed' }
]

const PAGE_SIZE = 100

// 描述自动折叠阈值:超过 ON 折叠;铅笔按钮在"行内 ↔ 工具行"间移动会改变被测高度,
// 用低于 ON 的 OFF 作退出阈值,避免临界高度时经 ResizeObserver 展开/折叠无限振荡
const DESC_OVERFLOW_ON = 80
const DESC_OVERFLOW_OFF = 64

// 描述展示:超高自动折叠(点击文本或「展开」展开,「收起」按钮收起),不持久化展开状态。
// 铅笔编辑按钮不溢出时留在文本行尾(与短描述一致),溢出时移到底部工具行以免被裁剪
function CollapsibleDesc({ text, editButton }: { text: string; editButton: ReactNode }) {
  const textRef = useRef<HTMLDivElement>(null)
  const [overflowing, setOverflowing] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const collapsed = overflowing && !expanded

  useLayoutEffect(() => {
    const el = textRef.current
    if (!el) return
    // scrollHeight 在 max-height + overflow:hidden 下仍是完整内容高度,折叠态也能正确测量
    const check = () =>
      setOverflowing((prev) => (prev ? el.scrollHeight > DESC_OVERFLOW_OFF : el.scrollHeight > DESC_OVERFLOW_ON))
    check()
    const ro = new ResizeObserver(check) // 列宽随窗口变化 → 换行数变化 → 重判
    ro.observe(el)
    return () => ro.disconnect()
  }, [text])

  return (
    <div className={styles.taskDesc}>
      <div
        ref={textRef}
        className={collapsed ? styles.taskDescClamp : undefined}
        onClick={collapsed ? () => setExpanded(true) : undefined}
      >
        {text}
        {!overflowing && editButton}
      </div>
      {overflowing && (
        <div className={styles.taskDescToggleRow}>
          <Button
            size="small"
            theme="borderless"
            type="tertiary"
            className={styles.taskDescToggleBtn}
            icon={collapsed ? <IconChevronDown /> : <IconChevronUp />}
            onClick={() => setExpanded((v) => !v)}
          >
            {collapsed ? '展开' : '收起'}
          </Button>
          {editButton}
        </div>
      )}
    </div>
  )
}

export default function TaskList() {
  // 清单作用域模式:由路由 /task-lists/:listId/tasks 传入,只展示该清单下的任务
  const { listId } = useParams<{ listId: string }>()
  const taskListId = listId
  const isListScoped = !!taskListId
  // 状态筛选缓存的作用域:清单 id,全局任务视图用 'all'
  const filterScopeKey = taskListId ?? 'all'

  const tasks = useTaskStore((s) => s.tasks)
  const loading = useTaskStore((s) => s.loading)
  const total = useTaskStore((s) => s.total)
  const allLists = useTaskListStore((s) => s.allLists)

  // Filter states(状态筛选初始值从缓存恢复,覆盖刷新/直达路由场景)
  const [currentStatus, setCurrentStatus] = useState<TaskStatus[]>(() =>
    useTaskFilterStore.getState().getStatusFilter(filterScopeKey)
  )
  const [currentTaskLists, setCurrentTaskLists] = useState<string[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [page, setPage] = useState(1)

  // 表体固定高度:容器剩余空间减去表头/分页条,窗口变化时自动调整
  const { containerRef, scrollY } = useTableScrollY<HTMLDivElement>()

  // React 19 下不能用静态 Modal.confirm,需组件内 useModal + contextHolder
  const [modal, modalContextHolder] = Modal.useModal()

  // fetch 参数显式传入,避免 setState 异步导致读到旧值
  const fetchTasks = (opts?: { page?: number; statuses?: TaskStatus[]; lists?: string[] }) => {
    const params: ListTasksRequest = {
      page: opts?.page ?? page,
      page_size: PAGE_SIZE
    }
    const statuses = opts?.statuses ?? currentStatus
    const listsSel = opts?.lists ?? currentTaskLists
    if (statuses.length) {
      params.status = statuses
    }
    if (taskListId) {
      params.task_list_id = [taskListId]
    } else if (listsSel.length) {
      params.task_list_id = listsSel
    }
    return useTaskStore.getState().fetchTasks(params)
  }

  // 路由在 /tasks 与各清单子路由之间切换时复用同一组件实例,监听参数重置状态并刷新(含首次挂载)
  useEffect(() => {
    const statuses = useTaskFilterStore.getState().getStatusFilter(taskListId ?? 'all')
    setCurrentStatus(statuses)
    setCurrentTaskLists([])
    setSearchQuery('')
    setPage(1)
    fetchTasks({ page: 1, statuses, lists: [] })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [taskListId])

  useEffect(() => {
    useTaskListStore.getState().fetchAllLists()
  }, [])

  // Task list filter options
  const taskListOptions = allLists.map((list) => ({
    label: list.is_default ? `${list.title}（默认）` : list.title,
    value: list.id
  }))

  // 页头标题:清单作用域下显示清单名称
  const pageTitle = taskListId
    ? allLists.find((l) => l.id === taskListId)?.title || '任务清单'
    : '任务列表'

  // Handle status filter change
  const handleStatusChange = (value: TaskStatus[]) => {
    setCurrentStatus(value)
    useTaskFilterStore.getState().setStatusFilter(filterScopeKey, value)
    setPage(1)
    fetchTasks({ page: 1, statuses: value })
  }

  // 重置:整个筛选栏恢复初始化状态(状态/清单/搜索全部清空),并重新拉取全部任务
  const handleResetFilter = () => {
    debouncedSearch.cancel()
    const def = useTaskFilterStore.getState().resetStatusFilter(filterScopeKey)
    setCurrentStatus(def)
    setCurrentTaskLists([])
    setSearchQuery('')
    setPage(1)
    fetchTasks({ page: 1, statuses: def, lists: [] })
  }

  // 刷新:按当前筛选/搜索条件重新拉取当前页;返回 Promise 供全局刷新快捷键等待完成
  const handleRefresh = () => {
    const q = searchQuery.trim()
    if (q) {
      return useTaskStore.getState().searchTasks(q, page)
    }
    return fetchTasks()
  }
  useRefreshShortcut(handleRefresh)

  // Handle task list filter change
  const handleTaskListChange = (value: string[]) => {
    setCurrentTaskLists(value)
    setPage(1)
    fetchTasks({ page: 1, lists: value })
  }

  // Handle search (debounced 300ms)
  const handleSearch = (query: string) => {
    if (query.trim()) {
      setPage(1)
      useTaskStore.getState().searchTasks(query.trim(), 1)
    } else {
      fetchTasks()
    }
  }
  const debouncedSearch = useDebouncedCallback(handleSearch, 300)

  const onSearchInput = (value: string) => {
    setSearchQuery(value)
    debouncedSearch(value)
  }

  // Clear search(cancel 丢弃防抖中的旧关键词,避免清空后又延迟发出搜索)
  const clearSearch = () => {
    debouncedSearch.cancel()
    setSearchQuery('')
    fetchTasks()
  }

  // Create dialog
  const createFormRef = useRef<TaskFormHandle>(null)
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  // "保存"(不关窗)后记住已入库的任务,后续保存/确定改走更新,避免重复建单
  // ref 供提交逻辑同步读写;createdTask state 仅供 footer 感知"已入库"以显示删除按钮
  const createdTaskRef = useRef<Task | null>(null)
  const [createdTask, setCreatedTask] = useState<Task | null>(null)
  const openCreateDialog = () => {
    createdTaskRef.current = null
    setCreatedTask(null)
    setShowCreateDialog(true)
  }
  const closeCreateDialog = () => {
    setShowCreateDialog(false)
    createdTaskRef.current = null
    setCreatedTask(null)
  }

  // Handle create task（keepOpen=true 仅保存入库不关窗；保存成功才关闭弹窗，失败保留弹窗与已填内容）
  const handleCreateTask = async (data: CreateTaskRequest | UpdateTaskRequest, keepOpen = false) => {
    const store = useTaskStore.getState()
    const saved = createdTaskRef.current
      ? await store.updateTask(createdTaskRef.current.id, data)
      : await store.createTask(data as CreateTaskRequest)
    if (!saved) return
    createdTaskRef.current = saved
    setCreatedTask(saved)
    fetchTasks()
    if (!keepOpen) {
      closeCreateDialog()
    }
  }

  // Edit dialog
  const editFormRef = useRef<TaskFormHandle>(null)
  const [editingTask, setEditingTask] = useState<Task | null>(null)
  const [showEditDialog, setShowEditDialog] = useState(false)
  const openEditDialog = (task: Task) => {
    setEditingTask(task)
    setShowEditDialog(true)
  }
  const closeEditDialog = () => {
    setShowEditDialog(false)
    setEditingTask(null)
  }

  // Handle update task（keepOpen=true 仅保存入库不关窗；保存成功才关闭弹窗，失败保留弹窗与已填内容）
  const handleUpdateTask = async (data: CreateTaskRequest | UpdateTaskRequest, keepOpen = false) => {
    if (!editingTask) return
    const updated = await useTaskStore.getState().updateTask(editingTask.id, data)
    if (!updated) return
    fetchTasks()
    if (!keepOpen) {
      closeEditDialog()
    }
  }

  // 原地编辑标题/描述:同一时刻只允许编辑一处(行 id + 字段),避免多处草稿状态
  const [inlineEdit, setInlineEdit] = useState<{ id: string; field: 'title' | 'description' } | null>(null)
  const [inlineDraft, setInlineDraft] = useState('')
  const [inlineSaving, setInlineSaving] = useState(false)

  const isInlineEditing = (row: Task, field: 'title' | 'description') =>
    inlineEdit?.id === row.id && inlineEdit?.field === field

  const startInlineEdit = (task: Task, field: 'title' | 'description') => {
    setInlineEdit({ id: task.id, field })
    setInlineDraft(field === 'title' ? task.title : task.description || '')
  }

  const cancelInlineEdit = () => setInlineEdit(null)

  // 保存原地编辑:仅提交被编辑的单个字段;失败时保留编辑态与草稿
  const saveInlineEdit = async (task: Task) => {
    if (!inlineEdit || inlineSaving) return
    const field = inlineEdit.field
    const value = field === 'title' ? inlineDraft.trim() : inlineDraft
    if (field === 'title' && !value) {
      Toast.warning('任务标题不能为空')
      return
    }
    const original = field === 'title' ? task.title : task.description || ''
    if (value === original) {
      setInlineEdit(null)
      return
    }
    setInlineSaving(true)
    try {
      const updated = await useTaskStore
        .getState()
        .updateTask(task.id, field === 'title' ? { title: value } : { description: value })
      if (updated) {
        setInlineEdit(null)
      }
    } finally {
      setInlineSaving(false)
    }
  }

  // Copy task title + description to clipboard (title/description separated by 2 newlines)
  const handleCopyTask = async (task: Task) => {
    const text = task.description ? `${task.title}\n\n${task.description}` : task.title
    try {
      await copyToClipboard(text)
      Toast.success('已复制到剪贴板')
    } catch {
      Toast.error('复制失败')
    }
  }

  // 弹窗底部"拷贝":复制表单当前标题+描述到剪贴板(未保存的输入也会被复制)
  const handleCopyForm = async (formRef: React.RefObject<TaskFormHandle | null>) => {
    const text = formRef.current?.getCopyText()?.trim()
    if (!text) {
      Toast.warning('暂无内容可复制')
      return
    }
    try {
      await copyToClipboard(text)
      Toast.success('已复制到剪贴板')
    } catch {
      Toast.error('复制失败')
    }
  }

  // 复制任务：以原任务内容创建副本（标题加"-副本"，状态重置为草稿），成功后刷新列表并打开副本编辑弹窗
  const handleDuplicateTask = async (task: Task) => {
    const created = await useTaskStore.getState().createTask({
      title: `${task.title}-副本`,
      description: task.description || undefined,
      status: 'draft',
      priority: task.priority,
      task_list_id: task.task_list_id || undefined,
      due_date: task.due_date || undefined
    })
    if (created) {
      await fetchTasks()
      openEditDialog(created)
    }
  }

  // Handle status update
  const handleStatusUpdate = async (taskId: string, status: TaskStatus) => {
    await useTaskStore.getState().updateStatus(taskId, status)
    fetchTasks()
  }

  // 标题和描述单元格(展示态 + 原地编辑态)
  const renderTitleCell = (row: Task) => (
    <>
      {!isInlineEditing(row, 'title') ? (
        <div className={styles.taskTitle}>
          {row.title}
          <TerminalStatusDot
            taskId={row.id}
            onClick={() => {
              presetTaskFormTab(row.id, 'terminal')
              openEditDialog(row)
            }}
          />
          <Button
            className={styles.inlineEditBtn}
            theme="borderless"
            icon={<IconEdit />}
            onClick={() => startInlineEdit(row, 'title')}
          />
          {!row.description && !isInlineEditing(row, 'description') && (
            <Button
              className={`${styles.inlineEditBtn} ${styles.inlineAddDescBtn}`}
              theme="borderless"
              icon={<IconEdit />}
              onClick={() => startInlineEdit(row, 'description')}
            >
              添加描述
            </Button>
          )}
        </div>
      ) : (
        <div className={styles.inlineEditBox} onKeyDown={(e) => e.key === 'Escape' && cancelInlineEdit()}>
          <InlineEditable
            defaultValue={inlineDraft}
            className={styles.taskTitle}
            maxLength={255}
            ariaLabel="编辑任务标题"
            onInput={setInlineDraft}
            onSubmit={() => saveInlineEdit(row)}
            onCancel={cancelInlineEdit}
          />
          <div className={styles.inlineEditActions}>
            <Button size="small" theme="solid" type="primary" loading={inlineSaving} onClick={() => saveInlineEdit(row)}>
              保存
            </Button>
            <Button size="small" onClick={cancelInlineEdit}>
              取消
            </Button>
          </div>
        </div>
      )}

      {!isInlineEditing(row, 'description') && row.description ? (
        <CollapsibleDesc
          text={row.description}
          editButton={
            <Button
              className={styles.inlineEditBtn}
              theme="borderless"
              icon={<IconEdit />}
              onClick={() => startInlineEdit(row, 'description')}
            />
          }
        />
      ) : isInlineEditing(row, 'description') ? (
        <div className={styles.inlineEditBox} onKeyDown={(e) => e.key === 'Escape' && cancelInlineEdit()}>
          <InlineEditable
            defaultValue={inlineDraft}
            multiline
            className={styles.taskDesc}
            maxLength={5000}
            placeholder="添加描述"
            ariaLabel="编辑任务描述"
            onInput={setInlineDraft}
            onCancel={cancelInlineEdit}
          />
          <div className={styles.inlineEditActions}>
            <Button size="small" theme="solid" type="primary" loading={inlineSaving} onClick={() => saveInlineEdit(row)}>
              保存
            </Button>
            <Button size="small" onClick={cancelInlineEdit}>
              取消
            </Button>
          </div>
        </div>
      ) : null}

      {!!row.links?.length && (
        <div className={styles.taskLinks}>
          <TaskLinkList links={row.links} />
        </div>
      )}
    </>
  )

  // Table columns
  // scroll.y 下 Semi 表格为 table-layout: fixed,列宽由 colgroup 决定,且 Chrome 会忽略
  // 混合单位的 max()/calc(),因此定宽列直接给 px 保底;标题列不设宽度,吸收全部剩余空间。
  // 窄窗口由 CSS 的 .semi-table table { min-width } 兜底出横向滚动(见 module.css)
  const columns: ColumnProps<Task>[] = [
    {
      title: '任务状态',
      dataIndex: 'status',
      width: 120,
      render: (_: unknown, row: Task) => (
        <StatusSelect status={row.status} onChange={(status) => handleStatusUpdate(row.id, status)} />
      )
    },
    {
      title: '任务清单',
      dataIndex: 'task_list',
      width: 160,
      ellipsis: true,
      render: (_: unknown, row: Task) => row.task_list?.title || '-'
    },
    { title: '标题&描述&链接', dataIndex: 'title', render: (_: unknown, row: Task) => renderTitleCell(row) },
    {
      title: '操作',
      dataIndex: 'action',
      // small 尺寸按钮:拷贝/编辑/工作,200px 内单行放下(需 ≥196px:3×52 按钮 + 2×4 间距 + 2×16 内边距)
      width: 200,
      render: (_: unknown, row: Task) => (
        <Space spacing={4} wrap>
          <Button size="small" onClick={() => handleCopyTask(row)}>
            拷贝
          </Button>
          <Button size="small" onClick={() => openEditDialog(row)}>
            编辑
          </Button>
          <Button size="small" onClick={() => useWorkbenchStore.getState().addTask(row)}>
            工作
          </Button>
        </Space>
      )
    }
  ]

  // 删除弹窗中的任务:二次确认后删除并关闭弹窗(成功/失败 Toast 由 store 的 deleteTask 负责)
  const handleDeleteTask = (task: Task, onClose: () => void) => {
    modal.confirm({
      title: '确认删除',
      content: `确定要删除任务 "${task.title}" 吗？`,
      okText: '删除',
      okButtonProps: { type: 'danger' },
      cancelText: '取消',
      onOk: async () => {
        const success = await useTaskStore.getState().deleteTask(task.id)
        if (success) {
          onClose()
          fetchTasks()
        }
      }
    })
  }

  // footer 左右分布:左侧复制/删除(仅已入库任务:编辑弹窗/新建弹窗"保存"后),右侧为原有按钮组
  const dialogFooter = (formRef: React.RefObject<TaskFormHandle | null>, onClose: () => void, task?: Task | null) => (
    <div className={styles.dialogFooter}>
      <div>
        {task && (
          <>
            <Button
              style={{ marginLeft: 0 }}
              onClick={() => {
                onClose()
                handleDuplicateTask(task)
              }}
            >
              复制
            </Button>
            <Button type="danger" onClick={() => handleDeleteTask(task, onClose)}>
              删除
            </Button>
          </>
        )}
      </div>
      <div>
        <Button onClick={onClose}>关闭</Button>
        {task && (
          <Button onClick={() => useWorkbenchStore.getState().addTask(task)}>工作</Button>
        )}
        <Button onClick={() => handleCopyForm(formRef)}>拷贝</Button>
        <Button type="primary" onClick={() => formRef.current?.save()}>
          保存
        </Button>
        <Button theme="solid" type="primary" onClick={() => formRef.current?.submit()}>
          确定
        </Button>
      </div>
    </div>
  )

  return (
    <div className={styles.container}>
      {modalContextHolder}
      {/* Header */}
      <div className={styles.pageHeader}>
        <div className={styles.title}>{pageTitle}</div>
        <Tooltip content="新建任务">
          <Button
            theme="borderless"
            type="tertiary"
            icon={<IconPlus />}
            aria-label="新建任务"
            onClick={openCreateDialog}
          />
        </Tooltip>
      </div>

      {/* Filters */}
      <div className={styles.filters}>
        <div className={styles.filterGroup}>
          <Select
            multiple
            showClear
            value={currentStatus}
            optionList={statusOptions}
            placeholder="选择任务状态"
            style={{ minWidth: 120 }}
            onChange={(v) => handleStatusChange((v as TaskStatus[]) || [])}
          />
          {!isListScoped && (
            <Select
              multiple
              showClear
              value={currentTaskLists}
              optionList={taskListOptions}
              placeholder="选择任务清单"
              style={{ minWidth: 140 }}
              onChange={(v) => handleTaskListChange((v as string[]) || [])}
            />
          )}
          <Input
            value={searchQuery}
            placeholder="搜索任务..."
            showClear
            prefix={<IconSearch />}
            style={{ width: 300 }}
            onChange={onSearchInput}
            onClear={clearSearch}
          />
          <Button onClick={handleResetFilter}>重置</Button>
          <Tooltip content="刷新">
            <Button
              theme="borderless"
              type="tertiary"
              icon={<IconRefresh />}
              aria-label="刷新"
              onClick={handleRefresh}
            />
          </Tooltip>
        </div>
      </div>

      {/* Task Table */}
      <div className={styles.tableContainer} ref={containerRef}>
        <Table
          dataSource={tasks}
          columns={columns}
          loading={loading}
          rowKey="id"
          scroll={scrollY !== undefined ? { y: scrollY } : undefined}
          empty={
            loading ? null : (
              <div className={styles.emptyState}>
                <IconInfoCircle style={{ fontSize: 48 }} />
                <p>暂无任务</p>
                <Button type="primary" onClick={openCreateDialog}>
                  创建第一个任务
                </Button>
              </div>
            )
          }
          pagination={{
            currentPage: page,
            pageSize: PAGE_SIZE,
            total,
            onPageChange: (p: number) => {
              setPage(p)
              fetchTasks({ page: p })
            }
          }}
        />
      </div>

      {/* Create Dialog */}
      <Modal
        visible={showCreateDialog}
        title="新建任务"
        centered
        width="40vw"
        className="task-form-dialog"
        onCancel={closeCreateDialog}
        footer={dialogFooter(createFormRef, closeCreateDialog, createdTask)}
      >
        <TaskForm ref={createFormRef} defaultTaskListId={taskListId} onSubmit={handleCreateTask} />
      </Modal>

      {/* Edit Dialog */}
      <Modal
        visible={showEditDialog}
        title="编辑任务"
        centered
        width="40vw"
        className="task-form-dialog"
        onCancel={closeEditDialog}
        footer={dialogFooter(editFormRef, closeEditDialog, editingTask)}
      >
        <TaskForm key={editingTask?.id || 'edit'} ref={editFormRef} task={editingTask} onSubmit={handleUpdateTask} />
      </Modal>
    </div>
  )
}
