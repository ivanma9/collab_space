import { useState, useCallback, useRef } from "react"
import { supabase } from "../lib/supabase"
import type { BoardObject } from "../lib/database.types"
import type {
	AIChatMessage,
	AIAgentResponse,
	AIToolCallResult,
} from "../types/ai-agent"

const PADDING = 40

export function findOpenArea(
	objects: BoardObject[],
): { x: number; y: number; width: number; height: number } {
	if (objects.length === 0) {
		return { x: 100, y: 100, width: 2000, height: 2000 }
	}
	const placed = objects.filter((o) => o.type !== "connector")
	if (placed.length === 0) {
		return { x: 100, y: 100, width: 2000, height: 2000 }
	}
	let minX = Infinity,
		minY = Infinity,
		maxX = -Infinity,
		maxY = -Infinity
	for (const obj of placed) {
		minX = Math.min(minX, obj.x)
		minY = Math.min(minY, obj.y)
		maxX = Math.max(maxX, obj.x + obj.width)
		maxY = Math.max(maxY, obj.y + obj.height)
	}
	const rightX = maxX + PADDING
	const rightArea = {
		x: rightX,
		y: minY,
		width: 2000,
		height: maxY - minY + 1000,
	}
	const belowY = maxY + PADDING
	const belowArea = {
		x: minX,
		y: belowY,
		width: maxX - minX + 1000,
		height: 2000,
	}
	const boardWidth = maxX - minX
	const boardHeight = maxY - minY
	return boardHeight > boardWidth ? belowArea : rightArea
}

export const STICKY_COLORS: Record<string, string> = {
	yellow: "#FFD700",
	pink: "#FF6B6B",
	blue: "#4ECDC4",
	green: "#95E1D3",
	orange: "#FFA07A",
	purple: "#9B59B6",
}

export const SHAPE_COLORS: Record<string, string> = {
	red: "#FF6B6B",
	blue: "#4ECDC4",
	green: "#95E1D3",
	yellow: "#FFD700",
	orange: "#FFA07A",
	purple: "#9B59B6",
	gray: "#636E72",
	white: "#FFFFFF",
}

export interface UseAIAgentOptions {
	boardId: string
	objects: BoardObject[]
	createObject: (
		obj: Omit<
			BoardObject,
			"id" | "created_at" | "updated_at" | "created_by"
		> & {
			id?: string
		},
	) => Promise<void>
	updateObject: (id: string, updates: Partial<BoardObject>) => Promise<void>
}

export function useAIAgent({
	boardId,
	objects,
	createObject,
	updateObject,
}: UseAIAgentOptions) {
	const [messages, setMessages] = useState<AIChatMessage[]>([])
	const [isProcessing, setIsProcessing] = useState(false)
	const [suggestions, setSuggestions] = useState<string[]>([])
	const objectsRef = useRef(objects)
	objectsRef.current = objects
	const messagesRef = useRef(messages)
	messagesRef.current = messages

	function buildApiMessages(
		chatMessages: AIChatMessage[],
	): { role: "user" | "assistant"; content: string }[] {
		return chatMessages
			.filter((m) => m.content && m.content.trim().length > 0)
			.map((m) => ({ role: m.role, content: m.content }))
			.slice(-7)
	}

	const sendMessage = useCallback(
		async (text: string) => {
			const userMsg: AIChatMessage = {
				id: crypto.randomUUID(),
				role: "user",
				content: text,
				timestamp: Date.now(),
			}

			setMessages((prev) => [...prev, userMsg])
			setIsProcessing(true)
			setSuggestions([])

			try {
				const allMessages = [...messagesRef.current, userMsg]
				const apiMessages = buildApiMessages(allMessages)
				const openArea = findOpenArea(objectsRef.current)
				const boardState = objectsRef.current.map((obj) => ({
					id: obj.id,
					type: obj.type,
					x: obj.x,
					y: obj.y,
					width: obj.width,
					height: obj.height,
					data: obj.data,
				}))

				const { data, error: fnError } = await supabase.functions.invoke(
					"ai-agent",
					{
						body: {
							messages: apiMessages,
							boardState,
							boardId,
							openArea,
						},
					},
				)
				if (fnError) throw fnError

				const response = data as AIAgentResponse

				if (response.type === "clarification") {
					const assistantMsg: AIChatMessage = {
						id: crypto.randomUUID(),
						role: "assistant",
						content: response.message || "What would you like me to create?",
						timestamp: Date.now(),
						suggestions: response.suggestions,
						meta: response.meta,
					}
					setMessages((prev) => [...prev, assistantMsg])
					setSuggestions(response.suggestions)
				} else {
					const msgId = crypto.randomUUID()
					const assistantMsg: AIChatMessage = {
						id: msgId,
						role: "assistant",
						content:
							response.plan ||
							`Executed ${response.toolCalls.length} operation(s)`,
						timestamp: Date.now(),
						toolCalls: response.toolCalls,
						meta: response.meta,
						executionStatus: "pending",
					}
					setMessages((prev) => [...prev, assistantMsg])
					setSuggestions([])

					// Auto-execute (fast path)
					await executeToolCalls(response.toolCalls)
					setMessages((prev) =>
						prev.map((m) =>
							m.id === msgId
								? {
										...m,
										executionStatus: "executed" as const,
									}
								: m,
						),
					)
				}
			} catch {
				const errorMsg: AIChatMessage = {
					id: crypto.randomUUID(),
					role: "assistant",
					content: "AI command failed. Try again.",
					timestamp: Date.now(),
				}
				setMessages((prev) => [...prev, errorMsg])
			} finally {
				setIsProcessing(false)
			}
		},
		[boardId],
	)

	async function executeToolCalls(toolCalls: AIToolCallResult[]) {
		const currentObjects = objectsRef.current
		let zOffset = 0
		for (const call of toolCalls) {
			try {
				await executeToolCall(
					call,
					currentObjects,
					currentObjects.length + zOffset,
				)
				zOffset++
			} catch (err) {
				console.error(`Tool call "${call.name}" failed, skipping:`, err)
			}
		}
	}

	async function executeToolCall(
		call: AIToolCallResult,
		currentObjects: BoardObject[],
		zIndex: number,
	) {
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const { input } = call as { input: any }

		const mergeData = (objectId: string, patch: Record<string, any>) => {
			const existing = currentObjects.find((o) => o.id === objectId)
			return updateObject(objectId, {
				data: { ...(existing?.data as any), ...patch },
			})
		}

		switch (call.name) {
			case "createStickyNote":
				return createObject({
					id: input.id,
					board_id: boardId,
					type: "sticky_note",
					x: input.x,
					y: input.y,
					width: 200,
					height: 200,
					rotation: 0,
					z_index: zIndex,
					data: {
						text: input.text,
						color: STICKY_COLORS[input.color] ?? input.color,
					},
				})
			case "createShape": {
				const color = SHAPE_COLORS[input.color] ?? input.color
				const shapeType = input.shapeType as
					| "rectangle"
					| "circle"
					| "line"
				const shapeData =
					shapeType === "circle"
						? {
								radius:
									Math.min(input.width, input.height) / 2,
								fillColor: color,
								strokeColor: "#2D3436",
								strokeWidth: 2,
							}
						: shapeType === "line"
							? {
									points: [
										0,
										0,
										input.width,
										input.height,
									],
									strokeColor: color,
									strokeWidth: 4,
								}
							: {
									fillColor: color,
									strokeColor: "#2D3436",
									strokeWidth: 2,
								}
				return createObject({
					id: input.id,
					board_id: boardId,
					type: shapeType,
					x: input.x,
					y: input.y,
					width: input.width,
					height: input.height,
					rotation: 0,
					z_index: zIndex,
					data: shapeData,
				})
			}
			case "createFrame":
				return createObject({
					id: input.id,
					board_id: boardId,
					type: "frame",
					x: input.x,
					y: input.y,
					width: input.width,
					height: input.height,
					rotation: 0,
					z_index: -(
						currentObjects.filter((o) => o.type === "frame")
							.length + 1
					),
					data: {
						title: input.title,
						backgroundColor: "rgba(240,240,240,0.5)",
					},
				})
			case "createTextBox":
				return createObject({
					id: input.id,
					board_id: boardId,
					type: "text",
					x: input.x,
					y: input.y,
					width: 200,
					height: 50,
					rotation: 0,
					z_index: zIndex,
					data: {
						text: input.text,
						fontSize: input.fontSize ?? 16,
						color: input.color ?? "#000000",
					},
				})
			case "createConnector":
				return createObject({
					id: input.id,
					board_id: boardId,
					type: "connector",
					x: 0,
					y: 0,
					width: 0,
					height: 0,
					rotation: 0,
					z_index: zIndex,
					data: {
						fromId: input.fromId,
						toId: input.toId,
						style: input.style,
					},
				})
			case "moveObject":
				return updateObject(input.objectId, {
					x: input.x,
					y: input.y,
				})
			case "resizeObject":
				return updateObject(input.objectId, {
					width: input.width,
					height: input.height,
				})
			case "updateStickyNoteText":
			case "updateTextBoxContent":
				return mergeData(input.objectId, { text: input.newText })
			case "changeColor": {
				const colorHex =
					SHAPE_COLORS[input.color] ??
					STICKY_COLORS[input.color] ??
					input.color
				return mergeData(input.objectId, {
					color: colorHex,
					fillColor: colorHex,
				})
			}
			case "getBoardState":
				return
			case "bulkCreateObjects": {
				const { objectType, count, startX, startY, columns, template } = input
				const w = template.width ?? (objectType === "sticky_note" ? 200 : objectType === "frame" ? 800 : objectType === "text" ? 200 : 150)
				const h = template.height ?? (objectType === "sticky_note" ? 200 : objectType === "frame" ? 600 : objectType === "text" ? 50 : 100)
				const gap = 20
				const chunkSize = 50

				for (let chunk = 0; chunk < count; chunk += chunkSize) {
					const batch: Promise<void>[] = []
					const end = Math.min(chunk + chunkSize, count)
					for (let i = chunk; i < end; i++) {
						const col = i % columns
						const row = Math.floor(i / columns)
						const x = startX + col * (w + gap)
						const y = startY + row * (h + gap)
						const n = i + 1
						const id = crypto.randomUUID()
						const resolveTemplate = (s: string | undefined) =>
							s?.replace(/\{n\}/g, String(n))
						// eslint-disable-next-line @typescript-eslint/no-explicit-any
						let objData: Record<string, any> = {}
						let type: string = objectType
						switch (objectType) {
							case "sticky_note":
								objData = {
									text: resolveTemplate(template.text) ?? `Note ${n}`,
									color: STICKY_COLORS[template.color] ?? template.color ?? STICKY_COLORS["yellow"],
								}
								break
							case "shape": {
								const color = SHAPE_COLORS[template.color] ?? template.color ?? SHAPE_COLORS["blue"]
								const shapeType = template.shapeType ?? "rectangle"
								type = shapeType
								objData = shapeType === "circle"
									? { radius: Math.min(w, h) / 2, fillColor: color, strokeColor: "#2D3436", strokeWidth: 2 }
									: shapeType === "line"
										? { points: [0, 0, w, h], strokeColor: color, strokeWidth: 4 }
										: { fillColor: color, strokeColor: "#2D3436", strokeWidth: 2 }
								break
							}
							case "frame":
								objData = {
									title: resolveTemplate(template.title) ?? `Frame ${n}`,
									backgroundColor: "rgba(240,240,240,0.5)",
								}
								break
							case "text":
								objData = {
									text: resolveTemplate(template.text) ?? `Text ${n}`,
									fontSize: template.fontSize ?? 16,
									color: template.color ?? "#000000",
								}
								break
						}
						const zIdx = objectType === "frame"
							? -(currentObjects.filter((o) => o.type === "frame").length + i + 1)
							: zIndex + i
						batch.push(
							createObject({
								id,
								board_id: boardId,
								type: type as BoardObject["type"],
								x, y, width: w, height: h,
								rotation: 0,
								z_index: zIdx,
								data: objData as BoardObject["data"],
							}),
						)
					}
					await Promise.all(batch)
				}
				return
			}
		}
	}

	const clearChat = useCallback(() => {
		setMessages([])
		setSuggestions([])
	}, [])

	return {
		messages,
		suggestions,
		isProcessing,
		sendMessage,
		clearChat,
	}
}
