import { memo, useEffect, useRef } from 'react'

interface TextEditOverlayProps {
  text: string
  x: number        // screen x position
  y: number        // screen y position
  width: number    // screen width (canvas width * scale)
  height: number   // screen height (canvas height * scale)
  color: string    // background color
  scale: number    // stageTransform.scale
  fontSize?: number // base font size (before scale)
  padding?: number  // inset padding in screen px (default 8 for sticky notes, 0 for plain text)
  onSave: (newText: string) => void
  onClose: () => void
}

export const TextEditOverlay = memo(function TextEditOverlay({ text, x, y, width, height, color, scale, fontSize = 14, padding = 8, onSave, onClose }: TextEditOverlayProps) {
  const divRef = useRef<HTMLDivElement>(null)
  const cancelledRef = useRef(false)

  useEffect(() => {
    const div = divRef.current
    if (!div) return
    div.innerText = text
    div.focus()
    // Select all text on open
    const range = document.createRange()
    range.selectNodeContents(div)
    const sel = window.getSelection()
    sel?.removeAllRanges()
    sel?.addRange(range)
  }, [])

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Escape') {
      cancelledRef.current = true
      onClose()
    }
    e.stopPropagation()
  }

  const handleBlur = () => {
    if (cancelledRef.current) {
      onClose()
      return
    }
    const div = divRef.current
    if (div) onSave(div.innerText)
    onClose()
  }

  return (
    <div data-testid="text-edit-overlay" style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, pointerEvents: 'none', zIndex: 999 }}>
      <div
        ref={divRef}
        contentEditable
        suppressContentEditableWarning
        onKeyDown={handleKeyDown}
        onBlur={handleBlur}
        data-testid="text-edit-input"
        style={{
          position: 'absolute',
          top: y + padding,
          left: x + padding,
          width: width - padding * 2,
          minHeight: height - padding * 2,
          background: color,
          border: 'none',
          outline: 'none',
          padding: '0',
          margin: '0',
          fontSize: `${fontSize * scale}px`,
          fontFamily: 'Arial, sans-serif',
          lineHeight: '1.4',
          boxSizing: 'border-box',
          pointerEvents: 'auto',
          cursor: 'text',
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
          overflow: 'hidden',
        }}
      />
    </div>
  )
})
