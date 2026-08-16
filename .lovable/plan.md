# Model credibility upgrade — real data, uncertainty, fairness, uplift

Goal: answer the "it's all placeholders / wrong objective / no fairness audit / no validity story" critiques so a reviewer can see the model is grounded, honest about what it can't see, audited for disparate impact, and optimized for where a dollar changes the outcome — not just who looks risky.

Audience is judges/reviewers, so every upgrade must be *visible in the UI*, not buried in code.

## 1. Ground Dallas in live real data

Replace the inline placeholder values in the map with live-fetched ACS data, keeping the existing property names so `Component3.jsx` renders unchanged.

Source of truth per variable:

| Variable | Real source | How |
|---|---|---|
| `rent_burden` | ACS 5-year B25070 (gross rent as % of income) | Census API, live |
| `poverty` | ACS 5-year B17001 | Census API, live |
| `renter_share` | ACS 5-year B25003 | Census API, live |
| `inc_change` | ACS B19013, two vintages | Census API, live |
| `rent_change` | ACS B25064, two vintages | Census API, live |
| `edu_change` | ACS B15003, two vintages | Census API, live |
| `value_change` | FHFA HPI (ZIP annual) + Zillow ZORI/ZHVI | fetched + cached |
| `*_moe` | ACS margin-of-error fields (`_M` suffix) | Census API, live |
| `ev_rate` | Eviction Lab | see note below |
| geometry | Census TIGERweb ZCTA boundaries | fetched, cached |

Eviction Lab has no open live API — it requires a signed-in bulk download. So eviction filing rates get committed as a static dataset file with explicit vintage and citation, while everything else is live. The UI will label each variable's provenance and freshness so the difference is visible rather than hidden.

Cities other than Dallas stay on the existing placeholder data, clearly badged as such.

## 2. Uncertainty and validity, made visible

- Carry ACS margins of error all the way through the index arithmetic instead of dropping them, and show the index as a range, not a point.
- Reliability flag driven by actual coefficient of variation from the real MOEs (replacing the current hardcoded `reliable` boolean).
- A "What this model cannot see" panel listing the known blind spots: informal tenancies, never-filed displacements, serial filers inflating counts, ACS sampling lag, ZCTA-vs-tract mismatch.
- Every tract tooltip shows the source and vintage of each component value.

## 3. Reframe the target variable

The current index treats eviction filings as ground truth. Add an explicit correction layer:

- A **serial-filer adjustment**: filings de-duplicated per address so a landlord filing monthly on the same unit doesn't read as twelve at-risk households.
- A stated distinction in the UI between *filings*, *judgments*, and *actual displacement*, with the model labeled as predicting the first and only proxying the third.
- A coverage caveat for tracts with high informal-tenancy indicators (high renter share, low formal lease signal).

## 4. New page: allocation, not ranking (`/allocate`)

The core conceptual fix. Risk ranking answers "who is worst off"; capital routing needs "where does a dollar change the outcome."

- Compute a per-tract **uplift score**: estimated evictions prevented per $10k deployed, combining risk, arrears size relative to a typical relief grant, and the share of cases plausibly resolvable by a one-time payment.
- Side-by-side comparison: allocation ranked by risk vs. allocation ranked by uplift, with the divergence highlighted — the tracts risk-ranking over-funds and the tracts it starves.
- A budget slider showing estimated evictions prevented under each strategy for the same dollar amount.
- Honest methodology note: this is a transparent structural model, not a randomized-trial treatment effect, and the assumptions are listed on screen.

## 5. New page: fairness audit (`/fairness`)

- Allocation outcomes broken out across demographic groups (ACS race/ethnicity, income bands) and geography.
- Standard disparity metrics: selection rate ratio per group, and an equal-opportunity style comparison of who gets funded relative to who is at risk.
- A pass/flag indicator per metric with the threshold stated openly.
- Comparison of the risk-ranked and uplift-ranked strategies on the same fairness metrics, so it's visible whether the better-targeting strategy is also the fairer one.
- Written acknowledgement that the geographic targeting itself carries disparate-impact risk under fair-housing law, and that this dashboard is monitoring, not clearance.

## 6. Nav and framing

Add "Allocation" and "Fairness" to the header nav. Update the overview page so the pitch leads with grounded data, uplift targeting, and audited allocation rather than "3D risk map."

## Technical notes

- Data fetching goes in a server function (`src/lib/censusData.functions.ts`) so API calls happen server-side; route loaders call it via `ensureQueryData`.
- Census ACS allows keyless requests at low volume; if a key becomes necessary I'll request it as a secret rather than hardcoding.
- Responses cached in-memory per deployment with a stated fetch timestamp shown in the UI; a fetch failure falls back to the last-known values and displays a visible degraded-data banner rather than silently showing stale numbers.
- Index math moves out of the component into a shared, unit-testable module so the same functions back the map, the allocation view, and the fairness audit.
- `Component3.jsx` keeps its rendering logic; it receives real GeoJSON with the same property names.
- Static Eviction Lab extract committed under `src/data/` with its citation and vintage.

## Explicitly out of scope for this pass

Per your selection, the legal/compliance disclosure layer, consent and anti-phishing UI, and conditional-relief program design are not included here. The fairness page will reference the fair-housing exposure but does not resolve it.
