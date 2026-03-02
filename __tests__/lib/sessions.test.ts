// sessions.ts removed — session management is now handled by Pinchtab profiles.
// See lib/pinchtab.ts > ensureProfile()
import { describe, it } from 'vitest'

describe('sessions', () => {
  it('세션 관리가 Pinchtab 프로필로 대체됨', () => {
    // No-op: cookie persistence is now handled by Pinchtab's profile system
  })
})
