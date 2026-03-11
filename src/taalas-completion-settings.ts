import type { TaalasChatModelId, TaalasChatSettings } from "./taalas-chat-settings.js"

export type TaalasCompletionModelId = TaalasChatModelId

export interface TaalasCompletionSettings extends TaalasChatSettings {
  /**
   * Echo back the prompt in addition to the completion.
   */
  echo?: boolean

  /**
   * String appended after the completion.
   */
  suffix?: string
}
