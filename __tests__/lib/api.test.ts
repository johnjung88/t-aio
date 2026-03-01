import { describe, it, expect, vi } from 'vitest'

// Mock next/server before importing api module
vi.mock('next/server', () => ({
  NextResponse: {
    json: (body: unknown, init?: { status?: number }) => ({
      body,
      status: init?.status ?? 200,
    }),
  },
}))

const { ok, fail, zodErrorDetails } = await import('@/lib/api')

describe('ok()', () => {
  it('success: true, data 포함, error: null 반환', () => {
    const res = ok({ id: '1' }) as { body: unknown; status: number }
    expect(res.body).toEqual({ success: true, data: { id: '1' }, error: null })
  })

  it('기본 status는 200', () => {
    const res = ok('hello') as { body: unknown; status: number }
    expect(res.status).toBe(200)
  })

  it('커스텀 status 반영', () => {
    const res = ok([], 201) as { body: unknown; status: number }
    expect(res.status).toBe(201)
  })
})

describe('fail()', () => {
  it('success: false, data: null, error 포함 반환', () => {
    const res = fail('Not found', 404) as { body: unknown; status: number }
    expect(res.body).toMatchObject({
      success: false,
      data: null,
      error: { message: 'Not found' },
    })
  })

  it('기본 status는 400', () => {
    const res = fail('bad') as { body: unknown; status: number }
    expect(res.status).toBe(400)
  })

  it('기본 code는 BAD_REQUEST', () => {
    const res = fail('err') as { body: { error: { code: string } }; status: number }
    expect(res.body.error.code).toBe('BAD_REQUEST')
  })

  it('커스텀 code 반영', () => {
    const res = fail('err', 500, 'INTERNAL') as { body: { error: { code: string } }; status: number }
    expect(res.body.error.code).toBe('INTERNAL')
  })
})

describe('zodErrorDetails()', () => {
  it('ZodError에서 fieldErrors, formErrors, issues 추출', async () => {
    const { z } = await import('@/lib/zod')
    const schema = z.object({ name: z.string().min(1) })
    const result = schema.safeParse({ name: '' })
    if (result.success) throw new Error('Expected failure')

    const details = zodErrorDetails(result.error)
    expect(details).toHaveProperty('fieldErrors')
    expect(details).toHaveProperty('formErrors')
    expect(details).toHaveProperty('issues')
    expect(Array.isArray(details.issues)).toBe(true)
  })
})
