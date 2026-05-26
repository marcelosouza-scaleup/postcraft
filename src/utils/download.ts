export function downloadImage(dataUrl: string, filename: string): void {
  const a = document.createElement('a')
  a.href = dataUrl
  a.download = `${filename.slice(0, 50).replace(/\s+/g, '-')}.jpg`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
}
