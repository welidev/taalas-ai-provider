import type {
  LanguageModelV2,
  LanguageModelV2CallOptions,
  LanguageModelV2FinishReason,
  LanguageModelV2StreamPart,
} from "@ai-sdk/provider"
import type { ParseResult } from "@ai-sdk/provider-utils"
import type {
  TaalasCompletionModelId,
  TaalasCompletionSettings,
} from "./taalas-completion-settings.js"
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
import { convertToTaalasCompletionPrompt } from "./convert-to-taalas-completion-prompt.js"
import { getResponseMetadata } from "./get-response-metadata.js"
import { mapTaalasFinishReason } from "./map-taalas-finish-reason.js"
import { taalasFailedResponseHandler } from "./taalas-error.js"

const TaalasCompletionResponseSchema = z.object({
  id: z.string().nullish(),
  created: z.number().nullish(),
  model: z.string().nullish(),
  choices: z.array(
    z.object({
      text: z.string(),
      finish_reason: z.string(),
    }),
  ),
  usage: z
    .object({
      prompt_tokens: z.number(),
      completion_tokens: z.number(),
      total_tokens: z.number().nullish(),
    })
    .nullish(),
})

const TaalasCompletionChunkSchema = z.union([
  z.object({
    id: z.string().nullish(),
    created: z.number().nullish(),
    model: z.string().nullish(),
    choices: z.array(
      z.object({
        text: z.string(),
        finish_reason: z.string().nullish(),
        index: z.number(),
      }),
    ),
    usage: z
      .object({
        prompt_tokens: z.number(),
        completion_tokens: z.number(),
        total_tokens: z.number().nullish(),
      })
      .nullish(),
  }),
  z.object({
    error: z.object({
      message: z.string(),
      type: z.string().nullish(),
      code: z.string().nullish(),
    }),
  }),
])

export class TaalasCompletionLanguageModel implements LanguageModelV2 {
  readonly specificationVersion = "v2"
  readonly supportedUrls = {}

  readonly modelId: TaalasCompletionModelId
  readonly settings: TaalasCompletionSettings

  private readonly config: TaalasModelConfig

  constructor(
    modelId: TaalasCompletionModelId,
    settings: TaalasCompletionSettings,
    config: TaalasModelConfig,
  ) {
    this.modelId = modelId
    this.settings = settings
    this.config = config
  }

  get provider(): string {
    return this.config.provider
  }

  private getArgs(options: LanguageModelV2CallOptions) {
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

    const { prompt: completionPrompt, stopSequences } =
      convertToTaalasCompletionPrompt({ prompt: options.prompt })

    const stop = [
      ...(stopSequences ?? []),
      ...(options.stopSequences ?? []),
    ]

    const args = {
      model: this.modelId,
      echo: this.settings.echo,
      suffix: this.settings.suffix,
      user: this.settings.user,
      max_tokens: options.maxOutputTokens,
      temperature: options.temperature,
      top_p: options.topP,
      prompt: completionPrompt,
      stop: stop.length > 0 ? stop : undefined,
    }

    return { args, warnings }
  }

  async doGenerate(
    options: LanguageModelV2CallOptions,
  ): Promise<Awaited<ReturnType<LanguageModelV2["doGenerate"]>>> {
    const { args, warnings } = this.getArgs(options)

    const { responseHeaders, value: response } = await postJsonToApi({
      url: this.config.url({ path: "/v1/completions" }),
      headers: combineHeaders(this.config.headers(), options.headers),
      body: args,
      failedResponseHandler: taalasFailedResponseHandler,
      successfulResponseHandler: createJsonResponseHandler(
        TaalasCompletionResponseSchema,
      ),
      abortSignal: options.abortSignal,
      fetch: this.config.fetch,
    })

    const choice = response.choices[0]

    if (!choice) {
      throw new Error("No choices returned in Taalas completion response")
    }

    return {
      content: [{ type: "text", text: choice.text }],
      usage: {
        inputTokens: response.usage?.prompt_tokens ?? undefined,
        outputTokens: response.usage?.completion_tokens ?? undefined,
        totalTokens: response.usage?.total_tokens ?? undefined,
      },
      finishReason: mapTaalasFinishReason(choice.finish_reason),
      response: {
        ...getResponseMetadata(response),
        headers: responseHeaders,
        body: response,
      },
      warnings,
      request: { body: args },
    }
  }

  async doStream(
    options: LanguageModelV2CallOptions,
  ): Promise<Awaited<ReturnType<LanguageModelV2["doStream"]>>> {
    const { args, warnings } = this.getArgs(options)
    const generateId = this.config.generateId ?? defaultGenerateId

    const requestBody = {
      ...args,
      stream: true,
    }

    const { responseHeaders, value: response } = await postJsonToApi({
      url: this.config.url({ path: "/v1/completions" }),
      headers: combineHeaders(this.config.headers(), options.headers),
      body: requestBody,
      failedResponseHandler: taalasFailedResponseHandler,
      successfulResponseHandler:
        createEventSourceResponseHandler(TaalasCompletionChunkSchema),
      abortSignal: options.abortSignal,
      fetch: this.config.fetch,
    })

    let finishReason: LanguageModelV2FinishReason = "unknown"
    let usage: {
      inputTokens: number | undefined
      outputTokens: number | undefined
      totalTokens: number | undefined
    } = {
      inputTokens: undefined,
      outputTokens: undefined,
      totalTokens: undefined,
    }
    let isFirstChunk = true
    let textId: string | undefined

    return {
      stream: response.pipeThrough(
        new TransformStream<
          ParseResult<z.infer<typeof TaalasCompletionChunkSchema>>,
          LanguageModelV2StreamPart
        >({
          transform(chunk, controller) {
            if (!chunk.success) {
              finishReason = "error"
              controller.enqueue({ type: "error", error: chunk.error })
              return
            }

            const value = chunk.value

            if ("error" in value) {
              finishReason = "error"
              controller.enqueue({
                type: "error",
                error: value.error.message,
              })
              return
            }

            if (isFirstChunk) {
              isFirstChunk = false
              controller.enqueue({ type: "stream-start", warnings })
              controller.enqueue({
                type: "response-metadata",
                ...getResponseMetadata(value),
              })
            }

            if (value.usage != null) {
              usage = {
                inputTokens: value.usage.prompt_tokens,
                outputTokens: value.usage.completion_tokens,
                totalTokens: value.usage.total_tokens ?? undefined,
              }
            }

            const choice = value.choices[0]

            if (choice?.finish_reason != null) {
              finishReason = mapTaalasFinishReason(choice.finish_reason)
            }

            if (choice?.text != null) {
              if (textId == null) {
                textId = generateId()
                controller.enqueue({ type: "text-start", id: textId })
              }
              controller.enqueue({
                type: "text-delta",
                id: textId,
                delta: choice.text,
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
