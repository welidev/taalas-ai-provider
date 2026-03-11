import type { FetchFunction } from "@ai-sdk/provider-utils"

export interface TaalasModelConfig {
  provider: string
  headers: () => Record<string, string | undefined>
  url: (options: { path: string }) => string
  fetch?: FetchFunction
  generateId?: () => string
}
