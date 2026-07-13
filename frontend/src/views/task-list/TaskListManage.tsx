import { useEffect, useRef, useState } from 'react'
import { Button, Input, Modal, Space, Table, Tag, Typography } from '@douyinfe/semi-ui-19'
import type { ColumnProps } from '@douyinfe/semi-ui-19/lib/es/table'
import { IconInfoCircle, IconPlus, IconSearch } from '@douyinfe/semi-icons'
import { useTaskListStore } from '@/stores/taskList'
import type { CreateTaskListRequest, ListTaskListsRequest, TaskList, UpdateTaskListRequest } from '@/types'
import { useTableScrollY } from '@/hooks/useTableScrollY'
import { useDebouncedCallback } from '@/hooks/useDebouncedCallback'
import TaskListForm, { type TaskListFormHandle } from '@/components/task-list/TaskListForm'
import styles from './TaskListManage.module.css'

const formatDate = (dateStr: string) => {
  return new Date(dateStr).toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  })
}

const PAGE_SIZE = 20

export default function TaskListManage() {
  // useModal 渲染在组件树内,避免静态 Modal.confirm 在 React 19 下同步卸载 root 的告警
  const [modal, modalContextHolder] = Modal.useModal()
  const lists = useTaskListStore((s) => s.lists)
  const loading = useTaskListStore((s) => s.loading)
  const total = useTaskListStore((s) => s.total)

  const [page, setPage] = useState(1)
  const [searchQuery, setSearchQuery] = useState('')

  // 表体固定高度:容器剩余空间减去表头/分页条,窗口变化时自动调整
  const { containerRef, scrollY } = useTableScrollY<HTMLDivElement>()

  // fetch 参数显式传入,避免 setState 异步导致读到旧值
  const fetchLists = (opts?: { page?: number; keyword?: string }) => {
    const params: ListTaskListsRequest = {
      page: opts?.page ?? page,
      page_size: PAGE_SIZE
    }
    const keyword = (opts?.keyword ?? searchQuery).trim()
    if (keyword) {
      params.keyword = keyword
    }
    return useTaskListStore.getState().fetchLists(params)
  }

  useEffect(() => {
    fetchLists({ page: 1 })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // 关键字搜索(防抖 300ms),按标题/描述模糊匹配
  const handleSearch = (query: string) => {
    setPage(1)
    fetchLists({ page: 1, keyword: query })
  }
  const debouncedSearch = useDebouncedCallback(handleSearch, 300)

  const onSearchInput = (value: string) => {
    setSearchQuery(value)
    debouncedSearch(value)
  }

  const clearSearch = () => {
    setSearchQuery('')
    setPage(1)
    fetchLists({ page: 1, keyword: '' })
  }

  // Create dialog
  const createFormRef = useRef<TaskListFormHandle>(null)
  const [showCreateDialog, setShowCreateDialog] = useState(false)

  const handleCreateList = async (data: CreateTaskListRequest | UpdateTaskListRequest) => {
    await useTaskListStore.getState().createList(data as CreateTaskListRequest)
    setShowCreateDialog(false)
    fetchLists()
  }

  // Edit dialog
  const editFormRef = useRef<TaskListFormHandle>(null)
  const [editingList, setEditingList] = useState<TaskList | null>(null)
  const [showEditDialog, setShowEditDialog] = useState(false)
  const openEditDialog = (list: TaskList) => {
    setEditingList(list)
    setShowEditDialog(true)
  }
  const closeEditDialog = () => {
    setShowEditDialog(false)
    setEditingList(null)
  }

  const handleUpdateList = async (data: CreateTaskListRequest | UpdateTaskListRequest) => {
    if (!editingList) return
    await useTaskListStore.getState().updateList(editingList.id, data)
    closeEditDialog()
    fetchLists()
  }

  // Handle delete task list
  const handleDeleteList = (list: TaskList) => {
    modal.confirm({
      title: '确认删除',
      content: `确定要删除任务清单 "${list.title}" 吗？该清单下的任务将移动到默认清单。`,
      okText: '确定',
      cancelText: '取消',
      onOk: async () => {
        const success = await useTaskListStore.getState().deleteList(list.id)
        if (success) {
          fetchLists()
        }
      }
    })
  }

  const columns: ColumnProps<TaskList>[] = [
    { title: '序号', dataIndex: 'sort_order', width: 80 },
    {
      title: 'ID',
      dataIndex: 'id',
      width: 240,
      render: (v: string) => <span className={styles.listId}>{v}</span>
    },
    {
      title: '标题',
      dataIndex: 'title',
      width: 220,
      render: (_: unknown, row: TaskList) => (
        <div className={styles.listTitle}>
          <span>{row.title}</span>
          {row.is_default && (
            <Tag color="blue" size="small">
              默认
            </Tag>
          )}
        </div>
      )
    },
    {
      title: '描述',
      dataIndex: 'description',
      width: 300,
      render: (v: string) => <span className={styles.listDesc}>{v || '-'}</span>
    },
    {
      title: '创建者',
      dataIndex: 'creator',
      width: 120,
      render: (_: unknown, row: TaskList) => <span className={styles.creatorInfo}>{row.creator?.username || '-'}</span>
    },
    { title: '创建时间', dataIndex: 'created_at', width: 180, render: (v: string) => formatDate(v) },
    { title: '更新时间', dataIndex: 'updated_at', width: 180, render: (v: string) => formatDate(v) },
    {
      title: '操作',
      dataIndex: 'action',
      width: 120,
      className: styles.actionCell,
      render: (_: unknown, row: TaskList) => (
        <Space spacing={12}>
          <Typography.Text link={{ onClick: () => openEditDialog(row) }}>编辑</Typography.Text>
          {!row.is_default && (
            <Typography.Text link={{ onClick: () => handleDeleteList(row) }} type="danger">
              删除
            </Typography.Text>
          )}
        </Space>
      )
    }
  ]

  return (
    <div className={styles.container}>
      {modalContextHolder}
      {/* Header */}
      <div className={styles.pageHeader}>
        <div className={styles.title}>任务清单</div>
        <Button theme="solid" type="primary" icon={<IconPlus />} onClick={() => setShowCreateDialog(true)}>
          新建清单
        </Button>
      </div>

      {/* Filters */}
      <div className={styles.filters}>
        <Input
          placeholder="搜索标题/描述"
          value={searchQuery}
          onChange={onSearchInput}
          onClear={clearSearch}
          showClear
          prefix={<IconSearch />}
          style={{ width: 300 }}
        />
      </div>

      {/* Task List Table */}
      <div className={styles.tableContainer} ref={containerRef}>
        <Table
          dataSource={lists}
          columns={columns}
          loading={loading}
          rowKey="id"
          scroll={scrollY !== undefined ? { y: scrollY } : undefined}
          empty={
            loading ? null : searchQuery.trim() ? (
              <div className={styles.emptyState}>
                <IconInfoCircle style={{ fontSize: 48 }} />
                <p>未找到匹配的清单</p>
              </div>
            ) : (
              <div className={styles.emptyState}>
                <IconInfoCircle style={{ fontSize: 48 }} />
                <p>暂无任务清单</p>
                <Button type="primary" onClick={() => setShowCreateDialog(true)}>
                  创建第一个清单
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
              fetchLists({ page: p })
            }
          }}
        />
      </div>

      {/* Create Dialog */}
      <Modal
        visible={showCreateDialog}
        title="新建清单"
        centered
        width="min(92vw, 640px)"
        okText="确定"
        cancelText="取消"
        onOk={() => createFormRef.current?.submit()}
        onCancel={() => setShowCreateDialog(false)}
      >
        <TaskListForm ref={createFormRef} onSubmit={handleCreateList} />
      </Modal>

      {/* Edit Dialog */}
      <Modal
        visible={showEditDialog}
        title="编辑清单"
        centered
        width="min(92vw, 640px)"
        okText="确定"
        cancelText="取消"
        onOk={() => editFormRef.current?.submit()}
        onCancel={closeEditDialog}
      >
        <TaskListForm key={editingList?.id || 'edit'} ref={editFormRef} list={editingList} onSubmit={handleUpdateList} />
      </Modal>
    </div>
  )
}
