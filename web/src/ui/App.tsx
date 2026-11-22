import { useState } from 'react'
import { AppProvider, useApp } from './AppContext'
import { Header } from './Header'
import { PlanView } from './PlanView'
import type { FixTarget } from './ReadinessChecklist'
import { ResultsView } from './ResultsView'
import type { AppState } from '../state/app'

function Shell() {
  const app = useApp()
  const [focusTarget, setFocusTarget] = useState<FixTarget | null>(null)
  return (
    <>
      <p className="small-screen-note">DSSeating works best on a laptop or larger screen.</p>
      <Header onFix={(target) => setFocusTarget(target)} />
      {app.state.mode === 'plan' ? <PlanView focusTarget={focusTarget} /> : <ResultsView />}
    </>
  )
}

export function App({ initial }: { initial?: AppState }) {
  return (
    <AppProvider initial={initial}>
      <Shell />
    </AppProvider>
  )
}
