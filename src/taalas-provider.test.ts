import { describe, expect, it } from "vitest"
import { TaalasChatLanguageModel } from "./taalas-chat-language-model.js"
import { TaalasCompletionLanguageModel } from "./taalas-completion-language-model.js"
import { createTaalas, taalas } from "./taalas-provider.js"

describe("createTaalas", () => {
  it("creates a provider with the given API key", () => {
    const provider = createTaalas({ apiKey: "test-key" })
    expect(provider).toBeDefined()
    expect(typeof provider).toBe("function")
  })

  it("calling the provider returns a chat model", () => {
    const provider = createTaalas({ apiKey: "test-key" })
    const model = provider("llama3.1-8B")
    expect(model).toBeInstanceOf(TaalasChatLanguageModel)
    expect(model.modelId).toBe("llama3.1-8B")
  })

  it("chatModel() returns a TaalasChatLanguageModel", () => {
    const provider = createTaalas({ apiKey: "test-key" })
    const model = provider.chatModel("llama3.1-8B")
    expect(model).toBeInstanceOf(TaalasChatLanguageModel)
    expect(model.modelId).toBe("llama3.1-8B")
  })

  it("languageModel() returns a TaalasChatLanguageModel", () => {
    const provider = createTaalas({ apiKey: "test-key" })
    const model = provider.languageModel("llama3.1-8B")
    expect(model).toBeInstanceOf(TaalasChatLanguageModel)
  })

  it("completion() returns a TaalasCompletionLanguageModel", () => {
    const provider = createTaalas({ apiKey: "test-key" })
    const model = provider.completion("llama3.1-8B")
    expect(model).toBeInstanceOf(TaalasCompletionLanguageModel)
    expect(model.modelId).toBe("llama3.1-8B")
  })

  it("embeddingModel() throws", () => {
    const provider = createTaalas({ apiKey: "test-key" })
    expect(() => provider.embeddingModel("anything" as any)).toThrow(
      "Taalas does not support embedding models.",
    )
  })

  it("uses default base URL", () => {
    const provider = createTaalas({ apiKey: "test-key" })
    const model = provider("llama3.1-8B")
    expect(model.provider).toBe("taalas.chat")
  })

  it("accepts custom base URL", () => {
    const provider = createTaalas({
      apiKey: "test-key",
      baseURL: "https://custom.api.com/",
    })
    const model = provider("llama3.1-8B")
    expect(model).toBeDefined()
  })

  it("strips trailing slash from base URL", async () => {
    let capturedUrl = ""
    const provider = createTaalas({
      apiKey: "test-key",
      baseURL: "https://custom.api.com/",
      fetch: async (url) => {
        capturedUrl = url as string
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

    const model = provider("llama3.1-8B")
    await model.doGenerate({
      prompt: [{ role: "user", content: [{ type: "text", text: "Hi" }] }],
    })

    expect(capturedUrl).toBe("https://custom.api.com/v1/chat/completions")
  })

  it("passes custom settings to chat model", () => {
    const provider = createTaalas({ apiKey: "test-key" })
    const model = provider.chatModel("llama3.1-8B", {
      user: "test-user",
    }) as TaalasChatLanguageModel
    expect(model.settings.user).toBe("test-user")
  })

  it("passes custom settings to completion model", () => {
    const provider = createTaalas({ apiKey: "test-key" })
    const model = provider.completion("llama3.1-8B", {
      echo: true,
      suffix: "END",
    }) as TaalasCompletionLanguageModel
    expect(model.settings.echo).toBe(true)
    expect(model.settings.suffix).toBe("END")
  })
})

describe("taalas singleton", () => {
  it("is a callable provider", () => {
    expect(typeof taalas).toBe("function")
    expect(typeof taalas.chatModel).toBe("function")
    expect(typeof taalas.completion).toBe("function")
    expect(typeof taalas.languageModel).toBe("function")
  })

  it("creates model instances", () => {
    const model = taalas("llama3.1-8B")
    expect(model).toBeInstanceOf(TaalasChatLanguageModel)
    expect(model.modelId).toBe("llama3.1-8B")
  })
})
