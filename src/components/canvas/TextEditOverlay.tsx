import { useEffect, useRef } from 'react'

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

export function TextEditOverlay({ text, x, y, width, height, color, scale, fontSize = 14, padding = 8, onSave, onClose }: TextEditOverlayProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const cancelledRef = useRef(false)

  const autoResize = (ta: HTMLTextAreaElement) => {
    ta.style.height = 'auto'
    ta.style.height = `${ta.scrollHeight}px`
  }

  useEffect(() => {
    const ta = textareaRef.current
    if (!ta) return
    ta.focus()
    ta.select()
    autoResize(ta)
  }, [])

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Escape') {
      cancelledRef.current = true   // mark as cancelled
      onClose()                      // unmount (will trigger onBlur)
    }
    e.stopPropagation()
  }

  const handleBlur = () => {
    if (cancelledRef.current) {      // skip save on cancel
      onClose()
      return
    }
    const ta = textareaRef.current
    if (ta) onSave(ta.value)
    onClose()
  }

  return (
    <div data-testid="text-edit-overlay" style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, pointerEvents: 'none', zIndex: 999 }}>
      <textarea
        ref={textareaRef}
        defaultValue={text}
        onKeyDown={handleKeyDown}
        onBlur={handleBlur}
        onInput={(e) => autoResize(e.currentTarget)}
        data-testid="text-edit-input"
        style={{
          position: 'absolute',
          top: y + padding,
          left: x + padding,
          width: width - padding * 2,
          minHeight: height - padding * 2,
          height: 'auto',
          background: color,
          border: '2px solid #4A90E2',
          borderRadius: '4px',
          padding: '2px',
          fontSize: `${fontSize * scale}px`,
          fontFamily: 'Arial, sans-serif',
          resize: 'none',
          outline: 'none',
          zIndex: 1000,
          overflow: 'hidden',
          lineHeight: '1.4',
          boxSizing: 'border-box',
          pointerEvents: 'auto',
        }}
      />
    </div>
  )
}
