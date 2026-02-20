import { describe, it, expect } from 'vitest'
import { templateRender } from './templateRender'

describe('templateRender', () => {
  it('should return the string as-is when there are no placeholders', () => {
    expect(templateRender('hello', {})).toBe('hello')
  })
})