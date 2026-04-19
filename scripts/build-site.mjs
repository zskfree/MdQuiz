import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const projectRoot = process.cwd()
const viteCliPath = fileURLToPath(new URL('../node_modules/vite/bin/vite.js', import.meta.url))

function run(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: projectRoot,
      stdio: 'inherit',
      shell: false,
    })

    child.on('error', reject)
    child.on('exit', (code) => {
      if (code === 0) {
        resolve()
        return
      }

      reject(new Error(`命令执行失败: ${command} ${args.join(' ')}`))
    })
  })
}

async function main() {
  await run(process.execPath, [viteCliPath, 'build', '--config', 'vite.config.ts'])
}

await main()
