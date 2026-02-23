import { TEMPLATE_NAMES } from "../../lib/templates"

interface AISuggestionChipsProps {
	suggestions: string[]
	onSelect: (text: string) => void
	disabled?: boolean
}

function chipLabel(suggestion: string): string {
	if (suggestion.startsWith("apply:")) {
		const id = suggestion.slice(6)
		return `Apply ${TEMPLATE_NAMES[id] ?? id} template`
	}
	return suggestion
}

export function AISuggestionChips({
	suggestions,
	onSelect,
	disabled,
}: AISuggestionChipsProps) {
	if (suggestions.length === 0) return null

	return (
		<div className="flex flex-wrap gap-1.5 px-3 py-2">
			{suggestions.map((suggestion) => {
				const isTemplate = suggestion.startsWith("apply:")
				return (
					<button
						key={suggestion}
						onClick={() => onSelect(suggestion)}
						disabled={disabled}
						className={`text-xs px-3 py-1.5 rounded-full border transition disabled:opacity-50 disabled:cursor-not-allowed ${
							isTemplate
								? "bg-green-50 hover:bg-green-100 text-green-700 border-green-200"
								: "bg-purple-50 hover:bg-purple-100 text-purple-700 border-purple-200"
						}`}
					>
						{chipLabel(suggestion)}
					</button>
				)
			})}
		</div>
	)
}
