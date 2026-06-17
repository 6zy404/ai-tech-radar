# Workspace Actions

Workspace pages are internal editorial tools. Actions must tell an operator what
will happen, what records are affected, and whether the action changes public
output or external delivery state.

## Action hierarchy

### Primary action

The main next step on a page. Examples:

- `Import enabled sources`
- `Convert to technology draft`
- `Save draft edits`
- `Publish technology`
- `Publish digest`
- `Send to selected channel`

Rules:

- Use at most one or two primary actions per page or panel.
- Place primary actions near the object or workflow they affect.
- Use result-oriented copy, not generic verbs.
- Disable primary actions when prerequisites are missing and explain why.

### Secondary action

Useful but not the main workflow path. Examples:

- `Mark candidate as reviewed`
- `Reset candidate to new`
- `Move technology back to draft`
- `Add technology to digest`
- `Run schedule now`

Rules:

- Keep secondary actions visually quieter than primary actions.
- The label should still describe the resulting state.
- Do not use vague labels such as `Submit`, `Apply`, `Run`, or `Update` by
  themselves.

### Destructive action

An action that removes an item from the active workflow or public surface.
Examples:

- `Reject candidate`
- `Archive technology`
- `Archive digest`
- `Disable source`
- `Disable channel`
- `Disable schedule`
- `Exclude from digest`

Rules:

- Style destructive actions as secondary or subdued controls unless the page is
  specifically about resolving a destructive state.
- Confirm before execution.
- Explain the result in the confirmation copy.

### Status action

An action that changes internal lifecycle state. Examples:

- `Mark candidate as reviewed`
- `Reset candidate to new`
- `Move technology back to draft`
- `Enable source`
- `Enable channel`
- `Enable schedule`

Rules:

- The label must include the target object when there are several object types
  on the page.
- Show a result message after the mutation.

### Diagnostic action

An action used for inspection, validation, retry, or operational recovery.
Examples:

- `Run source import`
- `Run due schedules now`
- `Retry failed delivery`
- `Generate enrichment suggestion`
- `Regenerate enrichment suggestion`
- `Apply selected suggestion fields`

Rules:

- Keep diagnostics lower priority than publish or conversion actions.
- If the action can cause an external send or overwrite draft fields, confirm
  before executing.
- Do not expose diagnostic actions on user-facing pages.

## Copy rules

Avoid vague button labels:

- `Run`
- `Submit`
- `Update`
- `Generate`
- `Send`
- `Apply`

Use result-oriented labels:

- `Run source import`
- `Save draft edits`
- `Generate digest draft`
- `Publish digest`
- `Send to selected channel`
- `Mark candidate as reviewed`
- `Reject candidate`
- `Convert to technology draft`
- `Apply selected suggestion fields`
- `Regenerate enrichment suggestion`

## Confirmation rules

Confirm these actions:

- rejecting a candidate
- archiving a digest or technology record
- disabling a source, delivery channel, or schedule
- sending a digest to an external channel
- retrying a failed delivery
- regenerating a digest draft when manual edits may exist
- excluding a technology from a digest
- applying enrichment suggestion fields that overwrite existing draft values

## Disabled and empty states

When an action is disabled, the UI should say why. Examples:

- A disabled source cannot be imported until it is enabled.
- A draft cannot be published until readiness errors are fixed.
- A draft digest cannot be delivered until it is published.
- A disabled schedule cannot be manually run.
- Due schedules cannot run when no enabled schedule is ready.

Empty states should point to the next useful workspace module instead of
displaying blank panels.

## Boundary rules

Workspace action components are internal-only. They must not be imported by
public routes such as `/technologies`, `/technologies/[slug]`, `/digest/today`,
or `/digest/[date]`.

User-facing pages may link to public content and feeds, but must not show
workspace mutation controls, delivery channel configuration, workflow events,
audit logs, task runner state, or workspace access tokens.

## UI Template QA & Consolidation v0 action checklist

The current Workspace Console Template action hierarchy is:

- Page primary action: one dominant action per page, such as `Add source`,
  `Refresh enabled sources`, or `Generate digest draft`.
- Row secondary actions: object-specific inspection or safe workflow actions,
  such as `Run source import`, `Edit source`, `View source detail`,
  `Open workspace record`, `Open source`, `Review digest`, and `Preview digest`.
- Risky actions: lifecycle-disrupting controls such as `Disable source`,
  `Reject candidate`, `Archive digest`, or `Exclude from digest`; keep these
  visually weaker than primary actions and confirm when appropriate.
- Diagnostic actions: validation, retry, import, sync, and run controls; keep
  them inside workspace and avoid exposing them on public routes.

The current User-facing Reading Template action hierarchy is:

- Public reading action: `Open signal`, `View skill`, `View concept`, or
  `Open related signal`.
- Public feed action: public digest pages may link to `RSS feed` and
  `JSON feed`.
- No public route should show `Publish`, `Convert`, `Review`, `Run import`,
  `Send`, `Retry`, `Disable`, `Archive`, or other workspace mutation controls.

Completed template action review:

- `/workspace/sources`
- `/workspace/candidates`
- `/workspace/digests`
- `/technologies`
- `/technologies/[slug]`

Still to review in later UI migration:

- `/digest/today`
- `/digest/[date]`
- `/skills`
- `/knowledge`
- `/workspace/operations`
- `/workspace/duplicates`
- `/workspace/technologies`
