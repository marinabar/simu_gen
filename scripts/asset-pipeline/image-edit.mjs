#!/usr/bin/env node
import { runReplicateNanaBananaEdit } from './replicate-nano-banana-edit.mjs'
import { loadDotEnv, many, one, parseArgs } from './fal-queue.mjs'
import { requestPath } from './request-metadata.mjs'

export async function runImageEdit(options) {
  await loadDotEnv()
  const summary = await runReplicateNanaBananaEdit({
    ...options,
    metadataPath: options.metadataPath || requestPath(options.outputDir, 0, 'image-edit'),
    resolution: options.resolution || '1K',
    aspectRatio: options.aspectRatio || 'auto',
  })
  return { ...summary, provider_alias: 'replicate-nano-banana' }
}

async function main() {
  const { flags } = parseArgs()
  const images = [...many(flags, 'image'), ...many(flags, 'input-image')]
  const prompt = one(flags, 'prompt')
  const outputDir = one(flags, 'output-dir')

  if (!prompt || !outputDir || images.length === 0) {
    throw new Error(
      'Usage: node image-edit.mjs --image <path-or-url> --prompt <prompt> --output-dir <dir>',
    )
  }

  const summary = await runImageEdit({
    prompt,
    images,
    outputDir,
    numImages: one(flags, 'num-images', 1),
    outputFormat: one(flags, 'format', 'png'),
    resolution: one(flags, 'resolution', '1K'),
    aspectRatio: one(flags, 'aspect-ratio', 'auto'),
    seed: one(flags, 'seed'),
  })

  console.log(JSON.stringify(summary, null, 2))
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error(error.message)
    process.exit(1)
  })
}
