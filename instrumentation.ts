export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { syncWithAccounts } = await import('./lib/scheduler')
    setTimeout(() => {
      console.log('[Instrumentation] Autopilot 작업 복구 시작...')
      syncWithAccounts()
    }, 3000)
  }
}
