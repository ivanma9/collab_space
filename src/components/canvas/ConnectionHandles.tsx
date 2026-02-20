import { Circle } from "react-konva"
import type Konva from "konva"

import type { BoardObject } from "../../lib/database.types"

interface ConnectionHandlesProps {
	object: BoardObject
	onStartConnect: (objectId: string, point: { x: number; y: number }) => void
}

const HANDLE_RADIUS = 4
const HANDLE_RADIUS_HOVER = 6
const HANDLE_FILL = "#ffffff"
const HANDLE_STROKE = "#b0b0b0"
const HANDLE_FILL_HOVER = "#4A90E2"
const HANDLE_STROKE_HOVER = "#4A90E2"

function getEdgeMidpoints(obj: BoardObject) {
	return [
		{ x: obj.x + obj.width / 2, y: obj.y }, // top
		{ x: obj.x + obj.width, y: obj.y + obj.height / 2 }, // right
		{ x: obj.x + obj.width / 2, y: obj.y + obj.height }, // bottom
		{ x: obj.x, y: obj.y + obj.height / 2 }, // left
	]
}

export function ConnectionHandles({
	object,
	onStartConnect,
}: ConnectionHandlesProps) {
	const points = getEdgeMidpoints(object)

	return (
		<>
			{points.map((pt, i) => (
				<Circle
					key={i}
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
						if (stage) stage.container().style.cursor = "crosshair"
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
					onClick={(e) => {
						e.cancelBubble = true
						onStartConnect(object.id, pt)
					}}
					hitStrokeWidth={8}
				/>
			))}
		</>
	)
}
