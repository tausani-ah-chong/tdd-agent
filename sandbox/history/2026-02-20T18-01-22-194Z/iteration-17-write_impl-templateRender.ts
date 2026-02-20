export function templateRender(template: string, data: Record<string, any>): string {
  return template.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (match, key) => {
    const value = key.split('.').reduce((obj: any, k: string) => obj && obj[k], data)
    return value !== undefined ? value : match
  })
}