import type { LanguageModelV2Prompt } from "@ai-sdk/provider"
import { UnsupportedFunctionalityError } from "@ai-sdk/provider"
import { describe, expect, it } from "vitest"
import { convertToTaalasCompletionPrompt } from "./convert-to-taalas-completion-prompt.js"

describe("convertToTaalasCompletionPrompt", () => {
  it("returns raw text for a single-text user message", () => {
    const prompt: LanguageModelV2Prompt = [
      { role: "user", content: [{ type: "text", text: "Tell me a joke" }] },
    ]

    const result = convertToTaalasCompletionPrompt({ prompt })

    expect(result.prompt).toBe("Tell me a joke")
    expect(result.stopSequences).toBeUndefined()
  })

  it("formats a multi-turn conversation with system prefix", () => {
    const prompt: LanguageModelV2Prompt = [
      { role: "system", content: "You are a comedian." },
      { role: "user", content: [{ type: "text", text: "Tell me a joke" }] },
    ]

    const result = convertToTaalasCompletionPrompt({ prompt })

    expect(result.prompt).toBe(
      "You are a comedian.\n\nuser:\nTell me a joke\n\nassistant:\n",
    )
    expect(result.stopSequences).toEqual(["\nuser:"])
  })

  it("includes assistant turns in the formatted prompt", () => {
    const prompt: LanguageModelV2Prompt = [
      { role: "user", content: [{ type: "text", text: "Hi" }] },
      { role: "assistant", content: [{ type: "text", text: "Hello!" }] },
      { role: "user", content: [{ type: "text", text: "Joke?" }] },
    ]

    const result = convertToTaalasCompletionPrompt({ prompt })

    expect(result.prompt).toBe(
      "user:\nHi\n\nassistant:\nHello!\n\nuser:\nJoke?\n\nassistant:\n",
    )
  })

  it("throws on file content", () => {
    const prompt: LanguageModelV2Prompt = [
      {
        role: "user",
        content: [
          {
            type: "file",
            data: new URL("https://example.com/img.png"),
            mediaType: "image/png",
          },
        ],
      },
    ]

    expect(() =>
      convertToTaalasCompletionPrompt({ prompt }),
    ).toThrow(UnsupportedFunctionalityError)
  })

  it("throws on tool messages", () => {
    const prompt: LanguageModelV2Prompt = [
      {
        role: "tool",
        content: [
          {
            type: "tool-result",
            toolCallId: "tc1",
            toolName: "search",
            output: { type: "text", value: "ok" },
          },
        ],
      },
    ]

    expect(() =>
      convertToTaalasCompletionPrompt({ prompt }),
    ).toThrow(UnsupportedFunctionalityError)
  })

  it("throws on a second system message", () => {
    const prompt: LanguageModelV2Prompt = [
      { role: "system", content: "First" },
      { role: "user", content: [{ type: "text", text: "Hi" }] },
      { role: "system", content: "Second" },
    ]

    expect(() =>
      convertToTaalasCompletionPrompt({ prompt }),
    ).toThrow()
  })
})
