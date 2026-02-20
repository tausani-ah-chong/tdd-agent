import { describe, it, expect } from 'vitest'
import { fizzbuzz } from './fizzbuzz'

describe('fizzbuzz', () => {
  it('returns an empty array when n is 0', () => {
    expect(fizzbuzz(0)).toEqual([])
  })
})
