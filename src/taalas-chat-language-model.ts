import type {
  LanguageModelV3,
  LanguageModelV3CallOptions,
  LanguageModelV3FinishReason,
  LanguageModelV3StreamPart,
  LanguageModelV3Usage,
} from "@ai-sdk/provider"
import type { ParseResult } from "@ai-sdk/provider-utils"
import type {
  TaalasChatModelId,
  TaalasChatSettings,
} from "./taalas-chat-settings.js"
import type { TaalasModelConfig } from "./taalas-model-config.js"
import { UnsupportedFunctionalityError } from "@ai-sdk/provider"
import {
  combineHeaders,
  createEventSourceResponseHandler,
  createJsonResponseHandler,
  generateId as defaultGenerateId,
  postJsonToApi,
} from "@ai-sdk/provider-utils"
import { z } from "zod"
import { collectUnsupportedWarnings } from "./collect-warnings.js"
import { convertToTaalasChatMessages } from "./convert-to-taalas-chat-messages.js"
import { getResponseMetadata } from "./get-response-metadata.js"
import { mapTaalasFinishReason } from "./map-taalas-finish-reason.js"
import { taalasFailedResponseHandler } from "./taalas-error.js"

const TaalasChatResponseSchema = z.object({
  id: z.string().nullish(),
  created: z.number().nullish(),
  model: z.string().nullish(),
  choices: z.array(
    z.object({
      message: z.object({
        role: z.literal("assistant").nullish(),
        content: z.string().nullish(),
      }),
      finish_reason: z.string().nullish(),
    }),
  ),
  usage: z
    .object({
      prompt_tokens: z.number().nullish(),
      completion_tokens: z.number().nullish(),
      total_tokens: z.number().nullish(),
    })
    .nullish(),
})

const TaalasChatChunkSchema = z.object({
  id: z.string().nullish(),
  created: z.number().nullish(),
  model: z.string().nullish(),
  choices: z.array(
    z.object({
      delta: z
        .object({
          role: z.enum(["assistant"]).nullish(),
          content: z.string().nullish(),
        })
        .nullish(),
      finish_reason: z.string().nullish(),
    }),
  ),
  usage: z
    .object({
      prompt_tokens: z.number().nullish(),
      completion_tokens: z.number().nullish(),
      total_tokens: z.number().nullish(),
    })
    .nullish(),
})

function mapUsage(usage: { prompt_tokens?: number | null; completion_tokens?: number | null; total_tokens?: number | null } | null | undefined): LanguageModelV3Usage {
  return {
    inputTokens: {
      total: usage?.prompt_tokens ?? undefined,
      noCache: undefined,
      cacheRead: undefined,
      cacheWrite: undefined,
    },
    outputTokens: {
      total: usage?.completion_tokens ?? undefined,
      text: undefined,
      reasoning: undefined,
    },
  }
}

export class TaalasChatLanguageModel implements LanguageModelV3 {
  readonly specificationVersion = "v3"
  readonly supportedUrls = {}

  readonly modelId: TaalasChatModelId
  readonly settings: TaalasChatSettings

  private readonly config: TaalasModelConfig

  constructor(
    modelId: TaalasChatModelId,
    settings: TaalasChatSettings,
    config: TaalasModelConfig,
  ) {
    this.modelId = modelId
    this.settings = settings
    this.config = config
  }

  get provider(): string {
    return this.config.provider
  }

  private getArgs(options: LanguageModelV3CallOptions) {
    const warnings = collectUnsupportedWarnings({
      topK: options.topK,
      frequencyPenalty: options.frequencyPenalty,
      presencePenalty: options.presencePenalty,
      responseFormat: options.responseFormat,
    })

    if (options.tools?.length) {
      throw new UnsupportedFunctionalityError({
        functionality: "tools",
      })
    }
    if (options.toolChoice) {
      throw new UnsupportedFunctionalityError({
        functionality: "toolChoice",
      })
    }

    const args = {
      model: this.modelId,
      messages: convertToTaalasChatMessages(options.prompt),
      max_completion_tokens: options.maxOutputTokens,
      temperature: options.temperature,
      top_p: options.topP,
      stop: options.stopSequences,
      user: this.settings.user,
    }

    return { args, warnings }
  }

  async doGenerate(
    options: LanguageModelV3CallOptions,
  ): Promise<Awaited<ReturnType<LanguageModelV3["doGenerate"]>>> {
    const { args, warnings } = this.getArgs(options)

    const { responseHeaders, value: responseBody } = await postJsonToApi({
      url: this.config.url({ path: "/v1/chat/completions" }),
      headers: combineHeaders(this.config.headers(), options.headers),
      body: args,
      failedResponseHandler: taalasFailedResponseHandler,
      successfulResponseHandler: createJsonResponseHandler(
        TaalasChatResponseSchema,
      ),
      abortSignal: options.abortSignal,
      fetch: this.config.fetch,
    })

    const choice = responseBody.choices[0]

    if (!choice) {
      throw new Error("No choices returned in Taalas chat response")
    }

    return {
      content: [{ type: "text", text: choice.message.content ?? "" }],
      finishReason: mapTaalasFinishReason(choice.finish_reason),
      usage: mapUsage(responseBody.usage),
      response: {
        ...getResponseMetadata(responseBody),
        headers: responseHeaders,
        body: responseBody,
      },
      warnings,
      request: { body: args },
    }
  }

  async doStream(
    options: LanguageModelV3CallOptions,
  ): Promise<Awaited<ReturnType<LanguageModelV3["doStream"]>>> {
    const { args, warnings } = this.getArgs(options)
    const generateId = this.config.generateId ?? defaultGenerateId

    const requestBody = {
      ...args,
      stream: true,
      stream_options: { include_usage: true },
    }

    const { responseHeaders, value: response } = await postJsonToApi({
      url: this.config.url({ path: "/v1/chat/completions" }),
      headers: combineHeaders(this.config.headers(), options.headers),
      body: requestBody,
      failedResponseHandler: taalasFailedResponseHandler,
      successfulResponseHandler:
        createEventSourceResponseHandler(TaalasChatChunkSchema),
      abortSignal: options.abortSignal,
      fetch: this.config.fetch,
    })

    let finishReason: LanguageModelV3FinishReason = { unified: "other", raw: undefined }
    let usage: LanguageModelV3Usage = mapUsage(undefined)
    let isFirstChunk = true
    let textId: string | undefined

    return {
      stream: response.pipeThrough(
        new TransformStream<
          ParseResult<z.infer<typeof TaalasChatChunkSchema>>,
          LanguageModelV3StreamPart
        >({
          transform(chunk, controller) {
            if (!chunk.success) {
              finishReason = { unified: "error", raw: undefined }
              controller.enqueue({ type: "error", error: chunk.error })
              return
            }

            const value = chunk.value

            if (isFirstChunk) {
              isFirstChunk = false
              controller.enqueue({ type: "stream-start", warnings })
              controller.enqueue({
                type: "response-metadata",
                ...getResponseMetadata(value),
              })
            }

            if (value.usage != null) {
              usage = mapUsage(value.usage)
            }

            const choice = value.choices[0]

            if (choice?.finish_reason != null) {
              finishReason = mapTaalasFinishReason(choice.finish_reason)
            }

            if (choice?.delta?.content != null) {
              if (textId == null) {
                textId = generateId()
                controller.enqueue({ type: "text-start", id: textId })
              }
              controller.enqueue({
                type: "text-delta",
                id: textId,
                delta: choice.delta.content,
              })
            }
          },

          flush(controller) {
            if (textId != null) {
              controller.enqueue({ type: "text-end", id: textId })
            }
            controller.enqueue({
              type: "finish",
              finishReason,
              usage,
            })
          },
        }),
      ),
      request: { body: requestBody },
      response: { headers: responseHeaders },
    }
  }
}
