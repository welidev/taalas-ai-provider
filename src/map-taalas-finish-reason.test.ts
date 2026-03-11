import { describe, expect, it } from "vitest"
import { mapTaalasFinishReason } from "./map-taalas-finish-reason.js"

describe("mapTaalasFinishReason", () => {
  it('maps "stop" to "stop"', () => {
    expect(mapTaalasFinishReason("stop")).toBe("stop")
  })

  it('maps "length" to "length"', () => {
    expect(mapTaalasFinishReason("length")).toBe("length")
  })

  it('maps null to "unknown"', () => {
    expect(mapTaalasFinishReason(null)).toBe("unknown")
  })

  it('maps undefined to "unknown"', () => {
    expect(mapTaalasFinishReason(undefined)).toBe("unknown")
  })

  it('maps unrecognized strings to "unknown"', () => {
    expect(mapTaalasFinishReason("something_else")).toBe("unknown")
  })
})
