/** This key records an explicit reader choice, not the old system-preference override. */
export const SCENE_MOTION_KEY = 'vermouth-scene-motion'

/** Self-contained so the same reader can run before the application bundle. */
export function readMotionPreference(storageKey: string): boolean {
  try { return localStorage.getItem(storageKey) !== 'static' }
  catch { return true }
}

export const readSceneMotion = (): boolean => readMotionPreference(SCENE_MOTION_KEY)

export const writeSceneMotion = (enabled: boolean): void => {
  try { localStorage.setItem(SCENE_MOTION_KEY, enabled ? 'dynamic' : 'static') }
  catch { /* The in-memory choice still works when storage is unavailable. */ }
}

/** Build-time serialization only: no eval or dynamic script execution in the page. */
export const parserMotionExpression = (): string =>
  `(${readMotionPreference.toString()})(${JSON.stringify(SCENE_MOTION_KEY)})`
