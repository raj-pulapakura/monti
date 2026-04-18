## MODIFIED Requirements

### Requirement: Keep looping until no more tool invocations
The runtime MUST continue the conversation model tool loop through repeated assistant/tool turns until the model emits a terminal message with no further tool calls. When a tool call requires confirmation, the loop SHALL pause (status `awaiting_confirmation`) rather than exit with an error. The loop resumes from the paused position when the user confirms or cancels. Loop continuation after a cancelled tool call SHALL proceed normally — the LLM receives the cancellation result and generates a response.

#### Scenario: Multiple tool calls in one conversation run
- **WHEN** the conversation model emits sequential tool calls before final response
- **THEN** the runtime executes each tool call in order and resumes model inference after each tool result

#### Scenario: Terminal response after tool sequence
- **WHEN** the final model turn includes no tool calls
- **THEN** the runtime finalizes the conversation run and emits terminal run event(s)

#### Scenario: Tool call requires confirmation — loop pauses
- **WHEN** the conversation model emits a tool call where `requiresConfirmation` returns `true`
- **THEN** the runtime writes the assistant tool-call message, marks the run `awaiting_confirmation`, emits `confirmation_required`, and exits the loop without executing the tool

#### Scenario: User confirms — loop resumes and continues
- **WHEN** the user confirms a paused run
- **THEN** the loop re-enters from the paused position, executes the confirmed tool with the user-selected quality mode, writes the tool result, and continues iterating remaining tool calls in the same set

#### Scenario: User cancels — loop resumes with cancelled result
- **WHEN** the user cancels a paused run
- **THEN** the loop re-enters, writes a tool result `{ status: 'cancelled', operation }`, routes that result back to the LLM, and the LLM generates an acknowledgement response; the run completes normally

#### Scenario: Next tool call after confirmed one also requires confirmation
- **WHEN** after a confirmed tool executes, the next tool call in the same set also has `requiresConfirmation: true`
- **THEN** the loop pauses again with an updated `confirmation_tool_call_id`, emits a new `confirmation_required` event, and waits for the next user decision
