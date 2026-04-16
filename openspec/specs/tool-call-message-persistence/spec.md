# tool-call-message-persistence Specification

## Purpose

Persist assistant tool-call turns and tool results as durable `chat_messages` rows so conversation history remains correct for multi-turn LLM requests and cross-run hydration, while keeping operational tool payloads in `tool_invocations`.

## Requirements

### Requirement: Persist assistant tool-call message to chat history when LLM emits tool calls

The system SHALL write a `chat_messages` row with `role: 'assistant'` and `content_json.toolCalls` containing the canonical tool call array immediately after the LLM returns a response that includes one or more tool calls, before executing any tool.

#### Scenario: LLM emits a tool call with no preceding text

- **WHEN** the conversation model returns a response containing only tool calls and no assistant text
- **THEN** the system persists a `chat_messages` row with `role: 'assistant'`, empty `content`, and `content_json.toolCalls` containing the tool call id, name, and arguments

#### Scenario: LLM emits assistant text followed by a tool call

- **WHEN** the conversation model returns a response containing both assistant text and tool calls
- **THEN** the system persists a `chat_messages` row with `role: 'assistant'` and `content_json.toolCalls` capturing the tool call details alongside the text content

#### Scenario: Multiple tool calls in a single LLM response

- **WHEN** the conversation model returns multiple tool calls in one response
- **THEN** the system persists a single `chat_messages` row whose `content_json.toolCalls` array contains all tool calls from that response

### Requirement: Persist tool-result message to chat history after each tool executes

The system SHALL write a `chat_messages` row with `role: 'tool'` containing the tool result immediately after a tool call completes (success or failure), before resuming the conversation loop.

#### Scenario: Tool call succeeds

- **WHEN** a tool call completes successfully
- **THEN** the system persists a `chat_messages` row with `role: 'tool'`, `content` set to the JSON-serialised result, and `content_json` containing the `toolCallId` and `toolName`

#### Scenario: Tool call fails

- **WHEN** a tool call fails or the tool is unknown
- **THEN** the system persists a `chat_messages` row with `role: 'tool'`, `content` set to the JSON-serialised error result, and `content_json` containing the `toolCallId` and `toolName`

#### Scenario: Tool result message references the correct tool call

- **WHEN** a tool-result message is persisted
- **THEN** the `content_json.toolCallId` matches the `id` field from the corresponding tool-call message's `content_json.toolCalls` entry
