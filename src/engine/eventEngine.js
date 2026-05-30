function rand(min, max) {
  return min + Math.random() * (max - min)
}

function randInt(min, max) {
  return Math.floor(rand(min, max + 1))
}

// ── Geometry ──────────────────────────────────────────────────────────────────

function cross2(ox, oy, ax, ay, bx, by) {
  return (ax - ox) * (by - oy) - (ay - oy) * (bx - ox)
}

function segmentsIntersect(ax, ay, bx, by, cx, cy, dx, dy) {
  const d1 = cross2(cx, cy, dx, dy, ax, ay)
  const d2 = cross2(cx, cy, dx, dy, bx, by)
  const d3 = cross2(ax, ay, bx, by, cx, cy)
  const d4 = cross2(ax, ay, bx, by, dx, dy)
  return ((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) &&
         ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0))
}

function segmentHitsCircle(ax, ay, bx, by, cx, cy, r) {
  const dx = bx - ax, dy = by - ay
  const fx = ax - cx, fy = ay - cy
  const a = dx * dx + dy * dy
  if (a === 0) return fx * fx + fy * fy <= r * r
  const b = 2 * (fx * dx + fy * dy)
  const c = fx * fx + fy * fy - r * r
  const disc = b * b - 4 * a * c
  if (disc < 0) return false
  const sq = Math.sqrt(disc)
  const t1 = (-b - sq) / (2 * a)
  const t2 = (-b + sq) / (2 * a)
  return (t1 >= 0 && t1 <= 1) || (t2 >= 0 && t2 <= 1) || (t1 <= 0 && t2 >= 1)
}

// ── Size ──────────────────────────────────────────────────────────────────────

function sizeMults(config) {
  const t = (config.eventSize - 1) / 9
  return { radiusMult: 1 + t * 2, widthMult: 1 + t * 9 }
}

// ── Cutting line ──────────────────────────────────────────────────────────────

function makeCuttingEvent(canvas, config, now) {
  const W = canvas.width, H = canvas.height
  const CX = W / 2, CY = H / 2
  const speedPx = (config.lineSpeed / 5) * Math.min(W, H) * 0.66
  const { widthMult } = sizeMults(config)

  let side = randInt(0, 3)
  let feinted = false
  const feintAt = config.feints ? rand(0.3, 0.7) : Infinity

  function startForSide(s) {
    if (s === 0) return [rand(W * 0.15, W * 0.85), -8]
    if (s === 1) return [W + 8, rand(H * 0.15, H * 0.85)]
    if (s === 2) return [rand(W * 0.15, W * 0.85), H + 8]
    return [-8, rand(H * 0.15, H * 0.85)]
  }

  let [sx, sy] = startForSide(side)
  let startTime = now
  let duration = (Math.hypot(CX - sx, CY - sy) / speedPx) * 1000
  let arc = null
  const ARC_FADE_MS = 550

  function tipAt(t) {
    const raw = Math.min((t - startTime) / duration, 1)
    const p = raw * raw
    return [sx + (CX - sx) * p, sy + (CY - sy) * p]
  }

  return {
    kind: 'defend',
    subtype: 'cut',
    blocked: false,

    getCenter(t) { return tipAt(t) },

    isAlive(t) {
      if (this.blocked) return false
      return (t - startTime) / duration < 1
    },

    hitTest(t, ax, ay, bx, by) {
      const [tx, ty] = tipAt(t)
      return segmentsIntersect(ax, ay, bx, by, sx, sy, tx, ty)
    },

    update(t) {
      if (feinted) return
      const progress = (t - startTime) / duration
      if (progress < feintAt) return

      feinted = true
      const [tipX, tipY] = tipAt(t)
      const D = Math.hypot(CX - tipX, CY - tipY)
      const currentAngle = Math.atan2(tipY - CY, tipX - CX)
      const offset = Math.PI / 2 + Math.random() * Math.PI
      const newAngle = currentAngle + offset

      arc = { startAngle: currentAngle, endAngle: newAngle, anticlockwise: offset > Math.PI, radius: D, fadeStart: t }
      sx = CX + D * Math.cos(newAngle)
      sy = CY + D * Math.sin(newAngle)
      startTime = t
      duration = (D / speedPx) * 1000
    },

    draw(ctx, t) {
      const [tx, ty] = tipAt(t)

      if (arc !== null) {
        const elapsed = t - arc.fadeStart
        if (elapsed < ARC_FADE_MS) {
          const alpha = (1 - elapsed / ARC_FADE_MS) * 0.65
          ctx.save()
          ctx.globalAlpha = alpha
          ctx.beginPath()
          ctx.arc(CX, CY, arc.radius, arc.startAngle, arc.endAngle, arc.anticlockwise)
          ctx.strokeStyle = '#ff6666'
          ctx.lineWidth = 2
          ctx.setLineDash([6, 5])
          ctx.stroke()
          ctx.setLineDash([])
          ctx.restore()
        } else {
          arc = null
        }
      }

      ctx.save()
      ctx.beginPath()
      ctx.moveTo(sx, sy)
      ctx.lineTo(tx, ty)
      ctx.strokeStyle = '#ff3333'
      ctx.lineWidth = 3 * widthMult
      ctx.lineCap = 'round'
      ctx.stroke()
      ctx.restore()
    }
  }
}

// ── Thrust dot ────────────────────────────────────────────────────────────────

const FEINT_SLIDE_MS = 200

function makeThrustEvent(canvas, config, now) {
  const { radiusMult } = sizeMults(config)
  const margin = Math.min(canvas.width, canvas.height) * 0.15
  let x = rand(margin, canvas.width - margin)
  let y = rand(margin, canvas.height - margin)
  const maxRadius = rand(25, 55) * radiusMult
  let phase0Duration = rand(0.8, 1.2) * 667 * (5 / config.lineSpeed)
  let startTime = now
  let baseRadius = 0
  let feinted = false
  const feintAt = config.feints ? rand(0.35, 0.65) : Infinity
  let phaseDuration = phase0Duration
  let slide = null

  function getRadius(t) {
    const raw = Math.min((t - startTime) / phaseDuration, 1)
    return baseRadius + (maxRadius - baseRadius) * raw * raw
  }

  function getPos(t) {
    if (!slide) return { x, y }
    const sp = Math.min((t - slide.startT) / FEINT_SLIDE_MS, 1)
    const ep = 1 - (1 - sp) * (1 - sp)
    return { x: slide.fromX + (slide.toX - slide.fromX) * ep, y: slide.fromY + (slide.toY - slide.fromY) * ep }
  }

  return {
    kind: 'defend',
    subtype: 'thrust',
    blocked: false,

    getCenter(t) { const { x: cx, y: cy } = getPos(t); return [cx, cy] },

    isAlive(t) {
      if (this.blocked) return false
      return getRadius(t) < maxRadius
    },

    hitTest(t, ax, ay, bx, by) {
      const { x: cx, y: cy } = getPos(t)
      return segmentHitsCircle(ax, ay, bx, by, cx, cy, getRadius(t))
    },

    update(t) {
      if (feinted) return
      const progress = (t - startTime) / phaseDuration
      if (progress < feintAt) return
      feinted = true
      baseRadius = getRadius(t)
      const m = Math.min(canvas.width, canvas.height) * 0.15
      const toX = rand(m, canvas.width - m)
      const toY = rand(m, canvas.height - m)
      slide = { fromX: x, fromY: y, toX, toY, startT: t }
      x = toX; y = toY
      phaseDuration = phase0Duration * (1 - feintAt)
      startTime = t
    },

    draw(ctx, t) {
      const radius = getRadius(t)
      const { x: cx, y: cy } = getPos(t)
      ctx.save()
      ctx.beginPath()
      ctx.arc(cx, cy, Math.max(radius, 1), 0, Math.PI * 2)
      ctx.fillStyle = '#ff3333'
      ctx.fill()
      ctx.beginPath()
      ctx.arc(cx, cy, Math.max(radius + 4, 5), 0, Math.PI * 2)
      ctx.strokeStyle = 'rgba(255, 80, 80, 0.4)'
      ctx.lineWidth = 3
      ctx.stroke()
      ctx.restore()
    }
  }
}

// ── Attack opening ────────────────────────────────────────────────────────────

function makeAttackEvent(canvas, config, now) {
  const { radiusMult } = sizeMults(config)
  const margin = Math.min(canvas.width, canvas.height) * 0.2
  const x = rand(margin, canvas.width - margin)
  const y = rand(margin, canvas.height - margin)
  const maxRadius = rand(45, 95) * radiusMult
  const duration = rand(0.8, 1.2) * 800 * (5 / config.lineSpeed)
  const startTime = now

  function computePerp(lx, ly) {
    const dx = x - lx, dy = y - ly
    const len = Math.hypot(dx, dy) || 1
    return [-dy / len, dx / len]
  }

  // Non-game-mode: random static position
  const staticAngle = Math.random() * Math.PI * 2
  const staticLineX = x + maxRadius * 2 * Math.cos(staticAngle)
  const staticLineY = y + maxRadius * 2 * Math.sin(staticAngle)
  const [staticPerpX, staticPerpY] = computePerp(staticLineX, staticLineY)

  // Game-mode: locked position set once via lockBlockedLine()
  let lineX = staticLineX, lineY = staticLineY
  let perpX = staticPerpX, perpY = staticPerpY
  let lineLocked = false  // in game mode, stays false until mouse-up endpoint arrives

  function currentRadius(t) {
    return maxRadius * (1 - Math.min((t - startTime) / duration, 1))
  }

  return {
    kind: 'attack',
    completed: false,

    getCenter() { return [x, y] },

    // Called by the engine when the player lifts the mouse
    lockBlockedLine(ex, ey) {
      const dx = ex - x, dy = ey - y
      const dist = Math.hypot(dx, dy) || 1
      const offset = Math.min(maxRadius * 2, dist * 0.85)
      lineX = x + (dx / dist) * offset
      lineY = y + (dy / dist) * offset
      ;[perpX, perpY] = computePerp(lineX, lineY)
      lineLocked = true
    },

    isAlive(t) {
      if (this.completed) return false
      return (t - startTime) / duration < 1
    },

    hitTest(t, ax, ay, bx, by) {
      return segmentHitsCircle(ax, ay, bx, by, x, y, currentRadius(t))
    },

    hitTestClosedLine(ax, ay, bx, by) {
      if (config.gameMode && !lineLocked) return false
      const half = Math.min(canvas.width, canvas.height) * 0.1
      return segmentsIntersect(
        ax, ay, bx, by,
        lineX - perpX * half, lineY - perpY * half,
        lineX + perpX * half, lineY + perpY * half
      )
    },

    getClosedLineCenter() { return [lineX, lineY] },

    // eslint-disable-next-line no-unused-vars
    update(_t) {},

    draw(ctx, t) {
      const showLine = config.closedLines && (!config.gameMode || lineLocked)

      if (showLine) {
        const half = Math.min(canvas.width, canvas.height) * 0.1
        ctx.save()
        ctx.beginPath()
        ctx.moveTo(lineX - perpX * half, lineY - perpY * half)
        ctx.lineTo(lineX + perpX * half, lineY + perpY * half)
        ctx.strokeStyle = '#cc2222'
        ctx.lineWidth = 3
        ctx.stroke()
        ctx.restore()
      }

      const progress = (t - startTime) / duration
      const radius = maxRadius * (1 - progress)

      ctx.save()
      ctx.beginPath()
      ctx.arc(x, y, Math.max(radius, 1), 0, Math.PI * 2)
      ctx.strokeStyle = `rgba(50, 255, 80, ${0.5 + 0.5 * (1 - progress)})`
      ctx.lineWidth = 4
      ctx.stroke()
      ctx.beginPath()
      ctx.arc(x, y, Math.max(radius - 4, 1), 0, Math.PI * 2)
      ctx.fillStyle = `rgba(50, 255, 80, ${0.08 * (1 - progress)})`
      ctx.fill()
      ctx.restore()
    }
  }
}

// ── Scheduler ─────────────────────────────────────────────────────────────────

function makeScheduler(canvas, config, startTs) {
  const gi = config.globalInterval
  const di = config.defendInterval
  const ai = config.attackInterval

  let lastAnyStart = startTs - rand(gi.max, gi.max * 2)
  let nextDefendAt = startTs + rand(di.min * 0.3, di.min)
  let nextAttackAt = startTs + rand(ai.min * 0.3, ai.min)
  let prevHadDefend = false
  let prevHadAttack = false

  return {
    tick(now, activeDefend, activeAttack) {
      let newDefend = null
      let newAttack = null

      if (prevHadDefend && !activeDefend) nextDefendAt = now + rand(di.min, di.max)
      if (prevHadAttack && !activeAttack) nextAttackAt = now + rand(ai.min, ai.max)
      prevHadDefend = !!activeDefend
      prevHadAttack = !!activeAttack

      const globalOk = now - lastAnyStart >= gi.min
      const thrustOnly = config.closedLines && activeAttack !== null
      const thrustChance = thrustOnly ? 1.0 : config.thrustRatio / 100

      if (!activeDefend && now >= nextDefendAt && globalOk) {
        newDefend = Math.random() < thrustChance
          ? makeThrustEvent(canvas, config, now)
          : makeCuttingEvent(canvas, config, now)
        lastAnyStart = now
      } else if (!activeDefend && now >= nextDefendAt && !globalOk) {
        nextDefendAt = lastAnyStart + rand(gi.min, gi.max)
      }

      if (!activeAttack && now >= nextAttackAt && globalOk) {
        newAttack = makeAttackEvent(canvas, config, now)
        lastAnyStart = now
      } else if (!activeAttack && now >= nextAttackAt && !globalOk) {
        nextAttackAt = lastAnyStart + rand(gi.min, gi.max)
      }

      return { newDefend, newAttack }
    }
  }
}

// ── Engine ────────────────────────────────────────────────────────────────────

const SLASH_FADE_MS  = 450
const SLASH_TRAIL_MS = 455   // how long each point persists in the trail
const SLASH_MAX_PX   = 350   // maximum pixel length of the visible trail

export function createEngine(canvas, config, callbacks = {}) {
  const ctx = canvas.getContext('2d')
  let rafId = null
  let running = false
  let scheduler = null
  let activeDefend = null
  let activeAttack = null

  // ── Particles ──────────────────────────────────────────────────────────────
  const particles = []

  function spawnSparks(cx, cy, color, count = 16) {
    const now = performance.now()
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2
      const speed = rand(100, 280)
      particles.push({
        x: cx, y: cy,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - rand(0, 60),
        spawnTime: now,
        duration: rand(380, 680),
        color,
        radius: rand(2, 4.5),
      })
    }
  }

  function updateAndDrawParticles() {
    const now = performance.now()
    const dt = 1 / 60
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i]
      const elapsed = now - p.spawnTime
      if (elapsed >= p.duration) { particles.splice(i, 1); continue }
      p.x += p.vx * dt
      p.y += p.vy * dt
      p.vy += 280 * dt  // gravity
      const alpha = 1 - elapsed / p.duration
      ctx.save()
      ctx.globalAlpha = alpha * 0.9
      ctx.shadowColor = p.color
      ctx.shadowBlur = 7
      ctx.beginPath()
      ctx.arc(p.x, p.y, p.radius * (0.4 + 0.6 * alpha), 0, Math.PI * 2)
      ctx.fillStyle = p.color
      ctx.fill()
      ctx.restore()
    }
  }

  // ── Slash overlay ──────────────────────────────────────────────────────────
  function drawSlash(ts) {
    const slash = callbacks.getSlash?.()
    if (!slash || slash.points.length < 2) return

    const now = performance.now()

    // Trim points older than the trail window (keep ≥2)
    while (slash.points.length > 2 && now - slash.points[0].t > SLASH_TRAIL_MS) {
      slash.points.shift()
    }

    // Trim from the front until the path fits within SLASH_MAX_PX
    let totalLen = 0
    for (let i = 1; i < slash.points.length; i++) {
      totalLen += Math.hypot(slash.points[i].x - slash.points[i-1].x, slash.points[i].y - slash.points[i-1].y)
    }
    while (slash.points.length > 2 && totalLen > SLASH_MAX_PX) {
      totalLen -= Math.hypot(slash.points[1].x - slash.points[0].x, slash.points[1].y - slash.points[0].y)
      slash.points.shift()
    }

    if (slash.points.length < 2) return

    const fadeAlpha = slash.drawing
      ? 1
      : Math.max(0, 1 - (ts - slash.fadeStart) / SLASH_FADE_MS)
    if (fadeAlpha <= 0) return

    ctx.save()
    ctx.lineWidth = 3
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.shadowColor = 'rgba(150, 210, 255, 0.8)'
    ctx.shadowBlur = 10

    for (let i = 1; i < slash.points.length; i++) {
      const age = now - slash.points[i].t
      ctx.globalAlpha = Math.max(0, 1 - age / SLASH_TRAIL_MS) * fadeAlpha
      ctx.strokeStyle = 'rgba(210, 240, 255, 0.95)'
      ctx.beginPath()
      ctx.moveTo(slash.points[i - 1].x, slash.points[i - 1].y)
      ctx.lineTo(slash.points[i].x, slash.points[i].y)
      ctx.stroke()
    }

    ctx.restore()
  }

  function resize() {
    canvas.width = window.innerWidth
    canvas.height = window.innerHeight
  }

  function loop(ts) {
    if (!running) return

    ctx.clearRect(0, 0, canvas.width, canvas.height)
    ctx.fillStyle = '#0d0d0f'
    ctx.fillRect(0, 0, canvas.width, canvas.height)

    // ── Defend event ──────────────────────────────────────────────────────────
    if (activeDefend) {
      activeDefend.update(ts)
      if (activeDefend.isAlive(ts)) {
        activeDefend.draw(ctx, ts)

        // Cuts: per-frame contact check against the drawn slash
        if (config.gameMode && activeDefend.subtype === 'cut' && !activeDefend.blocked) {
          const slash = callbacks.getSlash?.()
          if (slash && slash.points.length >= 2) {
            outer: for (let i = 0; i + 1 < slash.points.length; i++) {
              const p = slash.points[i], q = slash.points[i + 1]
              if (activeDefend.hitTest(ts, p.x, p.y, q.x, q.y)) {
                activeDefend.blocked = true
                const [cx, cy] = activeDefend.getCenter(ts)
                spawnSparks(cx, cy, '#ffdd33', 14)
                break outer
              }
            }
          }
        }
      } else {
        if (config.gameMode && !activeDefend.blocked) {
          const [cx, cy] = activeDefend.getCenter(ts)
          spawnSparks(cx, cy, '#ff3333', 18)
          callbacks.onDefendMissed?.()
        }
        activeDefend = null
      }
    }

    // ── Attack event ──────────────────────────────────────────────────────────
    if (activeAttack) {
      activeAttack.update(ts)
      if (activeAttack.isAlive(ts)) {
        activeAttack.draw(ctx, ts)  // also updates dynLine position

        // Closed line: deflect slash on contact + yellow sparks
        if (config.gameMode && config.closedLines && !activeAttack.completed) {
          const slash = callbacks.getSlash?.()
          if (slash && slash.points.length >= 2) {
            for (let i = 0; i + 1 < slash.points.length; i++) {
              const p = slash.points[i], q = slash.points[i + 1]
              if (activeAttack.hitTestClosedLine(p.x, p.y, q.x, q.y)) {
                const [lx, ly] = activeAttack.getClosedLineCenter()
                spawnSparks(lx, ly, '#ffdd33', 12)
                slash.points = []
                slash.suppressed = true
                break
              }
            }
          }
        }
      } else {
        activeAttack = null
      }
    }

    const { newDefend, newAttack } = scheduler.tick(ts, activeDefend, activeAttack)
    if (newDefend) activeDefend = newDefend
    if (newAttack) activeAttack = newAttack

    if (config.gameMode) {
      drawSlash(ts)
      updateAndDrawParticles()
    }

    rafId = requestAnimationFrame(loop)
  }

  return {
    start() {
      running = true
      resize()
      window.addEventListener('resize', resize)
      rafId = requestAnimationFrame(ts => {
        scheduler = makeScheduler(canvas, config, ts)
        loop(ts)
      })
    },

    stop() {
      running = false
      window.removeEventListener('resize', resize)
      if (rafId) cancelAnimationFrame(rafId)
    },

    // Called when the player lifts the mouse — locks the blocked line position
    setSlashEndpoint(ex, ey) {
      if (config.gameMode && config.closedLines && activeAttack && !activeAttack.completed) {
        activeAttack.lockBlockedLine(ex, ey)
      }
    },

    testSlash(ax, ay, bx, by) {
      const t = performance.now()

      // Thrusts: slash-through interaction
      if (activeDefend && !activeDefend.blocked && activeDefend.subtype === 'thrust') {
        if (activeDefend.hitTest(t, ax, ay, bx, by)) {
          activeDefend.blocked = true
          const [cx, cy] = activeDefend.getCenter(t)
          spawnSparks(cx, cy, '#ffdd33', 14)
        }
      }

      // Attack circle: slash-through to complete
      if (activeAttack && !activeAttack.completed) {
        if (activeAttack.hitTest(t, ax, ay, bx, by)) {
          activeAttack.completed = true
          const [cx, cy] = activeAttack.getCenter()
          spawnSparks(cx, cy, '#44ff77', 18)
          callbacks.onAttackCompleted?.()
        }
      }
    },
  }
}
