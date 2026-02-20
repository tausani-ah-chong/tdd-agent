import { describe, it, expect } from 'vitest';
import { fizzbuzz } from './solution';

describe('fizzbuzz', () => {
  it('returns empty array for n=0', () => {
    expect(fizzbuzz(0)).toEqual([]);
  });
  it('returns [1] for n=1', () => {
    expect(fizzbuzz(1)).toEqual(['1']);
  });
  it('returns Fizz for multiples of 3', () => {
    expect(fizzbuzz(3)[2]).toBe('Fizz');
  });
  it('returns Buzz for multiples of 5', () => {
    expect(fizzbuzz(5)[4]).toBe('Buzz');
  });
  it('returns FizzBuzz for multiples of 15', () => {
    expect(fizzbuzz(15)[14]).toBe('FizzBuzz');
  });
  it('returns correct array for n=15', () => {
    expect(fizzbuzz(15)).toEqual(['1','2','Fizz','4','Buzz','Fizz','7','8','Fizz','Buzz','11','Fizz','13','14','FizzBuzz']);
  });
});