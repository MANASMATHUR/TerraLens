# Promoting the Winner: Rollout & Rollback Runbook

This guide documents how to promote the winning variant (`spatial_impact`) or perform an instant rollback to baseline (`severity_only`) using the **Flagsmith Management Console** without modifying application code or triggering a redeployment.

---

## Prerequisites
* **Flagsmith Project:** `TerraLens` (ID: `55892`)
* **Environment:** `Development` (Key: `K3ygrnRrsFzbbuh8K7NUcy`)
* **Feature Flag:** `incident_prioritization_strategy`
* **Running Experiment:** `581` ("TerraLens: Spatial Impact vs Severity")

---

## Option A: Promoting `spatial_impact` to 100% of Users

When concluding Experiment 581 and adopting spatial impact ranking as the permanent standard:

### Step 1: Conclude Experiment in Flagsmith
1. Navigate to:  
   `https://app.flagsmith.com/project/55892/environment/K3ygrnRrsFzbbuh8K7NUcy/experiments/581`
2. Click **Stop Experiment** in the upper-right corner.
3. In the confirmation dialog, select **Roll out a variant** -> Choose **`Variant_1` (`spatial_impact`)**.
4. Confirm by clicking **End Experiment & Update Flag**.

### Step 2: Verify Multivariate Feature State
1. Navigate to **Features** -> Search for `incident_prioritization_strategy`.
2. Confirm the flag configuration:
   * **Enabled:** `true`
   * **Base Value / Fallback:** `spatial_impact`
   * **Multivariate Options:** Allocate 100% to `spatial_impact` (or set `spatial_impact` as the default single-string value).
3. Click **Save Changes**.

### Step 3: Application Verification
1. Open a fresh private browser window and load `http://localhost:3000/task`.
2. Open DevTools or inspect the Experiment Governance bar:
   * **Strategy:** `spatial_impact`
   * **Scoring Weights:** Population: `0.60`, Facilities: `0.30`, Accessibility: `0.10`
   * All incidents are automatically ranked with multivariate spatial weighting.

---

## Option B: Emergency Rollback to Baseline (`severity_only`)

If upstream GIS vector services degrade, or operational issues require immediate reversion to technical severity ranking:

### Instant Method 1: The Remote Kill-Switch
1. Navigate to Flagsmith -> **Features** -> `gis_degrade_severity_only`.
2. Toggle the flag to **Enabled: ON**.
3. Click **Save Changes**.
4. **Result:** The application immediately displays a visible operational notice:  
   *"Fallback Active: Operating under Standard Technical Severity"*  
   and routes all ranking calculations through `severity_only` regardless of assigned experiment variant.

### Instant Method 2: Reset Base Strategy Flag
1. If the experiment is stopped or deleted:
   * Navigate to `incident_prioritization_strategy`.
   * Set Value to `severity_only`.
   * Set Multivariate allocation for `spatial_impact` to `0%`.
2. Click **Save Changes**.
3. **Result:** Within the next SDK polling cycle or page refresh, 100% of users receive standard technical severity ranking. Zero downtime, zero code changes.
