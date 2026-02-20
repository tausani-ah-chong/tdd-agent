import { describe, it, expect } from 'vitest'
import { templateRender } from './templateRender'

describe('templateRender', () => {
  it('should return the same string when there are no placeholders', () => {
    expect(templateRender('hello', {})).toBe('hello')
  })

  it('should replace a single placeholder with the corresponding value', () => {
    expect(templateRender('hello {{name}}', { name: 'world' })).toBe('hello world')
  })

  it('should replace multiple different placeholders', () => {
    expect(templateRender('{{greeting}} {{name}}', { greeting: 'hi', name: 'alice' })).toBe('hi alice')
  })
})