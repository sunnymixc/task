<script setup lang="ts">
import Sidebar from '@/components/layout/Sidebar.vue'
</script>

<template>
  <div class="layout-root">
    <Sidebar />
    <div class="layout-outlet">
      <router-view />
    </div>
  </div>
</template>

<style scoped>
.layout-root {
  display: flex;
  align-items: stretch;
  width: 100%;
  height: 100vh;
  background: var(--td-bg-color-container);
}

.layout-outlet {
  flex: 1;
  min-width: 0;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: var(--td-bg-color-page);
}
</style>
