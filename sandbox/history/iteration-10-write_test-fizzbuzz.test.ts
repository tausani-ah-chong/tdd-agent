import { describe, it, expect } from 'vitest'
import { fizzbuzz } from './fizzbuzz'

describe('fizzbuzz', () => {
  it('returns an empty array when n is 0', () => {
    expect(fizzbuzz(0)).toEqual([])
  })

  it('returns ["1"] when n is 1', () => {
    expect(fizzbuzz(1)).toEqual(['1'])
  })

  it('returns Fizz for multiples of 3', () => {
    expect(fizzbuzz(3)).toEqual(['1', '2', 'Fizz'])
  })

  it('returns Buzz for multiples of 5', () => {
    expect(fizzbuzz(5)).toEqual(['1', '2', 'Fizz', '4', 'Buzz'])
  })
})
