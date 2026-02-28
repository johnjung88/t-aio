export function removeUndefined<T extends Record<string, unknown>>(value: T): Partial<T> {
  const result: Partial<T> = {}

  for (const [key, item] of Object.entries(value)) {
    if (item !== undefined) {
      result[key as keyof T] = item as T[keyof T]
    }
  }

  return result
}
