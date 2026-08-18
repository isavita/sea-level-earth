import { useCallback, useEffect, useState } from 'react'

/**
 * Theme preference, resolved to something the stylesheet can use.
 *
 * The choice is one of three, but the DOM only ever sees two: `system` is
 * resolved here against the phone's own setting and written to `<html>` as a
 * concrete `data-theme`. That keeps the CSS to a single light block with no
 * `prefers-color-scheme` query, so a manual override cannot end up losing a
 * specificity argument with the media query.
 *
 * The same resolution runs as an inline script in index.html before first
 * paint. Without it a light-mode phone flashes the dark shell for as long as
 * the bundle takes to arrive, which on a slow connection is most of a second.
 */
export type ThemeChoice = 'system' | 'light' | 'dark'
export type ResolvedTheme = 'light' | 'dark'

export const THEME_STORAGE_KEY = 'meridian-theme'

const DARK_QUERY = '(prefers-color-scheme: dark)'

/** Background behind the browser's own chrome, kept in step with the shell. */
const THEME_COLOR: Record<ResolvedTheme, string> = {
  dark: '#060d11',
  light: '#f2f6f7',
}

function readStoredChoice(): ThemeChoice {
  try {
    const raw = localStorage.getItem(THEME_STORAGE_KEY)
    if (raw === 'light' || raw === 'dark' || raw === 'system') return raw
  } catch {
    // Private browsing and blocked storage both throw; the default is fine.
  }
  return 'system'
}

function systemTheme(): ResolvedTheme {
  return typeof window !== 'undefined' && window.matchMedia(DARK_QUERY).matches
    ? 'dark'
    : 'light'
}

function resolve(choice: ThemeChoice): ResolvedTheme {
  return choice === 'system' ? systemTheme() : choice
}

function apply(theme: ResolvedTheme) {
  document.documentElement.setAttribute('data-theme', theme)
  const meta = document.querySelector('meta[name="theme-color"]')
  if (meta) meta.setAttribute('content', THEME_COLOR[theme])
}

export interface Theme {
  choice: ThemeChoice
  resolved: ResolvedTheme
  setChoice: (next: ThemeChoice) => void
  /** Steps system → light → dark → system, for a single-button control. */
  cycle: () => void
}

export function useTheme(): Theme {
  const [choice, setChoiceState] = useState<ThemeChoice>(readStoredChoice)
  const [resolved, setResolved] = useState<ResolvedTheme>(() => resolve(choice))

  useEffect(() => {
    const next = resolve(choice)
    setResolved(next)
    apply(next)
    try {
      localStorage.setItem(THEME_STORAGE_KEY, choice)
    } catch {
      // Not being able to remember the choice should not break using it.
    }
  }, [choice])

  // Follow the phone live while on `system` — iOS and Android both flip this
  // on a schedule, and the page should not need a reload to notice.
  useEffect(() => {
    if (choice !== 'system') return
    const mql = window.matchMedia(DARK_QUERY)
    const onChange = () => {
      const next = systemTheme()
      setResolved(next)
      apply(next)
    }
    mql.addEventListener('change', onChange)
    return () => mql.removeEventListener('change', onChange)
  }, [choice])

  const setChoice = useCallback((next: ThemeChoice) => setChoiceState(next), [])

  const cycle = useCallback(() => {
    setChoiceState((prev) =>
      prev === 'system' ? 'light' : prev === 'light' ? 'dark' : 'system',
    )
  }, [])

  return { choice, resolved, setChoice, cycle }
}
