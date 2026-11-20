import { transitionDay } from './logs/transitionDay.ts'
import { keepingPace } from './logs/keepingPace.ts'
import { keepTimeMoving } from './logs/keepTimeMoving.ts'
import { rebuildDirection } from './thoughts/rebuildDirection.ts'

/** Deliberate display order; missing original dates remain missing. */
export const writingEntries = [keepTimeMoving, rebuildDirection, transitionDay, keepingPace]
