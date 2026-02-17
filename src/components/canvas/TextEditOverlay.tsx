import { useEffect, useRef } from 'react'

interface TextEditOverlayProps {
  text: string
  x: number        // screen x position
  y: number        // screen y position
  width: number    // screen width (canvas width * scale)
  height: number   // screen height (canvas height * scale)
  color: string    // background color
  onSave: (newText: string) => void
  onClose: () => void
}

export function TextEditOverlay({ text, x, y, width, height, color, onSave, onClose }: TextEditOverlayProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    const ta = textareaRef.current
    if (!ta) return
    ta.focus()
    ta.select()
  }, [])

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Escape') {
      onClose()
    }
    e.stopPropagation()
  }

  const handleBlur = () => {
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
        top: y + 8,
        left: x + 8,
        width: width - 16,
        height: height - 16,
        background: color,
        border: '2px solid #4A90E2',
        borderRadius: '4px',
        padding: '2px',
        fontSize: '14px',
        fontFamily: 'Arial, sans-serif',
        resize: 'none',
        outline: 'none',
        zIndex: 1000,
        overflow: 'hidden',
        lineHeight: '1.4',
      }}
    />
  )
}
