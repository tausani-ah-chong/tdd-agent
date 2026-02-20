import { describe, it, expect } from 'vitest'
import { templateRender } from './templateRender'

describe('templateRender', () => {
  it('should return the same string when there are no placeholders', () => {
    expect(templateRender('hello', {})).toBe('hello')
  })

  it('should replace a single placeholder with the corresponding value', () => {
    expect(templateRender('hello {{name}}', { name: 'world' })).toBe('hello world')
  })

  it('should handle placeholders with spaces inside the braces', () => {
    expect(templateRender('hello {{ name }}', { name: 'world' })).toBe('hello world')
  })

  it('should leave placeholder as-is when key is not found in data', () => {
    expect(templateRender('hello {{name}}', {})).toBe('hello {{name}}')
  })

  it('should handle dot notation for nested object access', () => {
    expect(templateRender('hello {{person.name}}', { person: { name: 'alice' } })).toBe('hello alice')
  })

  it('should handle falsy values like 0 correctly', () => {
    expect(templateRender('count is {{count}}', { count: 0 })).toBe('count is 0')
  })
})