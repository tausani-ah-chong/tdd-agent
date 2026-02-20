import { describe, it, expect } from 'vitest'
import { write } from './write'

describe('write', () => {
  it('returns empty string for empty input', () => {
    expect(write('')).toBe('')
  })
})
