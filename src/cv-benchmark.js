function requireObject(value, message, errors) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    errors.push(message)
    return false
  }
  return true
}

export function validateCvBenchmarkManifest(manifest, scenarioDocument) {
  const errors = []

  if (!requireObject(manifest, "benchmark manifest must be an object", errors)) {
    return errors
  }
  if (manifest.schemaVersion !== 1) {
    errors.push("benchmark schemaVersion must be 1")
  }
  if (typeof manifest.id !== "string" || manifest.id.trim() === "") {
    errors.push("benchmark id is required")
  }

  const policyValid = requireObject(
    manifest.referencePolicy,
    "referencePolicy is required",
    errors
  )
  if (policyValid) {
    const policy = manifest.referencePolicy
    if (!["curated-model-output", "human-annotated"].includes(policy.kind)) {
      errors.push("referencePolicy.kind is not supported")
    }
    if (policy.accuracyClaimAllowed === true && policy.kind !== "human-annotated") {
      errors.push("accuracy claims require human-annotated references")
    }
  }

  const scenarios = Array.isArray(scenarioDocument?.scenarios)
    ? scenarioDocument.scenarios
    : []
  const scenarioIds = new Set(scenarios.map((item) => item?.id).filter(Boolean))
  const cases = Array.isArray(manifest.cases) ? manifest.cases : []
  if (cases.length === 0) {
    errors.push("benchmark must contain at least one case")
  }

  const caseIds = new Set()
  const imagePaths = new Set()
  const referenceIds = new Set()
  for (const benchmarkCase of cases) {
    if (!requireObject(benchmarkCase, "benchmark case must be an object", errors)) {
      continue
    }
    if (!benchmarkCase.id || caseIds.has(benchmarkCase.id)) {
      errors.push(`benchmark case id is missing or duplicated: ${benchmarkCase.id || "empty"}`)
    }
    caseIds.add(benchmarkCase.id)
    if (typeof benchmarkCase.imagePath !== "string" || benchmarkCase.imagePath === "") {
      errors.push(`benchmark case ${benchmarkCase.id} has no imagePath`)
    } else if (imagePaths.has(benchmarkCase.imagePath)) {
      errors.push(`benchmark imagePath is duplicated: ${benchmarkCase.imagePath}`)
    } else {
      imagePaths.add(benchmarkCase.imagePath)
    }
    if (benchmarkCase.reference?.kind !== "scenario-mask") {
      errors.push(`benchmark case ${benchmarkCase.id} has unsupported reference kind`)
    } else if (!scenarioIds.has(benchmarkCase.reference.scenarioId)) {
      errors.push(
        `benchmark case ${benchmarkCase.id} references missing scenario ${benchmarkCase.reference.scenarioId}`
      )
    } else if (referenceIds.has(benchmarkCase.reference.scenarioId)) {
      errors.push(
        `benchmark reference is duplicated: ${benchmarkCase.reference.scenarioId}`
      )
    } else {
      referenceIds.add(benchmarkCase.reference.scenarioId)
    }
  }

  return errors
}
