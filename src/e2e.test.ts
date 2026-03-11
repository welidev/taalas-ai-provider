import { describe, expect, it } from "vitest"
import { createTaalas } from "./taalas-provider.js"

const hasApiKey = !!process.env.TAALAS_API_KEY

const taalas = createTaalas()

describe.skipIf(!hasApiKey)("E2E: chat model", () => {
  const model = taalas.chatModel("llama3.1-8B")

  it("doGenerate returns a text response", async () => {
    const result = await model.doGenerate({
      inputFormat: "messages",
      mode: { type: "regular" },
      prompt: [
        { role: "user", content: [{ type: "text", text: "Say hello in one word." }] },
      ],
      maxTokens: 20,
    })

    expect(result.text).toBeDefined()
    expect(typeof result.text).toBe("string")
    expect(result.text!.length).toBeGreaterThan(0)
    expect(result.finishReason).toBe("stop")
    expect(result.usage.promptTokens).toBeGreaterThan(0)
    expect(result.usage.completionTokens).toBeGreaterThan(0)
    expect(result.response?.id).toBeDefined()
    expect(result.response?.modelId).toBeDefined()
  }, 30_000)

  it("doStream streams text deltas", async () => {
    const { stream } = await model.doStream({
      inputFormat: "messages",
      mode: { type: "regular" },
      prompt: [
        { role: "user", content: [{ type: "text", text: "Count from 1 to 3." }] },
      ],
      maxTokens: 30,
    })

    const parts: any[] = []
    const reader = stream.getReader()
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      parts.push(value)
    }

    const metadata = parts.find((p) => p.type === "response-metadata")
    expect(metadata).toBeDefined()
    expect(metadata.id).toBeDefined()

    const textDeltas = parts
      .filter((p) => p.type === "text-delta")
      .map((p) => p.textDelta)
    expect(textDeltas.length).toBeGreaterThan(0)

    const fullText = textDeltas.join("")
    expect(fullText.length).toBeGreaterThan(0)

    const finish = parts.find((p) => p.type === "finish")
    expect(finish).toBeDefined()
    expect(finish.finishReason).toBe("stop")
    expect(finish.usage.promptTokens).toBeGreaterThan(0)
    expect(finish.usage.completionTokens).toBeGreaterThan(0)
  }, 30_000)

  it("handles multi-turn conversations", async () => {
    const result = await model.doGenerate({
      inputFormat: "messages",
      mode: { type: "regular" },
      prompt: [
        { role: "system", content: "You are a helpful assistant. Reply in one sentence." },
        { role: "user", content: [{ type: "text", text: "What is 2+2?" }] },
        { role: "assistant", content: [{ type: "text", text: "2+2 equals 4." }] },
        { role: "user", content: [{ type: "text", text: "And 3+3?" }] },
      ],
      maxTokens: 30,
    })

    expect(result.text).toBeDefined()
    expect(result.text!.length).toBeGreaterThan(0)
  }, 30_000)
})

describe.skipIf(!hasApiKey)("E2E: completion model", () => {
  const model = taalas.completion("llama3.1-8B")

  it("doGenerate returns completion text", async () => {
    const result = await model.doGenerate({
      inputFormat: "prompt",
      mode: { type: "regular" },
      prompt: [
        { role: "user", content: [{ type: "text", text: "The capital of France is" }] },
      ],
      maxTokens: 20,
    })

    expect(result.text).toBeDefined()
    expect(typeof result.text).toBe("string")
    expect(result.text!.length).toBeGreaterThan(0)
    expect(result.usage.promptTokens).toBeGreaterThan(0)
    expect(result.usage.completionTokens).toBeGreaterThan(0)
    expect(result.response?.id).toBeDefined()
  }, 30_000)

  it("doStream streams completion deltas", async () => {
    const { stream } = await model.doStream({
      inputFormat: "prompt",
      mode: { type: "regular" },
      prompt: [
        { role: "user", content: [{ type: "text", text: "Once upon a time" }] },
      ],
      maxTokens: 30,
    })

    const parts: any[] = []
    const reader = stream.getReader()
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      parts.push(value)
    }

    const textDeltas = parts
      .filter((p) => p.type === "text-delta")
      .map((p) => p.textDelta)
    expect(textDeltas.length).toBeGreaterThan(0)

    const fullText = textDeltas.join("")
    expect(fullText.length).toBeGreaterThan(0)

    const finish = parts.find((p) => p.type === "finish")
    expect(finish).toBeDefined()
    expect(["stop", "length", "unknown"]).toContain(finish.finishReason)
  }, 30_000)
})
