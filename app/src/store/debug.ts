import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { ObjectRenderMode, ViewerQuality, WorldRenderMode } from '../types/world'

export type ControllerMode = 'fly' | 'fps'

function defaultViewerQuality() {
  if (typeof window === 'undefined') return ViewerQuality.High
  const mobileQuery = '(hover: none), (pointer: coarse), (max-width: 767px)'
  return window.matchMedia(mobileQuery).matches ? ViewerQuality.Low : ViewerQuality.High
}

interface DebugStore {
  viewerQuality: ViewerQuality
  setViewerQuality: (v: ViewerQuality) => void
  worldRenderMode: WorldRenderMode
  setWorldRenderMode: (v: WorldRenderMode) => void
  objectRenderMode: ObjectRenderMode
  setObjectRenderMode: (v: ObjectRenderMode) => void
  objectResetToken: number
  controllerResetToken: number
  resetObjects: () => void
  controllerMode: ControllerMode
  setControllerMode: (v: ControllerMode) => void
  flyMouseSensitivity: number
  setFlyMouseSensitivity: (v: number) => void
  showOrigin: boolean
  setShowOrigin: (v: boolean) => void
  // Splat DoF
  dofEnabled: boolean
  setDofEnabled: (v: boolean) => void
  focalDistance: number
  setFocalDistance: (v: number) => void
  apertureAngle: number
  setApertureAngle: (v: number) => void
  falloff: number
  setFalloff: (v: number) => void
  sharpRange: number
  setSharpRange: (v: number) => void
  falloffRate: number
  setFalloffRate: (v: number) => void
  // Lighting
  environmentIntensity: number
  setEnvironmentIntensity: (v: number) => void
  sunIntensity: number
  setSunIntensity: (v: number) => void
  sunColor: string
  setSunColor: (v: string) => void
}

export const useDebugStore = create<DebugStore>()(
  persist(
    (set) => ({
      viewerQuality: defaultViewerQuality(),
      setViewerQuality: (viewerQuality) => set({ viewerQuality }),
      worldRenderMode: WorldRenderMode.Combined,
      setWorldRenderMode: (worldRenderMode) => set({ worldRenderMode }),
      objectRenderMode: ObjectRenderMode.Lit,
      setObjectRenderMode: (objectRenderMode) => set({ objectRenderMode }),
      objectResetToken: 0,
      controllerResetToken: 0,
      resetObjects: () => set((s) => ({
        objectResetToken: s.objectResetToken + 1,
        controllerResetToken: s.controllerResetToken + 1,
      })),
      controllerMode: 'fly' as ControllerMode,
      setControllerMode: (controllerMode) => set({ controllerMode }),
      flyMouseSensitivity: 0.003,
      setFlyMouseSensitivity: (flyMouseSensitivity) => set({ flyMouseSensitivity }),
      showOrigin: false,
      setShowOrigin: (showOrigin) => set({ showOrigin }),
      dofEnabled: true,
      setDofEnabled: (dofEnabled) => set({ dofEnabled }),
      focalDistance: 5,
      setFocalDistance: (focalDistance) => set({ focalDistance }),
      apertureAngle: 0.01,
      setApertureAngle: (apertureAngle) => set({ apertureAngle }),
      falloff: 1,
      setFalloff: (falloff) => set({ falloff }),
      sharpRange: 0,
      setSharpRange: (sharpRange) => set({ sharpRange }),
      falloffRate: 0.01,
      setFalloffRate: (falloffRate) => set({ falloffRate }),
      environmentIntensity: 2,
      setEnvironmentIntensity: (environmentIntensity) => set({ environmentIntensity }),
      sunIntensity: 1,
      setSunIntensity: (sunIntensity) => set({ sunIntensity }),
      sunColor: '#ffffff',
      setSunColor: (sunColor) => set({ sunColor }),
    }),
    {
      name: 'simu-gen-viewer',
      version: 1,
      partialize: (s) => ({
        viewerQuality: s.viewerQuality,
        worldRenderMode: s.worldRenderMode,
        objectRenderMode: s.objectRenderMode,
        controllerMode: s.controllerMode,
        flyMouseSensitivity: s.flyMouseSensitivity,
        dofEnabled: s.dofEnabled,
        focalDistance: s.focalDistance,
        apertureAngle: s.apertureAngle,
        falloff: s.falloff,
        sharpRange: s.sharpRange,
        falloffRate: s.falloffRate,
      }),
    },
  ),
)
