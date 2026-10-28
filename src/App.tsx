import CharacterStage from './components/CharacterStage'
import { readStageOptions } from './animation/stageOptions'

export default function App() {
  const options = readStageOptions(window.location.search)
  return (
    <main className={`page page--${options.style}`} data-theme={options.theme}>
      <div className="aura" aria-hidden="true" />
      <CharacterStage />
    </main>
  )
}
