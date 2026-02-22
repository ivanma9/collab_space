/**
 * CanvasHUD - Bottom-left heads-up display overlay for the canvas
 *
 * Shows the current cursor position in world coordinates and the zoom level.
 * This is an HTML overlay, not a Konva component.
 */

interface CanvasHUDProps {
  cursorX: number
  cursorY: number
  zoomPercent: number
  onResetZoom?: () => void
}

function MagnifierIcon() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="11" cy="11" r="8" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  )
}

export function CanvasHUD({ cursorX, cursorY, zoomPercent, onResetZoom }: CanvasHUDProps) {
  const isAt100 = Math.round(zoomPercent) === 100

  return (
    <div className="absolute bottom-12 left-4 z-10 flex items-center gap-2 px-2.5 py-1.5 rounded bg-gray-800/80 backdrop-blur-sm text-white text-xs font-mono select-none">
      <span className="pointer-events-none">
        X: {Math.round(cursorX)}&nbsp;&nbsp;Y: {Math.round(cursorY)}
      </span>
      <div className="border-l border-gray-600 self-stretch" />
      <button
        onClick={onResetZoom}
        disabled={isAt100}
        className={`flex items-center gap-1 rounded px-1 -mx-1 transition-colors ${
          isAt100
            ? 'opacity-60 cursor-default'
            : 'hover:bg-white/15 cursor-pointer'
        }`}
        title={isAt100 ? 'Already at 100%' : 'Reset to 100%'}
      >
        <MagnifierIcon />
        {Math.round(zoomPercent)}%
      </button>
    </div>
  )
}
