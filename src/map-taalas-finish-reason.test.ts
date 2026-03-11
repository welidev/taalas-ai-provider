import { describe, expect, it } from "vitest"
import { mapTaalasFinishReason } from "./map-taalas-finish-reason.js"

describe("mapTaalasFinishReason", () => {
  it('maps "stop" to { unified: "stop", raw: "stop" }', () => {
    expect(mapTaalasFinishReason("stop")).toEqual({ unified: "stop", raw: "stop" })
  })

  it('maps "length" to { unified: "length", raw: "length" }', () => {
    expect(mapTaalasFinishReason("length")).toEqual({ unified: "length", raw: "length" })
  })

  it('maps "content_filter" to { unified: "content-filter", raw: "content_filter" }', () => {
    expect(mapTaalasFinishReason("content_filter")).toEqual({ unified: "content-filter", raw: "content_filter" })
  })

  it('maps null to { unified: "other", raw: undefined }', () => {
    expect(mapTaalasFinishReason(null)).toEqual({ unified: "other", raw: undefined })
  })

  it('maps undefined to { unified: "other", raw: undefined }', () => {
    expect(mapTaalasFinishReason(undefined)).toEqual({ unified: "other", raw: undefined })
  })

  it('maps unrecognized strings to { unified: "other", raw: "something_else" }', () => {
    expect(mapTaalasFinishReason("something_else")).toEqual({ unified: "other", raw: "something_else" })
  })
})
