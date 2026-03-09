export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { syncWithAccounts } = await import('./lib/scheduler')
    setTimeout(() => {
      console.log('[Instrumentation] Autopilot 작업 복구 시작...')
      try {
        syncWithAccounts()
      } catch (err) {
        console.error('[Instrumentation] 스케줄러 복구 실패:', err)
      }
    }, 3000)
  }
}
