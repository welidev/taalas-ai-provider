import { TaalasChatLanguageModel } from "./taalas-chat-language-model.js"
import { TaalasCompletionLanguageModel } from "./taalas-completion-language-model.js"
import type { TaalasChatSettings } from "./taalas-chat-settings.js"
import type { TaalasCompletionSettings } from "./taalas-completion-settings.js"
import type { TaalasModelConfig } from "./taalas-model-config.js"

export function sseResponse(events: string[]) {
  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    start(controller) {
      for (const event of events) {
        controller.enqueue(encoder.encode(`data: ${event}\n\n`))
      }
      controller.enqueue(encoder.encode("data: [DONE]\n\n"))
      controller.close()
    },
  })
  return async () =>
    new Response(stream, {
      status: 200,
      headers: { "Content-Type": "text/event-stream" },
    })
}

export function jsonResponse(body: unknown) {
  return async () =>
    new Response(JSON.stringify(body), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    })
}

const defaultConfig: TaalasModelConfig = {
  provider: "taalas.chat",
  headers: () => ({ Authorization: "Bearer test-key" }),
  url: ({ path }) => `https://api.taalas.com${path}`,
}

export function createChatModel(
  settings: TaalasChatSettings = {},
  configOverrides: Partial<TaalasModelConfig> = {},
) {
  return new TaalasChatLanguageModel("llama3.1-8B", settings, {
    ...defaultConfig,
    ...configOverrides,
  })
}

export function createCompletionModel(
  settings: TaalasCompletionSettings = {},
  configOverrides: Partial<TaalasModelConfig> = {},
) {
  return new TaalasCompletionLanguageModel("llama3.1-8B", settings, {
    ...defaultConfig,
    provider: "taalas.completion",
    ...configOverrides,
  })
}
