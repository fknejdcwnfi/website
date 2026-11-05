import CharacterStage from '../features/portrait/components/CharacterStage'
import { readStageOptions } from '../features/portrait/animation/stageOptions'
import PortraitBoundary from '../features/portrait/components/PortraitBoundary'
import PortraitViewport from '../features/profile/components/PortraitViewport'

/** Previous character renderers remain an explicit historical route. */
export default function ArchivedPortrait(){
  const options=readStageOptions(window.location.search)
  const portrait=<PortraitBoundary fallbackSrc={`${import.meta.env.BASE_URL}portrait-rest.png`}><CharacterStage /></PortraitBoundary>
  return <main className={`page page--${options.style}`} data-theme={options.theme}>
    {options.style==='portrait'?<PortraitViewport logicalSize={options.pixel}>{portrait}</PortraitViewport>:portrait}
  </main>
}
