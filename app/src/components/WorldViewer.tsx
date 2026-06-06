import { Component, Suspense, useRef, useEffect, type ReactNode } from 'react'
import { Canvas } from '@react-three/fiber'
import { Physics } from '@react-three/rapier'
import { SplatRenderer } from '../modules/splat/SplatRenderer'
import { EnvironmentMap } from '../modules/environment/EnvironmentMap'
import { WorldCollider } from '../modules/collider/WorldCollider'
import { GroundPlane } from '../modules/collider/GroundPlane'
import { CharacterController, type CharacterControllerHandle } from '../modules/character/CharacterController'
import { FlyController, type FlyControllerHandle } from '../modules/character/FlyController'
import { ObjectGrid } from '../modules/scene/ObjectGrid'
import { OriginHelper } from '../modules/scene/OriginHelper'
import { DEFAULT_SHADOW_CATCHER_COLOR, DEFAULT_SHADOW_CATCHER_OPACITY, shadowCatcherColor, shadowCatcherOpacity } from '../modules/scene/shadows'
import { getSplatUrl } from '../utils/worldLoader'
import { useDebugStore } from '../store/debug'
import {
  WorldRenderMode,
  ObjectRenderMode,
  ViewerQuality,
  type Vec3Tuple,
  type World,
  type WorldObjectAsset,
  type WorldSceneProject,
} from '../types/world'

type CharHandle = CharacterControllerHandle | FlyControllerHandle

const DEFAULT_ENVIRONMENT_URL = '/hdri.jpg'
const DEFAULT_WORLD_SEMANTICS = { metric_scale_factor: 1, ground_plane_offset: 0, flip_y: true }

function sunPositionFromRotation(rotation: Vec3Tuple): Vec3Tuple {
  let x = 0, y = 10, z = 0
  const [rx, ry, rz] = rotation
  const cx = Math.cos(rx), sx = Math.sin(rx)
  const cy = Math.cos(ry), sy = Math.sin(ry)
  const cz = Math.cos(rz), sz = Math.sin(rz)
  ;[y, z] = [y * cx - z * sx, y * sx + z * cx]
  ;[x, z] = [x * cy + z * sy, -x * sy + z * cy]
  ;[x, y] = [x * cz - y * sz, x * sz + y * cz]
  return [x, y, z]
}

class OptionalAssetBoundary extends Component<
  { label: string; resetKey: string; fallback?: ReactNode; children: ReactNode },
  { hasError: boolean }
> {
  state = { hasError: false }
  static getDerivedStateFromError() { return { hasError: true } }
  componentDidCatch(error: unknown) {
    console.warn(`Skipping optional world asset "${this.props.label}" because it failed to load.`, error)
  }
  componentDidUpdate(prevProps: { resetKey: string }) {
    if (prevProps.resetKey !== this.props.resetKey && this.state.hasError) this.setState({ hasError: false })
  }
  render() {
    if (this.state.hasError) return this.props.fallback ?? null
    return this.props.children
  }
}

function DefaultEnvironment({ intensity }: { intensity: number }) {
  return (
    <OptionalAssetBoundary label={DEFAULT_ENVIRONMENT_URL} resetKey={DEFAULT_ENVIRONMENT_URL} fallback={
      <><color attach="background" args={['#6b7280']} /><ambientLight color="#ffffff" intensity={0.9} /></>
    }>
      <Suspense fallback={null}>
        <EnvironmentMap panoUrl={DEFAULT_ENVIRONMENT_URL} intensity={intensity} />
      </Suspense>
    </OptionalAssetBoundary>
  )
}

interface Props {
  world?: World
  slug: string
  objectAssets: WorldObjectAsset[]
  allObjectAssets: WorldObjectAsset[]
  sceneProject?: WorldSceneProject
  sceneProjectReady?: boolean
  onSceneProjectSaved?: (project: WorldSceneProject) => void
  onRefreshWorlds?: () => void
  refreshingWorlds?: boolean
}

export function WorldViewer({
  world,
  slug,
  objectAssets,
  allObjectAssets,
  sceneProject,
  sceneProjectReady: _sceneProjectReady = true,
  onSceneProjectSaved: _onSceneProjectSaved,
  onRefreshWorlds: _onRefreshWorlds,
  refreshingWorlds: _refreshingWorlds = false,
}: Props) {
  const charRef = useRef<CharHandle>(null)
  const worldRenderMode = useDebugStore((s) => s.worldRenderMode)
  const objectRenderMode = useDebugStore((s) => s.objectRenderMode)
  const viewerQuality = useDebugStore((s) => s.viewerQuality)
  const controllerMode = useDebugStore((s) => s.controllerMode)
  const controllerResetToken = useDebugStore((s) => s.controllerResetToken)
  const environmentIntensity = useDebugStore((s) => s.environmentIntensity)
  const sunIntensity = useDebugStore((s) => s.sunIntensity)
  const sunColor = useDebugStore((s) => s.sunColor)

  const colliderUrl = world?.assets.mesh.collider_mesh_url.startsWith('/worlds/') ? world.assets.mesh.collider_mesh_url : ''
  const panoUrl = world?.assets.imagery.pano_url.startsWith('/worlds/') ? world.assets.imagery.pano_url : ''

  useEffect(() => { charRef.current?.reset() }, [slug])
  useEffect(() => { if (controllerResetToken > 0) charRef.current?.reset() }, [controllerResetToken])

  const splatUrl = world ? getSplatUrl(world) : ''
  const { ground_plane_offset, flip_y, metric_scale_factor } = world?.assets.splats.semantics_metadata ?? DEFAULT_WORLD_SEMANTICS
  const flipY = flip_y ?? true
  const metricScaleFactor = sceneProject?.metricScaleFactor ?? metric_scale_factor ?? 1
  const groundPlaneOffset = sceneProject?.groundPlaneOffset ?? (ground_plane_offset ?? 0) * (metricScaleFactor / (metric_scale_factor ?? 1))
  const groundPlaneColliderEnabled = worldRenderMode === WorldRenderMode.ObjectOnly ? true : (sceneProject?.groundPlaneColliderEnabled ?? true)
  const activeShadowCatcherOpacity = shadowCatcherOpacity(sceneProject?.shadowCatcherOpacity ?? DEFAULT_SHADOW_CATCHER_OPACITY)
  const activeShadowCatcherColor = shadowCatcherColor(sceneProject?.shadowCatcherColor ?? DEFAULT_SHADOW_CATCHER_COLOR)
  const activeSceneSun = sceneProject?.sun
  const activeSunIntensity = activeSceneSun?.intensity ?? sunIntensity
  const activeEnvironmentIntensity = activeSceneSun?.environmentIntensity ?? environmentIntensity
  const activeSunPosition = sunPositionFromRotation(activeSceneSun?.rotation ?? [0, 0, 0])
  const isHighQuality = viewerQuality === ViewerQuality.High
  const showScene = worldRenderMode !== WorldRenderMode.ObjectOnly
  const showSplat = showScene && objectRenderMode === ObjectRenderMode.Lit
  const showObjects = worldRenderMode !== WorldRenderMode.SplatOnly
  const objectPlacements = sceneProject?.instances
  const objectPhysicsAssets = sceneProject?.instances.length ? allObjectAssets : objectAssets

  return (
    <Canvas
      camera={{ fov: 75, near: 0.1, far: 1000 }}
      className="w-full h-full"
      gl={{ antialias: false }}
      shadows={isHighQuality}
    >
      <Suspense fallback={null}>
        <Physics key={`${slug}:${controllerResetToken}`} gravity={[0, -9.81, 0]}>
          {controllerMode === 'fly' ? (
            <FlyController ref={charRef as React.RefObject<FlyControllerHandle>} />
          ) : (
            <CharacterController ref={charRef as React.RefObject<CharacterControllerHandle>} />
          )}
          {showScene && colliderUrl && (
            <OptionalAssetBoundary label={colliderUrl} resetKey={colliderUrl}>
              <Suspense fallback={null}>
                <WorldCollider
                  url={colliderUrl}
                  flipY={flipY}
                  groundPlaneOffset={groundPlaneOffset}
                  metricScaleFactor={metricScaleFactor}
                  shadowOpacity={activeShadowCatcherOpacity}
                  shadowColor={activeShadowCatcherColor}
                />
              </Suspense>
            </OptionalAssetBoundary>
          )}
          {showObjects && (
            <Suspense fallback={null}>
              <ObjectGrid objects={objectPhysicsAssets} placements={objectPlacements} />
            </Suspense>
          )}
          <GroundPlane groundColliderEnabled={groundPlaneColliderEnabled} />
        </Physics>
        {splatUrl && (
          <OptionalAssetBoundary label={splatUrl} resetKey={splatUrl}>
            <SplatRenderer
              url={splatUrl}
              visible={showSplat}
              groundPlaneOffset={groundPlaneOffset}
              flipY={flipY}
              metricScaleFactor={metricScaleFactor}
            />
          </OptionalAssetBoundary>
        )}
        <directionalLight
          castShadow={isHighQuality && activeSunIntensity > 0}
          color={sunColor}
          intensity={activeSunIntensity}
          position={activeSunPosition}
          shadow-mapSize={[2048, 2048]}
          shadow-bias={-0.0001}
          shadow-normalBias={0.02}
          shadow-camera-near={0.5}
          shadow-camera-far={30}
          shadow-camera-left={-20}
          shadow-camera-right={20}
          shadow-camera-top={20}
          shadow-camera-bottom={-20}
        />
        {panoUrl ? (
          <OptionalAssetBoundary label={panoUrl} resetKey={panoUrl} fallback={<DefaultEnvironment intensity={activeEnvironmentIntensity} />}>
            <Suspense fallback={null}>
              <EnvironmentMap panoUrl={panoUrl} intensity={activeEnvironmentIntensity} />
            </Suspense>
          </OptionalAssetBoundary>
        ) : (
          <DefaultEnvironment intensity={activeEnvironmentIntensity} />
        )}
        <OriginHelper />
      </Suspense>
    </Canvas>
  )
}
