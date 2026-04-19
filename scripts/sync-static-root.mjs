import fs from 'node:fs/promises'
import path from 'node:path'

const projectRoot = process.cwd()
const distRoot = path.join(projectRoot, 'dist')

async function replaceDirectory(relativeSource, relativeTarget) {
  const sourcePath = path.join(distRoot, relativeSource)
  const targetPath = path.join(projectRoot, relativeTarget)

  await fs.rm(targetPath, { recursive: true, force: true })
  await fs.cp(sourcePath, targetPath, { recursive: true, force: true })
}

async function main() {
  await replaceDirectory('assets', 'assets')
  await replaceDirectory('builtin-library', 'builtin-library')
  await fs.copyFile(path.join(projectRoot, 'index.html'), path.join(projectRoot, '404.html'))

  console.log('根目录静态资源同步完成：assets/, builtin-library/, 404.html')
}

await main()
