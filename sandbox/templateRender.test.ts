import { describe, it, expect } from 'vitest'
import { templateRender } from './templateRender'

describe('templateRender', () => {
  it('should return the string as-is when there are no placeholders', () => {
    expect(templateRender('hello', {})).toBe('hello')
  })

  it('should replace a single placeholder with the corresponding value', () => {
    expect(templateRender('hello {{name}}', { name: 'world' })).toBe('hello world')
  })

  it('should handle placeholders with spaces like {{ name }}', () => {
    expect(templateRender('hello {{ name }}', { name: 'world' })).toBe('hello world')
  })

  it('should leave placeholder intact when key is not in data', () => {
    expect(templateRender('hello {{name}}', {})).toBe('hello {{name}}')
  })

  it('should return empty string when template is empty', () => {
    expect(templateRender('', { name: 'world' })).toBe('')
  })
})