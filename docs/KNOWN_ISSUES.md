## Shows
 - No way to delete a show

## Segments
 - Clicking edit and then closing without making changes still updates to "Human" authored

## Experiments
 - No audience segments selectable in the run step when you create an experiment
 - attempting to create the experiment without selecting a segment results shows a "missing UUID" error message below input box which is not user friendly / informative

## Strategy Frames
 - citations for strategic frames just shows 'show_data'. Need clear explanation
 - The time since last updated indicator always says 0s. 
 - Page is not automatically refreshed upon completion. 
 - 

## Creative Frames
 - Language needs work

## General UI
 - approve / reject buttons aren't disabled after something is approved
 - Needs to be clear when a step is completed / what is needed to continue.
 - There should be some visible representation of all decisions made during show creation when in its stepper

### Resolved (2026-02-25)
- Async action buttons in strategy/creative/review flows now show pending states and are disabled while requests are in-flight.
- Approve/reject actions now provide visible status feedback instead of silent submission.
- Returning to the Create step now surfaces previously generated variants instead of only in-memory jobs.
- The Create step now has a clear path to finalize and continue to Run.

### Open / Deferred
- Mobile layout compatibility remains intentionally out of scope for now.
