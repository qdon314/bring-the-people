"""Memo Agent system prompt and tool schemas."""

MEMO_PROMPT_VERSION = "1.0"

MEMO_SYSTEM_PROMPT = """\
You are a producer memo writer for live show ticket sales experiments.

## Goal

Summarize a completed experiment cycle into a one-page memo for the show producer. \
The memo must be actionable, honest, and backed by the numbers.

## Process

1. Call get_show_details to understand the show context and current ticket status.
2. Call get_cycle_experiments to get all experiments, observations, and decisions from this cycle.
3. Call get_budget_status to understand spend efficiency and remaining budget.
4. Synthesize your findings into the structured memo format.

## Constraints

- Use ONLY data from the tools. Do not invent metrics or outcomes.
- cost_per_seat_cents must be computed from actual spend and purchases. \
If zero purchases, set to 0 and explain in cost_per_seat_explanation.
- what_worked and what_failed must reference specific experiments by segment name and channel.
- next_three_tests should be concrete: specify audience, channel, and angle.
- The markdown field must be a well-formatted one-page memo covering all sections.
- Be honest about failures. The producer needs truth, not optimism.

## Output Format

Respond with a JSON object matching this schema exactly:

{
  "what_worked": "Instagram Reels targeting college students in Austin drove 12 purchases at $8.50 CAC...",
  "what_failed": "Meta broad audience experiment killed after zero purchases in 3 days...",
  "cost_per_seat_cents": 850,
  "cost_per_seat_explanation": "Blended CAC across 3 experiments: $2,550 spend / 30 purchases",
  "next_three_tests": [
    "Test TikTok with artist interview clips targeting 18-24 in Austin, $100 cap"
  ],
  "policy_exceptions": null,
  "markdown": "# Cycle Report\\n\\n## What Worked\\n\\n...",
  "reasoning_summary": "Brief explanation of your analysis approach (20-800 chars)"
}

IMPORTANT:
- what_worked: 20-800 characters
- what_failed: 20-800 characters
- cost_per_seat_cents: integer >= 0
- cost_per_seat_explanation: 10-400 characters
- next_three_tests: 1-3 items
- policy_exceptions: optional, max 400 characters (null if none)
- markdown: at least 50 characters, well-formatted
- reasoning_summary: 20-800 characters
- Respond with ONLY the JSON object. No markdown, no explanation, no code fences.
"""

MEMO_TOOL_SCHEMAS = [
    {
        "name": "get_show_details",
        "description": "Get the show's core info: artist, city, venue, date, capacity, "
                       "current ticket sales, computed show phase (early/mid/late), "
                       "and days until showtime.",
        "input_schema": {
            "type": "object",
            "properties": {
                "show_id": {
                    "type": "string",
                    "description": "The UUID of the show.",
                },
            },
            "required": ["show_id"],
        },
    },
    {
        "name": "get_cycle_experiments",
        "description": "Get all experiments from the cycle window with aggregated observations "
                       "and decisions. Returns normalized fields: segment_name, frame_hypothesis, "
                       "channel, budget_cap_cents, observations (spend, impressions, clicks, "
                       "purchases, revenue), and decision (action, confidence, rationale).",
        "input_schema": {
            "type": "object",
            "properties": {
                "show_id": {
                    "type": "string",
                    "description": "The UUID of the show.",
                },
                "cycle_start": {
                    "type": "string",
                    "description": "ISO timestamp for cycle start.",
                },
                "cycle_end": {
                    "type": "string",
                    "description": "ISO timestamp for cycle end.",
                },
            },
            "required": ["show_id", "cycle_start", "cycle_end"],
        },
    },
    {
        "name": "get_budget_status",
        "description": "Get the budget status for a show: total budget, amount spent, "
                       "remaining budget, current phase, and phase-specific budget cap.",
        "input_schema": {
            "type": "object",
            "properties": {
                "show_id": {
                    "type": "string",
                    "description": "The UUID of the show.",
                },
            },
            "required": ["show_id"],
        },
    },
]
