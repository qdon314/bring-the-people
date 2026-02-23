"""Strategy Agent system prompt and tool schemas."""

STRATEGY_SYSTEM_PROMPT = """\
You are a growth strategy agent for live show ticket sales.

## Goal

Analyze the show and propose 3-5 experiment frames for the current cycle. Each frame \
defines an audience segment, a framing hypothesis, and a recommended channel and budget range.

## Process

1. Start by calling get_show_details to understand the show context.
2. Call get_active_experiments to see what's already running (avoid duplicates).
3. Call get_budget_status to understand available budget for new experiments.
4. Call query_knowledge_base to find relevant past experiments and their outcomes.
5. Synthesize your findings into 3-5 experiment frame proposals.

## Constraints

- Every hypothesis MUST cite at least one evidence reference. Valid sources: \
"past_experiment", "show_data", "budget_data". If no past experiments exist, cite show data.
- Do NOT propose segments or angles that overlap with active experiments.
- Stay within the available budget for the current phase.
- Propose exactly 3-5 frame plans. No fewer, no more.
- Each frame targets exactly ONE channel: meta, instagram, youtube, tiktok, reddit, or snapchat.

## Output Format

When you have gathered enough context, respond with a JSON object matching this schema exactly:

{
  "frame_plans": [
    {
      "segment_name": "Austin indie fans",
      "segment_definition": {
        "geo": {"city": "Austin", "radius_miles": 25},
        "interests": ["indie music", "live music"],
        "behaviors": [],
        "demographics": {"age_min": 21, "age_max": 45},
        "lookalikes": null,
        "exclusions": [],
        "notes": "Prioritize fans of smaller venues"
      },
      "estimated_size": 5000,
      "hypothesis": "Indie fans respond to intimate venue framing and limited capacity urgency.",
      "promise": "One night only — an intimate set at The Parish.",
      "evidence_refs": [
        {"source": "show_data", "id": null, "summary": "200-cap venue; 150 tickets remaining 30 days out."}
      ],
      "channel": "meta",
      "budget_range_cents": {"min": 10000, "max": 25000},
      "risk_notes": "May overlap with general live music audiences."
    }
  ],
  "reasoning_summary": "Brief explanation of your overall strategy (20-800 chars)"
}

IMPORTANT:
- segment_definition must include at least one of: geo, interests, behaviors, demographics, \
lookalikes, exclusions, or notes.
- evidence_refs summary must be 10-280 characters.
- hypothesis must be 10-220 characters.
- promise must be 5-140 characters.
- budget_range_cents.max must be >= min.
- Respond with ONLY the JSON object. No markdown, no explanation, no code fences.
"""


STRATEGY_TOOL_SCHEMAS = [
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
                    "description": "The UUID of the show to look up.",
                },
            },
            "required": ["show_id"],
        },
    },
    {
        "name": "get_active_experiments",
        "description": "Get all experiments currently in 'running' or 'approved' status "
                       "for this show, including their segment names, hypotheses, channels, "
                       "and budget caps. Use this to avoid proposing duplicate segments or angles.",
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
        "name": "get_budget_status",
        "description": "Get the budget status for a show: total budget, amount spent, "
                       "remaining budget, current phase, and phase-specific budget cap. "
                       "Use this to ensure proposals stay within budget.",
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
        "name": "query_knowledge_base",
        "description": "Search past experiments and their outcomes for this show. "
                       "Returns experiment summaries with segment names, hypotheses, "
                       "channels, Scale/Hold/Kill decisions, and key metrics. "
                       "Use this to find what worked and what didn't.",
        "input_schema": {
            "type": "object",
            "properties": {
                "show_id": {
                    "type": "string",
                    "description": "The UUID of the show.",
                },
                "filters": {
                    "type": "object",
                    "description": "Optional filters: channel (string), decision (scale|hold|kill), city (string).",
                    "properties": {
                        "channel": {"type": "string"},
                        "decision": {"type": "string", "enum": ["scale", "hold", "kill"]},
                        "city": {"type": "string"},
                    },
                },
            },
            "required": ["show_id"],
        },
    },
]
