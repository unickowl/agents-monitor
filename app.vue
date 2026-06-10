<!-- app.vue -->
<template>
  <NuxtPage />
</template>

<script setup lang="ts">
if (import.meta.client) {
  const stored = localStorage.getItem('theme')
  if (stored) document.documentElement.dataset.theme = stored
}
</script>
