import type { AIChatMessage as ChatMessage } from "../../types/ai-agent"
import { AIMessageDetails } from "./AIMessageDetails"

interface AIChatMessageProps {
	message: ChatMessage
}

export function AIChatMessage({ message }: AIChatMessageProps) {
	const isUser = message.role === "user"
	const isAction = message.executionStatus != null

	if (isUser) {
		return (
			<div className="flex justify-end">
				<div className="max-w-[85%] bg-purple-500 text-white text-sm px-3 py-2 rounded-2xl rounded-br-md">
					{message.content}
				</div>
			</div>
		)
	}

	return (
		<div className="flex justify-start">
			<div
				className={`max-w-[85%] text-sm px-3 py-2 rounded-2xl rounded-bl-md ${
					isAction
						? "bg-purple-50 border border-purple-200"
						: "bg-gray-100 text-gray-800"
				}`}
			>
				{isAction && (
					<div className="flex items-center gap-1.5 mb-1">
						{message.executionStatus === "executed" ? (
							<span className="text-green-500 text-xs">✓</span>
						) : (
							<span className="text-purple-500 text-xs animate-pulse">
								⟳
							</span>
						)}
						<span className="text-xs font-medium text-purple-700">
							{message.executionStatus === "executed"
								? `Executed ${message.toolCalls?.reduce((sum, c) => sum + ((c.name === "bulkCreateObjects" ? (c.input as Record<string, number>)?.["count"] : null) || 1), 0) ?? 0} operation(s)`
								: "Executing..."}
						</span>
					</div>
				)}
				<div className="whitespace-pre-wrap">{message.content}</div>
				<AIMessageDetails
					toolCalls={message.toolCalls}
					meta={message.meta}
				/>
			</div>
		</div>
	)
}
