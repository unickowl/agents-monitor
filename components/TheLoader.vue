<template>
  <Transition name="lift">
    <div v-if="!done" class="loader" :data-theme="theme">
      <div class="loader-inner">
        <div class="loader-logo">owl monitor</div>
        <div class="loader-track">
          <div class="loader-bar"></div>
        </div>
        <div class="loader-hint">loading sessions…</div>
      </div>
      <div class="loader-corner">{{ dateStr }}</div>
    </div>
  </Transition>
</template>

<script setup lang="ts">
defineProps<{ done: boolean }>()

const theme = ref('light')
const dateStr = new Date().toLocaleDateString('en-US', {
  weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
})

onMounted(() => {
  theme.value = localStorage.getItem('theme') || 'light'
})
</script>

<style scoped>
.loader {
  position: fixed; inset: 0; z-index: 999;
  background: var(--bg);
  display: flex; align-items: center; justify-content: center;
}

/* ── Lift-off transition ── */
.lift-leave-active {
  transition: transform 0.52s cubic-bezier(0.76, 0, 0.24, 1),
              opacity  0.52s cubic-bezier(0.76, 0, 0.24, 1);
}
.lift-leave-to {
  transform: translateY(-100%);
  opacity: 0;
}

/* ── Center block ── */
.loader-inner {
  display: flex; flex-direction: column;
  align-items: flex-start; gap: 18px;
  animation: fade-up 0.6s cubic-bezier(0.16, 1, 0.3, 1) both;
}

@keyframes fade-up {
  from { opacity: 0; transform: translateY(12px); }
  to   { opacity: 1; transform: translateY(0); }
}

/* ── Logo ── */
.loader-logo {
  font-family: var(--mono);
  font-size: clamp(28px, 5vw, 52px);
  font-weight: 500;
  letter-spacing: -0.02em;
  color: var(--text);
  overflow: hidden;
  white-space: nowrap;
  width: 0;
  animation: type-in 0.7s steps(11, end) 0.2s both;
}

@keyframes type-in {
  from { width: 0; }
  to   { width: 100%; }
}

/* ── Progress bar ── */
.loader-track {
  width: 100%;
  height: 1.5px;
  background: var(--border);
  overflow: hidden;
  border-radius: 2px;
}

.loader-bar {
  height: 100%;
  background: var(--text);
  border-radius: 2px;
  animation: sweep 1.4s cubic-bezier(0.4, 0, 0.2, 1) 0.3s both;
  transform-origin: left;
}

@keyframes sweep {
  from { transform: scaleX(0); }
  to   { transform: scaleX(1); }
}

/* ── Hint text ── */
.loader-hint {
  font-family: var(--mono);
  font-size: 11px;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--faint);
  animation: fade-up 0.5s ease 0.9s both;
}

/* ── Corner date stamp ── */
.loader-corner {
  position: absolute;
  bottom: 28px; right: 32px;
  font-family: var(--mono);
  font-size: 11px;
  color: var(--faint);
  letter-spacing: 0.04em;
  animation: fade-up 0.5s ease 1s both;
}
</style>
