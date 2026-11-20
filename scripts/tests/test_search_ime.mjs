import assert from 'node:assert/strict'
import test from 'node:test'

test('actual search callbacks preserve composing keys and suppress only their form submission', async () => {
  const { createServer } = await import('vite')
  const React = await import('react')
  const server = await createServer({ root: process.cwd(), logLevel: 'silent', appType: 'custom',
    server: { middlewareMode: true, hmr: false, watch: null } })
  // Locked React's dispatcher lets the actual component expose its callbacks
  // without copying their logic or adding a DOM/testing dependency.
  const internals = React.__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE
  const oldDispatcher = internals.H
  const keys = ['window', 'document', 'Node']
  const saved = new Map(keys.map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]))
  const timers = new Map(), rafs = new Map(), listeners = new Map(), effects = []
  const memoValues = [], states = [], refs = []
  let memoCursor = 0, stateCursor = 0, refCursor = 0
  let nextId = 1, changes = 0, navigations = 0, targetFocus = 0
  const find = (node, predicate) => {
    if (!node || typeof node !== 'object') return null
    if (predicate(node)) return node
    const children = node.props?.children
    for (const child of Array.isArray(children) ? children : [children]) { const match = find(child, predicate); if (match) return match }
    return null
  }
  let cleanup
  try {
    internals.H = {
      useState(value) {
        const index = stateCursor++
        if (!(index in states)) states[index] = typeof value === 'function' ? value() : value
        return [states[index], update => {
          changes++
          states[index] = typeof update === 'function' ? update(states[index]) : update
        }]
      },
      useRef(value) { return refs[refCursor++] ??= { current: value } },
      useEffect(effect) { effects.push(effect) },
      useMemo(prepare, dependencies) {
        const index = memoCursor++
        const previous = memoValues[index]
        if (!previous || !dependencies || previous.dependencies?.length !== dependencies.length ||
          !dependencies.every((dependency, offset) => Object.is(dependency, previous.dependencies[offset]))) {
          memoValues[index] = { value: prepare(), dependencies: dependencies?.slice() }
        }
        return memoValues[index].value
      } }
    const mocks = { Node: class {},
      window: { setTimeout(fn) { const id = nextId++; timers.set(id, fn); return id }, clearTimeout(id) { timers.delete(id) },
        requestAnimationFrame(fn) { const id = nextId++; rafs.set(id, fn); return id },
        history: { replaceState() { navigations++ } }, dispatchEvent() {} },
      document: { addEventListener(type, fn) { listeners.set(type, fn) }, removeEventListener(type) { listeners.delete(type) },
        getElementById: () => ({ scrollIntoView() {}, focus() { targetFocus++ } }) },
    }
    for (const [key, value] of Object.entries(mocks)) Object.defineProperty(globalThis, key, { configurable: true, writable: true, value })
    const { default: SiteShell } = await server.ssrLoadModule('/src/features/profile/components/SiteShell.tsx')
    const shell = SiteShell({ children: null })
    const search = find(shell, node => typeof node.type === 'function' && node.type.name === 'SiteSearch')
    states.length = refs.length = memoValues.length = 0
    const before = effects.length
    const renderSearch = () => { memoCursor = stateCursor = refCursor = 0; return search.type({}) }
    const closed = renderSearch()
    assert.ok(!states.some(Array.isArray), 'the search index is deferred while closed')
    find(closed, node => node.type === 'input').props.onFocus()
    const prepared = states.find(Array.isArray)
    assert.ok(prepared?.length, 'the first focus prepares search entries')
    const tree = renderSearch()
    const input = find(tree, node => node.type === 'input' && node.props.id === 'site-search')
    const form = find(tree, node => node.type === 'form')
    cleanup = effects[before]()
    const key = (name, isComposing = false, keyCode = 13) => {
      let prevented = false
      const event = { key: name, keyCode, isComposing, nativeEvent: { key: name, keyCode, isComposing },
        preventDefault() { prevented = true }, target: null }
      input.props.onKeyDown(event)
      listeners.get('keydown')(event.nativeEvent)
      return prevented
    }
    input.props.onCompositionStart()
    for (const name of ['ArrowDown', 'ArrowUp', 'Escape', 'Enter']) {
      const state = changes
      assert.equal(key(name, true), false, name + ' remains available to the IME')
      assert.equal(changes, state)
      assert.equal(rafs.size, 0)
    }
    form.props.onSubmit({ preventDefault() {} })
    assert.equal(navigations, 0)
    input.props.onCompositionEnd()
    assert.equal(key('Enter', false, 229), false)
    form.props.onSubmit({ preventDefault() {} })
    assert.equal(navigations, 0, 'legacy 229 commit cannot navigate after compositionend')
    assert.equal(key('ArrowDown', false, 229), false)
    assert.equal(rafs.size, 0)
    // The next ordinary Enter is a distinct user action, not a composition.
    assert.equal(key('Enter', false, 13), false)
    form.props.onSubmit({ preventDefault() {} })
    assert.equal(navigations, 1)
    assert.equal(targetFocus, 1)
    assert.equal(key('ArrowDown', false, 40), true)
    assert.equal(rafs.size, 1)
    cleanup(); cleanup = null
    assert.equal(timers.size, 0)
    assert.equal(listeners.size, 0)
    renderSearch()
    assert.strictEqual(states.find(Array.isArray), prepared, 'subsequent search renders reuse the prepared index')
  } finally {
    cleanup?.()
    internals.H = oldDispatcher
    for (const [key, descriptor] of saved) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor)
      else delete globalThis[key]
    }
    await server.close()
  }
})
