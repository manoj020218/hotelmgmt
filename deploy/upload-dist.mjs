#!/usr/bin/env node
/**
 * Upload client/dist to the correct VPS directory.
 * Usage:  node deploy/upload-dist.mjs [admin|kds|waiter]   (default: admin)
 *
 * Reads VPS credentials from deploy/vps.env (gitignored).
 * Requires PuTTY pscp.exe installed on Windows.
 */
import { execSync }   from 'child_process'
import { existsSync } from 'fs'
import { readFileSync } from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')

// ── VPS targets ───────────────────────────────────────────────────────────────
const TARGETS = {
  admin:  '/var/www/hotel-admin',
  kds:    '/var/www/hotel-kds',
  waiter: '/var/www/hotel-waiter',
}

// ── Read credentials ──────────────────────────────────────────────────────────
function loadEnv(file) {
  if (!existsSync(file)) return {}
  return Object.fromEntries(
    readFileSync(file, 'utf8')
      .split('\n')
      .filter(l => l.includes('=') && !l.startsWith('#'))
      .map(l => l.split('=').map(s => s.trim()))
  )
}

const creds = loadEnv(path.join(__dirname, 'vps.env'))
const VPS_HOST = process.env.VPS_HOST ?? creds.VPS_HOST
const VPS_USER = process.env.VPS_USER ?? creds.VPS_USER
const VPS_PASS = process.env.VPS_PASS ?? creds.VPS_PASS

if (!VPS_HOST || !VPS_USER || !VPS_PASS) {
  console.error('[deploy] Missing VPS credentials. Create deploy/vps.env with VPS_HOST, VPS_USER, VPS_PASS.')
  process.exit(1)
}

// ── Find pscp ─────────────────────────────────────────────────────────────────
const PSCP_PATHS = [
  'C:\\Program Files\\PuTTY\\pscp.exe',
  'C:\\Program Files (x86)\\PuTTY\\pscp.exe',
  'pscp', // if on PATH
]

function findPscp() {
  for (const p of PSCP_PATHS) {
    if (p === 'pscp') {
      try { execSync('pscp --version 2>nul', { stdio: 'pipe' }); return 'pscp' } catch {}
    } else if (existsSync(p)) {
      return p
    }
  }
  return null
}

const pscp = findPscp()
if (!pscp) {
  console.error('[deploy] pscp not found. Install PuTTY from https://www.putty.org/')
  process.exit(1)
}

// ── Upload ────────────────────────────────────────────────────────────────────
const app    = process.argv[2] ?? 'admin'
const remote = TARGETS[app]
if (!remote) {
  console.error(`[deploy] Unknown target "${app}". Use: admin, kds, waiter`)
  process.exit(1)
}

const distPath = path.join(ROOT, 'client', 'dist')
if (!existsSync(distPath)) {
  console.error(`[deploy] dist not found at ${distPath}. Run pnpm build first.`)
  process.exit(1)
}

const dest = `${VPS_USER}@${VPS_HOST}:${remote}/`
console.log(`\n[deploy] Uploading ${app} → ${remote} ...`)

try {
  execSync(`"${pscp}" -pw "${VPS_PASS}" -r "${distPath}/." "${dest}"`, { stdio: 'inherit' })
  console.log(`[deploy] Done ✓  ${app} is live\n`)
} catch {
  console.error('[deploy] Upload failed.')
  process.exit(1)
}
