import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef } from 'react'
import { ThreeEvent, useFrame } from '@react-three/fiber'
import { CuboidCollider, RigidBody, type RapierRigidBody } from '@react-three/rapier'
import * as THREE from 'three'
import { ObjectRenderMode, type WorldObjectAsset, type WorldObjectPhysics } from '../../types/world'
import { useSceneObjectVisual } from './useSceneObjectVisual'

export const OBJECT_SCALE = 0.5
const MIN_METRIC_SCALE = 0.02
const MAX_METRIC_SCALE = 200
const OBJECT_AUTO_ROTATE_Y_SPEED = 0.35

export function resolveObjectScale(realWorldHeightM: number | undefined, boundsHeight: number): number {
  if (realWorldHeightM === undefined || boundsHeight <= 0) return OBJECT_SCALE
  return THREE.MathUtils.clamp(realWorldHeightM / boundsHeight, MIN_METRIC_SCALE, MAX_METRIC_SCALE)
}

const COLLIDER_WIREFRAME_COLOR = 0x00aaff

type PointerHandler = (event: ThreeEvent<PointerEvent>) => boolean
type HoverHandler = (event: ThreeEvent<PointerEvent>, objectId: string, hovering: boolean) => void
type ClickHandler = (worldPos: THREE.Vector3) => void

const _rotation = new THREE.Quaternion()
export const SCENE_OBJECT_INSTANCE_ID_KEY = 'sceneObjectInstanceId'

export interface SceneObjectHandle {
  id: string
  rigidBody: RapierRigidBody | null
  initialPosition: THREE.Vector3
  initialRotation: THREE.Quaternion
  bounds: THREE.Box3
  getFocusPoint: (target: THREE.Vector3) => THREE.Vector3
  playInteractionSfx: () => void
}

interface Props {
  object: WorldObjectAsset
  position: [number, number, number]
  rotation?: [number, number, number]
  scale?: [number, number, number]
  physics?: WorldObjectPhysics
  renderMode: ObjectRenderMode
  autoRotateY?: boolean
  onHover: HoverHandler
  onClick?: ClickHandler
  onPointerDown?: PointerHandler
  onPointerMove?: PointerHandler
  onPointerUp?: PointerHandler
  onPointerCancel?: PointerHandler
}

export const SceneObject = forwardRef<SceneObjectHandle, Props>(function SceneObject(
  {
    object,
    position,
    rotation = [0, 0, 0],
    scale = [1, 1, 1],
    physics = 'rigidbody',
    renderMode,
    autoRotateY = false,
    onHover,
    onClick,
    onPointerDown,
    onPointerMove,
    onPointerUp,
    onPointerCancel,
  },
  ref,
) {
  const rigidBodyRef = useRef<RapierRigidBody>(null)
  const visualGroupRef = useRef<THREE.Group>(null)
  const colliderProxyRef = useRef<THREE.Mesh>(null)
  const isStatic = physics === 'static' || physics === 'ghost'
  const usesBoxCollider = physics === 'rigidbody' || physics === 'static'
  const initialPosition = useMemo(() => new THREE.Vector3(...position), [position])
  const initialRotation = useMemo(() => new THREE.Quaternion().setFromEuler(new THREE.Euler(...rotation)), [rotation])
  const { scene, wireframeOverlayScene, offset, size, bounds } = useSceneObjectVisual({ asset: object, renderMode })

  const objectScale = useMemo(
    () => resolveObjectScale(object.realWorldHeightM, size.y),
    [object.realWorldHeightM, size],
  )
  const colliderCenter = useMemo(
    () => new THREE.Vector3(0, (size.y * objectScale) / 2, 0),
    [size, objectScale],
  )
  const colliderUserData = useMemo(() => ({ [SCENE_OBJECT_INSTANCE_ID_KEY]: object.id }), [object.id])
  const colliderHalfExtents = useMemo(
    () => new THREE.Vector3(
      Math.max((size.x * objectScale) / 2, 0.01),
      Math.max((size.y * objectScale) / 2, 0.01),
      Math.max((size.z * objectScale) / 2, 0.01),
    ),
    [size, objectScale],
  )
  const objectMass = useMemo(() => {
    if (object.realWorldMassKg === undefined) return undefined
    return object.realWorldMassKg * Math.abs(scale[0] * scale[1] * scale[2])
  }, [object.realWorldMassKg, scale])
  const colliderWireframeMaterial = useMemo(() => new THREE.MeshBasicMaterial({
    color: COLLIDER_WIREFRAME_COLOR,
    wireframe: true,
    transparent: true,
    depthTest: false,
    depthWrite: false,
    toneMapped: false,
    fog: false,
  }), [])

  useFrame((_, delta) => {
    if (!autoRotateY || !visualGroupRef.current) return
    visualGroupRef.current.rotation.y += delta * OBJECT_AUTO_ROTATE_Y_SPEED
  })

  useEffect(() => {
    colliderWireframeMaterial.opacity = 0
    colliderWireframeMaterial.transparent = true
    colliderWireframeMaterial.depthTest = false
    colliderWireframeMaterial.depthWrite = false
    colliderWireframeMaterial.needsUpdate = true
  }, [colliderWireframeMaterial])

  useEffect(() => {
    const body = rigidBodyRef.current
    if (!body) return
    body.setTranslation({ x: position[0], y: position[1], z: position[2] }, true)
    _rotation.setFromEuler(new THREE.Euler(...rotation))
    body.setRotation({ x: _rotation.x, y: _rotation.y, z: _rotation.z, w: _rotation.w }, true)
    body.setLinvel({ x: 0, y: 0, z: 0 }, true)
    body.setAngvel({ x: 0, y: 0, z: 0 }, true)
    body.wakeUp()
  }, [position, rotation, scale])

  useEffect(() => () => { colliderWireframeMaterial.dispose() }, [colliderWireframeMaterial])

  useImperativeHandle(ref, () => ({
    id: object.id,
    get rigidBody() { return rigidBodyRef.current },
    initialPosition,
    initialRotation,
    bounds,
    getFocusPoint: (target) => {
      if (colliderProxyRef.current) return colliderProxyRef.current.getWorldPosition(target)
      return target.copy(initialPosition).add(colliderCenter)
    },
    playInteractionSfx: () => {},
  }), [bounds, colliderCenter, initialPosition, initialRotation, object.id])

  return (
    <RigidBody
      ref={rigidBodyRef}
      type={isStatic ? 'fixed' : 'dynamic'}
      colliders={false}
      position={position}
      rotation={rotation}
      linearDamping={0.45}
      angularDamping={0.35}
      additionalSolverIterations={4}
      ccd
      canSleep
    >
      {usesBoxCollider && (
        <CuboidCollider
          args={[
            colliderHalfExtents.x * scale[0],
            colliderHalfExtents.y * scale[1],
            colliderHalfExtents.z * scale[2],
          ]}
          position={[colliderCenter.x * scale[0], colliderCenter.y * scale[1], colliderCenter.z * scale[2]]}
          mass={objectMass}
        />
      )}
      <mesh
        ref={colliderProxyRef}
        position={[colliderCenter.x * scale[0], colliderCenter.y * scale[1], colliderCenter.z * scale[2]]}
        material={colliderWireframeMaterial}
        renderOrder={10000}
        userData={colliderUserData}
        onPointerOver={(event) => { event.stopPropagation(); onHover(event, object.id, true) }}
        onPointerOut={(event) => { event.stopPropagation(); onHover(event, object.id, false) }}
        onClick={(event) => { event.stopPropagation(); onClick?.(event.point.clone()) }}
        onPointerDown={(event) => {
          if (event.button !== 0) return
          event.stopPropagation()
          onPointerDown?.(event)
        }}
        onPointerMove={(event) => { onHover(event, object.id, true); onPointerMove?.(event) }}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerCancel}
      >
        <boxGeometry args={[
          colliderHalfExtents.x * scale[0] * 2,
          colliderHalfExtents.y * scale[1] * 2,
          colliderHalfExtents.z * scale[2] * 2,
        ]} />
      </mesh>
      <group ref={visualGroupRef} scale={[objectScale * scale[0], objectScale * scale[1], objectScale * scale[2]]}>
        <primitive object={scene} position={offset} dispose={null} />
        {renderMode === ObjectRenderMode.ShadedWireframe && (
          <primitive object={wireframeOverlayScene} position={offset} dispose={null} />
        )}
      </group>
    </RigidBody>
  )
})
