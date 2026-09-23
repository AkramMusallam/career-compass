import os
import re
from glob import glob

TESTS_DIR = r"backend/tests"

replacements = {
    r'from app\.routers': 'from app.api.routes',
    r'from app\.config': 'from app.core.config',
    r'from app\.database': 'from app.core.database',
    r'from app\.mongo': 'from app.core.mongo',
    r'from app\.security': 'from app.core.security',
    r'from app\.celery_app': 'from app.worker.celery_app',
    r'from app\.tasks': 'from app.worker.tasks',
    r'import app\.routers': 'import app.api.routes',
}

python_files = glob(os.path.join(TESTS_DIR, "**/*.py"), recursive=True)

for filepath in python_files:
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
    
    new_content = content
    for pattern, repl in replacements.items():
        new_content = re.sub(pattern, repl, new_content)
        
    if new_content != content:
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(new_content)

print("Tests refactored successfully.")