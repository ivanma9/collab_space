interface AISuggestionChipsProps {
	suggestions: string[]
	onSelect: (text: string) => void
	disabled?: boolean
}

export function AISuggestionChips({
	suggestions,
	onSelect,
	disabled,
}: AISuggestionChipsProps) {
	if (suggestions.length === 0) return null

	return (
		<div className="flex flex-wrap gap-1.5 px-3 py-2">
			{suggestions.map((suggestion) => (
				<button
					key={suggestion}
					onClick={() => onSelect(suggestion)}
					disabled={disabled}
					className="text-xs px-3 py-1.5 bg-purple-50 hover:bg-purple-100 text-purple-700 rounded-full border border-purple-200 transition disabled:opacity-50 disabled:cursor-not-allowed"
				>
					{suggestion}
				</button>
			))}
		</div>
	)
}
