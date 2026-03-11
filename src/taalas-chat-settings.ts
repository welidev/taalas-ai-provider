export type TaalasChatModelId = "llama3.1-8B" | (string & {})

export interface TaalasChatSettings {
  /**
   * A unique identifier representing the end-user, which can help
   * the provider to monitor and detect abuse.
   */
  user?: string
}
