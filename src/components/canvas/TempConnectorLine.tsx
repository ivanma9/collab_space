import { memo } from "react";
import { Arrow } from "react-konva";

interface TempConnectorLineProps {
	fromPoint: { x: number; y: number };
	toPoint: { x: number; y: number };
}

export const TempConnectorLine = memo(function TempConnectorLine({
	fromPoint,
	toPoint,
}: TempConnectorLineProps) {
	return (
		<Arrow
			points={[fromPoint.x, fromPoint.y, toPoint.x, toPoint.y]}
			stroke="#555555"
			strokeWidth={2}
			fill="#555555"
			pointerLength={10}
			pointerWidth={8}
			dash={[6, 3]}
			listening={false}
		/>
	);
})
