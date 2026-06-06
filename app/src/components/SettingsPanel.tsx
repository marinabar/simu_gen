import { useDebugStore } from '../store/debug'
import { ViewerQuality } from '../types/world'
import { chrome } from './AppChrome'

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 px-2 py-0.5">
      <span className="w-28 flex-shrink-0 text-white/50 text-xs font-mono">{label}</span>
      <div className="flex-1 min-w-0">{children}</div>
    </div>
  )
}

function Slider({
  value,
  min,
  max,
  step,
  onChange,
  displayValue,
}: {
  value: number
  min: number
  max: number
  step: number
  onChange: (v: number) => void
  displayValue?: string
}) {
  return (
    <div className="flex items-center gap-2">
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="flex-1 h-1 accent-white/80 cursor-pointer"
      />
      <span className="w-10 text-right text-white/50 text-xs font-mono tabular-nums">
        {displayValue ?? value.toFixed(step < 0.01 ? 4 : step < 1 ? 2 : 0)}
      </span>
    </div>
  )
}

function Toggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!value)}
      className={`w-7 h-4 rounded-full transition-colors ${value ? 'bg-white/60' : 'bg-white/15'}`}
    >
      <span
        className={`block w-3 h-3 rounded-full bg-white transition-transform mx-0.5 ${value ? 'translate-x-3' : 'translate-x-0'}`}
      />
    </button>
  )
}

export function SettingsPanel() {
  const viewerQuality = useDebugStore((s) => s.viewerQuality)
  const dofEnabled = useDebugStore((s) => s.dofEnabled)
  const setDofEnabled = useDebugStore((s) => s.setDofEnabled)
  const focalDistance = useDebugStore((s) => s.focalDistance)
  const setFocalDistance = useDebugStore((s) => s.setFocalDistance)
  const apertureAngle = useDebugStore((s) => s.apertureAngle)
  const setApertureAngle = useDebugStore((s) => s.setApertureAngle)
  const falloff = useDebugStore((s) => s.falloff)
  const setFalloff = useDebugStore((s) => s.setFalloff)
  const sharpRange = useDebugStore((s) => s.sharpRange)
  const setSharpRange = useDebugStore((s) => s.setSharpRange)
  const falloffRate = useDebugStore((s) => s.falloffRate)
  const setFalloffRate = useDebugStore((s) => s.setFalloffRate)
  const flyMouseSensitivity = useDebugStore((s) => s.flyMouseSensitivity)
  const setFlyMouseSensitivity = useDebugStore((s) => s.setFlyMouseSensitivity)

  const isHQ = viewerQuality === ViewerQuality.High

  return (
    <div className={`${chrome.panel} py-1.5 flex flex-col gap-0.5`}>
      <div className={chrome.sectionHeader}>
        <span>settings</span>
      </div>

      <div className="mt-1">
        <div className={`${chrome.sectionHeader} text-white/35`}>
          <span>depth of field</span>
          {!isHQ && <span className="text-white/25 italic">hq only</span>}
        </div>
        <Row label="enabled">
          <Toggle value={dofEnabled} onChange={setDofEnabled} />
        </Row>
        {dofEnabled && (
          <>
            <Row label="focal dist">
              <Slider value={focalDistance} min={0.5} max={50} step={0.5} onChange={setFocalDistance} />
            </Row>
            <Row label="aperture">
              <Slider value={apertureAngle} min={0} max={0.1} step={0.001} onChange={setApertureAngle} />
            </Row>
            <Row label="sharp range">
              <Slider value={sharpRange} min={0} max={10} step={0.1} onChange={setSharpRange} />
            </Row>
            <Row label="falloff rate">
              <Slider value={falloffRate} min={0.001} max={1} step={0.001} onChange={setFalloffRate} />
            </Row>
            <Row label="falloff">
              <Slider value={falloff} min={0} max={5} step={0.1} onChange={setFalloff} />
            </Row>
          </>
        )}
      </div>

      <div className="mt-1">
        <div className={`${chrome.sectionHeader} text-white/35`}>
          <span>camera</span>
        </div>
        <Row label="mouse sens">
          <Slider
            value={flyMouseSensitivity}
            min={0.001}
            max={0.01}
            step={0.0001}
            onChange={setFlyMouseSensitivity}
            displayValue={flyMouseSensitivity.toFixed(4)}
          />
        </Row>
      </div>
    </div>
  )
}
