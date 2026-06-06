#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import path from "node:path";
import {
  downloadRemoteFiles,
  ensureDir,
  loadDotEnv,
  requireEnv,
  writeJson
} from "./fal-queue.mjs";
import { buildRequestSummary, requestPath } from "./request-metadata.mjs";

export const REPLICATE_3D_PROVIDER = "replicate-hunyuan3d-2";
const MODEL_VERSION = "b1b9449a1277e10402781c5d41eb30c0a0683504fb23fab591ca9dfc2aabe1cb";
const API_BASE = "https://api.replicate.com/v1";
const POLL_INTERVAL_MS = 8000;

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
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" }
    });
    const prediction = await res.json();
    const status = prediction.status;
    process.stderr.write(`replicate status: ${status}\n`);
    if (status === "succeeded") return prediction;
    if (status === "failed" || status === "canceled") {
      throw new Error(`Replicate prediction ${status}: ${prediction.error || "unknown error"}`);
    }
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
  }
}

export async function runReplicate3D(options) {
  await loadDotEnv();
  const {
    image,
    outputDir,
    assetName,
    metadataPath,
    metadata = {},
    steps = 50,
    guidanceScale = 5.5,
    octreeResolution = 256,
    removeBackground = true,
    seed
  } = options;

  if (!image) throw new Error("Input image is required.");
  if (!outputDir) throw new Error("outputDir is required.");

  await ensureDir(outputDir);

  const apiKey = await requireEnv("REPLICATE_API_KEY");
  const submittedAt = new Date().toISOString();

  const imageDataUri = await imageToDataUri(image);

  const input = {
    image: imageDataUri,
    steps,
    guidance_scale: guidanceScale,
    octree_resolution: octreeResolution,
    remove_background: removeBackground
  };
  if (seed !== undefined) input.seed = seed;

  const submitRes = await fetch(`${API_BASE}/predictions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ version: MODEL_VERSION, input })
  });

  if (!submitRes.ok) {
    const err = await submitRes.text();
    throw new Error(`Replicate submit failed (${submitRes.status}): ${err}`);
  }

  const prediction = await submitRes.json();
  const predictionUrl = prediction.urls?.get;
  if (!predictionUrl) throw new Error("Replicate did not return a polling URL.");

  process.stderr.write(`replicate prediction id: ${prediction.id}\n`);

  const finalMeta = metadataPath || requestPath(outputDir, 0, assetName || "model");
  await writeJson(finalMeta, {
    ...metadata,
    kind: "3d",
    provider: REPLICATE_3D_PROVIDER,
    request_id: prediction.id,
    prediction_url: predictionUrl,
    submitted_at: submittedAt
  });

  const completed = await pollPrediction(predictionUrl, apiKey);

  // Hunyuan3D-2 on Replicate returns output as array of objects with {mesh, textures} or flat URLs
  let outputUrls = [];
  if (Array.isArray(completed.output)) {
    for (const item of completed.output) {
      if (typeof item === "string") outputUrls.push(item);
      else if (item?.mesh) outputUrls.push(item.mesh);
    }
  } else if (completed.output) {
    outputUrls = [completed.output];
  }

  if (!outputUrls.length) throw new Error("Replicate returned no output files.");

  const fakeResult = { data: { glb: outputUrls[0], files: outputUrls } };
  const downloaded = await downloadRemoteFiles(fakeResult.data, outputDir, assetName || "model");

  const summary = buildRequestSummary({
    kind: "3d",
    provider: REPLICATE_3D_PROVIDER,
    endpoint: REPLICATE_3D_PROVIDER,
    metadata,
    requestId: prediction.id,
    submittedAt,
    inputFiles: [image],
    outputFiles: downloaded.map((f) => f.path),
    downloadedFiles: downloaded,
    result: { output: outputUrls }
  });

  await writeJson(finalMeta, summary);
  return summary;
}
