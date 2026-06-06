#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import path from "node:path";
import {
  downloadFile,
  ensureDir,
  loadDotEnv,
  requireEnv,
  writeJson
} from "./fal-queue.mjs";
import { buildRequestSummary, requestPath } from "./request-metadata.mjs";

export const REPLICATE_3D_PROVIDER = "replicate-hunyuan3d-3.1";
const MODEL_ID = "tencent/hunyuan-3d-3.1";
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
    prompt,
    outputDir,
    assetName,
    metadataPath,
    metadata = {},
    enablePbr = true,
    faceCount = 500000,
    generateType = "Normal",
  } = options;

  if (!image && !prompt) throw new Error("Either image or prompt is required.");
  if (image && prompt) throw new Error("Provide either image or prompt, not both.");
  if (!outputDir) throw new Error("outputDir is required.");

  await ensureDir(outputDir);

  const apiKey = await requireEnv("REPLICATE_API_KEY");
  const submittedAt = new Date().toISOString();

  const input = {
    enable_pbr: enablePbr,
    face_count: faceCount,
    generate_type: generateType,
  };
  if (image) input.image = await imageToDataUri(image);
  if (prompt) input.prompt = prompt;

  const submitRes = await fetch(`${API_BASE}/models/${MODEL_ID}/predictions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ input })
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

  // Hunyuan3D-3.1 returns a single string URI
  const outputUrl = typeof completed.output === "string" ? completed.output : null;
  if (!outputUrl) throw new Error("Replicate returned no output file.");
  const outputUrls = [outputUrl];

  const ext = path.extname(new URL(outputUrl).pathname) || ".glb";
  const fileName = `${assetName || "model"}${ext}`;
  const outputPath = path.join(outputDir, fileName);
  await downloadFile(outputUrl, outputPath);
  const downloaded = [{ label: "glb", path: outputPath, source: { url: outputUrl, content_type: "model/gltf-binary" } }];

  const summary = buildRequestSummary({
    kind: "3d",
    provider: REPLICATE_3D_PROVIDER,
    endpoint: REPLICATE_3D_PROVIDER,
    metadata,
    requestId: prediction.id,
    submittedAt,
    inputFiles: image ? [image] : [],
    outputFiles: downloaded.map((f) => f.path),
    downloadedFiles: downloaded,
    result: { output: outputUrls }
  });

  await writeJson(finalMeta, summary);
  return summary;
}
