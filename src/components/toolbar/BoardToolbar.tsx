import { useState, useRef, useEffect, useCallback } from "react"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Tool =
	| "select"
	| "sticky_note"
	| "rectangle"
	| "circle"
	| "line"
	| "text"
	| "frame"

interface BoardToolbarProps {
	activeTool: Tool
	onToolSelect: (tool: Tool) => void
	onDelete: () => void
	canDelete: boolean
	deleteCount: number
	isLoading: boolean
	activeColor: string
	onColorChange: (color: string) => void
	hasSelection: boolean
}

// ---------------------------------------------------------------------------
// Icons (inline SVG for zero-dependency icons)
// ---------------------------------------------------------------------------

function CursorIcon() {
	return (
		<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
			<path d="M4 4l7.07 17 2.51-7.39L21 11.07z" />
		</svg>
	)
}

function StickyNoteIcon() {
	return (
		<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
			<path d="M15.5 3H5a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2V8.5L15.5 3z" />
			<polyline points="14 3 14 8 21 8" />
		</svg>
	)
}

function ShapesIcon() {
	return (
		<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
			<rect x="3" y="3" width="18" height="18" rx="2" />
		</svg>
	)
}

function RectangleIcon() {
	return (
		<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
			<rect x="3" y="5" width="18" height="14" rx="2" />
		</svg>
	)
}

function CircleIcon() {
	return (
		<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
			<circle cx="12" cy="12" r="10" />
		</svg>
	)
}

function LineIcon() {
	return (
		<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
			<line x1="5" y1="19" x2="19" y2="5" />
		</svg>
	)
}

function TextIcon() {
	return (
		<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
			<polyline points="4 7 4 4 20 4 20 7" />
			<line x1="9" y1="20" x2="15" y2="20" />
			<line x1="12" y1="4" x2="12" y2="20" />
		</svg>
	)
}

function FrameIcon() {
	return (
		<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
			<rect x="3" y="3" width="18" height="18" rx="0" />
			<line x1="3" y1="9" x2="21" y2="9" />
			<line x1="9" y1="3" x2="9" y2="9" />
		</svg>
	)
}

function TrashIcon() {
	return (
		<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
			<polyline points="3 6 5 6 21 6" />
			<path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" />
			<path d="M10 11v6" />
			<path d="M14 11v6" />
			<path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2" />
		</svg>
	)
}

function ChevronDownIcon() {
	return (
		<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
			<polyline points="6 9 12 15 18 9" />
		</svg>
	)
}

// ---------------------------------------------------------------------------
// Toolbar Button
// ---------------------------------------------------------------------------

function ToolButton({
	icon,
	label,
	isActive,
	onClick,
	disabled,
	badge,
	children,
	testId,
}: {
	icon: React.ReactNode
	label: string
	isActive?: boolean
	onClick: () => void
	disabled?: boolean
	badge?: React.ReactNode
	children?: React.ReactNode
	testId?: string
}) {
	return (
		<div className="relative group">
			<button
				onClick={onClick}
				disabled={disabled}
				data-testid={testId}
				className={`relative flex items-center justify-center w-10 h-10 rounded-lg transition-all duration-150 ${
					isActive
						? "bg-blue-100 text-blue-600 shadow-inner"
						: disabled
							? "text-gray-300 cursor-not-allowed"
							: "text-gray-600 hover:bg-gray-100 hover:text-gray-800"
				}`}
				title={label}
			>
				{icon}
				{badge}
			</button>
			{/* Tooltip */}
			<div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 px-2 py-1 bg-gray-800 text-white text-xs rounded-md whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity duration-150">
				{label}
			</div>
			{children}
		</div>
	)
}

// ---------------------------------------------------------------------------
// Shapes Flyout
// ---------------------------------------------------------------------------

const SHAPE_TOOLS: { tool: Tool; icon: React.ReactNode; label: string }[] = [
	{ tool: "rectangle", icon: <RectangleIcon />, label: "Rectangle" },
	{ tool: "circle", icon: <CircleIcon />, label: "Circle" },
	{ tool: "line", icon: <LineIcon />, label: "Line" },
]

function ShapesFlyout({
	activeTool,
	onToolSelect,
	isLoading,
}: {
	activeTool: Tool
	onToolSelect: (tool: Tool) => void
	isLoading: boolean
}) {
	const [open, setOpen] = useState(false)
	const ref = useRef<HTMLDivElement>(null)
	const isShapeActive = ["rectangle", "circle", "line"].includes(activeTool)

	// Active shape icon — show the currently selected shape type
	const activeShapeIcon = SHAPE_TOOLS.find((s) => s.tool === activeTool)?.icon ?? <ShapesIcon />

	// Close on outside click
	useEffect(() => {
		if (!open) return
		const handler = (e: MouseEvent) => {
			if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
		}
		document.addEventListener("mousedown", handler)
		return () => document.removeEventListener("mousedown", handler)
	}, [open])

	return (
		<div ref={ref} className="relative group">
			<button
				onClick={() => setOpen((v) => !v)}
				disabled={isLoading}
				data-testid="shapes-flyout-trigger"
				className={`relative flex items-center justify-center w-10 h-10 rounded-lg transition-all duration-150 ${
					isShapeActive
						? "bg-blue-100 text-blue-600 shadow-inner"
						: isLoading
							? "text-gray-300 cursor-not-allowed"
							: "text-gray-600 hover:bg-gray-100 hover:text-gray-800"
				}`}
				title="Shapes"
			>
				{activeShapeIcon}
				<span className="absolute bottom-1 right-1">
					<ChevronDownIcon />
				</span>
			</button>

			{/* Tooltip (only when flyout is closed) */}
			{!open && (
				<div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 px-2 py-1 bg-gray-800 text-white text-xs rounded-md whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity duration-150">
					Shapes
				</div>
			)}

			{/* Flyout menu */}
			{open && (
				<div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 bg-white rounded-xl shadow-xl border border-gray-200 p-1.5 flex gap-1">
					{SHAPE_TOOLS.map((s) => (
						<button
							key={s.tool}
							onClick={() => {
								onToolSelect(s.tool)
								setOpen(false)
							}}
							className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-all ${
								activeTool === s.tool
									? "bg-blue-100 text-blue-600"
									: "text-gray-600 hover:bg-gray-100"
							}`}
							data-testid={`${s.tool}-tool`}
						>
							{s.icon}
							<span className="text-xs font-medium">{s.label}</span>
						</button>
					))}
				</div>
			)}
		</div>
	)
}

// ---------------------------------------------------------------------------
// Divider
// ---------------------------------------------------------------------------

function Divider() {
	return <div className="w-px h-6 bg-gray-200 mx-0.5" />
}

// ---------------------------------------------------------------------------
// Color Button
// ---------------------------------------------------------------------------

const PALETTE = [
	"#FFD700",
	"#FF6B6B",
	"#4ECDC4",
	"#45B7D1",
	"#96CEB4",
	"#A29BFE",
	"#FFA07A",
	"#DFE6E9",
] as const

function ColorButton({
	activeColor,
	onColorChange,
}: {
	activeColor: string
	onColorChange: (color: string) => void
}) {
	const [open, setOpen] = useState(false)
	const ref = useRef<HTMLDivElement>(null)

	useEffect(() => {
		if (!open) return
		const handler = (e: MouseEvent) => {
			if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
		}
		document.addEventListener("mousedown", handler)
		return () => document.removeEventListener("mousedown", handler)
	}, [open])

	return (
		<div ref={ref} className="relative group">
			<button
				onClick={() => setOpen((v) => !v)}
				className="relative flex items-center justify-center w-10 h-10 rounded-lg transition-all duration-150 text-gray-600 hover:bg-gray-100 hover:text-gray-800"
				title="Color"
				data-testid="color-button"
			>
				<span
					className="w-5 h-5 rounded-full border-2 border-white shadow-sm ring-1 ring-gray-300"
					style={{ background: activeColor }}
				/>
			</button>

			{/* Tooltip */}
			{!open && (
				<div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 px-2 py-1 bg-gray-800 text-white text-xs rounded-md whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity duration-150">
					Color
				</div>
			)}

			{/* Swatch popover */}
			{open && (
				<div
					className="absolute top-full left-1/2 -translate-x-1/2 mt-2 bg-white rounded-xl shadow-xl border border-gray-200 p-2 flex gap-1.5"
					data-testid="color-popover"
				>
					{PALETTE.map((color) => (
						<button
							key={color}
							onClick={() => {
								onColorChange(color)
								setOpen(false)
							}}
							className="w-6 h-6 rounded-full border-2 transition-transform hover:scale-110 focus:outline-none"
							style={{
								background: color,
								borderColor: color === activeColor ? "#4A90E2" : "transparent",
								boxShadow: color === activeColor ? "0 0 0 2px #4A90E2" : undefined,
							}}
							title={color}
							data-testid={`color-swatch-${color}`}
						/>
					))}
				</div>
			)}
		</div>
	)
}

// ---------------------------------------------------------------------------
// Main Toolbar
// ---------------------------------------------------------------------------

export function BoardToolbar({
	activeTool,
	onToolSelect,
	onDelete,
	canDelete,
	deleteCount,
	isLoading,
	activeColor,
	onColorChange,
	hasSelection: _hasSelection,
}: BoardToolbarProps) {
	const handleToolClick = useCallback(
		(tool: Tool) => {
			if (!isLoading) onToolSelect(tool)
		},
		[isLoading, onToolSelect],
	)

	return (
		<div className="absolute top-14 left-1/2 -translate-x-1/2 z-20">
			<div className="flex items-center gap-0.5 bg-white rounded-2xl shadow-xl border border-gray-200 px-2 py-1.5">
				{/* Select / Cursor */}
				<ToolButton
					icon={<CursorIcon />}
					label="Select (V)"
					isActive={activeTool === "select"}
					onClick={() => handleToolClick("select")}
				/>

				<Divider />

				{/* Sticky Note */}
				<ToolButton
					icon={<StickyNoteIcon />}
					label="Sticky Note (S)"
					isActive={activeTool === "sticky_note"}
					onClick={() => handleToolClick("sticky_note")}
					disabled={isLoading}
					testId="sticky-note-tool"
				/>

				{/* Shapes flyout */}
				<ShapesFlyout
					activeTool={activeTool}
					onToolSelect={onToolSelect}
					isLoading={isLoading}
				/>

				{/* Text */}
				<ToolButton
					icon={<TextIcon />}
					label="Text (T)"
					isActive={activeTool === "text"}
					onClick={() => handleToolClick("text")}
					disabled={isLoading}
					testId="text-tool"
				/>

				{/* Frame */}
				<ToolButton
					icon={<FrameIcon />}
					label="Frame (F)"
					isActive={activeTool === "frame"}
					onClick={() => handleToolClick("frame")}
					disabled={isLoading}
					testId="frame-tool"
				/>

				<Divider />
				<ColorButton activeColor={activeColor} onColorChange={onColorChange} />
				<Divider />
				{/* Delete */}
				<ToolButton
					icon={<TrashIcon />}
					label={canDelete ? `Delete (${deleteCount})` : "Delete"}
					onClick={onDelete}
					disabled={!canDelete}
					badge={
						canDelete ? (
							<span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
								{deleteCount}
							</span>
						) : null
					}
				/>
			</div>
		</div>
	)
}
