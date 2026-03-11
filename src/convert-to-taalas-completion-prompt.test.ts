import type { LanguageModelV1Prompt } from "@ai-sdk/provider"
import { UnsupportedFunctionalityError } from "@ai-sdk/provider"
import { describe, expect, it } from "vitest"
import { convertToTaalasCompletionPrompt } from "./convert-to-taalas-completion-prompt.js"

describe("convertToTaalasCompletionPrompt", () => {
  it("returns raw text for a single-text prompt in prompt format", () => {
    const prompt: LanguageModelV1Prompt = [
      { role: "user", content: [{ type: "text", text: "Tell me a joke" }] },
    ]

    const result = convertToTaalasCompletionPrompt({
      prompt,
      inputFormat: "prompt",
    })

    expect(result.prompt).toBe("Tell me a joke")
    expect(result.stopSequences).toBeUndefined()
  })

  it("formats a multi-turn conversation with system prefix", () => {
    const prompt: LanguageModelV1Prompt = [
      { role: "system", content: "You are a comedian." },
      { role: "user", content: [{ type: "text", text: "Tell me a joke" }] },
    ]

    const result = convertToTaalasCompletionPrompt({
      prompt,
      inputFormat: "messages",
    })

    expect(result.prompt).toBe(
      "You are a comedian.\n\nuser:\nTell me a joke\n\nassistant:\n",
    )
    expect(result.stopSequences).toEqual(["\nuser:"])
  })

  it("includes assistant turns in the formatted prompt", () => {
    const prompt: LanguageModelV1Prompt = [
      { role: "user", content: [{ type: "text", text: "Hi" }] },
      { role: "assistant", content: [{ type: "text", text: "Hello!" }] },
      { role: "user", content: [{ type: "text", text: "Joke?" }] },
    ]

    const result = convertToTaalasCompletionPrompt({
      prompt,
      inputFormat: "messages",
    })

    expect(result.prompt).toBe(
      "user:\nHi\n\nassistant:\nHello!\n\nuser:\nJoke?\n\nassistant:\n",
    )
  })

  it("throws on image content", () => {
    const prompt: LanguageModelV1Prompt = [
      {
        role: "user",
        content: [
          {
            type: "image",
            image: new URL("https://example.com/img.png"),
            mimeType: "image/png",
          },
        ],
      },
    ]

    expect(() =>
      convertToTaalasCompletionPrompt({ prompt, inputFormat: "messages" }),
    ).toThrow(UnsupportedFunctionalityError)
  })

  it("throws on tool messages", () => {
    const prompt: LanguageModelV1Prompt = [
      {
        role: "tool",
        content: [
          {
            type: "tool-result",
            toolCallId: "tc1",
            toolName: "search",
            result: "ok",
          },
        ],
      },
    ]

    expect(() =>
      convertToTaalasCompletionPrompt({ prompt, inputFormat: "messages" }),
    ).toThrow(UnsupportedFunctionalityError)
  })

  it("throws on a second system message", () => {
    const prompt: LanguageModelV1Prompt = [
      { role: "system", content: "First" },
      { role: "user", content: [{ type: "text", text: "Hi" }] },
      { role: "system", content: "Second" },
    ]

    expect(() =>
      convertToTaalasCompletionPrompt({ prompt, inputFormat: "messages" }),
    ).toThrow()
  })
})
