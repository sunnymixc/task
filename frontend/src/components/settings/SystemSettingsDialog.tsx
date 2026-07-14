import { useEffect, useState } from 'react'
import { Button, InputNumber, Modal, Radio, RadioGroup, Tag } from '@douyinfe/semi-ui-19'
import { useUiStore, RADIUS_OPTIONS, RADIUS_MIN, RADIUS_MAX } from '@/stores/ui'
import { useAuthStore } from '@/stores/auth'
import styles from './SystemSettingsDialog.module.css'

// 圆角单选组中"自定义"项的哨兵值
const CUSTOM_VALUE = 'custom'

interface Props {
  visible: boolean
  onClose: () => void
}

export default function SystemSettingsDialog({ visible, onClose }: Props) {
  const radius = useUiStore((s) => s.radius)
  // 系统设置为全局配置，仅管理员可修改，其他用户只读
  const canEdit = useAuthStore((s) => s.user?.is_admin === true)

  // 显式选过"自定义"后即使输入值恰好等于某个预设档,也保持自定义态不跳档
  const [customSelected, setCustomSelected] = useState(
    () => !RADIUS_OPTIONS.some((opt) => opt.px === useUiStore.getState().radius)
  )

  const radioValue = customSelected ? CUSTOM_VALUE : radius

  // 打开对话框时拉取最新的服务端设置
  useEffect(() => {
    if (visible) {
      useUiStore.getState().fetchSystemSettings().then(() => {
        const current = useUiStore.getState().radius
        setCustomSelected(!RADIUS_OPTIONS.some((opt) => opt.px === current))
      })
    }
  }, [visible])

  const handleRadiusChange = (value: string | number) => {
    if (value === CUSTOM_VALUE) {
      setCustomSelected(true)
      return
    }
    setCustomSelected(false)
    useUiStore.getState().updateSystemSettings({ ui_radius: Number(value) })
  }

  const handleCustomInput = (value: string | number) => {
    const px = Number(value)
    // 清空输入框时不写入，保留上次生效值
    if (value === '' || !Number.isFinite(px)) return
    useUiStore.getState().updateSystemSettings({ ui_radius: px })
  }

  return (
    <Modal
      visible={visible}
      title="系统设置"
      centered
      width="min(92vw, 520px)"
      onCancel={onClose}
      footer={<Button onClick={onClose}>关闭</Button>}
    >
      <div>
        <div className={styles.sectionTitle}>
          UI 设置
          {!canEdit && (
            <Tag color="orange" size="small">
              仅管理员可修改
            </Tag>
          )}
        </div>
        <div className={styles.row}>
          <span className={styles.rowLabel}>圆角</span>
          <RadioGroup
            value={radioValue}
            disabled={!canEdit}
            onChange={(e) => handleRadiusChange(e.target.value)}
          >
            {RADIUS_OPTIONS.map((opt) => (
              <Radio key={opt.px} value={opt.px}>
                {opt.label}({opt.px}px)
              </Radio>
            ))}
            <Radio value={CUSTOM_VALUE}>自定义</Radio>
          </RadioGroup>
        </div>
        {customSelected && (
          <div className={styles.row}>
            <span className={styles.rowLabel}>自定义圆角</span>
            <InputNumber
              value={radius}
              min={RADIUS_MIN}
              max={RADIUS_MAX}
              disabled={!canEdit}
              suffix="px"
              style={{ width: 120 }}
              onChange={handleCustomInput}
            />
          </div>
        )}
      </div>
    </Modal>
  )
}
