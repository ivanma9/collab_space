import { useState } from "react"
import type { AIMessageMeta, AIToolCallResult } from "../../types/ai-agent"

interface AIMessageDetailsProps {
	toolCalls?: AIToolCallResult[]
	meta?: AIMessageMeta
}

const BRAINTRUST_BASE_URL = "https://www.braintrust.dev/app"

function getToolSummary(call: AIToolCallResult): string {
	const input = call.input as Record<string, unknown>
	const label =
		(input["text"] as string) ??
		(input["title"] as string) ??
		(input["newText"] as string) ??
		(input["objectId"] as string) ??
		""
	const short = label.length > 30 ? label.slice(0, 30) + "…" : label
	return short ? `${call.name} → "${short}"` : call.name
}

export function AIMessageDetails({ toolCalls, meta }: AIMessageDetailsProps) {
	const [isOpen, setIsOpen] = useState(false)

	if (!toolCalls?.length && !meta) return null

	return (
		<div className="mt-1.5">
			<button
				onClick={() => setIsOpen(!isOpen)}
				className="text-[10px] text-gray-400 hover:text-gray-600 transition flex items-center gap-1"
			>
				<span
					className="transform transition-transform"
					style={{
						display: "inline-block",
						transform: isOpen ? "rotate(90deg)" : "rotate(0deg)",
					}}
				>
					▸
				</span>
				{toolCalls?.length
					? `${toolCalls.length} tool${toolCalls.length > 1 ? "s" : ""}`
					: ""}
				{meta
					? `${toolCalls?.length ? " · " : ""}${meta.inputTokens + meta.outputTokens} tokens · ${(meta.latencyMs / 1000).toFixed(1)}s`
					: ""}
			</button>

			{isOpen && (
				<div className="mt-1 pl-2 border-l-2 border-gray-100 text-[11px] text-gray-500 space-y-0.5">
					{toolCalls?.map((call, i) => (
						<div key={i} className="font-mono">
							▸ {getToolSummary(call)}
						</div>
					))}
					{meta && (
						<>
							<div className="mt-1 text-gray-400">
								{meta.inputTokens} input · {meta.outputTokens} output ·{" "}
								{(meta.latencyMs / 1000).toFixed(1)}s
							</div>
							{meta.braintrustTraceId && (
								<a
									href={`${BRAINTRUST_BASE_URL}/CollabBoard%20Agent/logs?traceId=${meta.braintrustTraceId}`}
									target="_blank"
									rel="noopener noreferrer"
									className="text-purple-500 hover:text-purple-700 underline"
								>
									View full trace in Braintrust
								</a>
							)}
						</>
					)}
				</div>
			)}
		</div>
	)
}
