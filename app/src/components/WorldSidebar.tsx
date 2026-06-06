import { useState } from 'react'
import { useLocation } from 'wouter'
import { ListIcon, PersonIcon, BirdIcon, GearIcon } from '@phosphor-icons/react'
import type { WorldEntry, WorldObjectAsset } from '../types/world'
import { type ControllerMode, useDebugStore } from '../store/debug'
import { ViewerQuality } from '../types/world'
import { AppButton } from './AppButton'
import { ChromeThumbnail, chrome } from './AppChrome'
import { SettingsPanel } from './SettingsPanel'

const CONTROLLER_MODES: readonly { mode: ControllerMode; label: string }[] = [
  { mode: 'fly', label: 'Fly' },
  { mode: 'fps', label: 'FPS' },
]

const QUALITY_MODES = [
  { mode: ViewerQuality.Low, label: 'Low' },
  { mode: ViewerQuality.High, label: 'High' },
] as const

function nextMode<T>(items: readonly { mode: T }[], current: T) {
  const idx = items.findIndex((item) => item.mode === current)
  return items[(idx + 1) % items.length].mode
}

interface Props {
  worlds: WorldEntry[]
  activeSlug: string
  activeWorldVersionIndex?: number
  onActiveWorldVersionChange: (index: number) => void
}

export function WorldSidebar({ worlds, activeSlug }: Props) {
  const [, navigate] = useLocation()
  const [menuOpen, setMenuOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const controllerMode = useDebugStore((s) => s.controllerMode)
  const setControllerMode = useDebugStore((s) => s.setControllerMode)
  const viewerQuality = useDebugStore((s) => s.viewerQuality)
  const setViewerQuality = useDebugStore((s) => s.setViewerQuality)

  const activeEntry = worlds.find((w) => w.slug === activeSlug) ?? worlds[0]
  const objects = activeEntry.objectAssets.filter((a) => a.complete && a.url)
  const pendingObjects = activeEntry.objectAssets.filter((a) => !a.complete)

  return (
    <aside className={`${chrome.enter} w-full sm:w-56 max-h-[80vh] flex flex-col gap-1 whitespace-nowrap text-sm`}>
      {/* Header bar */}
      <div className={`${chrome.bar} flex flex-shrink-0 items-center justify-between px-2 py-1 font-mono`}>
        <AppButton
          onClick={() => { setMenuOpen((o) => !o); setSettingsOpen(false) }}
          className="min-w-0 flex-1 gap-2 px-1 truncate font-mono text-white opacity-100 hover:bg-transparent"
        >
          <ListIcon size={14} weight="regular" className="text-white/60 sm:hidden" />
          <span className="truncate">{activeEntry.project.display_name ?? activeSlug}</span>
        </AppButton>
        <div className="flex items-center gap-0.5 flex-shrink-0">
          <AppButton
            onClick={() => setControllerMode(nextMode(CONTROLLER_MODES, controllerMode))}
            className="px-1.5 py-0.5 text-xs text-white/70 hover:text-white"
            title="Toggle controller mode"
          >
            {controllerMode === 'fly' ? <BirdIcon size={13} /> : <PersonIcon size={13} />}
          </AppButton>
          <AppButton
            onClick={() => setViewerQuality(nextMode(QUALITY_MODES, viewerQuality))}
            className="px-1.5 py-0.5 text-xs font-mono text-white/70 hover:text-white"
            title="Toggle quality"
          >
            {viewerQuality === ViewerQuality.High ? 'HQ' : 'LQ'}
          </AppButton>
          <AppButton
            onClick={() => { setSettingsOpen((o) => !o); setMenuOpen(false) }}
            active={settingsOpen}
            className={`px-1.5 py-0.5 text-xs text-white/70 hover:text-white ${settingsOpen ? 'text-white opacity-100' : ''}`}
            title="Settings"
          >
            <GearIcon size={13} />
          </AppButton>
        </div>
      </div>

      {/* Settings panel */}
      {settingsOpen && <SettingsPanel />}

      {/* World switcher menu */}
      {menuOpen && worlds.length > 1 && (
        <div className={`${chrome.panel} overflow-y-auto`}>
          {worlds.map((w) => (
            <AppButton
              key={w.slug}
              onClick={() => { navigate(`/${w.slug}`); setMenuOpen(false) }}
              active={w.slug === activeSlug}
              className={`w-full px-2 py-1 font-mono ${chrome.row} ${w.slug === activeSlug ? chrome.rowActive : chrome.rowIdle}`}
            >
              {w.project.display_name ?? w.slug}
            </AppButton>
          ))}
        </div>
      )}

      {/* Objects panel */}
      {(objects.length > 0 || pendingObjects.length > 0) && (
        <div className={`${chrome.panel} overflow-y-auto`}>
          <div className={chrome.sectionHeader}>
            <span>objects</span>
            <span className="text-white/35">{objects.length}/{activeEntry.objectAssets.length}</span>
          </div>
          {objects.map((asset) => (
            <ObjectRow key={asset.assetId} asset={asset} />
          ))}
          {pendingObjects.map((asset) => (
            <ObjectRow key={asset.assetId} asset={asset} pending />
          ))}
        </div>
      )}
    </aside>
  )
}

function ObjectRow({ asset, pending = false }: { asset: WorldObjectAsset; pending?: boolean }) {
  return (
    <div className={`${chrome.row} ${chrome.rowIdle} px-2 py-1 gap-2`}>
      <ChromeThumbnail thumbnailUrl={asset.thumbnailUrl} alt={asset.name} />
      <span className={`truncate text-xs ${pending ? 'text-white/40 italic' : 'text-white/80'}`}>
        {asset.name}
        {pending && asset.status ? ` — ${asset.status}` : ''}
      </span>
    </div>
  )
}
