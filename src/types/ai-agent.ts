export interface AIMessageMeta {
	inputTokens: number
	outputTokens: number
	latencyMs: number
	model: string

}

export interface AIToolCallResult {
	name: string
	input: Record<string, unknown>
}

export interface AIClarificationResponse {
	type: "clarification"
	message: string
	suggestions: string[]
	meta: AIMessageMeta
}

export interface AIExecutionResponse {
	type: "execution"
	plan?: string
	toolCalls: AIToolCallResult[]
	meta: AIMessageMeta
}

export type AIAgentResponse = AIClarificationResponse | AIExecutionResponse

export interface AIChatMessage {
	id: string
	role: "user" | "assistant"
	content: string
	timestamp: number
	toolCalls?: AIToolCallResult[]
	suggestions?: string[]
	meta?: AIMessageMeta
	executionStatus?: "pending" | "executed"
}
