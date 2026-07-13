import { Typography } from '@douyinfe/semi-ui-19'
import { IconCheckList, IconLink } from '@douyinfe/semi-icons'
import type { TaskLink } from '@/types'
import styles from './TaskLinkList.module.css'

// URL 链接直接打开;任务链接新窗口打开任务详情页;目标任务已删除的不可点
const openTaskLink = (link: TaskLink) => {
  if (link.link_type === 'url' && link.url) {
    window.open(link.url, '_blank', 'noopener')
  } else if (link.link_type === 'task' && link.target_task_id && link.target_task) {
    window.open(`/tasks/${link.target_task_id}`, '_blank', 'noopener')
  }
}

export default function TaskLinkList({ links }: { links?: TaskLink[] }) {
  if (!links?.length) return <>-</>

  return (
    <>
      {links.map((link) => (
        <div key={link.id} className={styles.item}>
          {link.link_type === 'url' || link.target_task ? (
            <Typography.Text link={{ onClick: () => openTaskLink(link) }}>
              {link.link_type === 'url' ? (
                <IconLink size="small" className={styles.icon} />
              ) : (
                <IconCheckList size="small" className={styles.icon} />
              )}
              {link.link_type === 'url' ? link.title : link.target_task!.title}
            </Typography.Text>
          ) : (
            <span className={styles.dead}>
              <IconCheckList size="small" className={styles.icon} />
              已删除的任务
            </span>
          )}
        </div>
      ))}
    </>
  )
}
