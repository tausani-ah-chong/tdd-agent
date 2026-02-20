export function fizzbuzz(n: number): string[] {
  const result: string[] = [];
  for (let i = 1; i <= n; i++) {
    if (i % 3 === 0) {
      result.push('Fizz');
    } else {
      result.push(String(i));
    }
  }
  return result;
}