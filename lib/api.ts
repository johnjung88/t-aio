import { NextResponse } from 'next/server'

export interface ApiError {
  code: string
  message: string
  details?: unknown
}

export interface ApiSuccess<T> {
  success: true
  data: T
  error: null
}

export interface ApiFailure {
  success: false
  data: null
  error: ApiError
}

export type ApiResponse<T> = ApiSuccess<T> | ApiFailure

export function ok<T>(data: T, status = 200) {
  const body: ApiSuccess<T> = {
    success: true,
    data,
    error: null,
  }
  return NextResponse.json(body, { status })
}

export function fail(message: string, status = 400, code = 'BAD_REQUEST', details?: unknown) {
  const body: ApiFailure = {
    success: false,
    data: null,
    error: {
      code,
      message,
      details,
    },
  }
  return NextResponse.json(body, { status })
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function zodErrorDetails(error: any) {
  const flat = error.flatten?.() ?? { fieldErrors: {}, formErrors: [] }
  const issues = (error.issues ?? []) as Array<{ path: Array<string | number>; message: string }>
  return {
    formErrors: flat.formErrors as string[],
    fieldErrors: flat.fieldErrors as Record<string, string[]>,
    issues: issues.map((issue) => ({
      path: issue.path.join('.'),
      message: issue.message,
    })),
  }
}
