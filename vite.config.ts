import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

function normalizeBasePath(input: string): string {
  const withSlashes = `/${input.replace(/^\/+|\/+$/g, '')}/`
  return withSlashes === '//' ? '/' : withSlashes
}

function readEnv(name: string): string | undefined {
  const envSource = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env
  return envSource?.[name]
}

function resolveProductionBase(): string {
  const envBase = readEnv('VITE_BASE_PATH')

  if (envBase && envBase.trim().length > 0) {
    return normalizeBasePath(envBase)
  }

  const repository = readEnv('GITHUB_REPOSITORY')?.split('/')[1]

  if (!repository) {
    return '/'
  }

  if (repository.toLowerCase().slice(-10) === '.github.io') {
    return '/'
  }

  return normalizeBasePath(repository)
}

export default defineConfig(({ command }) => ({
  plugins: [react()],
  // Build base path is inferred from CI repository to avoid hardcoded project paths.
  base: command === 'build' ? resolveProductionBase() : '/',
  build: {
    cssCodeSplit: false,
    rollupOptions: {
      output: {
        entryFileNames: 'assets/index.js',
        chunkFileNames: 'assets/chunk-[hash].js',
        assetFileNames: (assetInfo) => {
          const assetName = assetInfo.name || ''

          if (assetName.slice(-4) === '.css') {
            return 'assets/index.css'
          }

          return 'assets/[name]-[hash][extname]'
        },
      },
    },
  },
  server: {
    host: '127.0.0.1',
    port: 5173,
    strictPort: true,
  },
}))
