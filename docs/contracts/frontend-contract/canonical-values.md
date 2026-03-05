# §1 Canonical Values

← [Frontend Contract index](../frontend-contract.md)

All status values below are authoritative. Do not use synonyms, aliases, or
invented values. If a value is not in these tables, it does not exist.

### Review status (segments, frames, variants)

| Value    | Meaning                |
|----------|------------------------|
| pending  | Awaiting human review  |
| approved | Approved by reviewer   |
| rejected | Rejected by reviewer   |

WRONG: `"draft"`, `"in_review"`, `"accepted"`, `"declined"`

### Action-to-status mapping

Frontend review actions map to backend status values. Do not confuse action
verbs with status values. `"approve"` is an action. `"approved"` is a status.

| UI action button | API field: `action` | Stored as `review_status` |
|------------------|---------------------|---------------------------|
| "Approve"        | `"approve"`         | `"approved"`              |
| "Reject"         | `"reject"`          | `"rejected"`              |

### Job status

| Value     | Terminal? |
|-----------|-----------|
| queued    | no        |
| running   | no        |
| completed | yes       |
| failed    | yes       |

### Experiment status

| Value             | Meaning                                |
|-------------------|----------------------------------------|
| draft             | Created, not yet launched              |
| active            | Ads running externally                 |
| awaiting_approval | Carried from prior cycle, needs review |
| decided           | Scale/hold/kill decision recorded      |

### Decision action

| Value | Meaning          |
|-------|------------------|
| scale | Increase spend   |
| hold  | Maintain current |
| kill  | Stop experiment  |

### Show phase

| Value | Window         |
|-------|----------------|
| early | T-60 to T-22   |
| mid   | T-21 to T-8    |
| late  | T-7 to T-0     |
