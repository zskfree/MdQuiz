import fs from 'node:fs/promises'
import path from 'node:path'
import { spawn } from 'node:child_process'

const projectRoot = process.cwd()
const sourceIndexPath = path.join(projectRoot, 'index.html')
const buildIndexPath = path.join(projectRoot, 'index.vite.html')
const viteCliPath = path.join(projectRoot, 'node_modules', 'vite', 'bin', 'vite.js')

function run(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: projectRoot,
      env: {
        ...process.env,
        VITE_BASE_PATH: '/',
      },
      stdio: 'inherit',
      shell: false,
    })

    child.on('error', reject)
    child.on('exit', (code) => {
      if (code === 0) {
        resolve()
        return
      }

      reject(new Error(`Command failed: ${command} ${args.join(' ')}`))
    })
  })
}

async function main() {
  const originalIndexHtml = await fs.readFile(sourceIndexPath, 'utf8')
  const buildIndexHtml = await fs.readFile(buildIndexPath, 'utf8')

  try {
    await fs.writeFile(sourceIndexPath, buildIndexHtml, 'utf8')
    await run(process.execPath, [viteCliPath, 'build', '--config', 'vite.config.ts'])
  } finally {
    await fs.writeFile(sourceIndexPath, originalIndexHtml, 'utf8')
  }
}

await main()
