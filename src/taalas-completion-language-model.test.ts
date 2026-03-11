import { UnsupportedFunctionalityError } from "@ai-sdk/provider"
import { describe, expect, it } from "vitest"
import { TaalasCompletionLanguageModel } from "./taalas-completion-language-model.js"
import { createCompletionModel, jsonResponse, sseResponse } from "./test-helpers.js"

describe("TaalasCompletionLanguageModel", () => {
  it("has correct spec version, provider, and modelId", () => {
    const model = createCompletionModel()

    expect(model.specificationVersion).toBe("v1")
    expect(model.provider).toBe("taalas.completion")
    expect(model.modelId).toBe("llama3.1-8B")
    expect(model.defaultObjectGenerationMode).toBeUndefined()
    expect(model.supportsStructuredOutputs).toBe(false)
  })

  describe("doGenerate", () => {
    it("sends correct request and parses response", async () => {
      let capturedUrl = ""
      let capturedBody: any = null

      const model = new TaalasCompletionLanguageModel("llama3.1-8B", {}, {
        provider: "taalas.completion",
        headers: () => ({ Authorization: "Bearer test-key" }),
        url: ({ path }) => `https://api.taalas.com${path}`,
        fetch: async (url, init) => {
          capturedUrl = url as string
          capturedBody = JSON.parse(init!.body as string)
          return new Response(
            JSON.stringify({
              id: "cmpl-123",
              created: 1700000000,
              model: "llama3.1-8B",
              choices: [{
                text: "Why did the chicken cross the road?",
                finish_reason: "stop",
              }],
              usage: { prompt_tokens: 3, completion_tokens: 8 },
            }),
            { status: 200, headers: { "Content-Type": "application/json" } },
          )
        },
      })

      const result = await model.doGenerate({
        inputFormat: "prompt",
        mode: { type: "regular" },
        prompt: [
          { role: "user", content: [{ type: "text", text: "Tell me a joke" }] },
        ],
      })

      expect(capturedUrl).toBe("https://api.taalas.com/v1/completions")
      expect(capturedBody.model).toBe("llama3.1-8B")
      expect(capturedBody.prompt).toBe("Tell me a joke")
      expect(result.text).toBe("Why did the chicken cross the road?")
      expect(result.finishReason).toBe("stop")
      expect(result.usage).toEqual({ promptTokens: 3, completionTokens: 8 })
    })

    it("passes echo and suffix settings", async () => {
      let capturedBody: any = null

      const model = createCompletionModel({ echo: true, suffix: "END" }, {
        fetch: async (_url, init) => {
          capturedBody = JSON.parse(init!.body as string)
          return new Response(
            JSON.stringify({
              id: "x",
              choices: [{ text: "ok", finish_reason: "stop" }],
              usage: { prompt_tokens: 1, completion_tokens: 1 },
            }),
            { status: 200, headers: { "Content-Type": "application/json" } },
          )
        },
      })

      await model.doGenerate({
        inputFormat: "prompt",
        mode: { type: "regular" },
        prompt: [{ role: "user", content: [{ type: "text", text: "Hi" }] }],
      })

      expect(capturedBody.echo).toBe(true)
      expect(capturedBody.suffix).toBe("END")
    })

    it("throws on empty choices array", async () => {
      const model = createCompletionModel({}, {
        fetch: jsonResponse({
          id: "x",
          choices: [],
          usage: { prompt_tokens: 1, completion_tokens: 0 },
        }),
      })

      await expect(
        model.doGenerate({
          inputFormat: "prompt",
          mode: { type: "regular" },
          prompt: [{ role: "user", content: [{ type: "text", text: "Hi" }] }],
        }),
      ).rejects.toThrow("No choices returned in Taalas completion response")
    })

    it("throws on tools", async () => {
      const model = createCompletionModel()

      await expect(
        model.doGenerate({
          inputFormat: "prompt",
          mode: {
            type: "regular",
            tools: [{
              type: "function",
              name: "test",
              description: "test",
              parameters: { type: "object", properties: {} },
            }],
          },
          prompt: [{ role: "user", content: [{ type: "text", text: "Hi" }] }],
        }),
      ).rejects.toThrow(UnsupportedFunctionalityError)
    })

    it("throws on object-json mode", async () => {
      const model = createCompletionModel()

      await expect(
        model.doGenerate({
          inputFormat: "prompt",
          mode: { type: "object-json" },
          prompt: [{ role: "user", content: [{ type: "text", text: "Hi" }] }],
        }),
      ).rejects.toThrow(UnsupportedFunctionalityError)
    })
  })

  describe("doStream", () => {
    it("streams text deltas and finishes", async () => {
      const model = createCompletionModel({}, {
        fetch: sseResponse([
          JSON.stringify({
            id: "cmpl-1",
            created: 1700000000,
            model: "llama3.1-8B",
            choices: [{ text: "Why did ", finish_reason: null, index: 0 }],
          }),
          JSON.stringify({
            id: "cmpl-1",
            choices: [{ text: "the chicken", finish_reason: null, index: 0 }],
          }),
          JSON.stringify({
            id: "cmpl-1",
            choices: [{ text: "", finish_reason: "stop", index: 0 }],
            usage: { prompt_tokens: 3, completion_tokens: 5 },
          }),
        ]),
      })

      const { stream } = await model.doStream({
        inputFormat: "prompt",
        mode: { type: "regular" },
        prompt: [
          { role: "user", content: [{ type: "text", text: "Tell me a joke" }] },
        ],
      })

      const parts: any[] = []
      const reader = stream.getReader()
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        parts.push(value)
      }

      expect(parts[0].type).toBe("response-metadata")
      expect(parts[0].id).toBe("cmpl-1")

      const textDeltas = parts
        .filter((p) => p.type === "text-delta")
        .map((p) => p.textDelta)
      expect(textDeltas).toEqual(["Why did ", "the chicken", ""])

      const finish = parts.find((p) => p.type === "finish")
      expect(finish.finishReason).toBe("stop")
      expect(finish.usage.promptTokens).toBe(3)
      expect(finish.usage.completionTokens).toBe(5)
    })

    it("sets stream: true in request body", async () => {
      let capturedBody: any = null

      const model = createCompletionModel({}, {
        fetch: async (_url, init) => {
          capturedBody = JSON.parse(init!.body as string)
          const encoder = new TextEncoder()
          const body = new ReadableStream({
            start(controller) {
              controller.enqueue(
                encoder.encode(
                  `data: ${JSON.stringify({
                    id: "x",
                    choices: [{ text: "ok", finish_reason: "stop", index: 0 }],
                    usage: { prompt_tokens: 1, completion_tokens: 1 },
                  })}\n\n`,
                ),
              )
              controller.enqueue(encoder.encode("data: [DONE]\n\n"))
              controller.close()
            },
          })
          return new Response(body, {
            status: 200,
            headers: { "Content-Type": "text/event-stream" },
          })
        },
      })

      const { stream } = await model.doStream({
        inputFormat: "prompt",
        mode: { type: "regular" },
        prompt: [{ role: "user", content: [{ type: "text", text: "Hi" }] }],
      })

      const reader = stream.getReader()
      while (!(await reader.read()).done) {}

      expect(capturedBody.stream).toBe(true)
    })
  })
})
