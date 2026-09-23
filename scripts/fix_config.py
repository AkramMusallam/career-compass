import os

with open("backend/app/core/config.py", "r", encoding="utf-8") as f:
    content = f.read()

if "OPENAI_API_KEY" not in content:
    content = content.replace(
        'USE_MONGOMOCK: bool = os.getenv("USE_MONGOMOCK", "0") == "1"',
        'USE_MONGOMOCK: bool = os.getenv("USE_MONGOMOCK", "0") == "1"\n\n    # ---- AI Engines ----\n    OPENAI_API_KEY: str = os.getenv("OPENAI_API_KEY", "")'
    )
    with open("backend/app/core/config.py", "w", encoding="utf-8") as f:
        f.write(content)
print("Config updated.")