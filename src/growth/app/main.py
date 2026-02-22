"""Uvicorn entry point for the Growth API."""
from growth.app.api.app import create_app

app = create_app()

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("growth.app.main:app", host="0.0.0.0", port=8000, reload=True)
