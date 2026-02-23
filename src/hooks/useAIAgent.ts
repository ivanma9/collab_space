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

export interface JourneyContext {
	clientName?: string
	currentSessionNumber?: number
	activeGoals?: Array<{ title: string; status: string; commitments?: string[] }>
	recentSummaries?: Array<{ session_number: number; summary: string }>
	aiMemory?: { key_themes?: string[]; client_notes?: string } | null
}

const SESSION_ZONE_WIDTH = 1800
const SESSION_ZONE_HEIGHT = 1200
const SESSION_ZONE_SPACING = 2000
const SESSION_ZONE_PADDING = 40

/** Compute the open area within a session frame for AI object placement */
function getSessionOpenArea(
	sessionNumber: number,
	objects: BoardObject[],
): { x: number; y: number; width: number; height: number } {
	const frameX = (sessionNumber - 1) * SESSION_ZONE_SPACING
	const frameY = 0
	// Find objects already inside this session zone
	const zoneObjects = objects.filter(
		(o) =>
			o.type !== "connector" &&
			o.x >= frameX &&
			o.x < frameX + SESSION_ZONE_WIDTH &&
			o.y >= frameY &&
			o.y < frameY + SESSION_ZONE_HEIGHT,
	)
	if (zoneObjects.length === 0) {
		// Empty zone — start after the title bar area
		return {
			x: frameX + SESSION_ZONE_PADDING,
			y: frameY + 80,
			width: SESSION_ZONE_WIDTH - SESSION_ZONE_PADDING * 2,
			height: SESSION_ZONE_HEIGHT - 80 - SESSION_ZONE_PADDING,
		}
	}
	// Find rightmost + bottommost occupied point within the zone
	let maxX = -Infinity
	let maxY = -Infinity
	for (const obj of zoneObjects) {
		maxX = Math.max(maxX, obj.x + obj.width)
		maxY = Math.max(maxY, obj.y + obj.height)
	}
	// Try placing to the right of existing content
	const rightX = maxX + 20
	const remainingWidth = frameX + SESSION_ZONE_WIDTH - SESSION_ZONE_PADDING - rightX
	if (remainingWidth >= 200) {
		return { x: rightX, y: frameY + 80, width: remainingWidth, height: SESSION_ZONE_HEIGHT - 80 - SESSION_ZONE_PADDING }
	}
	// Fall back to below existing content
	const belowY = maxY + 20
	return {
		x: frameX + SESSION_ZONE_PADDING,
		y: belowY,
		width: SESSION_ZONE_WIDTH - SESSION_ZONE_PADDING * 2,
		height: Math.max(SESSION_ZONE_HEIGHT - belowY + frameY, 400),
	}
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
	journeyContext?: JourneyContext | null
}

export function useAIAgent({
	boardId,
	objects,
	createObject,
	updateObject,
	journeyContext,
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
				const openArea =
					journeyContext?.currentSessionNumber != null
						? getSessionOpenArea(journeyContext.currentSessionNumber, objectsRef.current)
						: findOpenArea(objectsRef.current)
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
							journeyContext: journeyContext ?? undefined,
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

					// Detect suggestFramework tool calls and push apply: chips
					const frameworkSuggestions = response.toolCalls
						.filter((c) => c.name === "suggestFramework")
						.map((c) => `apply:${(c.input as Record<string, string>)["frameworkId"]}`)
					if (frameworkSuggestions.length > 0) {
						setSuggestions(frameworkSuggestions)
					} else {
						// Suggest adding connectors if multiple objects were created without any
						const createNames = ["createStickyNote", "createShape", "createFrame", "createTextBox"]
						const creates = response.toolCalls.filter((c) => createNames.includes(c.name))
						const hasConnectors = response.toolCalls.some((c) => c.name === "createConnector")
						if (creates.length >= 2 && !hasConnectors) {
							setSuggestions(["Connect these with arrows", "Add dashed connectors"])
						}
					}
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
		// Map AI-generated IDs to real UUIDs so connectors resolve correctly
		const idMap = new Map<string, string>()
		let zOffset = 0
		for (const call of toolCalls) {
			try {
				await executeToolCall(
					call,
					currentObjects,
					currentObjects.length + zOffset,
					idMap,
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
		idMap: Map<string, string>,
	) {
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const { input } = call as { input: any }

		// Replace AI-generated IDs with real UUIDs (or generate one if missing)
		const refKey = input.id
		const realId = crypto.randomUUID()
		if (refKey) idMap.set(refKey, realId)
		input.id = realId
		// Resolve connector references through the map
		if (input.fromId) input.fromId = idMap.get(input.fromId) ?? input.fromId
		if (input.toId) input.toId = idMap.get(input.toId) ?? input.toId

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
			case "createGoal":
				return createObject({
					id: input.id,
					board_id: boardId,
					type: "goal",
					x: input.x,
					y: input.y,
					width: 280,
					height: 200,
					rotation: 0,
					z_index: zIndex,
					data: {
						title: input.title,
						status: "active",
						commitments: input.commitments ?? [],
						due_date: input.due_date ?? undefined,
					},
				})
			case "updateGoalStatus": {
				const goal = currentObjects.find((o) => o.id === input.objectId)
				if (!goal) return
				return updateObject(input.objectId, {
					data: {
						...(goal.data as any),
						status: input.status,
					},
				})
			}
			case "createSessionSummary":
				return createObject({
					id: input.id,
					board_id: boardId,
					type: "sticky_note",
					x: input.x,
					y: input.y,
					width: 300,
					height: 300,
					rotation: 0,
					z_index: zIndex,
					data: {
						text: `📋 Session Summary\n\n${input.summary}\n\n🏷️ Themes: ${(input.keyThemes ?? []).join(", ")}`,
						color: "#E8F5E9",
					},
				})
			case "recallContext":
				// recallContext is informational — the AI uses journeyContext from the system prompt
				// No board action needed; the AI will respond with recalled info in its message
			case "suggestFramework":
				// Informational only — no board action. Suggestion chips are handled after execution.
				return
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

	/**
	 * Generate a structured session summary via the AI agent.
	 * Returns { summary, keyThemes } or null if AI call fails.
	 * Does NOT add to chat history — this is a silent background call.
	 */
	const generateSessionSummary = useCallback(
		async (): Promise<{ summary: string; keyThemes: string[] } | null> => {
			try {
				const sessionNum = journeyContext?.currentSessionNumber
				const openArea =
					sessionNum != null
						? getSessionOpenArea(sessionNum, objectsRef.current)
						: findOpenArea(objectsRef.current)

				// Filter to only objects within the active session frame
				const allObjects = objectsRef.current
				const sessionObjects =
					sessionNum != null
						? allObjects.filter((obj) => {
								// Include objects spatially inside the session zone
								const frameX = (sessionNum - 1) * SESSION_ZONE_SPACING
								const inZone =
									obj.x >= frameX &&
									obj.x < frameX + SESSION_ZONE_WIDTH &&
									obj.y < SESSION_ZONE_HEIGHT
								// Also include connectors that reference session objects
								if (obj.type === "connector") {
									const d = obj.data as { fromId?: string; toId?: string }
									return allObjects.some(
										(o) =>
											(o.id === d.fromId || o.id === d.toId) &&
											o.x >= frameX &&
											o.x < frameX + SESSION_ZONE_WIDTH,
									)
								}
								return inZone
							})
						: allObjects

				const boardState = sessionObjects
					.filter((obj) => obj.type !== "frame") // exclude the session frame itself
					.map((obj) => ({
						id: obj.id,
						type: obj.type,
						x: obj.x,
						y: obj.y,
						width: obj.width,
						height: obj.height,
						data: obj.data,
					}))

				const prompt =
					"Please summarize this coaching session. Review all the objects shown — sticky notes, goals, and text — and create a concise session summary that captures: key topics discussed, decisions made, goals created or updated, and action items. Use the createSessionSummary tool with your summary and key themes."

				const { data, error: fnError } = await supabase.functions.invoke(
					"ai-agent",
					{
						body: {
							messages: [{ role: "user", content: prompt }],
							boardState,
							boardId,
							openArea,
							journeyContext: journeyContext ?? undefined,
						},
					},
				)
				if (fnError || !data) return null

				const response = data as AIAgentResponse
				if (response.type !== "execution") return null

				const summaryCall = response.toolCalls.find(
					(c) => c.name === "createSessionSummary",
				)
				if (!summaryCall) return null

				const input = summaryCall.input as {
					summary: string
					keyThemes: string[]
					x: number
					y: number
				}
				return {
					summary: input.summary,
					keyThemes: input.keyThemes ?? [],
				}
			} catch {
				return null
			}
		},
		[boardId, journeyContext],
	)

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
		generateSessionSummary,
	}
}
