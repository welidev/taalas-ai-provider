import { createJsonErrorResponseHandler } from "@ai-sdk/provider-utils"
import { z } from "zod"

const taalasErrorDataSchema = z.object({
  error: z.object({
    message: z.string(),
    type: z.string().nullish(),
    code: z.string().nullish(),
  }),
})

export type TaalasErrorData = z.infer<typeof taalasErrorDataSchema>

export const taalasFailedResponseHandler = createJsonErrorResponseHandler({
  errorSchema: taalasErrorDataSchema,
  errorToMessage: (data) => data.error.message,
})
