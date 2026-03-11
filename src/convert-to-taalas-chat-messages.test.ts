import type { LanguageModelV1Prompt } from "@ai-sdk/provider"
import { UnsupportedFunctionalityError } from "@ai-sdk/provider"
import { describe, expect, it } from "vitest"
import { convertToTaalasChatMessages } from "./convert-to-taalas-chat-messages.js"

describe("convertToTaalasChatMessages", () => {
  it("converts a system message", () => {
    const prompt: LanguageModelV1Prompt = [
      { role: "system", content: "You are helpful." },
    ]

    expect(convertToTaalasChatMessages(prompt)).toEqual([
      { role: "system", content: "You are helpful." },
    ])
  })

  it("converts a single text user message", () => {
    const prompt: LanguageModelV1Prompt = [
      { role: "user", content: [{ type: "text", text: "Hello" }] },
    ]

    expect(convertToTaalasChatMessages(prompt)).toEqual([
      { role: "user", content: "Hello" },
    ])
  })

  it("concatenates multiple text parts in a user message", () => {
    const prompt: LanguageModelV1Prompt = [
      {
        role: "user",
        content: [
          { type: "text", text: "Hello " },
          { type: "text", text: "World" },
        ],
      },
    ]

    expect(convertToTaalasChatMessages(prompt)).toEqual([
      { role: "user", content: "Hello World" },
    ])
  })

  it("converts an assistant message with text", () => {
    const prompt: LanguageModelV1Prompt = [
      {
        role: "assistant",
        content: [{ type: "text", text: "I can help with that." }],
      },
    ]

    expect(convertToTaalasChatMessages(prompt)).toEqual([
      { role: "assistant", content: "I can help with that." },
    ])
  })

  it("converts a multi-turn conversation", () => {
    const prompt: LanguageModelV1Prompt = [
      { role: "system", content: "Be concise." },
      { role: "user", content: [{ type: "text", text: "Hi" }] },
      { role: "assistant", content: [{ type: "text", text: "Hello!" }] },
      { role: "user", content: [{ type: "text", text: "How are you?" }] },
    ]

    expect(convertToTaalasChatMessages(prompt)).toEqual([
      { role: "system", content: "Be concise." },
      { role: "user", content: "Hi" },
      { role: "assistant", content: "Hello!" },
      { role: "user", content: "How are you?" },
    ])
  })

  it("throws on image content in user messages", () => {
    const prompt: LanguageModelV1Prompt = [
      {
        role: "user",
        content: [
          {
            type: "image",
            image: new URL("https://example.com/cat.png"),
            mimeType: "image/png",
          },
        ],
      },
    ]

    expect(() => convertToTaalasChatMessages(prompt)).toThrow(
      UnsupportedFunctionalityError,
    )
  })

  it("throws on tool-call content in assistant messages", () => {
    const prompt: LanguageModelV1Prompt = [
      {
        role: "assistant",
        content: [
          {
            type: "tool-call",
            toolCallId: "tc1",
            toolName: "search",
            args: { q: "test" },
          },
        ],
      },
    ]

    expect(() => convertToTaalasChatMessages(prompt)).toThrow(
      UnsupportedFunctionalityError,
    )
  })

  it("throws on tool role messages", () => {
    const prompt: LanguageModelV1Prompt = [
      {
        role: "tool",
        content: [
          {
            type: "tool-result",
            toolCallId: "tc1",
            toolName: "search",
            result: { data: "ok" },
          },
        ],
      },
    ]

    expect(() => convertToTaalasChatMessages(prompt)).toThrow(
      UnsupportedFunctionalityError,
    )
  })
})
