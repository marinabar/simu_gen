# SIMU_GEN

Image-to-3D-interactive-world pipeline using World Labs (world gen) and Replicate (3D objects + image editing).

## Setup

Run `npm run setup` to set API keys, or copy `.env.example` to `.env` and fill in manually.

## Directory Layout

```
worlds/
  <world-slug>/
    project.json
    scene.json
    image.json
    source/
      0-<slug>.<ext>
      <image>.json
    output/
      world/
      <object>/
        object.json

input/
```

`scene.json` holds editor placement state. `source/` holds stable source files and per-image analysis. `output` holds generated files and request metadata.

Generated assets are disk-first: provider URLs in JSON are provenance and resume metadata only; the frontend loads local `/worlds/...` files.

## Indexed Files

```text
N-slug.ext
.N-slug-request.json
```

- `N` is the generation index. `0` is the source/original.
- Hidden request JSON sits beside the file it generated.
- Inspect generated state with `ls -a <directory>`.

## Skill Invocation

Every generation request must use `Agent` with `run_in_background: true`.

## Order of Operations

1. Inspect project state and `input/`.
2. Initialize project with slug, stage inputs.
3. Start `npm run dev` if not running. Open `http://localhost:5173/<slug>`.
4. Analyze source image (see `orchestrator/uncover.md`).
5. Confirm objects, write `object.json` per object. Run plate generation (see `orchestrator/plate.md`).
6. Generate world from newest source image (see `orchestrator/world.md`).
7. Generate one 3D object per confirmed object (see `orchestrator/3d.md`).
8. Report final project state and viewer URL.

## Generation Scripts

All scripts block until complete. Run directly, never in background or with tail -f.

```bash
node scripts/project/project-state.mjs --world "<slug>" --stage-input
node scripts/world/generate-world.mjs --world "<slug>" --prompt "<caption>"
node scripts/asset-pipeline/generate-single-asset.mjs --world "<slug>" --object-id "<id>" --image-edit-prompt "<prompt>"
node scripts/image-edit/generate-edit.mjs --image "<path>" --prompt "<prompt>" --output-dir "<dir>" --output-slug "<slug>"
node scripts/project/ensure-local-assets.mjs --from "<world-json>"
```
