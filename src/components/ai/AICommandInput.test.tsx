import { describe, it, expect, vi } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { AICommandInput } from "./AICommandInput"

function defaultProps(overrides: Partial<Parameters<typeof AICommandInput>[0]> = {}) {
	return {
		onSubmit: vi.fn(),
		isProcessing: false,
		lastResult: null,
		error: null,
		...overrides,
	}
}

describe("AICommandInput", () => {
	// ── Rendering ──────────────────────────────────────────
	it("renders input and send button", () => {
		render(<AICommandInput {...defaultProps()} />)
		expect(screen.getByPlaceholderText(/ask ai/i)).toBeInTheDocument()
		expect(screen.getByRole("button", { name: /send/i })).toBeInTheDocument()
	})

	it("submit button is disabled when input is empty", () => {
		render(<AICommandInput {...defaultProps()} />)
		expect(screen.getByRole("button", { name: /send/i })).toBeDisabled()
	})

	// ── Form submission ────────────────────────────────────
	it("calls onSubmit with trimmed text and clears input", async () => {
		const onSubmit = vi.fn()
		const user = userEvent.setup()
		render(<AICommandInput {...defaultProps({ onSubmit })} />)

		const input = screen.getByPlaceholderText(/ask ai/i)
		await user.type(input, "  create a sticky  ")
		await user.click(screen.getByRole("button", { name: /send/i }))

		expect(onSubmit).toHaveBeenCalledWith("create a sticky")
		expect(input).toHaveValue("")
	})

	it("submits on Enter key", async () => {
		const onSubmit = vi.fn()
		const user = userEvent.setup()
		render(<AICommandInput {...defaultProps({ onSubmit })} />)

		const input = screen.getByPlaceholderText(/ask ai/i)
		await user.type(input, "add note{Enter}")

		expect(onSubmit).toHaveBeenCalledWith("add note")
	})

	it("does not submit empty or whitespace-only input", async () => {
		const onSubmit = vi.fn()
		const user = userEvent.setup()
		render(<AICommandInput {...defaultProps({ onSubmit })} />)

		const input = screen.getByPlaceholderText(/ask ai/i)
		await user.type(input, "   {Enter}")

		expect(onSubmit).not.toHaveBeenCalled()
	})

	it("does not submit when processing", async () => {
		const onSubmit = vi.fn()
		render(<AICommandInput {...defaultProps({ onSubmit, isProcessing: true })} />)

		const input = screen.getByPlaceholderText(/ask ai/i)
		expect(input).toBeDisabled()
	})

	// ── Processing state ───────────────────────────────────
	it("shows processing indicator", () => {
		render(<AICommandInput {...defaultProps({ isProcessing: true })} />)
		expect(screen.getByText(/ai is working/i)).toBeInTheDocument()
		expect(screen.getByRole("button")).toHaveTextContent("...")
	})

	// ── Success state ──────────────────────────────────────
	it("shows success result", () => {
		render(
			<AICommandInput
				{...defaultProps({ lastResult: "Done — executed 3 operation(s)" })}
			/>,
		)
		expect(screen.getByText(/done — executed 3 operation/i)).toBeInTheDocument()
	})

	// ── Error state ────────────────────────────────────────
	it("shows error message", () => {
		render(
			<AICommandInput {...defaultProps({ error: "AI command failed. Try again." })} />,
		)
		expect(screen.getByText(/ai command failed/i)).toBeInTheDocument()
	})

	it("does not show error while processing", () => {
		render(
			<AICommandInput
				{...defaultProps({ error: "some error", isProcessing: true })}
			/>,
		)
		expect(screen.queryByText(/some error/)).not.toBeInTheDocument()
	})

	// ── Example prompts ────────────────────────────────────
	it("shows example prompts on focus", async () => {
		render(<AICommandInput {...defaultProps()} />)
		const input = screen.getByPlaceholderText(/ask ai/i)

		fireEvent.focus(input)
		expect(screen.getByText(/swot analysis/i)).toBeInTheDocument()
		expect(screen.getByText(/retro board/i)).toBeInTheDocument()
	})

	it("clicking example fills the input", async () => {
		render(<AICommandInput {...defaultProps()} />)
		const input = screen.getByPlaceholderText(/ask ai/i)

		fireEvent.focus(input)
		const example = screen.getByText(/swot analysis/i)
		fireEvent.mouseDown(example)

		expect(input).toHaveValue("Create a SWOT analysis with 4 labeled frames")
	})
})
