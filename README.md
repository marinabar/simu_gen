# simu_gen

generate interactive 3D environments from any image. drop a photo, get a physics-enabled scene you can walk through — gaussian splat background, textured 3D meshes, real-world scale. built for spinning up simulation environments to train policies against real-world visual distributions without needing a lab or a dataset.

## what it does

point it at any image — a port, a warehouse, a street corner, a living room — and it produces:

- a navigable 3D environment (gaussian splat, metric scale) from the scene background
- physics-enabled 3D mesh objects extracted from the image foreground
- an FPS/fly viewer you can drop into immediately

the objects have real-world size and mass estimates baked in, so physics behaves correctly relative to the environment. scene layout is saved as a json placement file you can version and replay.

## pipeline

```
image
  → scene analysis + object candidates        (VLM)
  → clean plate (objects removed)             (Replicate nano-banana)
  → 3D environment from plate                 (World Labs)
  → 3D mesh per object                        (Replicate hunyuan3d-2)
  → interactive scene                         (Spark / Three.js / Rapier)
```

each step is a script that blocks and writes to disk. no daemons, no queues. worlds live in `worlds/<slug>/`, outputs are indexed files you can inspect directly.

## setup

```bash
npm install
npm run setup       # prompts for api keys
npm run dev         # starts viewer at localhost:5173
```

requires:
- [World Labs](https://worldlabs.ai) api key — environment generation
- [Replicate](https://replicate.com) api key — 3D objects + image editing

## usage

drop an image into `input/`, then run the orchestrator prompts in order using an LLM (Claude, or any VLM):

```
orchestrator/uncover.md   → analyze image, extract object candidates
orchestrator/plate.md     → remove objects to create clean background
orchestrator/world.md     → generate 3D environment from plate
orchestrator/3d.md        → generate mesh per object
```

or one-shot the full pipeline by following `orchestrator/rules.md`.

generated assets land in `worlds/<slug>/output/`. the viewer hot-reloads as files appear on disk.

## scripts

```bash
node scripts/project/project-state.mjs --world <slug> --stage-input
node scripts/world/generate-world.mjs --world <slug> --prompt "<caption>"
node scripts/asset-pipeline/generate-single-asset.mjs --world <slug> --object-id <id> --image-edit-prompt "<prompt>"
node scripts/image-edit/generate-edit.mjs --image <path> --prompt "<prompt>" --output-dir <dir> --output-slug <slug>
node scripts/project/ensure-local-assets.mjs --from <world-json>
```

## viewer

```
top-left sidebar    world switcher / object list / FPS-fly toggle / HQ-LQ toggle / DoF settings
bottom-left bar     render mode (scene+objects / scene / objects) / mesh display (lit / wireframe)
```

objects have physics — you can pick them up and throw them around.

## structure

```
worlds/<slug>/
  project.json
  image.json              scene + object analysis
  source/                 input images + per-image analysis json
  output/
    world/                gaussian splat, collider mesh, panorama
    <object>/             reference image, glb mesh, object.json
input/                    drop images here to stage them
orchestrator/             llm prompt files for each pipeline step
scripts/                  generation scripts (node, no build step)
app/                      vite + react + three.js viewer
```
