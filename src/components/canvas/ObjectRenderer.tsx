import { memo } from 'react'
import type Konva from 'konva'

import { ConnectionHandles } from './ConnectionHandles'
import { Connector } from './Connector'
import { Frame } from './Frame'
import { GoalCard } from './GoalCard'
import { RemoteCursor } from './RemoteCursor'
import { Shape } from './Shape'
import { StickyNote } from './StickyNote'
import { SelectionTransformer } from './SelectionTransformer'
import { TempConnectorLine } from './TempConnectorLine'
import { TextElement } from './TextElement'
import type {
  BoardObject,
  ConnectorData,
  FrameData,
  GoalData,
  StickyNoteData,
  RectangleData,
  CircleData,
  LineData,
  TextData,
  CursorPosition,
} from '../../lib/database.types'

interface ObjectRendererProps {
  sortedObjects: BoardObject[]
  objectMap: Map<string, BoardObject>
  selectedIds: Set<string>
  editingId: string | null
  connectorMode: { fromId: string; fromPoint: { x: number; y: number } } | null
  connectingCursorPos: { x: number; y: number }
  cursors: Map<string, CursorPosition>
  selectedNodes: Konva.Group[]
  transformVersion: number
  nodeRefs: React.RefObject<Map<string, Konva.Group>>
  isSelected: (id: string) => boolean
  onUpdate: (id: string, updates: Partial<BoardObject>) => void
  onSelect: (id: string, multiSelect?: boolean) => void
  onMount: (id: string, node: Konva.Group) => void
  onUnmount: (id: string) => void
  onStartEdit: (id: string) => void
  onStartConnect: (objectId: string, point: { x: number; y: number }) => void
  onTransformEnd: (id: string, updates: { x: number; y: number; scaleX: number; scaleY: number; rotation: number }) => void
}

export const ObjectRenderer = memo(function ObjectRenderer({
  sortedObjects,
  objectMap,
  selectedIds,
  editingId,
  connectorMode,
  connectingCursorPos,
  cursors,
  selectedNodes,
  transformVersion,
  nodeRefs,
  isSelected,
  onUpdate,
  onSelect,
  onMount,
  onUnmount,
  onStartEdit,
  onStartConnect,
  onTransformEnd,
}: ObjectRendererProps) {
  return (
    <>
      {/* Render all objects sorted by z_index */}
      {sortedObjects.map((obj) => {
        switch (obj.type) {
          case 'frame':
            return (
              <Frame
                key={obj.id}
                object={obj as BoardObject & { type: 'frame'; data: FrameData }}
                onUpdate={onUpdate}
                onSelect={onSelect}
                isSelected={isSelected(obj.id)}
                onMount={onMount}
                onUnmount={onUnmount}
              />
            )
          case 'connector':
            return (
              <Connector
                key={obj.id}
                object={obj as BoardObject & { type: 'connector'; data: ConnectorData }}
                objectMap={objectMap}
                isSelected={isSelected(obj.id)}
                onSelect={onSelect}
              />
            )
          case 'rectangle':
          case 'circle':
          case 'line':
            return (
              <Shape
                key={obj.id}
                object={obj as BoardObject & { type: 'rectangle' | 'circle' | 'line'; data: RectangleData | CircleData | LineData }}
                onUpdate={onUpdate}
                onSelect={onSelect}
                isSelected={isSelected(obj.id)}
                onMount={onMount}
                onUnmount={onUnmount}
              />
            )
          case 'sticky_note':
            return (
              <StickyNote
                key={obj.id}
                object={obj as BoardObject & { type: 'sticky_note'; data: StickyNoteData }}
                onUpdate={onUpdate}
                onSelect={onSelect}
                isSelected={isSelected(obj.id)}
                isEditing={editingId === obj.id}
                onStartEdit={onStartEdit}
                onMount={onMount}
                onUnmount={onUnmount}
              />
            )
          case 'text':
            return (
              <TextElement
                key={obj.id}
                object={obj as BoardObject & { type: 'text'; data: TextData }}
                onUpdate={onUpdate}
                onSelect={onSelect}
                isSelected={isSelected(obj.id)}
                isEditing={editingId === obj.id}
                onStartEdit={onStartEdit}
                onMount={onMount}
                onUnmount={onUnmount}
              />
            )
          case 'goal':
            return (
              <GoalCard
                key={obj.id}
                object={obj as BoardObject & { type: 'goal'; data: GoalData }}
                onUpdate={onUpdate}
                onSelect={onSelect}
                isSelected={isSelected(obj.id)}
                onMount={onMount}
                onUnmount={onUnmount}
              />
            )
          default:
            return null
        }
      })}

      <SelectionTransformer
        selectedNodes={selectedNodes}
        transformVersion={transformVersion}
        onTransformEnd={onTransformEnd}
      />

      {/* Connection handle dots on selected objects */}
      {!connectorMode && Array.from(selectedIds).map(id => {
        const obj = objectMap.get(id)
        if (!obj || obj.type === 'connector') return null
        return (
          <ConnectionHandles
            key={`handles-${id}`}
            object={obj}
            node={nodeRefs.current.get(id)}
            onStartConnect={onStartConnect}
          />
        )
      })}

      {/* Temp connector line while connecting */}
      {connectorMode && (
        <TempConnectorLine
          fromPoint={connectorMode.fromPoint}
          toPoint={connectingCursorPos}
        />
      )}

      {/* Remote cursors */}
      {Array.from(cursors.values()).map((cursor) => (
        <RemoteCursor key={cursor.userId} cursor={cursor} />
      ))}
    </>
  )
})
