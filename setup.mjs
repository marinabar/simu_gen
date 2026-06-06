#!/usr/bin/env node
import { createInterface } from 'node:readline'
import { readFile, writeFile, access } from 'node:fs/promises'
import path from 'node:path'

const ENV_PATH = path.resolve('.env')
const ENV_EXAMPLE_PATH = path.resolve('.env.example')

const rl = createInterface({ input: process.stdin, output: process.stdout })

function ask(question) {
  return new Promise((resolve) => rl.question(question, resolve))
}

async function readEnvFile(filePath) {
  try {
    return await readFile(filePath, 'utf-8')
  } catch {
    return ''
  }
}

function parseEnv(content) {
  const values = {}
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim()
    if (!line || line.startsWith('#')) continue
    const equalsIndex = line.indexOf('=')
    if (equalsIndex === -1) continue
    const key = line.slice(0, equalsIndex).trim()
    let value = line.slice(equalsIndex + 1).trim()
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1)
    }
    if (key) values[key] = value
  }
  return values
}

async function main() {
  console.log('\n  simu_gen setup\n')

  const existing = parseEnv(await readEnvFile(ENV_PATH))

  const keys = [
    { key: 'WORLD_LABS_API_KEY', label: 'World Labs API key (for world generation)' },
    { key: 'REPLICATE_API_KEY', label: 'Replicate API key (for 3D object and image editing)' },
  ]

  const result = { ...existing }

  for (const { key, label } of keys) {
    const current = existing[key]
    const placeholder = current ? `[current: ${current.slice(0, 6)}...]` : '[not set]'
    const input = await ask(`  ${label} ${placeholder}\n  > `)
    const trimmed = input.trim()
    if (trimmed) result[key] = trimmed
    else if (!current) console.log(`  Warning: ${key} left empty`)
  }

  const lines = Object.entries(result)
    .map(([k, v]) => `${k}=${v}`)
    .join('\n')
  await writeFile(ENV_PATH, lines + '\n')

  console.log('\n  Saved to .env\n')
  rl.close()
}

main().catch((error) => {
  console.error(error.message)
  rl.close()
  process.exit(1)
})
