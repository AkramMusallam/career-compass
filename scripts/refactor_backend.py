import os
import shutil
import re
from glob import glob

APP_DIR = r"backend/app"

# 1. Create directories
core_dir = os.path.join(APP_DIR, "core")
worker_dir = os.path.join(APP_DIR, "worker")
api_dir = os.path.join(APP_DIR, "api")
os.makedirs(core_dir, exist_ok=True)
os.makedirs(worker_dir, exist_ok=True)

# 2. Rename routers -> api/routes
routers_dir = os.path.join(APP_DIR, "routers")
api_routes_dir = os.path.join(api_dir, "routes")
if os.path.exists(routers_dir):
    shutil.move(routers_dir, api_routes_dir)

# 3. Move core and worker files
files_to_move = {
    "config.py": core_dir,
    "database.py": core_dir,
    "mongo.py": core_dir,
    "security.py": core_dir,
    "celery_app.py": worker_dir,
    "tasks.py": worker_dir
}

for file, dest in files_to_move.items():
    src = os.path.join(APP_DIR, file)
    if os.path.exists(src):
        shutil.move(src, os.path.join(dest, file))

# Fix init files
open(os.path.join(core_dir, "__init__.py"), "w").close()
open(os.path.join(worker_dir, "__init__.py"), "w").close()
open(os.path.join(api_dir, "__init__.py"), "w").close()

# 4. Global Find and Replace for imports
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

python_files = glob(os.path.join(APP_DIR, "**/*.py"), recursive=True)

for filepath in python_files:
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
    
    new_content = content
    for pattern, repl in replacements.items():
        new_content = re.sub(pattern, repl, new_content)
        
    if new_content != content:
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(new_content)

print("Backend refactored successfully.")