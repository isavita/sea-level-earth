import type { ResolvedTheme, ThemeChoice } from '../lib/useTheme'

interface ThemeToggleProps {
  choice: ThemeChoice
  resolved: ResolvedTheme
  onCycle: () => void
}

/**
 * One button rather than a segmented control: on a phone the app bar has room
 * for an icon and not much else, and the three states are cheap to step
 * through. The label always names what a press will do, so the control is
 * usable without seeing the icon change.
 */
const NEXT_LABEL: Record<ThemeChoice, string> = {
  system: 'Switch to light theme',
  light: 'Switch to dark theme',
  dark: 'Use the system theme',
}

const STATE_LABEL: Record<ThemeChoice, string> = {
  system: 'Theme: following your device',
  light: 'Theme: light',
  dark: 'Theme: dark',
}

function Icon({ choice, resolved }: { choice: ThemeChoice; resolved: ResolvedTheme }) {
  if (choice === 'system') {
    // A phone: the setting is coming from the device, not from this app.
    return (
      <svg viewBox="0 0 24 24" aria-hidden focusable="false">
        <rect
          x="7"
          y="2.5"
          width="10"
          height="19"
          rx="2.4"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.7}
        />
        <path
          d="M10.6 5.2h2.8"
          stroke="currentColor"
          strokeWidth={1.7}
          strokeLinecap="round"
        />
        {/* Filled half hints at which way the device currently resolves. */}
        {resolved === 'dark' ? (
          <path d="M12 8.5a3.5 3.5 0 1 0 3.2 4.9A4 4 0 0 1 12 8.5" fill="currentColor" />
        ) : (
          <circle cx="12" cy="12.5" r="2.4" fill="currentColor" />
        )}
      </svg>
    )
  }
  if (choice === 'light') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden focusable="false">
        <circle cx="12" cy="12" r="4" fill="none" stroke="currentColor" strokeWidth={1.7} />
        <path
          d="M12 2.6v2.2M12 19.2v2.2M2.6 12h2.2M19.2 12h2.2M5.4 5.4l1.5 1.5M17.1 17.1l1.5 1.5M18.6 5.4l-1.5 1.5M6.9 17.1l-1.5 1.5"
          stroke="currentColor"
          strokeWidth={1.7}
          strokeLinecap="round"
        />
      </svg>
    )
  }
  return (
    <svg viewBox="0 0 24 24" aria-hidden focusable="false">
      <path
        d="M20 14.2A8.2 8.2 0 0 1 9.8 4 8.4 8.4 0 1 0 20 14.2"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.7}
        strokeLinejoin="round"
      />
    </svg>
  )
}

export function ThemeToggle({ choice, resolved, onCycle }: ThemeToggleProps) {
  return (
    <button
      type="button"
      className="theme-toggle"
      onClick={onCycle}
      aria-label={`${STATE_LABEL[choice]}. ${NEXT_LABEL[choice]}`}
      title={STATE_LABEL[choice]}
    >
      <Icon choice={choice} resolved={resolved} />
    </button>
  )
}
