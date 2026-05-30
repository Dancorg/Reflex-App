import { useEffect, useRef, useState } from 'react'
import { createEngine } from '../engine/eventEngine'
import { makeT } from '../i18n'
import './SessionPage.css'

function fmt(totalSeconds) {
  const m = Math.floor(totalSeconds / 60)
  const s = totalSeconds % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

export default function SessionPage({ config, onComplete }) {
  const canvasRef = useRef(null)
  const engineRef = useRef(null)
  const slashRef  = useRef({ drawing: false, points: [], fadeStart: 0 })

  const totalSecs = config.duration.minutes * 60 + config.duration.seconds
  const [timeLeft, setTimeLeft]   = useState(totalSecs)
  const [done, setDone]           = useState(false)
  const [lives, setLives]         = useState(config.startingLives ?? 3)
  const [score, setScore]         = useState(0)
  const [gameOver, setGameOver]   = useState(false)

  const t = makeT(config.locale)

  useEffect(() => {
    const canvas = canvasRef.current
    let stopped = false

    const engine = createEngine(canvas, config, {
      getSlash: () => slashRef.current,

      onDefendMissed: () => {
        if (stopped) return
        setLives(l => {
          const next = l - 1
          if (next <= 0 && !stopped) {
            stopped = true
            clearInterval(intervalId)
            engine.stop()
            setGameOver(true)
          }
          return Math.max(0, next)
        })
      },

      onAttackCompleted: () => {
        if (!stopped) setScore(s => s + 1)
      },
    })

    engineRef.current = engine
    engine.start()

    const intervalId = setInterval(() => {
      if (stopped) return
      setTimeLeft(prev => {
        if (prev <= 1) {
          stopped = true
          clearInterval(intervalId)
          engine.stop()
          setDone(true)
          setTimeout(onComplete, 2500)
          return 0
        }
        return prev - 1
      })
    }, 1000)

    // ── Mouse / touch handlers ──────────────────────────────────────────────
    if (config.gameMode) {
      function pt(e) {
        const src = e.touches ? e.touches[0] : e
        return { x: src.clientX, y: src.clientY }
      }

      function onStart(e) {
        e.preventDefault()
        slashRef.current = { drawing: true, suppressed: false, points: [pt(e)], fadeStart: 0 }
      }

      function onMove(e) {
        e.preventDefault()
        const slash = slashRef.current
        if (!slash.drawing || slash.suppressed) return
        const prev = slash.points[slash.points.length - 1]
        const cur  = pt(e)
        slash.points.push(cur)
        engineRef.current?.testSlash(prev.x, prev.y, cur.x, cur.y)
      }

      function onEnd(e) {
        e.preventDefault()
        // Extract the endpoint position from the event
        let ex, ey
        if (e.type === 'touchend' && e.changedTouches?.length) {
          ex = e.changedTouches[0].clientX
          ey = e.changedTouches[0].clientY
        } else if (e.clientX !== undefined) {
          ex = e.clientX
          ey = e.clientY
        } else {
          const pts = slashRef.current.points
          if (pts.length > 0) { ex = pts[pts.length - 1].x; ey = pts[pts.length - 1].y }
        }
        if (ex !== undefined) engineRef.current?.setSlashEndpoint(ex, ey)
        slashRef.current.drawing = false
        slashRef.current.fadeStart = performance.now()
        setTimeout(() => { slashRef.current.points = [] }, 500)
      }

      canvas.addEventListener('mousedown',  onStart)
      canvas.addEventListener('mousemove',  onMove)
      canvas.addEventListener('mouseup',    onEnd)
      canvas.addEventListener('mouseleave', onEnd)
      canvas.addEventListener('touchstart', onStart, { passive: false })
      canvas.addEventListener('touchmove',  onMove,  { passive: false })
      canvas.addEventListener('touchend',   onEnd,   { passive: false })

      return () => {
        stopped = true
        clearInterval(intervalId)
        engine.stop()
        canvas.removeEventListener('mousedown',  onStart)
        canvas.removeEventListener('mousemove',  onMove)
        canvas.removeEventListener('mouseup',    onEnd)
        canvas.removeEventListener('mouseleave', onEnd)
        canvas.removeEventListener('touchstart', onStart)
        canvas.removeEventListener('touchmove',  onMove)
        canvas.removeEventListener('touchend',   onEnd)
      }
    }

    return () => {
      stopped = true
      clearInterval(intervalId)
      engine.stop()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const urgent = timeLeft <= 10

  return (
    <div className={`session-root ${config.gameMode ? 'game-mode' : ''}`}>
      <canvas ref={canvasRef} className="session-canvas" />

      <div className={`session-timer ${urgent ? 'urgent' : ''}`}>
        {fmt(timeLeft)}
      </div>

      {config.gameMode && !gameOver && !done && (
        <div className="game-hud">
          <div className="hud-lives">
            {Array.from({ length: config.startingLives ?? 3 }, (_, i) => (
              <span key={i} className={i < lives ? 'heart-full' : 'heart-empty'}>♥</span>
            ))}
          </div>
          <div className="hud-score">{score}</div>
        </div>
      )}

      {gameOver && (
        <div className="game-over-overlay">
          <div className="game-over-inner">
            <div className="game-over-icon">✕</div>
            <h1>{t('gameOver')}</h1>
            <div className="game-over-score">{score}</div>
            <p className="game-over-label">{t('pointsScored')}</p>
            <button className="game-over-btn" onClick={onComplete}>
              {t('backToConfig')}
            </button>
          </div>
        </div>
      )}

      {done && (
        <div className="session-complete">
          <div className="session-complete-inner">
            <div className="session-complete-icon">✓</div>
            <h1>{t('sessionComplete')}</h1>
            {config.gameMode && (
              <p className="session-score-line">{t('score')}: <strong>{score}</strong></p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
