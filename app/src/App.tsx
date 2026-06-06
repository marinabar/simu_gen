import { useCallback, useEffect, useRef, useState } from 'react'
import { useRoute, useLocation, Redirect } from 'wouter'
import { WorldViewer } from './components/WorldViewer'
import { WorldSidebar } from './components/WorldSidebar'
import { BottomLeftControls, ViewerModeHotkeys } from './components/BottomLeftControls'
import { TouchControls } from './components/TouchControls'
import { useSceneProject } from './modules/scene/useSceneProject'
import { fetchWorlds, loadWorlds } from './utils/worldLoader'
import type { WorldEntry } from './types/world'

export function App() {
  const [worlds, setWorlds] = useState(loadWorlds)
  const [refreshingWorlds, setRefreshingWorlds] = useState(false)
  const refreshTimeoutRef = useRef<number | undefined>(undefined)

  const refreshWorlds = useCallback(async () => {
    if (!import.meta.env.DEV) return
    setRefreshingWorlds(true)
    try {
      setWorlds(await fetchWorlds())
    } catch (error) {
      console.warn('Could not refresh local world assets.', error)
    } finally {
      setRefreshingWorlds(false)
    }
  }, [])

  useEffect(() => {
    refreshWorlds()
  }, [refreshWorlds])

  useEffect(() => {
    if (!import.meta.env.DEV) return
    const refreshSoon = () => {
      window.clearTimeout(refreshTimeoutRef.current)
      refreshTimeoutRef.current = window.setTimeout(() => void refreshWorlds(), 150)
    }
    import.meta.hot?.on('worlds-changed', refreshSoon)
    return () => {
      window.clearTimeout(refreshTimeoutRef.current)
      import.meta.hot?.off('worlds-changed', refreshSoon)
    }
  }, [refreshWorlds])

  if (!worlds.length) {
    return (
      <div className="flex items-center justify-center h-screen text-white bg-black font-mono text-sm">
        no worlds found in worlds/
      </div>
    )
  }

  return <LoadedApp worlds={worlds} refreshingWorlds={refreshingWorlds} onRefreshWorlds={refreshWorlds} />
}

function LoadedApp({
  worlds,
  refreshingWorlds,
  onRefreshWorlds,
}: {
  worlds: WorldEntry[]
  refreshingWorlds: boolean
  onRefreshWorlds: () => void
}) {
  const [match, params] = useRoute('/:slug')
  const [location] = useLocation()
  const [selectedWorldVersions, setSelectedWorldVersions] = useState<Record<string, number>>({})

  const slug = params?.slug ?? worlds[0].slug
  const entry = worlds.find((w) => w.slug === slug) ?? worlds[0]

  const defaultWorldVersionIndex = entry.worldVersions[entry.worldVersions.length - 1]?.index
  const activeWorldVersionIndex = selectedWorldVersions[entry.slug] ?? defaultWorldVersionIndex
  const activeWorldVersion = entry.worldVersions.find((v) => v.index === activeWorldVersionIndex)
  const activeWorld = activeWorldVersion?.world ?? entry.world
  const renderableObjectAssets = entry.objectAssets.filter((a) => a.complete && a.url)

  const { sceneProject, sceneProjectReady, updateSceneProject } = useSceneProject(
    entry.slug,
    location,
    entry.sceneProject,
  )

  useEffect(() => {
    setSelectedWorldVersions((prev) => ({ ...prev }))
  }, [entry.slug])

  if (!match) {
    return <Redirect to={`/${worlds[0].slug}`} />
  }

  return (
    <div className="relative w-screen h-screen bg-black overflow-hidden select-none [&_*]:focus:outline-none [&_*]:focus-visible:outline-none [&_*]:focus:ring-0 [&_*]:focus-visible:ring-0">
      <ViewerModeHotkeys />
      <WorldViewer
        world={activeWorld}
        slug={entry.slug}
        objectAssets={renderableObjectAssets}
        allObjectAssets={entry.allObjectAssets.filter((a) => a.complete && a.url)}
        sceneProject={sceneProject}
        sceneProjectReady={sceneProjectReady}
        onSceneProjectSaved={updateSceneProject}
        onRefreshWorlds={onRefreshWorlds}
        refreshingWorlds={refreshingWorlds}
      />
      <div className="fixed inset-x-4 top-4 sm:left-4 sm:right-auto z-10">
        <WorldSidebar
          worlds={worlds}
          activeSlug={entry.slug}
          activeWorldVersionIndex={activeWorldVersionIndex}
          onActiveWorldVersionChange={(index) =>
            setSelectedWorldVersions((prev) => ({ ...prev, [entry.slug]: index }))
          }
        />
      </div>
      <TouchControls />
      <div className="fixed inset-x-0 bottom-4 z-20 flex justify-center px-4 sm:left-4 sm:right-auto sm:justify-start sm:px-0">
        <BottomLeftControls />
      </div>
    </div>
  )
}
