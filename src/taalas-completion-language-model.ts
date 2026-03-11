import type {
  APICallError,
  LanguageModelV1,
  LanguageModelV1FinishReason,
  LanguageModelV1StreamPart,
} from "@ai-sdk/provider"
import type {
  ParseResult,
  ResponseHandler,
} from "@ai-sdk/provider-utils"
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

export class TaalasCompletionLanguageModel implements LanguageModelV1 {
  readonly specificationVersion = "v1"
  readonly defaultObjectGenerationMode = undefined
  readonly supportsStructuredOutputs = false

  readonly modelId: TaalasCompletionModelId
  readonly settings: TaalasCompletionSettings

  private readonly config: TaalasModelConfig
  private readonly failedResponseHandler: ResponseHandler<APICallError>

  constructor(
    modelId: TaalasCompletionModelId,
    settings: TaalasCompletionSettings,
    config: TaalasModelConfig,
  ) {
    this.modelId = modelId
    this.settings = settings
    this.config = config
    this.failedResponseHandler = taalasFailedResponseHandler
  }

  get provider(): string {
    return this.config.provider
  }

  private getArgs({
    mode,
    inputFormat,
    prompt,
    maxTokens,
    temperature,
    topP,
    topK,
    frequencyPenalty,
    presencePenalty,
    stopSequences: userStopSequences,
    responseFormat,
  }: Parameters<LanguageModelV1["doGenerate"]>[0]) {
    const type = mode.type
    const warnings = collectUnsupportedWarnings({
      topK,
      frequencyPenalty,
      presencePenalty,
      responseFormat,
    })

    const { prompt: completionPrompt, stopSequences } =
      convertToTaalasCompletionPrompt({ prompt, inputFormat })

    const stop = [...(stopSequences ?? []), ...(userStopSequences ?? [])]

    const baseArgs = {
      model: this.modelId,
      echo: this.settings.echo,
      suffix: this.settings.suffix,
      user: this.settings.user,
      max_tokens: maxTokens,
      temperature,
      top_p: topP,
      prompt: completionPrompt,
      stop: stop.length > 0 ? stop : undefined,
    }

    switch (type) {
      case "regular": {
        if (mode.tools?.length) {
          throw new UnsupportedFunctionalityError({
            functionality: "tools",
          })
        }
        if (mode.toolChoice) {
          throw new UnsupportedFunctionalityError({
            functionality: "toolChoice",
          })
        }
        return { args: baseArgs, warnings }
      }

      case "object-json":
        throw new UnsupportedFunctionalityError({
          functionality: "object-json mode",
        })

      case "object-tool":
        throw new UnsupportedFunctionalityError({
          functionality: "object-tool mode",
        })

      default: {
        const _exhaustiveCheck: never = type
        throw new Error(`Unsupported type: ${_exhaustiveCheck}`)
      }
    }
  }

  async doGenerate(
    options: Parameters<LanguageModelV1["doGenerate"]>[0],
  ): Promise<Awaited<ReturnType<LanguageModelV1["doGenerate"]>>> {
    const { args, warnings } = this.getArgs(options)

    const { responseHeaders, value: response } = await postJsonToApi({
      url: this.config.url({ path: "/v1/completions" }),
      headers: combineHeaders(this.config.headers(), options.headers),
      body: args,
      failedResponseHandler: this.failedResponseHandler,
      successfulResponseHandler: createJsonResponseHandler(
        TaalasCompletionResponseSchema,
      ),
      abortSignal: options.abortSignal,
      fetch: this.config.fetch,
    })

    const { prompt: rawPrompt, ...rawSettings } = args
    const choice = response.choices[0]

    if (!choice) {
      throw new Error("No choices returned in Taalas completion response")
    }

    return {
      text: choice.text,
      usage: {
        promptTokens: response.usage?.prompt_tokens ?? Number.NaN,
        completionTokens: response.usage?.completion_tokens ?? Number.NaN,
      },
      finishReason: mapTaalasFinishReason(choice.finish_reason),
      rawCall: { rawPrompt, rawSettings },
      rawResponse: { headers: responseHeaders },
      response: getResponseMetadata(response),
      warnings,
      request: { body: JSON.stringify(args) },
    }
  }

  async doStream(
    options: Parameters<LanguageModelV1["doStream"]>[0],
  ): Promise<Awaited<ReturnType<LanguageModelV1["doStream"]>>> {
    const { args, warnings } = this.getArgs(options)

    const requestBody = {
      ...args,
      stream: true,
    }

    const { responseHeaders, value: response } = await postJsonToApi({
      url: this.config.url({ path: "/v1/completions" }),
      headers: combineHeaders(this.config.headers(), options.headers),
      body: requestBody,
      failedResponseHandler: this.failedResponseHandler,
      successfulResponseHandler:
        createEventSourceResponseHandler(TaalasCompletionChunkSchema),
      abortSignal: options.abortSignal,
      fetch: this.config.fetch,
    })

    const { prompt: rawPrompt, ...rawSettings } = args

    let finishReason: LanguageModelV1FinishReason = "unknown"
    let usage: { promptTokens: number; completionTokens: number } = {
      promptTokens: Number.NaN,
      completionTokens: Number.NaN,
    }
    let isFirstChunk = true

    return {
      stream: response.pipeThrough(
        new TransformStream<
          ParseResult<z.infer<typeof TaalasCompletionChunkSchema>>,
          LanguageModelV1StreamPart
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
              controller.enqueue({
                type: "response-metadata",
                ...getResponseMetadata(value),
              })
            }

            if (value.usage != null) {
              usage = {
                promptTokens: value.usage.prompt_tokens,
                completionTokens: value.usage.completion_tokens,
              }
            }

            const choice = value.choices[0]

            if (choice?.finish_reason != null) {
              finishReason = mapTaalasFinishReason(choice.finish_reason)
            }

            if (choice?.text != null) {
              controller.enqueue({
                type: "text-delta",
                textDelta: choice.text,
              })
            }
          },

          flush(controller) {
            controller.enqueue({
              type: "finish",
              finishReason,
              usage,
            })
          },
        }),
      ),
      rawCall: { rawPrompt, rawSettings },
      rawResponse: { headers: responseHeaders },
      warnings,
      request: { body: JSON.stringify(requestBody) },
    }
  }
}
