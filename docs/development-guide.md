# Development Guide

Guide for contributing to the Bring The People growth system.

---

## Setup

### Prerequisites

- Python 3.9+
- Git
- Anthropic API key (for Strategy Agent)

### Installation

```bash
# Clone the repository
git clone <repo-url>
cd bring-the-people

# Create virtual environment
python -m venv .venv
source .venv/bin/activate  # Windows: .venv\Scripts\activate

# Install with dev dependencies
pip install -e ".[dev]"

# Verify installation
python -c "import growth; print('OK')"
```

### Environment Setup

```bash
# Copy example env (if available)
cp .env.example .env

# Or set directly
export ANTHROPIC_API_KEY=sk-ant-...
export DATABASE_URL=sqlite:///growth.db
```

---

## Project Structure

```
src/growth/
├── domain/          # Pure business logic
├── ports/           # Protocols/interfaces
├── adapters/        # Concrete implementations
└── app/             # Application layer
```

**Rule**: Code in `domain/` must not import from `adapters/` or `app/`.

---

## Running Tests

### All Tests

```bash
pytest -v
```

### With Coverage

```bash
pytest --cov=growth --cov-report=html --cov-report=term
open htmlcov/index.html  # View coverage report
```

### Specific Test File

```bash
pytest tests/domain/test_policies.py -v
```

### Specific Test

```bash
pytest tests/domain/test_policies.py::test_evaluate_scale -v
```

### Smoke Test (CLI)

```bash
# Run full system test
python -m growth.app.cli

# Cleanup files after
python -m growth.app.cli --cleanup
```

---

## Running the Application

### Development Server

```bash
# Auto-reload on changes
uvicorn growth.app.main:app --reload

# Or via module
python -m uvicorn growth.app.main:app --reload
```

### Production

```bash
# No reload, multiple workers
uvicorn growth.app.main:app --host 0.0.0.0 --port 8000 --workers 4
```

### Health Check

```bash
curl http://localhost:8000/health
# {"status": "ok", "version": "0.2.0"}
```

---

## Making Changes

### Domain Layer

1. **Models** are frozen dataclasses in [`src/growth/domain/models.py`](src/growth/domain/models.py)
2. **Events** are frozen dataclasses in [`src/growth/domain/events.py`](src/growth/domain/events.py)
3. **Policies** are pure functions in [`src/growth/domain/policies.py`](src/growth/domain/policies.py)

When adding a field:

```python
@dataclass(frozen=True)
class Experiment:
    # existing fields...
    new_field: str  # Add here
```

Update corresponding:
- ORM model in [`src/growth/adapters/orm.py`](src/growth/adapters/orm.py)
- Repository conversion functions
- Pydantic schemas in [`src/growth/app/schemas.py`](src/growth/app/schemas.py)
- Tests

### Adding a New API Endpoint

1. **Add route** in appropriate file under [`src/growth/app/api/`](src/growth/app/api/)

```python
@router.post("/{id}/action")
def do_action(id: UUID, request: Request):
    repo = _get_repo(request)
    # ... implementation
```

2. **Register router** in [`src/growth/app/api/app.py`](src/growth/app/api/app.py)

```python
from growth.app.api.new_module import router as new_router
app.include_router(new_router, prefix="/api/new", tags=["new"])
```

3. **Add tests** in `tests/api/`

### Adding a Repository

1. **Define port** in [`src/growth/ports/repositories.py`](src/growth/ports/repositories.py)

```python
class NewRepository(Protocol):
    def get_by_id(self, id: UUID) -> NewModel | None: ...
    def save(self, model: NewModel) -> None: ...
```

2. **Implement adapter** in [`src/growth/adapters/repositories.py`](src/growth/adapters/repositories.py)

```python
class SQLAlchemyNewRepository(NewRepository):
    def __init__(self, session: Session): ...
```

3. **Wire in container** in [`src/growth/app/container.py`](src/growth/app/container.py)

4. **Add ORM model** in [`src/growth/adapters/orm.py`](src/growth/adapters/orm.py)

---

## Code Style

### Imports

```python
# Standard library
from __future__ import annotations
from dataclasses import dataclass
from datetime import datetime

# Third-party
from sqlalchemy.orm import Session
from pydantic import BaseModel

# Local
from growth.domain.models import Show
from growth.ports.repositories import ShowRepository
```

### Type Hints

- Use `from __future__ import annotations` for forward references
- Use `|` union syntax: `str | None`
- Annotate all function parameters and returns

### Docstrings

```python
def evaluate(
    num_windows: int,
    total_clicks: int,
    ...
) -> Decision:
    """Evaluate an experiment and return a decision.
    
    Decision hierarchy:
    1. Guardrails - if violated, KILL immediately
    2. Kill conditions - if triggered, KILL
    3. Evidence minimums - if not met, HOLD
    4. Scale conditions - if met, SCALE; else HOLD
    """
```

---

## Testing Guidelines

### Unit Tests (Domain)

Test pure functions with various inputs:

```python
def test_check_guardrails_returns_kill_on_high_refund():
    result = check_guardrails(
        refund_rate=0.15,  # Above 10% threshold
        complaint_rate=0.01,
        negative_comment_rate=0.05,
        max_refund_rate=0.10,
        max_complaint_rate=0.05,
        max_negative_comment_rate=0.15,
    )
    assert result == DecisionAction.KILL
```

### Integration Tests (Adapters)

Test with real database (SQLite in-memory):

```python
@pytest.fixture
def session():
    from growth.adapters.orm import get_engine, get_session_maker
    engine = get_engine("sqlite:///:memory:")
    create_tables(engine)
    Session = get_session_maker(engine)
    return Session()

def test_save_and_retrieve_show(session):
    repo = SQLAlchemyShowRepository(session)
    show = Show(...)
    repo.save(show)
    
    retrieved = repo.get_by_id(show.show_id)
    assert retrieved.artist_name == show.artist_name
```

### API Tests

Use FastAPI's TestClient:

```python
from fastapi.testclient import TestClient
from growth.app.api.app import create_app

@pytest.fixture
def client():
    app = create_app()
    return TestClient(app)

def test_create_show(client):
    response = client.post("/api/shows", json={...})
    assert response.status_code == 201
    assert response.json()["artist_name"] == "Test Artist"
```

### Fixtures

Common fixtures in `conftest.py`:

```python
@pytest.fixture
def sample_show():
    return Show(
        show_id=uuid4(),
        artist_name="Test Artist",
        ...
    )
```

---

## Debugging

### Event Log Inspection

```bash
# Read all events
cat data/events.jsonl | jq .

# Filter by type
cat data/events.jsonl | jq 'select(.event_type == "experiment_started")'
```

### Database Inspection

```bash
# SQLite CLI
sqlite3 growth.db

# Or Python
python -c "
from growth.adapters.orm import get_engine, get_session_maker
from growth.adapters.repositories import SQLAlchemyShowRepository
engine = get_engine()
Session = get_session_maker(engine)
session = Session()
repo = SQLAlchemyShowRepository(session)
for show in repo.list_all():
    print(show)
"
```

### Strategy Agent Debugging

Each run creates artifacts in `data/runs/{run_id}/`:

```bash
# View conversation log
cat data/runs/{run_id}/strategy_conversation.jsonl | jq .

# View final plan
cat data/runs/{run_id}/plan.json | jq .
```

---

## Common Tasks

### Adding a New Decision Rule

1. Add function to [`src/growth/domain/policies.py`](src/growth/domain/policies.py)
2. Call it from [`evaluate()`](src/growth/domain/policies.py:128) in appropriate order
3. Add tests in [`tests/domain/test_policies.py`](tests/domain/test_policies.py)
4. Update configuration schema in [`src/growth/domain/policy_config.py`](src/growth/domain/policy_config.py)
5. Add threshold to [`config/policy.toml`](config/policy.toml)

### Adding a New Tool for Strategy Agent

1. Implement function in `src/growth/adapters/llm/strategy_tools.py`
2. Add to tool schemas in `src/growth/adapters/llm/prompts/strategy.py`
3. Add to dispatcher in [`StrategyService._build_tool_dispatcher()`](src/growth/app/services/strategy_service.py:185)
4. Add tests

### Updating Policy Configuration

Edit [`config/policy.toml`](config/policy.toml), restart server. Config is loaded at startup.

---

## Troubleshooting

### Import Errors

```bash
# Ensure src is in path
export PYTHONPATH="${PYTHONPATH}:$(pwd)/src"

# Or use editable install
pip install -e ".[dev]"
```

### Database Locked (SQLite)

```bash
# Remove lock file
rm growth.db-journal

# Or use WAL mode (add to ORM setup)
```

### Tests Failing After Changes

```bash
# Run specific failing test with verbose output
pytest tests/path/to/test.py::test_name -v -s

# Check for import cycles
python -c "import growth"
```

---

## Release Checklist

- [ ] All tests pass
- [ ] Coverage maintained/improved
- [ ] Version bumped in `pyproject.toml`
- [ ] CHANGELOG updated
- [ ] Documentation updated
- [ ] Smoke test passes
- [ ] Git tag created

---

## Getting Help

- Check existing tests for examples
- Review design docs in `docs/designs/`
- Read architecture docs in `docs/`
