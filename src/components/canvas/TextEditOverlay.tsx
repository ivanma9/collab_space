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

  useEffect(() => {
    const ta = textareaRef.current
    if (!ta) return
    ta.focus()
    ta.select()
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
    <textarea
      ref={textareaRef}
      defaultValue={text}
      onKeyDown={handleKeyDown}
      onBlur={handleBlur}
      style={{
        position: 'absolute',
        top: y + padding,
        left: x + padding,
        width: width - padding * 2,
        height: height - padding * 2,
        background: color,
        border: '2px solid #4A90E2',
        borderRadius: '4px',
        padding: '2px',
        fontSize: `${fontSize * scale}px`,
        fontFamily: 'Arial, sans-serif',
        resize: 'none',
        outline: 'none',
        zIndex: 1000,
        overflow: 'auto',
        lineHeight: '1.4',
      }}
    />
  )
}
