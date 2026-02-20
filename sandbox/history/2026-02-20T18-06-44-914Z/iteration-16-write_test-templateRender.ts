export function templateRender(template: string, data: Record<string, string>): string {
  return template.replace(/\{\{\s*(\w+)\s*\}\}/g, (match, key) => key in data ? data[key] : match)
}