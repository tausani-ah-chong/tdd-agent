export function fizzbuzz(n: number): string[] {
  const result: string[] = [];
  for (let i = 1; i <= n; i++) {
    result.push(String(i));
  }
  return result;
}