#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import path from "node:path";
import {
  ensureDir,
  loadDotEnv,
  requireEnv,
  writeJson
} from "./fal-queue.mjs";
import { buildRequestSummary, requestPath, nextIndex } from "./request-metadata.mjs";
import { writeFile } from "node:fs/promises";

const PROVIDER = "replicate/nano-banana-2";
const MODEL = "google/nano-banana-2";
const VERSION = "71516450bdbeafc41df33ad538bc8cc6a90f80038a563b1260531c02d694f4fd";
const API_BASE = "https://api.replicate.com/v1";
const POLL_INTERVAL_MS = 4000;

async function imageToDataUri(imagePath) {
  const ext = path.extname(imagePath).toLowerCase();
  const mimeTypes = { ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp" };
  const mimeType = mimeTypes[ext] || "image/png";
  const data = await readFile(imagePath);
  return `data:${mimeType};base64,${data.toString("base64")}`;
}

async function pollPrediction(predictionUrl, apiKey) {
  while (true) {
    const res = await fetch(predictionUrl, {
      headers: { Authorization: `Bearer ${apiKey}` }
    });
    const p = await res.json();
    process.stderr.write(`nano-banana replicate status: ${p.status}\n`);
    if (p.status === "succeeded") return p;
    if (p.status === "failed" || p.status === "canceled") {
      throw new Error(`Replicate prediction ${p.status}: ${p.error || "unknown error"}`);
    }
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
  }
}

export async function runReplicateNanaBananaEdit(options) {
  await loadDotEnv();
  const {
    prompt,
    images,
    outputDir,
    outputFormat = "png",
    resolution = "1K",
    aspectRatio = "auto",
    metadataPath,
    metadata = {}
  } = options;

  if (!prompt) throw new Error("Prompt is required.");
  if (!images?.length) throw new Error("At least one input image is required.");
  if (!outputDir) throw new Error("outputDir is required.");

  await ensureDir(outputDir);

  const apiKey = await requireEnv("REPLICATE_API_KEY");
  const submittedAt = new Date().toISOString();

  const imageDataUri = await imageToDataUri(images[0]);

  const input = {
    prompt,
    image_input: [imageDataUri],
    resolution,
    aspect_ratio: aspectRatio,
    output_format: outputFormat
  };

  const submitRes = await fetch(`${API_BASE}/predictions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ version: VERSION, input })
  });

  if (!submitRes.ok) {
    const err = await submitRes.text();
    throw new Error(`Replicate nano-banana submit failed (${submitRes.status}): ${err}`);
  }

  const prediction = await submitRes.json();
  const predictionUrl = prediction.urls?.get;
  if (!predictionUrl) throw new Error("Replicate did not return a polling URL.");

  process.stderr.write(`nano-banana prediction id: ${prediction.id}\n`);

  const index = await nextIndex(outputDir);
  const finalMeta = metadataPath || requestPath(outputDir, index, "nano-banana");
  await writeJson(finalMeta, {
    ...metadata, kind: "2d", provider: PROVIDER, request_id: prediction.id,
    prediction_url: predictionUrl, submitted_at: submittedAt
  });

  const completed = await pollPrediction(predictionUrl, apiKey);
  const outputUrl = Array.isArray(completed.output) ? completed.output[0] : completed.output;
  if (!outputUrl) throw new Error("Replicate nano-banana returned no output.");

  const outputPath = path.join(outputDir, `${index}-nano-banana.${outputFormat}`);
  const imgRes = await fetch(outputUrl);
  await writeFile(outputPath, Buffer.from(await imgRes.arrayBuffer()));

  const downloadedFiles = [{ path: outputPath, source: { content_type: `image/${outputFormat}` } }];
  const summary = buildRequestSummary({
    kind: "2d",
    provider: PROVIDER,
    endpoint: PROVIDER,
    metadata,
    requestId: prediction.id,
    submittedAt,
    prompt,
    inputFiles: images,
    outputFiles: [outputPath],
    downloadedFiles,
    result: { output: outputUrl }
  });

  await writeJson(finalMeta, summary);
  return { ...summary, downloaded_files: downloadedFiles };
}
