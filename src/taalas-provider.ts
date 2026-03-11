import type { LanguageModelV1, ProviderV1 } from "@ai-sdk/provider"
import type { FetchFunction } from "@ai-sdk/provider-utils"
import type {
  TaalasChatModelId,
  TaalasChatSettings,
} from "./taalas-chat-settings.js"
import type {
  TaalasCompletionModelId,
  TaalasCompletionSettings,
} from "./taalas-completion-settings.js"
import { loadApiKey, withoutTrailingSlash } from "@ai-sdk/provider-utils"
import { TaalasChatLanguageModel } from "./taalas-chat-language-model.js"
import { TaalasCompletionLanguageModel } from "./taalas-completion-language-model.js"

export interface TaalasProvider extends ProviderV1 {
  (
    modelId: TaalasChatModelId,
    settings?: TaalasChatSettings,
  ): LanguageModelV1

  chatModel: (
    modelId: TaalasChatModelId,
    settings?: TaalasChatSettings,
  ) => LanguageModelV1

  languageModel: (
    modelId: TaalasChatModelId,
    settings?: TaalasChatSettings,
  ) => LanguageModelV1

  completion: (
    modelId: TaalasCompletionModelId,
    settings?: TaalasCompletionSettings,
  ) => LanguageModelV1
}

export interface TaalasProviderSettings {
  /**
   * Base URL for the Taalas API.
   * @default "https://api.taalas.com"
   */
  baseURL?: string

  /**
   * API key for the Taalas API. Falls back to the `TAALAS_API_KEY`
   * environment variable.
   */
  apiKey?: string

  /**
   * Extra headers to include in every request.
   */
  headers?: Record<string, string>

  /**
   * Custom fetch implementation. Useful for proxies or testing.
   */
  fetch?: FetchFunction
}

export function createTaalas(
  options: TaalasProviderSettings = {},
): TaalasProvider {
  const baseURL = withoutTrailingSlash(
    options.baseURL ?? "https://api.taalas.com",
  )

  const getHeaders = () => ({
    Authorization: `Bearer ${loadApiKey({
      apiKey: options.apiKey,
      environmentVariableName: "TAALAS_API_KEY",
      description: "Taalas API key",
    })}`,
    ...options.headers,
  })

  const getCommonConfig = (modelType: string) => ({
    provider: `taalas.${modelType}`,
    url: ({ path }: { path: string }) => `${baseURL}${path}`,
    headers: getHeaders,
    fetch: options.fetch,
  })

  const createChatModel = (
    modelId: TaalasChatModelId,
    settings: TaalasChatSettings = {},
  ) =>
    new TaalasChatLanguageModel(
      modelId,
      settings,
      getCommonConfig("chat"),
    )

  const createCompletionModel = (
    modelId: TaalasCompletionModelId,
    settings: TaalasCompletionSettings = {},
  ) =>
    new TaalasCompletionLanguageModel(
      modelId,
      settings,
      getCommonConfig("completion"),
    )

  const provider = (
    modelId: TaalasChatModelId,
    settings?: TaalasChatSettings,
  ) => createChatModel(modelId, settings)

  provider.chatModel = createChatModel
  provider.languageModel = createChatModel
  provider.completion = createCompletionModel
  provider.textEmbeddingModel = () => {
    throw new Error("Taalas does not support embedding models.")
  }

  return provider as TaalasProvider
}

export const taalas = createTaalas()
