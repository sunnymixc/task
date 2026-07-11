<script setup lang="ts">
import { useUiStore, RADIUS_OPTIONS } from '@/stores/ui'

const uiStore = useUiStore()

const visible = defineModel<boolean>('visible', { required: true })

const handleRadiusChange = (value: string | number | boolean) => {
  uiStore.setRadius(Number(value))
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
      <div class="settings-section__title">UI 设置</div>
      <div class="settings-row">
        <span class="settings-row__label">圆角</span>
        <t-radio-group :model-value="uiStore.radius" @change="handleRadiusChange">
          <t-radio v-for="opt in RADIUS_OPTIONS" :key="opt.px" :value="opt.px">
            {{ opt.label }}({{ opt.px }}px)
          </t-radio>
        </t-radio-group>
      </div>
    </div>
    <template #footer>
      <t-button theme="default" @click="visible = false">关闭</t-button>
    </template>
  </t-dialog>
</template>

<style scoped>
.settings-section__title {
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

.settings-row__label {
  flex-shrink: 0;
  width: 80px;
  font-size: 14px;
  color: var(--td-text-color-primary);
}
</style>
