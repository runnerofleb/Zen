# Revenue Desk

`revdesk.html` is the entry point. The app is a static, dependency-free browser application, served by the repository’s existing GitHub Pages deployment.

## Files

- `revdesk/core.js`: testable rules for evidence, coverage, recommendations, quote verification, milestones, payments, refunds, queue order, migration, and metrics.
- `revdesk/data.js`: centrally maintained reference catalog, playbook, and isolated practice data.
- `revdesk/app.js`: UI, dialogs, local persistence, copy/export handoffs, and backup restore.
- `revdesk/styles.css`: responsive dark/light interface.
- `tests/revdesk.test.js`: financial and workflow regression tests, using Node’s built-in test runner.

Run `node --test tests/revdesk*.test.js`. Application event handlers are also exercised in a minimal DOM harness; these tests do not substitute for visual browser QA. For local development, serve the repository with `python -m http.server 8765` and open `/revdesk.html`.

A self-contained review copy is provided as `revdesk-preview.html`; download it and open it in a browser. It starts with isolated practice records. Rebuild it after source changes with `python scripts/build-revdesk-preview.py`. No build step is required for the main app.

## Workflow

1. Create a deal or continue one from the queue.
2. Start a call to record time. Agree on purpose and available time.
3. Capture the buyer’s need, impact, timing, decision process, fit, and decision criteria. Short-on-time mode prioritizes need, timing, and decision.
4. Verify coverage. Unknown, already covered, confirmed gap, and not relevant are different states; outside providers count as coverage.
5. Review a fitting recommendation. All quoted prices, eligibility, scope, and terms require account-level verification. Enter initial price, billing period, full scope, renewal/cancellation terms, source, and expiration.
6. Record actual customer acceptance and authorization separately. Revenue remains zero until a successful external payment is explicitly recorded with a unique reference.
7. Confirm activation, or schedule a specific next step. Copy reviewed recaps and follow-up drafts into approved systems.

The original training guide remains available at `junecallguideofficial.html`. Other existing pages are unchanged.

## Data and integration boundaries

This version does **not** connect to Salesforce, a payment processor, a dialer, or an email sender. It never charges a customer, issues a refund, sends an invitation, or sends a message. Its financial records are explicitly rep-confirmed records of transactions completed in the approved service system. Do not store payment card details, credentials, or sensitive identifiers.

The historical catalog is adapted from the prior app’s June 2026 guide and is labeled as reference material, not current pricing. Settings supports a maintained catalog JSON import; export the template to see the schema. Prices are integer USD cents as `[singleMember, multiMember]`, with `null` for unavailable/unknown amounts. Imported catalogs never verify customer quotes automatically. Product scope and terms are copied into an immutable payment snapshot when payment is recorded.

Records are persisted in localStorage under `revdesk:v3:workspace`. Practice data uses `revdesk:v3:practice`, never the real workspace. Settings exports JSON backups and CSV summaries and validates a selected backup before a confirmed replacement. Multiple tabs detect conflicting revisions and stop overwriting saved records. Storage failures are visible and allow a backup export. There is no cross-device sync.

On the first run, a recognizable prior draft under `zbcm_june_call` is imported once. Original keys remain untouched. Old cart selections and daily counters are not imported as paid transactions. Coverage is unknown unless the old record explicitly establishes it.

## Metric definitions

- **Paid deals**: unique deals receiving their first recorded successful payment within the selected period. Later installments increase cash but do not create another deal.
- **Net collected**: successful payment amounts recorded in the period minus refund amounts recorded in that period.
- **Contract value**: quoted monthly price times commitment months, or the one-time/annual amount. It is not collected cash.
- **Retained count**: first-paid deals from the period that still have positive net collected value across all recorded history.
- **Qualified deal**: a completed connected call with a recorded need, decision process, and at least one confirmed gap. The denominator uses unique deals.
- **Qualified close rate**: deals both qualified and paid during the reporting window divided by deals qualified during that window. It is not a prediction or a lifetime cohort rate.
- **Paid deals per call hour**: first-paid deals divided by duration of completed calls during the period. Calls in progress are excluded until ended.
- **Follow-up conversion**: deals with a customer-agreed follow-up and a payment recorded within the selected period, over all such follow-up deals.
- **Activation count**: customer activations confirmed during the selected period.

All report date boundaries use the selected IANA reporting time zone. Scheduling inputs explicitly use the device time zone. Baseline/adaptive workflow labels are locked after the first call; comparisons are descriptive and should use comparable lead sources.

## Future integrations

A backend with approved account authentication is needed for authoritative CRM events, current product pricing, automatic payment reconciliation, multi-user sync, and approved transcription. Keep secrets and OAuth tokens off the static site. Integrations should preserve unique transaction references, append-only payment/refund history, explicit evidence sources, and buyer approval gates.
