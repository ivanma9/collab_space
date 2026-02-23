import type { ReactNode } from 'react'

import { TextEditOverlay } from './TextEditOverlay'
import type {
  BoardObject,
  StickyNoteData,
  TextData,
} from '../../lib/database.types'

interface TextEditOverlayContentProps {
  editingObject: BoardObject | undefined
  stageTransform: { x: number; y: number; scale: number }
  onSave: (newText: string) => void
  onClose: () => void
}

export function TextEditOverlayContent({
  editingObject,
  stageTransform,
  onSave,
  onClose,
}: TextEditOverlayContentProps): ReactNode | null {
  if (!editingObject) return null
  const isNote = editingObject.type === 'sticky_note'
  const isText = editingObject.type === 'text'
  if (!isNote && !isText) return null

  const screenX = editingObject.x * stageTransform.scale + stageTransform.x
  const screenY = editingObject.y * stageTransform.scale + stageTransform.y
  const screenW = editingObject.width * stageTransform.scale
  const screenH = (isNote ? editingObject.height : Math.max(editingObject.height, 40)) * stageTransform.scale
  const color = isNote ? (editingObject.data as StickyNoteData).color : 'transparent'
  const fontSize = isNote ? 14 : ((editingObject.data as TextData).fontSize ?? 16)
  const padding = isNote ? Math.round(10 * stageTransform.scale) : 0

  return (
    <TextEditOverlay
      text={(editingObject.data as { text: string }).text}
      x={screenX}
      y={screenY}
      width={screenW}
      height={screenH}
      color={color}
      scale={stageTransform.scale}
      fontSize={fontSize}
      padding={padding}
      onSave={onSave}
      onClose={onClose}
    />
  )
}
