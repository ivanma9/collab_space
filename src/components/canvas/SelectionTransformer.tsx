import { useEffect, useRef } from 'react'
import { Transformer } from 'react-konva'
import type Konva from 'konva'

interface SelectionTransformerProps {
  selectedNodes: Konva.Node[]
  transformVersion: number
  onTransformEnd: (id: string, updates: { x: number; y: number; scaleX: number; scaleY: number; rotation: number }) => void
}

export function SelectionTransformer({ selectedNodes, transformVersion, onTransformEnd }: SelectionTransformerProps) {
  const trRef = useRef<Konva.Transformer>(null)

  useEffect(() => {
    if (!trRef.current) return
    trRef.current.nodes(selectedNodes)
    trRef.current.getLayer()?.batchDraw()
  }, [selectedNodes, transformVersion])

  const handleTransformEnd = () => {
    const nodes = trRef.current?.nodes() ?? []
    nodes.forEach((node) => {
      const id = node.id()
      if (!id) return
      // Capture scale BEFORE resetting — node.width() returns 0 for Groups,
      // so the caller uses their stored width * scaleX to get the new size.
      const scaleX = node.scaleX()
      const scaleY = node.scaleY()
      const x = node.x()
      const y = node.y()
      const rotation = node.rotation()
      // Reset scale first so the Konva node is clean before React re-renders.
      node.scaleX(1)
      node.scaleY(1)
      onTransformEnd(id, { x, y, scaleX, scaleY, rotation })
    })
  }

  return (
    <Transformer
      ref={trRef}
      onTransformEnd={handleTransformEnd}
      boundBoxFunc={(oldBox, newBox) => {
        if (newBox.width < 20 || newBox.height < 20) return oldBox
        return newBox
      }}
      data-testid="selection-transformer"
    />
  )
}
