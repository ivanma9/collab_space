import { useState, useRef, useEffect } from "react"
import type { AIChatMessage as ChatMessageType } from "../../types/ai-agent"
import { AIChatMessage } from "./AIChatMessage"
import { AISuggestionChips } from "./AISuggestionChips"

const EXAMPLES = [
	"Create a SWOT analysis with 4 labeled frames",
	'Add a sticky note that says "User Research"',
	"Create a 2x3 grid of sticky notes for pros and cons",
	"Set up a retro board: What Went Well, What Didn't, Action Items",
]

interface AIPanelProps {
	isOpen: boolean
	onClose: () => void
	messages: ChatMessageType[]
	suggestions: string[]
	isProcessing: boolean
	onSendMessage: (text: string) => void
	onClearChat: () => void
}

export function AIPanel({
	isOpen,
	onClose,
	messages,
	suggestions,
	isProcessing,
	onSendMessage,
	onClearChat,
}: AIPanelProps) {
	const [input, setInput] = useState("")
	const messagesEndRef = useRef<HTMLDivElement>(null)
	const inputRef = useRef<HTMLInputElement>(null)

	useEffect(() => {
		messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
	}, [messages])

	useEffect(() => {
		if (isOpen) inputRef.current?.focus()
	}, [isOpen])

	const handleSubmit = (e: React.FormEvent) => {
		e.preventDefault()
		const trimmed = input.trim()
		if (!trimmed || isProcessing) return
		onSendMessage(trimmed)
		setInput("")
	}

	const handleChipClick = (text: string) => {
		if (isProcessing) return
		onSendMessage(text)
		setInput("")
	}

	if (!isOpen) return null

	return (
		<div className="fixed top-0 right-0 h-full w-[350px] bg-white border-l border-gray-200 shadow-xl z-30 flex flex-col">
			{/* Header */}
			<div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
				<div className="flex items-center gap-2">
					<span className="text-lg">&#10024;</span>
					<h2 className="text-sm font-semibold text-gray-800">
						AI Agent
					</h2>
				</div>
				<div className="flex items-center gap-1">
					{messages.length > 0 && (
						<button
							onClick={onClearChat}
							className="text-xs text-gray-400 hover:text-gray-600 px-2 py-1 rounded transition"
							title="Clear chat"
						>
							Clear
						</button>
					)}
					<button
						onClick={onClose}
						className="text-gray-400 hover:text-gray-600 p-1 rounded transition"
					>
						&#10005;
					</button>
				</div>
			</div>

			{/* Messages area */}
			<div className="flex-1 overflow-y-auto px-3 py-3 space-y-3">
				{messages.length === 0 && (
					<div className="text-center py-8">
						<p className="text-sm text-gray-400 mb-4">
							Ask AI to create or arrange content on your board
						</p>
						<div className="space-y-2">
							{EXAMPLES.map((ex) => (
								<button
									key={ex}
									onClick={() => handleChipClick(ex)}
									disabled={isProcessing}
									className="block w-full text-left text-xs px-3 py-2 bg-gray-50 hover:bg-purple-50 hover:text-purple-600 rounded-lg transition text-gray-600 border border-gray-100"
								>
									{ex}
								</button>
							))}
						</div>
					</div>
				)}

				{messages.map((msg) => (
					<AIChatMessage key={msg.id} message={msg} />
				))}

				{isProcessing && (
					<div className="flex justify-start">
						<div className="bg-gray-100 text-sm px-3 py-2 rounded-2xl rounded-bl-md text-purple-600 animate-pulse">
							AI is thinking...
						</div>
					</div>
				)}

				<div ref={messagesEndRef} />
			</div>

			{/* Suggestion chips */}
			{suggestions.length > 0 && !isProcessing && (
				<AISuggestionChips
					suggestions={suggestions}
					onSelect={handleChipClick}
					disabled={isProcessing}
				/>
			)}

			{/* Input area */}
			<form
				onSubmit={handleSubmit}
				className="border-t border-gray-100 px-3 py-2.5 flex items-center gap-2"
			>
				<input
					ref={inputRef}
					type="text"
					value={input}
					onChange={(e) => setInput(e.target.value)}
					placeholder="Message AI agent..."
					className="flex-1 text-sm outline-none text-gray-700 placeholder-gray-400 bg-transparent"
					disabled={isProcessing}
				/>
				<button
					type="submit"
					disabled={!input.trim() || isProcessing}
					className="px-3 py-1.5 bg-purple-500 hover:bg-purple-600 disabled:bg-gray-200 disabled:text-gray-400 text-white text-sm rounded-lg font-medium transition flex-shrink-0"
				>
					{isProcessing ? "..." : "Send"}
				</button>
			</form>
		</div>
	)
}
