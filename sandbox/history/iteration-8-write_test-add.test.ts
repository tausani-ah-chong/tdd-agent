import { describe, it, expect } from 'vitest'
import { add } from './add'

describe('add', () => {
  it('should return 0 when adding 0 and 0', () => {
    expect(add(0, 0)).toBe(0)
  })

  it('should return 3 when adding 1 and 2', () => {
    expect(add(1, 2)).toBe(3)
  })

  it('should return -3 when adding -1 and -2', () => {
    expect(add(-1, -2)).toBe(-3)
  })
})