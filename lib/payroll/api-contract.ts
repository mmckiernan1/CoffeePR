export const payrollApiResources = [
  { method: "POST", path: "/api/v1/configuration", purpose: "Persist effective changes, opening balances and linked corrections", maturity: "implemented" },
  { method: "POST", path: "/api/v1/employers", purpose: "Create an employer onboarding record", maturity: "planned" },
  { method: "POST", path: "/api/v1/employers/{employerId}/employees", purpose: "Create an effective-dated employee payroll profile", maturity: "planned" },
  { method: "PUT", path: "/api/v1/pay-runs/{payRunId}/time", purpose: "Upsert hourly time and mark the input set ready", maturity: "planned" },
  { method: "POST", path: "/api/v1/pay-runs", purpose: "Create the next numbered draft run", maturity: "planned" },
  { method: "POST", path: "/api/v1/pay-runs/{payRunId}/calculate", purpose: "Calculate with a pinned effective-dated ruleset", maturity: "planned" },
  { method: "POST", path: "/api/v1/pay-runs/{payRunId}/review", purpose: "Record review and resolve blocking notices", maturity: "planned" },
  { method: "POST", path: "/api/v1/pay-runs/{payRunId}/approve", purpose: "Lock the run and atomically create audit and billing events", maturity: "planned" },
  { method: "GET", path: "/api/v1/pay-runs/{payRunId}/register", purpose: "Retrieve the immutable payroll register", maturity: "planned" },
  { method: "POST", path: "/api/v1/pay-runs/{payRunId}/bank-files", purpose: "Generate a configured bank-adapter export", maturity: "planned" },
  { method: "POST", path: "/api/v1/records-of-employment", purpose: "Create an editable ROE draft from approved history", maturity: "planned" },
  { method: "POST", path: "/api/v1/year-ends/{year}/t4", purpose: "Generate balanced T4 slips and CRA XML", maturity: "planned" },
  { method: "GET", path: "/api/v1/admin/data-exchange/{section}/export", purpose: "Export an authorized employer data section as CSV", maturity: "planned" },
  { method: "POST", path: "/api/v1/admin/data-exchange/{section}/imports/validate", purpose: "Validate and dry-run a CSV import without changing records", maturity: "planned" },
  { method: "POST", path: "/api/v1/admin/data-exchange/{section}/imports/commit", purpose: "Commit a validated CSV batch with an audit record", maturity: "planned" },
] as const;

export const payrollApiControls = [
  "Integer cents for all money fields",
  "Employer-scoped identifiers and server-side authorization",
  "Idempotency keys on creation, calculation, approval and output requests",
  "Optimistic version checks on mutable drafts",
  "Effective-dated calculation-rule references on every calculation",
  "Immutable approval snapshot with linked adjustments or reversals",
  "Separate payroll, banking, CRA, GL and billing ledgers",
  "Administrator-only CSV import/export with validation, audit batches and append-only approved history",
] as const;

export const openApiDocument = {
  openapi: "3.1.0",
  info: {
    title: "Comcheq Canadian Payroll API",
    version: "0.4.0-effective-dating",
    description: "Design contract for a Canadian small-employer payroll API. Effective-dated configuration writes use authenticated employer roles and durable versioned records; public demo routes contain fictional data only.",
  },
  servers: [{ url: "/", description: "Current Comcheq prototype" }],
  paths: {
    "/api/v1/health": {
      get: {
        summary: "Inspect prototype capabilities",
        operationId: "getHealth",
        responses: { "200": { description: "Prototype capability status" } },
      },
    },
    "/api/v1/demo/rbc-cpa005": {
      get: {
        summary: "Download a fictional RBC CPA005 Credit TEST file",
        operationId: "getDemoRbcCpa005",
        responses: {
          "200": {
            description: "Fixed-width RBC CPA005 test file",
            content: { "text/plain": { schema: { type: "string" } } },
          },
        },
      },
    },
    "/api/v1/demo/alberta-calculation": {
      get: {
        summary: "Inspect a fictional 2026 Alberta regular-periodic calculation",
        operationId: "getDemoAlbertaCalculation",
        responses: {
          "200": {
            description: "Effective-dated statutory calculation and audit evidence",
            content: { "application/json": { schema: { type: "object" } } },
          },
        },
      },
    },
    ...Object.fromEntries(payrollApiResources.map((resource) => [resource.path, {
      [resource.method.toLowerCase()]: {
        summary: resource.purpose,
        "x-comcheq-maturity": resource.maturity,
        responses: { "501": { description: "Design contract only; production control plane not yet enabled" } },
      },
    }])),
    "/api/v1/configuration": {
      get: {
        summary: "Read versioned employer configuration records",
        "x-comcheq-maturity": "implemented",
        security: [{ workspaceIdentity: [] }],
        responses: { "200": { description: "Effective changes, corrections and opening balances" }, "401": { description: "Employer membership required" } },
      },
      post: {
        summary: "Persist an effective change, opening balance or linked correction",
        "x-comcheq-maturity": "implemented",
        security: [{ workspaceIdentity: [] }],
        responses: { "201": { description: "Versioned record created" }, "400": { description: "Validation failed" }, "401": { description: "Employer membership required" }, "403": { description: "Write role required" } },
      },
    },
  },
  components: {
    securitySchemes: {
      workspaceIdentity: { type: "apiKey", in: "header", name: "oai-authenticated-user-email" },
      idempotencyKey: { type: "apiKey", in: "header", name: "Idempotency-Key" },
    },
    schemas: {
      MoneyCents: { type: "integer", description: "Signed integer amount in Canadian cents", examples: [832647] },
      PayRunStatus: { type: "string", enum: ["draft", "calculated", "reviewed", "approved", "reversed"] },
      AlbertaCalculationPath: { type: "string", enum: ["CRA_T4127_REGULAR_PERIODIC"] },
      CsvImportStatus: { type: "string", enum: ["uploaded", "validated", "rejected", "committed"] },
    },
  },
} as const;
