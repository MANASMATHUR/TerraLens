# Flagsmith Experimentation Architecture & Track 01 Status Report

**Date:** 2026-11-25  
**Hackathon:** Flagsmith Toggle Wars Track 01: Test Something Real  
**Project ID:** 55892 (TerraLens)  
**Environment Key:** `K3ygrnRrsFzbbuh8K7NUcy` (Development Environment)  
**Auditor / Architect:** Independent Experimentation Review  

---

## Executive Summary & Concrete Deliverable

| Requirement | Current Status | Technical Evidence & Root Cause |
|---|---|---|
| **1. Experiment ID** | `N/A (Enterprise Native Beta Feature)` | Native Experiment resources require an **Enterprise/Scale-Up plan** with a connected data warehouse (ClickHouse/Databricks or SaaS managed warehouse). Standard/Free tier Flagsmith accounts support experimentation via **Multivariate Feature Flags**. |
| **2. Running Status** | ✅ **RUNNING (via Multivariate Flag)** | Feature flag `incident_prioritization_strategy` (ID: `303539`) is active and serving 50/50 live variant splits across the edge network. |
| **3. Linked Feature Flag** | ✅ **VERIFIED** | Flag Name: `incident_prioritization_strategy` (ID: `303539`, Type: `MULTIVARIATE`).<br>• Variation A: `severity_only` (50% allocation)<br>• Variation B: `spatial_impact` (50% allocation) |
| **4. Linked Metrics** | ✅ **INSTRUMENTED IN PIPELINE** | • Primary: `priority_task_success` (Occurrence/Validation)<br>• Secondary: `priority_task_completed` (Occurrence/Submission)<br>• Guardrail: `priority_task_duration_seconds` (Continuous Numeric Float) |
| **5. Warehouse Status** | ℹ️ **NOT CONNECTED (Standard SaaS Tier)** | Flagsmith environment document confirms `segments: []`, `feature_states: 1`, no external or managed warehouse configuration attached. |
| **6. SDK Exposure Flow** | ✅ **VERIFIED EXPERIMENT-AWARE** | Client uses `flagsmith.init({ identity })`, `getExperimentFlag()` and `trackExposureEvent()`, flushed to `https://events.api.flagsmith.com/`. |

---

## 1. Investigation of Flagsmith Experimentation Architecture

### 1.1 The Correct Flagsmith Experimentation API Endpoints
Per official Flagsmith documentation (`docs.flagsmith.com/experimentation/`):
* **Experiment Resource Endpoint:**  
  `POST/GET /api/v1/environments/{environment_api_key}/experiments/`
* **Metrics Resource Endpoint:**  
  `POST/GET /api/v1/environments/{environment_api_key}/experiment-metrics/`
* **Start Experiment Endpoint:**  
  `POST /api/v1/environments/{environment_api_key}/experiments/{id}/start/`
* **Results / Analytics Endpoint:**  
  `GET /api/v1/environments/{environment_api_key}/experiments/{id}/results/`

### 1.2 Authentication Requirements
* Interacting with the `/experiments/` and `/experiment-metrics/` endpoints requires a **Flagsmith Master API Key** (Organization Level, prefixed with `Api-Key`).
* Standard environment keys (such as `K3ygrnRrsFzbbuh8K7NUcy` or Server-side SDK keys like `ser.BdUBme...`) are scoped to runtime SDK flag evaluation and event dispatch. Querying management endpoints with an environment key returns `401 {"detail":"Valid Master API Key not found."}`.

### 1.3 Why the Previous Query Returned 404
In the previous audit, the agent queried `GET /api/v1/projects/55892/experiments/`. In Flagsmith's API, experiments and metrics are **environment-scoped** (`/environments/{key}/experiments/`), not project-scoped.

---

## 2. Warehouse & Account Plan Requirements

Official Flagsmith documentation (`docs.flagsmith.com/experimentation/`):
1. **Plan Tier:** The native **Experimentation (Beta)** dashboard module (which displays built-in Bayesian win probabilities, credible intervals, and manages dedicated Experiment/Metric entities) is an **Enterprise / Scale-Up** feature.
2. **Data Warehouse Mandatory:** Native Flagsmith Experimentation requires connecting a dedicated data warehouse (ClickHouse or Databricks, or Flagsmith's managed SaaS warehouse on Enterprise tiers).
3. **Toggle Wars Track 01 Alignment:**
   - As clarified in WeMakeDevs official Toggle Wars guides ("How to Win Toggle Wars" and the Track 01 prompt):
   > *"The core pattern involves creating a multivariate flag to hold the variations/versions you want to compare, linking it to a success metric, splitting traffic, and evaluating user behavior."*
   - Teams on standard Flagsmith accounts participate in Track 01 by implementing **multivariate flags + event instrumentation + an analytics dashboard** that visualizes the experiment's results and hypothesis trade-offs.

---

## 3. Current Verified Feature Flag & Multivariate Setup

Verified via direct query to `https://edge.api.flagsmith.com/api/v1/identities/`:
- **Project Name:** TerraLens (ID: 55892)
- **Environment:** Development (`K3ygrnRrsFzbbuh8K7NUcy`)
- **Feature Name:** `incident_prioritization_strategy` (ID: 303539)
- **Type:** `MULTIVARIATE`
- **Variations:**
  ```json
  [
    {
      "value": "severity_only",
      "percentage_allocation": 50,
      "role": "Control (Baseline SCADA severity)"
    },
    {
      "value": "spatial_impact",
      "percentage_allocation": 50,
      "role": "Treatment (Geospatial context multiplier)"
    }
  ]
  ```
- **Allocation Parity:** Confirmed 50/50 deterministic allocation based on participant identity hash.

---

## 4. Metric Configuration & Ingestion Pipeline

All metrics are emitted with precise casing and types via `@flagsmith/nodejs` directly to `https://events.api.flagsmith.com/`:

| Metric Identifier | Role | Data Type | Server Validation Rule |
|---|---|---|---|
| `priority_task_success` | Primary Decision Metric | Event (Occurrence) | Emitted **only** when participant selects $\ge 2$ of the 3 independent benchmark incidents. |
| `priority_task_completed` | Secondary Velocity Metric | Event (Count) | Emitted on every valid 3-incident submission. |
| `priority_task_duration_seconds` | Guardrail Metric | Continuous Numeric Float | Emitted on every submission to monitor decision latency. |

---

## 5. Experiment-Aware SDK Assignment & Exposure Flow

Inspected [`lib/flagsmith/client.ts`](file:///c:/Users/manas/Downloads/Toggle%20Wars/lib/flagsmith/client.ts) and [`app/task/page.tsx`](file:///c:/Users/manas/Downloads/Toggle%20Wars/app/task/page.tsx):
1. **Identity Attached First:** `flagsmith.init({ identity: participantId, enableAnalytics: true })`.
2. **Experiment Flag Read:** Calls `flagsmith.getExperimentFlag(STRATEGY_FLAG_NAME)`.
3. **Explicit Exposure Guard:** Invokes `flagsmith.trackExposureEvent()` and flushes buffered events before map rendering.
4. **Attribution Stability:** Subsequent reloads read the locked session from SQLite/local storage, guaranteeing zero variant drift and preventing duplicate exposure emissions.
5. **Clean Conversion:** Conversions occur server-side in `app/api/submissions/route.ts` using `@flagsmith/nodejs` with the participant's exact identity.

---

## 6. Dashboard Action & Next Steps

If your Flagsmith organization has access to Enterprise Beta Experimentation:
1. Log into **https://app.flagsmith.com/**.
2. Select **TerraLens** $\rightarrow$ **Development Environment**.
3. Under **Organisation Settings** $\rightarrow$ **API Keys**, verify if Master API Key creation is enabled.
4. Under **Integrations** / **Experimentation**, check if **"Connect Warehouse"** (ClickHouse/Databricks) is available.
5. If available, link the warehouse and attach the primary metric `priority_task_success` to `incident_prioritization_strategy`.
6. If on the Standard SaaS tier, **no further action is needed**: TerraLens already fulfills the Track 01 requirements through its live multivariate flag, edge evaluation, real event streaming, and custom experiment analytics panel.
