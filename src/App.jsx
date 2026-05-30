import { useState } from 'react'
import ConfigPage from './pages/ConfigPage'
import SessionPage from './pages/SessionPage'

const DEFAULT_CONFIG = {
  locale: 'es',
  duration:       { minutes: 3, seconds: 0 },
  defendInterval: { min: 1500, max: 4000 },
  attackInterval: { min: 2500, max: 6000 },
  globalInterval: { min: 800,  max: 2000 },
  lineSpeed: 5,
  eventSize: 1,
  thrustRatio: 50,
  feints: false,
  closedLines: false,
  gameMode: false,
  startingLives: 3,
}

export default function App() {
  const [page, setPage] = useState('config')
  const [config, setConfig] = useState(DEFAULT_CONFIG)

  if (page === 'session') {
    return (
      <SessionPage
        config={config}
        onComplete={() => setPage('config')}
      />
    )
  }

  return (
    <ConfigPage
      config={config}
      onChange={setConfig}
      onStart={() => setPage('session')}
    />
  )
}
