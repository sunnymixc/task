<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useUiStore, RADIUS_OPTIONS, RADIUS_MIN, RADIUS_MAX } from '@/stores/ui'
import { useAuthStore } from '@/stores/auth'

// 圆角单选组中"自定义"项的哨兵值
const CUSTOM_VALUE = 'custom'

const uiStore = useUiStore()
const authStore = useAuthStore()

const visible = defineModel<boolean>('visible', { required: true })

// 系统设置为全局配置，仅管理员可修改，其他用户只读
const canEdit = computed(() => authStore.isAdmin)

// 显式选过"自定义"后即使输入值恰好等于某个预设档,也保持自定义态不跳档
const customSelected = ref(!RADIUS_OPTIONS.some((opt) => opt.px === uiStore.radius))

const radioValue = computed(() =>
  customSelected.value ? CUSTOM_VALUE : uiStore.radius
)

// 打开对话框时拉取最新的服务端设置
watch(visible, (v) => {
  if (v) {
    uiStore.fetchSystemSettings().then(() => {
      customSelected.value = !RADIUS_OPTIONS.some((opt) => opt.px === uiStore.radius)
    })
  }
})

const handleRadiusChange = (value: string | number | boolean) => {
  if (value === CUSTOM_VALUE) {
    customSelected.value = true
    return
  }
  customSelected.value = false
  uiStore.updateSystemSettings({ ui_radius: Number(value) })
}

const handleCustomInput = (value: string | number | undefined) => {
  const px = Number(value)
  // 清空输入框时不写入，保留上次生效值
  if (value === undefined || value === '' || !Number.isFinite(px)) return
  uiStore.updateSystemSettings({ ui_radius: px })
}
</script>

<template>
  <t-dialog
    v-model:visible="visible"
    header="系统设置"
    placement="center"
    width="min(92vw, 520px)"
  >
    <div class="settings-section">
      <div class="settings-section__title">
        UI 设置
        <t-tag v-if="!canEdit" theme="warning" variant="light" size="small">
          仅管理员可修改
        </t-tag>
      </div>
      <div class="settings-row">
        <span class="settings-row__label">圆角</span>
        <t-radio-group
          :model-value="radioValue"
          :disabled="!canEdit"
          @change="handleRadiusChange"
        >
          <t-radio v-for="opt in RADIUS_OPTIONS" :key="opt.px" :value="opt.px">
            {{ opt.label }}({{ opt.px }}px)
          </t-radio>
          <t-radio :value="CUSTOM_VALUE">自定义</t-radio>
        </t-radio-group>
      </div>
      <div v-if="customSelected" class="settings-row">
        <span class="settings-row__label">自定义圆角</span>
        <t-input-number
          :model-value="uiStore.radius"
          theme="normal"
          :min="RADIUS_MIN"
          :max="RADIUS_MAX"
          :allow-input-over-limit="false"
          :disabled="!canEdit"
          suffix="px"
          style="width: 120px"
          @change="handleCustomInput"
        />
      </div>
    </div>
    <template #footer>
      <t-button theme="default" @click="visible = false">关闭</t-button>
    </template>
  </t-dialog>
</template>

<style scoped>
.settings-section__title {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
  font-size: 13px;
  font-weight: 600;
  color: var(--td-text-color-secondary);
}

.settings-row {
  display: flex;
  align-items: center;
  gap: 16px;
}

.settings-row + .settings-row {
  margin-top: 12px;
}

.settings-row__label {
  flex-shrink: 0;
  width: 80px;
  font-size: 14px;
  color: var(--td-text-color-primary);
}
</style>
