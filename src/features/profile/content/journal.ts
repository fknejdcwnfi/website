import { transitionDay } from './journals/transitionDay.ts'
import { keepingPace } from './journals/keepingPace.ts'

export { transitionDay, keepingPace }
/** Display order is editorial; an undated original must not gain an invented date. */
export const journalEntries = [keepingPace, transitionDay]
