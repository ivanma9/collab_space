import { useEffect, useRef, useCallback } from "react"
import { Circle } from "react-konva"
import type Konva from "konva"

import type { BoardObject } from "../../lib/database.types"

interface ConnectionHandlesProps {
	object: BoardObject
	node: Konva.Group | undefined
	onStartConnect: (objectId: string, point: { x: number; y: number }) => void
}

const HANDLE_RADIUS = 4
const HANDLE_RADIUS_HOVER = 6
const HANDLE_FILL = "#ffffff"
const HANDLE_STROKE = "#b0b0b0"
const HANDLE_FILL_HOVER = "#4A90E2"
const HANDLE_STROKE_HOVER = "#4A90E2"
const HANDLE_OFFSET = 12

function getEdgeMidpoints(
	x: number,
	y: number,
	w: number,
	h: number,
) {
	return [
		{ x: x + w / 2, y: y - HANDLE_OFFSET }, // top
		{ x: x + w + HANDLE_OFFSET, y: y + h / 2 }, // right
		{ x: x + w / 2, y: y + h + HANDLE_OFFSET }, // bottom
		{ x: x - HANDLE_OFFSET, y: y + h / 2 }, // left
	]
}

export function ConnectionHandles({
	object,
	node,
	onStartConnect,
}: ConnectionHandlesProps) {
	const handleRefs = useRef<(Konva.Circle | null)[]>([null, null, null, null])
	const stageRef = useRef<Konva.Stage | null>(null)

	const updatePositions = useCallback(() => {
		let x: number, y: number, w: number, h: number
		if (node) {
			x = node.x()
			y = node.y()
			w = object.width * node.scaleX()
			h = object.height * node.scaleY()
		} else {
			x = object.x
			y = object.y
			w = object.width
			h = object.height
		}
		const positions = getEdgeMidpoints(x, y, w, h)
		handleRefs.current.forEach((ref, i) => {
			if (ref) {
				ref.x(positions[i]!.x)
				ref.y(positions[i]!.y)
			}
		})
		handleRefs.current[0]?.getLayer()?.batchDraw()
	}, [node, object.x, object.y, object.width, object.height])

	// Track node movement for fluid handle positioning
	useEffect(() => {
		if (!node) return
		node.on("dragmove.handles", updatePositions)
		node.on("transform.handles", updatePositions)
		return () => {
			node.off("dragmove.handles")
			node.off("transform.handles")
		}
	}, [node, updatePositions])

	// Reset cursor on unmount (handles removed before onMouseLeave can fire)
	useEffect(() => {
		return () => {
			if (stageRef.current) {
				stageRef.current.container().style.cursor = "default"
			}
		}
	}, [])

	const initialPositions = getEdgeMidpoints(
		object.x,
		object.y,
		object.width,
		object.height,
	)

	return (
		<>
			{initialPositions.map((pt, i) => (
				<Circle
					key={i}
					ref={(ref) => {
						handleRefs.current[i] = ref
					}}
					x={pt.x}
					y={pt.y}
					radius={HANDLE_RADIUS}
					fill={HANDLE_FILL}
					stroke={HANDLE_STROKE}
					strokeWidth={1.5}
					onMouseEnter={(e) => {
						const circle = e.target as Konva.Circle
						circle.radius(HANDLE_RADIUS_HOVER)
						circle.fill(HANDLE_FILL_HOVER)
						circle.stroke(HANDLE_STROKE_HOVER)
						const stage = circle.getStage()
						if (stage) {
							stageRef.current = stage
							stage.container().style.cursor = "crosshair"
						}
						circle.getLayer()?.batchDraw()
					}}
					onMouseLeave={(e) => {
						const circle = e.target as Konva.Circle
						circle.radius(HANDLE_RADIUS)
						circle.fill(HANDLE_FILL)
						circle.stroke(HANDLE_STROKE)
						const stage = circle.getStage()
						if (stage) stage.container().style.cursor = "default"
						circle.getLayer()?.batchDraw()
					}}
					onMouseDown={(e) => {
						e.cancelBubble = true
						// Compute current position from node if available
						let cx: number, cy: number, cw: number, ch: number
						if (node) {
							cx = node.x()
							cy = node.y()
							cw = object.width * node.scaleX()
							ch = object.height * node.scaleY()
						} else {
							cx = object.x
							cy = object.y
							cw = object.width
							ch = object.height
						}
						const currentPoints = getEdgeMidpoints(cx, cy, cw, ch)
						onStartConnect(object.id, currentPoints[i]!)
					}}
					hitStrokeWidth={8}
				/>
			))}
		</>
	)
}
