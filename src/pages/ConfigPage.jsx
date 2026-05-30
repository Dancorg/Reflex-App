import { useRef } from 'react'
import { makeT } from '../i18n'
import './ConfigPage.css'

function IntervalRow({ label, hint, field, config, onChange, msUnit }) {
  return (
    <div className="field-group">
      <label className="field-label">
        {label}
        {hint && <span className="field-hint">{hint}</span>}
      </label>
      <div className="range-inputs">
        <div className="range-input-pair">
          <span className="range-tag">min</span>
          <input
            type="number"
            min={100}
            step={100}
            value={config[field].min}
            onChange={e => onChange({ ...config, [field]: { ...config[field], min: Math.max(100, +e.target.value) } })}
          />
          <span className="range-unit">{msUnit}</span>
        </div>
        <span className="range-sep">–</span>
        <div className="range-input-pair">
          <span className="range-tag">max</span>
          <input
            type="number"
            min={100}
            step={100}
            value={config[field].max}
            onChange={e => onChange({ ...config, [field]: { ...config[field], max: Math.max(config[field].min, +e.target.value) } })}
          />
          <span className="range-unit">{msUnit}</span>
        </div>
      </div>
    </div>
  )
}

function Toggle({ label, hint, checked, onChange }) {
  return (
    <label className="toggle-row">
      <div className="toggle-text">
        <span className="toggle-label">{label}</span>
        {hint && <span className="field-hint">{hint}</span>}
      </div>
      <div className={`toggle-switch ${checked ? 'on' : ''}`} onClick={() => onChange(!checked)}>
        <div className="toggle-knob" />
      </div>
    </label>
  )
}

export default function ConfigPage({ config, onChange, onStart }) {
  const t = makeT(config.locale)
  const fileInputRef = useRef(null)

  function handleExport() {
    const blob = new Blob([JSON.stringify(config, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'fencing-reflex-config.json'
    a.click()
    URL.revokeObjectURL(url)
  }

  function handleImport(e) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = ev => {
      try {
        const parsed = JSON.parse(ev.target.result)
        // Merge: current config fills in any keys missing from the imported file
        onChange({ ...config, ...parsed })
      } catch {
        // Silently ignore malformed JSON
      }
    }
    reader.readAsText(file)
    e.target.value = ''  // reset so the same file can be re-imported
  }

  const totalSecs = config.duration.minutes * 60 + config.duration.seconds

  function thrustLabel(ratio) {
    if (ratio === 0)   return t('cutsOnly')
    if (ratio === 100) return t('thrustsOnly')
    if (ratio === 50)  return '50 / 50'
    return ratio < 50
      ? `${100 - ratio}% ${t('cutsSuffix')}`
      : `${ratio}% ${t('thrustsSuffix')}`
  }

  return (
    <div className="config-root">
      <div className="config-card">
        <div className="config-header">
          <div className="config-logo">⚔</div>
          <h1>{t('appTitle')}</h1>
          <div className="lang-toggle">
            {['es', 'en'].map(l => (
              <button
                key={l}
                className={`lang-btn ${config.locale === l ? 'active' : ''}`}
                onClick={() => onChange({ ...config, locale: l })}
              >
                {l.toUpperCase()}
              </button>
            ))}
          </div>
        </div>

        <div className="config-sections">
          {/* Duration */}
          <section className="config-section">
            <h2>{t('sessionDuration')}</h2>
            <div className="field-group">
              <label className="field-label">{t('length')}</label>
              <div className="duration-inputs">
                <div className="duration-pair">
                  <input
                    type="number"
                    min={0}
                    max={59}
                    value={config.duration.minutes}
                    onChange={e => onChange({ ...config, duration: { ...config.duration, minutes: Math.max(0, Math.min(59, +e.target.value)) } })}
                  />
                  <span className="duration-unit">{t('minUnit')}</span>
                </div>
                <span className="range-sep">:</span>
                <div className="duration-pair">
                  <input
                    type="number"
                    min={0}
                    max={59}
                    value={config.duration.seconds}
                    onChange={e => onChange({ ...config, duration: { ...config.duration, seconds: Math.max(0, Math.min(59, +e.target.value)) } })}
                  />
                  <span className="duration-unit">{t('secUnit')}</span>
                </div>
                <span className="duration-total">{totalSecs}{t('sTotal')}</span>
              </div>
            </div>
          </section>

          {/* Timing */}
          <section className="config-section">
            <h2>{t('eventTiming')}</h2>
            <IntervalRow
              label={t('betweenDefend')}
              hint={t('defendHint')}
              field="defendInterval"
              config={config}
              onChange={onChange}
              msUnit={t('msUnit')}
            />
            <IntervalRow
              label={t('betweenAttack')}
              hint={t('attackHint')}
              field="attackInterval"
              config={config}
              onChange={onChange}
              msUnit={t('msUnit')}
            />
            <IntervalRow
              label={t('globalSpacing')}
              hint={t('globalHint')}
              field="globalInterval"
              config={config}
              onChange={onChange}
              msUnit={t('msUnit')}
            />
          </section>

          {/* Defend events */}
          <section className="config-section">
            <h2>{t('defendEvents')}</h2>
            <div className="field-group">
              <label className="field-label">
                {t('cutsVsThrusts')}
                <span className="field-hint">{thrustLabel(config.thrustRatio)}</span>
              </label>
              <div className="slider-row bipolar">
                <span className="slider-bound">{t('cutsSuffix')}</span>
                <input
                  type="range"
                  min={0}
                  max={100}
                  step={5}
                  value={config.thrustRatio}
                  onChange={e => onChange({ ...config, thrustRatio: +e.target.value })}
                />
                <span className="slider-bound">{t('thrustsSuffix')}</span>
              </div>
            </div>
            <div className="field-group">
              <label className="field-label">
                {t('eventSize')}
                <span className="field-hint">{t('size')[config.eventSize] || ''}</span>
              </label>
              <div className="slider-row">
                <span className="slider-bound">1</span>
                <input
                  type="range"
                  min={1}
                  max={10}
                  step={1}
                  value={config.eventSize}
                  onChange={e => onChange({ ...config, eventSize: +e.target.value })}
                />
                <span className="slider-bound">10</span>
                <span className="slider-value">{config.eventSize}</span>
              </div>
            </div>
            <div className="field-group">
              <label className="field-label">
                {t('difficultySpeed')}
                <span className="field-hint">{t('speed')[config.lineSpeed]}</span>
              </label>
              <div className="slider-row">
                <span className="slider-bound">1</span>
                <input
                  type="range"
                  min={1}
                  max={10}
                  step={1}
                  value={config.lineSpeed}
                  onChange={e => onChange({ ...config, lineSpeed: +e.target.value })}
                />
                <span className="slider-bound">10</span>
                <span className="slider-value">{config.lineSpeed}</span>
              </div>
            </div>
          </section>

          {/* Modifiers */}
          <section className="config-section">
            <h2>{t('modifiers')}</h2>
            <Toggle
              label={t('feints')}
              hint={t('feintsHint')}
              checked={config.feints}
              onChange={v => onChange({ ...config, feints: v })}
            />
            <Toggle
              label={t('closedLines')}
              hint={t('closedLinesHint')}
              checked={config.closedLines}
              onChange={v => onChange({ ...config, closedLines: v })}
            />
            <Toggle
              label={t('gameMode')}
              hint={t('gameModeHint')}
              checked={config.gameMode}
              onChange={v => onChange({ ...config, gameMode: v })}
            />
            {config.gameMode && (
              <div className="field-group lives-row">
                <label className="field-label">{t('startingLives')}</label>
                <input
                  type="number"
                  min={1}
                  max={10}
                  value={config.startingLives}
                  onChange={e => onChange({ ...config, startingLives: Math.max(1, Math.min(10, +e.target.value)) })}
                  className="lives-input"
                />
              </div>
            )}
          </section>
        </div>

        <div className="config-io-row">
          <button className="io-btn" onClick={handleExport}>
            <span className="io-icon">↓</span> {t('exportConfig')}
          </button>
          <button className="io-btn" onClick={() => fileInputRef.current.click()}>
            <span className="io-icon">↑</span> {t('importConfig')}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".json,application/json"
            style={{ display: 'none' }}
            onChange={handleImport}
          />
        </div>

        <button
          className="start-btn"
          onClick={onStart}
          disabled={totalSecs === 0}
        >
          {t('startSession')}
        </button>
      </div>
    </div>
  )
}
