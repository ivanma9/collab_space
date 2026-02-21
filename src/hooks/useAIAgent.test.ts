import { describe, it, expect, vi, beforeEach } from "vitest"
import { renderHook, act } from "@testing-library/react"
import {
	findOpenArea,
	useAIAgent,
	STICKY_COLORS,
	SHAPE_COLORS,
} from "./useAIAgent"
import type { BoardObject } from "../lib/database.types"

// ── Mock supabase ──────────────────────────────────────────────
const mockInvoke = vi.fn()
vi.mock("../lib/supabase", () => ({
	supabase: { functions: { invoke: (...args: unknown[]) => mockInvoke(...args) } },
}))

// ── Helpers ────────────────────────────────────────────────────
function makeObject(
	overrides: Partial<BoardObject> & { type: BoardObject["type"] },
): BoardObject {
	return {
		id: crypto.randomUUID(),
		board_id: "board-1",
		x: 0,
		y: 0,
		width: 200,
		height: 200,
		rotation: 0,
		z_index: 0,
		created_by: null,
		created_at: new Date().toISOString(),
		updated_at: new Date().toISOString(),
		data: { text: "test", color: "#FFD700" },
		...overrides,
	} as BoardObject
}

function defaultHookOpts(overrides: Partial<Parameters<typeof useAIAgent>[0]> = {}) {
	return {
		boardId: "board-1",
		objects: [] as BoardObject[],
		createObject: vi.fn().mockResolvedValue(undefined),
		updateObject: vi.fn().mockResolvedValue(undefined),
		...overrides,
	}
}

// ═══════════════════════════════════════════════════════════════
// findOpenArea
// ═══════════════════════════════════════════════════════════════
describe("findOpenArea", () => {
	it("returns default area for empty board", () => {
		expect(findOpenArea([])).toEqual({ x: 100, y: 100, width: 2000, height: 2000 })
	})

	it("returns default area when only connectors exist", () => {
		const connector = makeObject({
			type: "connector",
			x: 0,
			y: 0,
			width: 0,
			height: 0,
			data: { fromId: "a", toId: "b", style: "arrow" as const },
		})
		expect(findOpenArea([connector])).toEqual({ x: 100, y: 100, width: 2000, height: 2000 })
	})

	it("places to the right of a wide board", () => {
		const obj = makeObject({ type: "sticky_note", x: 0, y: 0, width: 500, height: 100 })
		const area = findOpenArea([obj])
		// Board is wider than tall → place to right
		expect(area.x).toBe(500 + 40) // maxX + PADDING
		expect(area.y).toBe(0)
	})

	it("places below a tall board", () => {
		const obj = makeObject({ type: "sticky_note", x: 0, y: 0, width: 100, height: 500 })
		const area = findOpenArea([obj])
		// Board is taller than wide → place below
		expect(area.y).toBe(500 + 40) // maxY + PADDING
		expect(area.x).toBe(0)
	})

	it("computes bounding box from multiple objects", () => {
		const objs = [
			makeObject({ type: "sticky_note", x: 100, y: 50, width: 200, height: 200 }),
			makeObject({ type: "sticky_note", x: 400, y: 300, width: 200, height: 200 }),
		]
		const area = findOpenArea(objs)
		// maxX = 600, maxY = 500, width=500, height=450 → taller not true, wider → right
		expect(area.x).toBe(600 + 40)
	})
})

// ═══════════════════════════════════════════════════════════════
// Color maps
// ═══════════════════════════════════════════════════════════════
describe("color maps", () => {
	it("STICKY_COLORS has all 6 named colors", () => {
		expect(Object.keys(STICKY_COLORS)).toEqual(
			expect.arrayContaining(["yellow", "pink", "blue", "green", "orange", "purple"]),
		)
		expect(Object.keys(STICKY_COLORS)).toHaveLength(6)
	})

	it("SHAPE_COLORS has all 8 named colors", () => {
		expect(Object.keys(SHAPE_COLORS)).toEqual(
			expect.arrayContaining(["red", "blue", "green", "yellow", "orange", "purple", "gray", "white"]),
		)
		expect(Object.keys(SHAPE_COLORS)).toHaveLength(8)
	})

	it("all color values are valid hex strings", () => {
		const allColors = { ...STICKY_COLORS, ...SHAPE_COLORS }
		for (const hex of Object.values(allColors)) {
			expect(hex).toMatch(/^#[0-9A-Fa-f]{6}$/)
		}
	})
})

// ═══════════════════════════════════════════════════════════════
// useAIAgent hook — executeCommand
// ═══════════════════════════════════════════════════════════════
describe("useAIAgent", () => {
	beforeEach(() => {
		vi.clearAllMocks()
	})

	it("starts with idle state", () => {
		const { result } = renderHook(() => useAIAgent(defaultHookOpts()))
		expect(result.current.isProcessing).toBe(false)
		expect(result.current.lastResult).toBeNull()
		expect(result.current.error).toBeNull()
	})

	// ── createStickyNote ─────────────────────────────────────
	it("executes createStickyNote tool call", async () => {
		const createObject = vi.fn().mockResolvedValue(undefined)
		mockInvoke.mockResolvedValue({
			data: {
				toolCalls: [
					{
						name: "createStickyNote",
						input: { id: "uuid-1", text: "Hello", x: 100, y: 200, color: "yellow" },
					},
				],
			},
		})

		const { result } = renderHook(() =>
			useAIAgent(defaultHookOpts({ createObject })),
		)

		await act(() => result.current.executeCommand("add a sticky"))

		expect(createObject).toHaveBeenCalledWith(
			expect.objectContaining({
				id: "uuid-1",
				type: "sticky_note",
				x: 100,
				y: 200,
				width: 200,
				height: 200,
				data: { text: "Hello", color: "#FFD700" },
			}),
		)
		expect(result.current.lastResult).toBe("Done — executed 1 operation(s)")
		expect(result.current.isProcessing).toBe(false)
	})

	// ── createShape: rectangle ───────────────────────────────
	it("executes createShape rectangle with correct data", async () => {
		const createObject = vi.fn().mockResolvedValue(undefined)
		mockInvoke.mockResolvedValue({
			data: {
				toolCalls: [
					{
						name: "createShape",
						input: {
							id: "uuid-r",
							shapeType: "rectangle",
							x: 10,
							y: 20,
							width: 150,
							height: 100,
							color: "blue",
						},
					},
				],
			},
		})

		const { result } = renderHook(() =>
			useAIAgent(defaultHookOpts({ createObject })),
		)
		await act(() => result.current.executeCommand("create rect"))

		expect(createObject).toHaveBeenCalledWith(
			expect.objectContaining({
				type: "rectangle",
				data: { fillColor: "#4ECDC4", strokeColor: "#2D3436", strokeWidth: 2 },
			}),
		)
	})

	// ── createShape: circle ──────────────────────────────────
	it("executes createShape circle with radius", async () => {
		const createObject = vi.fn().mockResolvedValue(undefined)
		mockInvoke.mockResolvedValue({
			data: {
				toolCalls: [
					{
						name: "createShape",
						input: {
							id: "uuid-c",
							shapeType: "circle",
							x: 0,
							y: 0,
							width: 100,
							height: 80,
							color: "red",
						},
					},
				],
			},
		})

		const { result } = renderHook(() =>
			useAIAgent(defaultHookOpts({ createObject })),
		)
		await act(() => result.current.executeCommand("create circle"))

		expect(createObject).toHaveBeenCalledWith(
			expect.objectContaining({
				type: "circle",
				data: {
					radius: 40, // min(100,80)/2
					fillColor: "#FF6B6B",
					strokeColor: "#2D3436",
					strokeWidth: 2,
				},
			}),
		)
	})

	// ── createShape: line ────────────────────────────────────
	it("executes createShape line with points array", async () => {
		const createObject = vi.fn().mockResolvedValue(undefined)
		mockInvoke.mockResolvedValue({
			data: {
				toolCalls: [
					{
						name: "createShape",
						input: {
							id: "uuid-l",
							shapeType: "line",
							x: 50,
							y: 50,
							width: 200,
							height: 100,
							color: "green",
						},
					},
				],
			},
		})

		const { result } = renderHook(() =>
			useAIAgent(defaultHookOpts({ createObject })),
		)
		await act(() => result.current.executeCommand("create line"))

		expect(createObject).toHaveBeenCalledWith(
			expect.objectContaining({
				type: "line",
				data: { points: [0, 0, 200, 100], strokeColor: "#95E1D3", strokeWidth: 4 },
			}),
		)
	})

	// ── createFrame ──────────────────────────────────────────
	it("executes createFrame with negative z_index", async () => {
		const createObject = vi.fn().mockResolvedValue(undefined)
		mockInvoke.mockResolvedValue({
			data: {
				toolCalls: [
					{
						name: "createFrame",
						input: { id: "uuid-f", title: "Sprint", x: 0, y: 0, width: 800, height: 600 },
					},
				],
			},
		})

		const { result } = renderHook(() =>
			useAIAgent(defaultHookOpts({ createObject })),
		)
		await act(() => result.current.executeCommand("create frame"))

		expect(createObject).toHaveBeenCalledWith(
			expect.objectContaining({
				type: "frame",
				z_index: -1, // negative to render behind
				data: { title: "Sprint", backgroundColor: "rgba(240,240,240,0.5)" },
			}),
		)
	})

	// ── createTextBox ────────────────────────────────────────
	it("executes createTextBox with defaults", async () => {
		const createObject = vi.fn().mockResolvedValue(undefined)
		mockInvoke.mockResolvedValue({
			data: {
				toolCalls: [
					{
						name: "createTextBox",
						input: { id: "uuid-t", text: "Title", x: 50, y: 50 },
					},
				],
			},
		})

		const { result } = renderHook(() =>
			useAIAgent(defaultHookOpts({ createObject })),
		)
		await act(() => result.current.executeCommand("add text"))

		expect(createObject).toHaveBeenCalledWith(
			expect.objectContaining({
				type: "text",
				width: 200,
				height: 50,
				data: { text: "Title", fontSize: 16, color: "#000000" },
			}),
		)
	})

	// ── createConnector ──────────────────────────────────────
	it("executes createConnector", async () => {
		const createObject = vi.fn().mockResolvedValue(undefined)
		mockInvoke.mockResolvedValue({
			data: {
				toolCalls: [
					{
						name: "createConnector",
						input: { id: "uuid-conn", fromId: "a", toId: "b", style: "arrow" },
					},
				],
			},
		})

		const { result } = renderHook(() =>
			useAIAgent(defaultHookOpts({ createObject })),
		)
		await act(() => result.current.executeCommand("connect"))

		expect(createObject).toHaveBeenCalledWith(
			expect.objectContaining({
				type: "connector",
				x: 0,
				y: 0,
				width: 0,
				height: 0,
				data: { fromId: "a", toId: "b", style: "arrow" },
			}),
		)
	})

	// ── moveObject ───────────────────────────────────────────
	it("executes moveObject", async () => {
		const updateObject = vi.fn().mockResolvedValue(undefined)
		mockInvoke.mockResolvedValue({
			data: {
				toolCalls: [
					{ name: "moveObject", input: { objectId: "obj-1", x: 300, y: 400 } },
				],
			},
		})

		const { result } = renderHook(() =>
			useAIAgent(defaultHookOpts({ updateObject })),
		)
		await act(() => result.current.executeCommand("move it"))

		expect(updateObject).toHaveBeenCalledWith("obj-1", { x: 300, y: 400 })
	})

	// ── resizeObject ─────────────────────────────────────────
	it("executes resizeObject", async () => {
		const updateObject = vi.fn().mockResolvedValue(undefined)
		mockInvoke.mockResolvedValue({
			data: {
				toolCalls: [
					{ name: "resizeObject", input: { objectId: "obj-1", width: 500, height: 300 } },
				],
			},
		})

		const { result } = renderHook(() =>
			useAIAgent(defaultHookOpts({ updateObject })),
		)
		await act(() => result.current.executeCommand("resize it"))

		expect(updateObject).toHaveBeenCalledWith("obj-1", { width: 500, height: 300 })
	})

	// ── updateStickyNoteText ─────────────────────────────────
	it("executes updateStickyNoteText via mergeData", async () => {
		const existingNote = makeObject({
			id: "note-1",
			type: "sticky_note",
			data: { text: "old", color: "#FFD700" },
		})
		const updateObject = vi.fn().mockResolvedValue(undefined)
		mockInvoke.mockResolvedValue({
			data: {
				toolCalls: [
					{ name: "updateStickyNoteText", input: { objectId: "note-1", newText: "new text" } },
				],
			},
		})

		const { result } = renderHook(() =>
			useAIAgent(defaultHookOpts({ objects: [existingNote], updateObject })),
		)
		await act(() => result.current.executeCommand("change text"))

		expect(updateObject).toHaveBeenCalledWith("note-1", {
			data: { text: "new text", color: "#FFD700" },
		})
	})

	// ── updateTextBoxContent ─────────────────────────────────
	it("executes updateTextBoxContent via mergeData", async () => {
		const existingText = makeObject({
			id: "text-1",
			type: "text",
			data: { text: "old", fontSize: 16, color: "#000000" },
		})
		const updateObject = vi.fn().mockResolvedValue(undefined)
		mockInvoke.mockResolvedValue({
			data: {
				toolCalls: [
					{ name: "updateTextBoxContent", input: { objectId: "text-1", newText: "updated" } },
				],
			},
		})

		const { result } = renderHook(() =>
			useAIAgent(defaultHookOpts({ objects: [existingText], updateObject })),
		)
		await act(() => result.current.executeCommand("update text"))

		expect(updateObject).toHaveBeenCalledWith("text-1", {
			data: { text: "updated", fontSize: 16, color: "#000000" },
		})
	})

	// ── changeColor ──────────────────────────────────────────
	it("executes changeColor with named color lookup", async () => {
		const existingObj = makeObject({
			id: "obj-1",
			type: "sticky_note",
			data: { text: "hello", color: "#FFD700" },
		})
		const updateObject = vi.fn().mockResolvedValue(undefined)
		mockInvoke.mockResolvedValue({
			data: {
				toolCalls: [
					{ name: "changeColor", input: { objectId: "obj-1", color: "purple" } },
				],
			},
		})

		const { result } = renderHook(() =>
			useAIAgent(defaultHookOpts({ objects: [existingObj], updateObject })),
		)
		await act(() => result.current.executeCommand("change color"))

		expect(updateObject).toHaveBeenCalledWith("obj-1", {
			data: { text: "hello", color: "#9B59B6", fillColor: "#9B59B6" },
		})
	})

	it("changeColor falls through to raw hex if name not found", async () => {
		const existingObj = makeObject({
			id: "obj-1",
			type: "sticky_note",
			data: { text: "test", color: "#000" },
		})
		const updateObject = vi.fn().mockResolvedValue(undefined)
		mockInvoke.mockResolvedValue({
			data: {
				toolCalls: [
					{ name: "changeColor", input: { objectId: "obj-1", color: "#FF00FF" } },
				],
			},
		})

		const { result } = renderHook(() =>
			useAIAgent(defaultHookOpts({ objects: [existingObj], updateObject })),
		)
		await act(() => result.current.executeCommand("change color"))

		expect(updateObject).toHaveBeenCalledWith("obj-1", {
			data: { text: "test", color: "#FF00FF", fillColor: "#FF00FF" },
		})
	})

	// ── getBoardState (no-op) ────────────────────────────────
	it("getBoardState is a no-op", async () => {
		const createObject = vi.fn()
		const updateObject = vi.fn()
		mockInvoke.mockResolvedValue({
			data: { toolCalls: [{ name: "getBoardState", input: {} }] },
		})

		const { result } = renderHook(() =>
			useAIAgent(defaultHookOpts({ createObject, updateObject })),
		)
		await act(() => result.current.executeCommand("get state"))

		expect(createObject).not.toHaveBeenCalled()
		expect(updateObject).not.toHaveBeenCalled()
		expect(result.current.lastResult).toBe("Done — executed 1 operation(s)")
	})

	// ── Multiple tool calls ──────────────────────────────────
	it("executes multiple tool calls sequentially with incrementing z_index", async () => {
		const createObject = vi.fn().mockResolvedValue(undefined)
		mockInvoke.mockResolvedValue({
			data: {
				toolCalls: [
					{
						name: "createStickyNote",
						input: { id: "s1", text: "A", x: 0, y: 0, color: "yellow" },
					},
					{
						name: "createStickyNote",
						input: { id: "s2", text: "B", x: 200, y: 0, color: "pink" },
					},
				],
			},
		})

		const { result } = renderHook(() =>
			useAIAgent(defaultHookOpts({ createObject })),
		)
		await act(() => result.current.executeCommand("create two stickies"))

		expect(createObject).toHaveBeenCalledTimes(2)
		// First call z_index = objects.length + 0 = 0
		expect(createObject.mock.calls[0][0].z_index).toBe(0)
		// Second call z_index = objects.length + 1 = 1
		expect(createObject.mock.calls[1][0].z_index).toBe(1)
		expect(result.current.lastResult).toBe("Done — executed 2 operation(s)")
	})

	// ── Error: no tool calls ─────────────────────────────────
	it("sets error when no tool calls returned", async () => {
		mockInvoke.mockResolvedValue({ data: { toolCalls: [] } })

		const { result } = renderHook(() => useAIAgent(defaultHookOpts()))
		await act(() => result.current.executeCommand("do nothing"))

		expect(result.current.error).toBe(
			"The AI couldn't determine the correct action. Please try rephrasing your request.",
		)
		expect(result.current.isProcessing).toBe(false)
	})

	it("sets error when toolCalls is undefined", async () => {
		mockInvoke.mockResolvedValue({ data: {} })

		const { result } = renderHook(() => useAIAgent(defaultHookOpts()))
		await act(() => result.current.executeCommand("bad command"))

		expect(result.current.error).toContain("couldn't determine")
	})

	// ── Error: function invoke fails ─────────────────────────
	it("sets generic error when edge function throws", async () => {
		mockInvoke.mockResolvedValue({ error: new Error("Server error") })

		const { result } = renderHook(() => useAIAgent(defaultHookOpts()))
		await act(() => result.current.executeCommand("fail"))

		expect(result.current.error).toBe("AI command failed. Try again.")
	})

	// ── Error: individual tool call failure is skipped ────────
	it("skips failed tool calls and still reports success", async () => {
		const createObject = vi.fn()
			.mockRejectedValueOnce(new Error("DB error"))
			.mockResolvedValueOnce(undefined)
		mockInvoke.mockResolvedValue({
			data: {
				toolCalls: [
					{ name: "createStickyNote", input: { id: "s1", text: "A", x: 0, y: 0, color: "yellow" } },
					{ name: "createStickyNote", input: { id: "s2", text: "B", x: 200, y: 0, color: "blue" } },
				],
			},
		})

		const { result } = renderHook(() =>
			useAIAgent(defaultHookOpts({ createObject })),
		)
		await act(() => result.current.executeCommand("create two"))

		expect(createObject).toHaveBeenCalledTimes(2)
		expect(result.current.lastResult).toBe("Done — executed 2 operation(s)")
		expect(result.current.error).toBeNull()
	})

	// ── Request payload ──────────────────────────────────────
	it("sends correct payload to edge function", async () => {
		const note = makeObject({
			id: "n-1",
			type: "sticky_note",
			x: 100,
			y: 100,
			width: 200,
			height: 200,
		})
		mockInvoke.mockResolvedValue({ data: { toolCalls: [] } })

		const { result } = renderHook(() =>
			useAIAgent(defaultHookOpts({ objects: [note] })),
		)
		await act(() => result.current.executeCommand("hello"))

		expect(mockInvoke).toHaveBeenCalledWith("ai-agent", {
			body: expect.objectContaining({
				command: "hello",
				boardId: "board-1",
				boardState: [
					expect.objectContaining({ id: "n-1", type: "sticky_note", x: 100, y: 100 }),
				],
				openArea: expect.objectContaining({ x: expect.any(Number), y: expect.any(Number) }),
			}),
		})
	})
})
