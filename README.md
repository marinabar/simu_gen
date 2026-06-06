# simu_gen

**simu_gen** is a pipeline for constructing interactive 3D simulation environments from single monocular images. Given an input photograph, the system produces a navigable, physics-enabled scene consisting of a gaussian splat background reconstructed at metric scale and a set of textured 3D mesh objects with estimated real-world dimensions and mass. The resulting environments are intended for use in embodied agent research, policy evaluation, and sim-to-real transfer experiments.

## Overview

Existing simulation environments require either manual asset authoring or curated 3D datasets. simu_gen removes this requirement by operating directly on in-the-wild images. A vision-language model identifies and segments foreground objects; generative models reconstruct the background environment and synthesize per-object meshes; and a physics engine assembles the scene with plausible object placement and collision geometry. The output is a self-contained world directory that can be loaded into the interactive viewer or consumed programmatically.

## Pipeline

```
input image
  ├── scene analysis + object extraction         (VLM)
  ├── inpainting: object removal / clean plate   (Replicate nano-banana)
  ├── 3D environment reconstruction              (World Labs)
  └── per-object mesh synthesis                  (Replicate hunyuan3d-2)
          ↓
  interactive scene (Spark / Three.js / Rapier physics)
```

Each stage is an independent script that writes versioned artifacts to disk. Outputs are indexed files (`N-slug.ext`) with accompanying request metadata, enabling resumption and inspection at each step.

## Requirements

- Node.js 18+
- [World Labs](https://worldlabs.ai) API key — gaussian splat environment generation
- [Replicate](https://replicate.com) API key — mesh synthesis and image editing

## Installation

```bash
npm install
npm run setup    # interactive prompt for API keys
npm run dev      # viewer at http://localhost:5173
```

## Usage

Place an input image in `input/` and invoke the orchestrator prompts sequentially using any VLM:

| Prompt | Stage |
|--------|-------|
| `orchestrator/uncover.md` | image analysis, object candidate extraction, size estimation |
| `orchestrator/plate.md` | inpaint foreground objects to produce a clean background plate |
| `orchestrator/world.md` | reconstruct 3D environment from the clean plate |
| `orchestrator/3d.md` | synthesize a textured mesh for each confirmed object |

The full pipeline can be executed in one shot by following `orchestrator/rules.md`. Generated assets are written to `worlds/<slug>/output/` and the viewer reflects changes on disk in real time.

Individual stages can also be invoked directly:

```bash
node scripts/project/project-state.mjs --world <slug> --stage-input
node scripts/world/generate-world.mjs --world <slug> --prompt "<scene description>"
node scripts/asset-pipeline/generate-single-asset.mjs --world <slug> --object-id <id> --image-edit-prompt "<prompt>"
node scripts/image-edit/generate-edit.mjs --image <path> --prompt "<prompt>" --output-dir <dir> --output-slug <slug>
node scripts/project/ensure-local-assets.mjs --from <world-json>
```

## Viewer

The interactive viewer supports first-person and fly navigation with Rapier rigid-body physics. Object meshes are scaled to estimated real-world dimensions and assigned physics mass accordingly.

```
top-left     world list / object list / navigation mode / quality / depth-of-field controls
bottom-left  render mode (combined / splat only / objects only) / mesh shading (lit / wireframe)
```

## Repository Structure

```
worlds/<slug>/
  project.json            project metadata
  image.json              scene and object analysis
  source/                 input images and per-image VLM analysis
  output/
    world/                gaussian splat (.spz), collision mesh (.glb), panorama
    <object>/             reference image, mesh (.glb), object.json (identity + size estimates)
input/                    staging directory for input images
orchestrator/             VLM prompt files for each pipeline stage
scripts/                  generation and project management scripts
app/                      Vite + React + Three.js viewer
```

## Object Representation

Each object is described by an `object.json` file containing identity, source provenance, and physical estimates:

```json
{
  "object": {
    "id": "<slug>",
    "name": "<name>",
    "description": "<literal description>",
    "estimated_size_m": { "height": 0.0, "width": 0.0, "length": 0.0 },
    "estimated_mass_kg": 0.0,
    "source_images": [],
    "evidence": []
  }
}
```

Size estimates are used at render time to scale meshes to metric world space and to compute rigid-body mass for the physics simulation.
