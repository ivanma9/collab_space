/**
 * Coaching Framework Templates
 *
 * Pure data definitions for pre-built coaching frameworks.
 * All offsets are relative to a base origin (0,0) — the caller
 * translates them to the actual placement position on the board.
 */

export interface TemplateSlot {
	type: "frame" | "sticky_note" | "text"
	offsetX: number
	offsetY: number
	width: number
	height: number
	zIndexOffset: number
	data: Record<string, unknown>
}

export interface CoachingTemplate {
	id: string
	name: string
	description: string
	slots: Array<TemplateSlot>
}

// ---------------------------------------------------------------------------
// Helper to build a 2x2 quadrant layout
// ---------------------------------------------------------------------------

function quadrant2x2(
	labels: [string, string, string, string],
): Array<TemplateSlot> {
	const fw = 420
	const fh = 320
	const gap = 20
	const positions = [
		{ col: 0, row: 0 },
		{ col: 1, row: 0 },
		{ col: 0, row: 1 },
		{ col: 1, row: 1 },
	] as const

	const slots: Array<TemplateSlot> = []

	// Frames (zIndexOffset negative so they stay behind)
	positions.forEach(({ col, row }, index) => {
		const ox = col * (fw + gap)
		const oy = row * (fh + gap) + 40 // offset for header text
		slots.push({
			type: "frame",
			offsetX: ox,
			offsetY: oy,
			width: fw,
			height: fh,
			zIndexOffset: -(index + 1),
			data: {
				title: labels[index],
				backgroundColor: "rgba(240,240,240,0.5)",
			},
		})
		// Placeholder sticky inside each frame
		slots.push({
			type: "sticky_note",
			offsetX: ox + 20,
			offsetY: oy + 50,
			width: 180,
			height: 140,
			zIndexOffset: index + 10,
			data: {
				text: `Add ${labels[index]} items here...`,
				color: "#FFD700",
			},
		})
	})

	return slots
}

// ---------------------------------------------------------------------------
// Template definitions
// ---------------------------------------------------------------------------

const GROW: CoachingTemplate = {
	id: "grow",
	name: "GROW",
	description: "Goal / Reality / Options / Will",
	slots: [
		{
			type: "text",
			offsetX: 0,
			offsetY: 0,
			width: 300,
			height: 36,
			zIndexOffset: 20,
			data: { text: "GROW Framework", fontSize: 24, color: "#2D3436" },
		},
		...quadrant2x2(["Goal", "Reality", "Options", "Will"]),
	],
}

const SWOT: CoachingTemplate = {
	id: "swot",
	name: "SWOT",
	description: "Strengths / Weaknesses / Opportunities / Threats",
	slots: [
		{
			type: "text",
			offsetX: 0,
			offsetY: 0,
			width: 300,
			height: 36,
			zIndexOffset: 20,
			data: { text: "SWOT Analysis", fontSize: 24, color: "#2D3436" },
		},
		...quadrant2x2([
			"Strengths",
			"Weaknesses",
			"Opportunities",
			"Threats",
		]),
	],
}

const WHEEL_OF_LIFE: CoachingTemplate = {
	id: "wheelOfLife",
	name: "Wheel of Life",
	description: "Rate 8 life areas on a 1-10 scale",
	slots: ((): Array<TemplateSlot> => {
		const areas = [
			"Career",
			"Finance",
			"Health",
			"Family",
			"Relationships",
			"Personal Growth",
			"Fun & Recreation",
			"Physical Environment",
		]
		const slots: Array<TemplateSlot> = [
			{
				type: "text",
				offsetX: 0,
				offsetY: 0,
				width: 300,
				height: 36,
				zIndexOffset: 20,
				data: {
					text: "Wheel of Life",
					fontSize: 24,
					color: "#2D3436",
				},
			},
		]
		const rowH = 70
		const colors = [
			"#FF6B6B",
			"#FFD700",
			"#4ECDC4",
			"#95E1D3",
			"#FFA07A",
			"#9B59B6",
			"#45B7D1",
			"#A29BFE",
		]
		areas.forEach((area, index) => {
			// Label text
			slots.push({
				type: "text",
				offsetX: 0,
				offsetY: 50 + index * rowH,
				width: 200,
				height: 30,
				zIndexOffset: index + 10,
				data: { text: area, fontSize: 16, color: "#2D3436" },
			})
			// Score sticky
			slots.push({
				type: "sticky_note",
				offsetX: 220,
				offsetY: 45 + index * rowH,
				width: 120,
				height: 50,
				zIndexOffset: index + 10,
				data: { text: "_ / 10", color: colors[index] },
			})
		})
		return slots
	})(),
}

const VALUES_CLARIFICATION: CoachingTemplate = {
	id: "values",
	name: "Values Clarification",
	description: "Rank your top values",
	slots: ((): Array<TemplateSlot> => {
		const slots: Array<TemplateSlot> = [
			{
				type: "text",
				offsetX: 0,
				offsetY: 0,
				width: 300,
				height: 36,
				zIndexOffset: 20,
				data: {
					text: "Values Clarification",
					fontSize: 24,
					color: "#2D3436",
				},
			},
			{
				type: "frame",
				offsetX: 0,
				offsetY: 50,
				width: 400,
				height: 520,
				zIndexOffset: -1,
				data: {
					title: "My Top Values",
					backgroundColor: "rgba(240,240,240,0.5)",
				},
			},
		]
		const colors = [
			"#FF6B6B",
			"#FFD700",
			"#4ECDC4",
			"#95E1D3",
			"#FFA07A",
			"#9B59B6",
		]
		for (let index = 0; index < 6; index++) {
			slots.push({
				type: "sticky_note",
				offsetX: 20,
				offsetY: 100 + index * 70,
				width: 360,
				height: 55,
				zIndexOffset: index + 10,
				data: {
					text: `#${index + 1} — `,
					color: colors[index],
				},
			})
		}
		return slots
	})(),
}

const OKR_BOARD: CoachingTemplate = {
	id: "okr",
	name: "OKR Board",
	description: "1 Objective + 3 Key Results",
	slots: [
		{
			type: "text",
			offsetX: 0,
			offsetY: 0,
			width: 300,
			height: 36,
			zIndexOffset: 20,
			data: { text: "OKR Board", fontSize: 24, color: "#2D3436" },
		},
		// Objective frame
		{
			type: "frame",
			offsetX: 0,
			offsetY: 50,
			width: 860,
			height: 120,
			zIndexOffset: -1,
			data: {
				title: "Objective",
				backgroundColor: "rgba(230,240,255,0.6)",
			},
		},
		{
			type: "sticky_note",
			offsetX: 20,
			offsetY: 90,
			width: 400,
			height: 60,
			zIndexOffset: 10,
			data: { text: "Define your objective here...", color: "#4ECDC4" },
		},
		// Key Result frames
		...[0, 1, 2].flatMap((index) => {
			const krX = index * 290
			return [
				{
					type: "frame" as const,
					offsetX: krX,
					offsetY: 200,
					width: 270,
					height: 220,
					zIndexOffset: -(index + 2),
					data: {
						title: `Key Result ${index + 1}`,
						backgroundColor: "rgba(240,240,240,0.5)",
					},
				},
				{
					type: "sticky_note" as const,
					offsetX: krX + 20,
					offsetY: 250,
					width: 230,
					height: 80,
					zIndexOffset: index + 11,
					data: {
						text: `KR${index + 1}: ...`,
						color: ["#FFD700", "#FF6B6B", "#95E1D3"][index],
					},
				},
				{
					type: "text" as const,
					offsetX: krX + 20,
					offsetY: 350,
					width: 200,
					height: 30,
					zIndexOffset: index + 14,
					data: {
						text: "Progress: 0%",
						fontSize: 14,
						color: "#636E72",
					},
				},
			]
		}),
	],
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

export const COACHING_TEMPLATES: Array<CoachingTemplate> = [
	GROW,
	SWOT,
	WHEEL_OF_LIFE,
	VALUES_CLARIFICATION,
	OKR_BOARD,
]

export const TEMPLATE_NAMES: Record<string, string> = {
	grow: "GROW",
	swot: "SWOT",
	wheelOfLife: "Wheel of Life",
	values: "Values Clarification",
	okr: "OKR Board",
}
