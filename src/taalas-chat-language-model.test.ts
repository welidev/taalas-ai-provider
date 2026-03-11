import { UnsupportedFunctionalityError } from "@ai-sdk/provider"
import { describe, expect, it } from "vitest"
import { TaalasChatLanguageModel } from "./taalas-chat-language-model.js"
import { createChatModel, jsonResponse, sseResponse } from "./test-helpers.js"

describe("TaalasChatLanguageModel", () => {
  it("has correct spec version, provider, and modelId", () => {
    const model = createChatModel()
    expect(model.specificationVersion).toBe("v1")
    expect(model.provider).toBe("taalas.chat")
    expect(model.modelId).toBe("llama3.1-8B")
  })

  it("does not support structured outputs or object generation", () => {
    const model = createChatModel()
    expect(model.defaultObjectGenerationMode).toBeUndefined()
    expect(model.supportsStructuredOutputs).toBe(false)
  })

  describe("doGenerate", () => {
    it("sends correct request and parses response", async () => {
      let capturedUrl = ""
      let capturedBody: any = null

      const model = new TaalasChatLanguageModel("llama3.1-8B", {}, {
        provider: "taalas.chat",
        headers: () => ({ Authorization: "Bearer test-key" }),
        url: ({ path }) => {
          capturedUrl = `https://api.taalas.com${path}`
          return capturedUrl
        },
        fetch: async (url, init) => {
          capturedUrl = url as string
          capturedBody = JSON.parse(init!.body as string)
          return new Response(
            JSON.stringify({
              id: "chatcmpl-123",
              created: 1700000000,
              model: "llama3.1-8B",
              choices: [{
                message: { role: "assistant", content: "Hello there!" },
                finish_reason: "stop",
              }],
              usage: { prompt_tokens: 5, completion_tokens: 3 },
            }),
            { status: 200, headers: { "Content-Type": "application/json" } },
          )
        },
      })

      const result = await model.doGenerate({
        inputFormat: "messages",
        mode: { type: "regular" },
        prompt: [
          { role: "user", content: [{ type: "text", text: "Hi" }] },
        ],
      })

      expect(capturedUrl).toBe("https://api.taalas.com/v1/chat/completions")
      expect(capturedBody.model).toBe("llama3.1-8B")
      expect(capturedBody.messages).toEqual([{ role: "user", content: "Hi" }])
      expect(result.text).toBe("Hello there!")
      expect(result.finishReason).toBe("stop")
      expect(result.usage).toEqual({ promptTokens: 5, completionTokens: 3 })
      expect(result.response?.id).toBe("chatcmpl-123")
    })

    it("passes temperature and max tokens", async () => {
      let capturedBody: any = null

      const model = createChatModel({}, {
        fetch: async (_url, init) => {
          capturedBody = JSON.parse(init!.body as string)
          return new Response(
            JSON.stringify({
              id: "x",
              choices: [{
                message: { role: "assistant", content: "ok" },
                finish_reason: "stop",
              }],
              usage: { prompt_tokens: 1, completion_tokens: 1 },
            }),
            { status: 200, headers: { "Content-Type": "application/json" } },
          )
        },
      })

      await model.doGenerate({
        inputFormat: "messages",
        mode: { type: "regular" },
        prompt: [
          { role: "user", content: [{ type: "text", text: "Hi" }] },
        ],
        temperature: 0.7,
        maxTokens: 100,
      })

      expect(capturedBody.temperature).toBe(0.7)
      expect(capturedBody.max_completion_tokens).toBe(100)
    })

    it("sends user setting in request body", async () => {
      let capturedBody: any = null

      const model = createChatModel({ user: "test-user-id" }, {
        fetch: async (_url, init) => {
          capturedBody = JSON.parse(init!.body as string)
          return new Response(
            JSON.stringify({
              id: "x",
              choices: [{
                message: { role: "assistant", content: "ok" },
                finish_reason: "stop",
              }],
              usage: { prompt_tokens: 1, completion_tokens: 1 },
            }),
            { status: 200, headers: { "Content-Type": "application/json" } },
          )
        },
      })

      await model.doGenerate({
        inputFormat: "messages",
        mode: { type: "regular" },
        prompt: [{ role: "user", content: [{ type: "text", text: "Hi" }] }],
      })

      expect(capturedBody.user).toBe("test-user-id")
    })

    it("warns on unsupported settings", async () => {
      const model = createChatModel({}, {
        fetch: jsonResponse({
          id: "x",
          choices: [{
            message: { role: "assistant", content: "ok" },
            finish_reason: "stop",
          }],
          usage: { prompt_tokens: 1, completion_tokens: 1 },
        }),
      })

      const result = await model.doGenerate({
        inputFormat: "messages",
        mode: { type: "regular" },
        prompt: [{ role: "user", content: [{ type: "text", text: "Hi" }] }],
        topK: 5,
        frequencyPenalty: 0.5,
        presencePenalty: 0.5,
      })

      const settingNames = result.warnings
        ?.filter((w) => w.type === "unsupported-setting")
        .map((w) => (w as { setting: string }).setting)

      expect(settingNames).toContain("topK")
      expect(settingNames).toContain("frequencyPenalty")
      expect(settingNames).toContain("presencePenalty")
    })

    it("throws on empty choices array", async () => {
      const model = createChatModel({}, {
        fetch: jsonResponse({
          id: "x",
          choices: [],
          usage: { prompt_tokens: 1, completion_tokens: 0 },
        }),
      })

      await expect(
        model.doGenerate({
          inputFormat: "messages",
          mode: { type: "regular" },
          prompt: [{ role: "user", content: [{ type: "text", text: "Hi" }] }],
        }),
      ).rejects.toThrow("No choices returned in Taalas chat response")
    })

    it("throws on tools", async () => {
      const model = createChatModel()
      await expect(
        model.doGenerate({
          inputFormat: "messages",
          mode: {
            type: "regular",
            tools: [
              {
                type: "function",
                name: "test",
                description: "test",
                parameters: { type: "object", properties: {} },
              },
            ],
          },
          prompt: [{ role: "user", content: [{ type: "text", text: "Hi" }] }],
        }),
      ).rejects.toThrow(UnsupportedFunctionalityError)
    })

    it("throws on object-json mode", async () => {
      const model = createChatModel()
      await expect(
        model.doGenerate({
          inputFormat: "messages",
          mode: { type: "object-json" },
          prompt: [{ role: "user", content: [{ type: "text", text: "Hi" }] }],
        }),
      ).rejects.toThrow(UnsupportedFunctionalityError)
    })

    it("throws on object-tool mode", async () => {
      const model = createChatModel()
      await expect(
        model.doGenerate({
          inputFormat: "messages",
          mode: {
            type: "object-tool",
            tool: {
              type: "function",
              name: "test",
              description: "test",
              parameters: { type: "object", properties: {} },
            },
          },
          prompt: [{ role: "user", content: [{ type: "text", text: "Hi" }] }],
        }),
      ).rejects.toThrow(UnsupportedFunctionalityError)
    })
  })

  describe("doStream", () => {
    it("streams text deltas and finishes", async () => {
      const model = createChatModel({}, {
        fetch: sseResponse([
          JSON.stringify({
            id: "chatcmpl-1",
            created: 1700000000,
            model: "llama3.1-8B",
            choices: [{ delta: { role: "assistant", content: "Hello" }, finish_reason: null }],
          }),
          JSON.stringify({
            id: "chatcmpl-1",
            choices: [{ delta: { content: " world" }, finish_reason: null }],
          }),
          JSON.stringify({
            id: "chatcmpl-1",
            choices: [{ delta: {}, finish_reason: "stop" }],
            usage: { prompt_tokens: 5, completion_tokens: 2 },
          }),
        ]),
      })

      const { stream } = await model.doStream({
        inputFormat: "messages",
        mode: { type: "regular" },
        prompt: [{ role: "user", content: [{ type: "text", text: "Hi" }] }],
      })

      const parts: any[] = []
      const reader = stream.getReader()
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        parts.push(value)
      }

      expect(parts[0].type).toBe("response-metadata")
      expect(parts[0].id).toBe("chatcmpl-1")

      const textDeltas = parts
        .filter((p) => p.type === "text-delta")
        .map((p) => p.textDelta)
      expect(textDeltas).toEqual(["Hello", " world"])

      const finish = parts.find((p) => p.type === "finish")
      expect(finish.finishReason).toBe("stop")
      expect(finish.usage.promptTokens).toBe(5)
      expect(finish.usage.completionTokens).toBe(2)
    })

    it("sets stream: true and stream_options in request body", async () => {
      let capturedBody: any = null

      const model = createChatModel({}, {
        fetch: async (_url, init) => {
          capturedBody = JSON.parse(init!.body as string)
          const encoder = new TextEncoder()
          const body = new ReadableStream({
            start(controller) {
              controller.enqueue(
                encoder.encode(
                  `data: ${JSON.stringify({
                    id: "x",
                    choices: [{ delta: { content: "ok" }, finish_reason: "stop" }],
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
        inputFormat: "messages",
        mode: { type: "regular" },
        prompt: [{ role: "user", content: [{ type: "text", text: "Hi" }] }],
      })

      const reader = stream.getReader()
      while (!(await reader.read()).done) {}

      expect(capturedBody.stream).toBe(true)
      expect(capturedBody.stream_options).toEqual({ include_usage: true })
    })
  })
})
