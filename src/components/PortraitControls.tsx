import type { StageOptions } from '../animation/stageOptions'

type Props = { options: StageOptions; change: (patch: Partial<StageOptions>) => void; blink: () => void }

/** Opt-in developer controls. The public portrait has no overlaid interface. */
export default function PortraitControls({ options, change, blink }: Props) {
  const sliders = [
    ['wind', '風力', 0, 1, 0.05], ['direction', '風向', -1, 1, 0.1],
    ['gust', '陣風頻率', 0.1, 2, 0.05], ['stiffness', '髮束剛度', 5, 40, 1],
    ['damping', '阻尼', 1, 12, 0.5], ['speed', '播放速度', 0.25, 2, 0.05],
  ] as const
  return (
    <details className="portrait-controls">
      <summary>動態調試</summary>
      <div className="portrait-controls__body">
        {sliders.map(([key, label, min, max, step]) => (
          <label key={key}>
            <span>{label} <output>{options[key].toFixed(2)}</output></span>
            <input type="range" min={min} max={max} step={step} value={options[key]}
              onChange={(event) => change({ [key]: Number(event.target.value) })} />
          </label>
        ))}
        <div className="portrait-controls__actions">
          <button type="button" onClick={() => change({ paused: !options.paused })}>{options.paused ? '繼續' : '暫停'}</button>
          <button type="button" onClick={blink}>眨眼</button>
        </div>
      </div>
    </details>
  )
}
