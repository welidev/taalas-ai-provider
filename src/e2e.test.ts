import { describe, expect, it } from "vitest"
import { createTaalas } from "./taalas-provider.js"

const hasApiKey = !!process.env.TAALAS_API_KEY

const taalas = createTaalas()

describe.skipIf(!hasApiKey)("E2E: chat model", () => {
  const model = taalas.chatModel("llama3.1-8B")

  it("doGenerate returns a text response", async () => {
    const result = await model.doGenerate({
      prompt: [
        { role: "user", content: [{ type: "text", text: "Say hello in one word." }] },
      ],
      maxOutputTokens: 20,
    })

    const textContent = result.content.find((c) => c.type === "text")
    expect(textContent).toBeDefined()
    expect(textContent!.text.length).toBeGreaterThan(0)
    expect(result.finishReason.unified).toBe("stop")
    expect(result.usage.inputTokens.total).toBeGreaterThan(0)
    expect(result.usage.outputTokens.total).toBeGreaterThan(0)
    expect(result.response?.id).toBeDefined()
    expect(result.response?.modelId).toBeDefined()
  }, 30_000)

  it("doStream streams text deltas", async () => {
    const { stream } = await model.doStream({
      prompt: [
        { role: "user", content: [{ type: "text", text: "Count from 1 to 3." }] },
      ],
      maxOutputTokens: 30,
    })

    const parts: any[] = []
    const reader = stream.getReader()
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      parts.push(value)
    }

    const streamStart = parts.find((p) => p.type === "stream-start")
    expect(streamStart).toBeDefined()

    const metadata = parts.find((p) => p.type === "response-metadata")
    expect(metadata).toBeDefined()
    expect(metadata.id).toBeDefined()

    const textDeltas = parts
      .filter((p) => p.type === "text-delta")
      .map((p) => p.delta)
    expect(textDeltas.length).toBeGreaterThan(0)

    const fullText = textDeltas.join("")
    expect(fullText.length).toBeGreaterThan(0)

    const finish = parts.find((p) => p.type === "finish")
    expect(finish).toBeDefined()
    expect(finish.finishReason.unified).toBe("stop")
    expect(finish.usage.inputTokens.total).toBeGreaterThan(0)
    expect(finish.usage.outputTokens.total).toBeGreaterThan(0)
  }, 30_000)

  it("handles multi-turn conversations", async () => {
    const result = await model.doGenerate({
      prompt: [
        { role: "system", content: "You are a helpful assistant. Reply in one sentence." },
        { role: "user", content: [{ type: "text", text: "What is 2+2?" }] },
        { role: "assistant", content: [{ type: "text", text: "2+2 equals 4." }] },
        { role: "user", content: [{ type: "text", text: "And 3+3?" }] },
      ],
      maxOutputTokens: 30,
    })

    const textContent = result.content.find((c) => c.type === "text")
    expect(textContent).toBeDefined()
    expect(textContent!.text.length).toBeGreaterThan(0)
  }, 30_000)
})

describe.skipIf(!hasApiKey)("E2E: completion model", () => {
  const model = taalas.completion("llama3.1-8B")

  it("doGenerate returns completion text", async () => {
    const result = await model.doGenerate({
      prompt: [
        { role: "user", content: [{ type: "text", text: "The capital of France is" }] },
      ],
      maxOutputTokens: 20,
    })

    const textContent = result.content.find((c) => c.type === "text")
    expect(textContent).toBeDefined()
    expect(textContent!.text.length).toBeGreaterThan(0)
    expect(result.usage.inputTokens.total).toBeGreaterThan(0)
    expect(result.usage.outputTokens.total).toBeGreaterThan(0)
    expect(result.response?.id).toBeDefined()
  }, 30_000)

  it("doStream streams completion deltas", async () => {
    const { stream } = await model.doStream({
      prompt: [
        { role: "user", content: [{ type: "text", text: "Once upon a time" }] },
      ],
      maxOutputTokens: 30,
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
      .map((p) => p.delta)
    expect(textDeltas.length).toBeGreaterThan(0)

    const fullText = textDeltas.join("")
    expect(fullText.length).toBeGreaterThan(0)

    const finish = parts.find((p) => p.type === "finish")
    expect(finish).toBeDefined()
    expect(["stop", "length", "other"]).toContain(finish.finishReason.unified)
  }, 30_000)
})
