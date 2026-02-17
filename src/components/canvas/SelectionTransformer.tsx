import { useEffect, useRef } from 'react'
import { Transformer } from 'react-konva'
import type Konva from 'konva'

interface SelectionTransformerProps {
  selectedNodes: Konva.Node[]
  onTransformEnd: (id: string, updates: { x: number; y: number; width: number; height: number; rotation: number }) => void
}

export function SelectionTransformer({ selectedNodes, onTransformEnd }: SelectionTransformerProps) {
  const trRef = useRef<Konva.Transformer>(null)

  useEffect(() => {
    if (!trRef.current) return
    trRef.current.nodes(selectedNodes)
    trRef.current.getLayer()?.batchDraw()
  }, [selectedNodes])

  const handleTransformEnd = () => {
    selectedNodes.forEach((node) => {
      const id = node.id()
      if (!id) return
      onTransformEnd(id, {
        x: node.x(),
        y: node.y(),
        width: Math.max(20, node.width() * node.scaleX()),
        height: Math.max(20, node.height() * node.scaleY()),
        rotation: node.rotation(),
      })
      node.scaleX(1)
      node.scaleY(1)
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
    />
  )
}
