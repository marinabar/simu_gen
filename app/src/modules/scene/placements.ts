import type { WorldObjectAsset, WorldObjectPlacement } from '../../types/world'
import { CHARACTER_SPAWN } from '../character/spawn'

// Objects are sized in real-world meters, so spacing must scale with each
// object's footprint (a 366 m ship vs a 2.6 m container). A fixed grid would
// pile metric-scaled objects on top of each other and bury the spawn point.
const FALLBACK_FOOTPRINT_M = 2 // assumed footprint when an object has no size estimate
const OBJECT_GAP_M = 6 // clear space between neighboring objects
const SPAWN_FRONT_CLEARANCE_M = 8 // clear walkable space ahead of the player

function footprintOf(object: WorldObjectAsset): number {
  return Math.max(
    object.realWorldFootprintM ?? object.realWorldHeightM ?? FALLBACK_FOOTPRINT_M,
    FALLBACK_FOOTPRINT_M,
  )
}

// Lay objects out in a single row in front of the spawn, spaced by footprint so
// nothing overlaps and the spawn point stays clear (the player can always move).
export function createDefaultPlacements(objects: WorldObjectAsset[]): WorldObjectPlacement[] {
  const footprints = objects.map(footprintOf)
  const maxFootprint = footprints.reduce((max, f) => Math.max(max, f), FALLBACK_FOOTPRINT_M)
  const totalWidth =
    footprints.reduce((sum, f) => sum + f, 0) + OBJECT_GAP_M * Math.max(0, objects.length - 1)
  // Push the row far enough ahead that even the deepest object clears the spawn.
  const rowZ = CHARACTER_SPAWN.z - SPAWN_FRONT_CLEARANCE_M - maxFootprint / 2

  let cursorX = -totalWidth / 2
  return objects.map((object, index) => {
    const footprint = footprints[index]
    const x = cursorX + footprint / 2
    cursorX += footprint + OBJECT_GAP_M
    return {
      instanceId: object.id,
      objectId: object.id,
      assetId: object.assetId,
      physics: 'rigidbody',
      position: [x, 0, rowZ],
      rotation: [0, 0, 0],
      scale: [1, 1, 1],
    }
  })
}

export function getInitialPlacements(
  objects: WorldObjectAsset[],
  savedPlacements?: WorldObjectPlacement[],
): WorldObjectPlacement[] {
  return savedPlacements ?? createDefaultPlacements(objects)
}
