import os
import shutil
import re
from glob import glob

FRONTEND_DIR = r"frontend/src"
components_dir = os.path.join(FRONTEND_DIR, "components")

components_map = {
    "layout": ["AppLayout.jsx", "CompassLogo.jsx"],
    "ui": ["CircularProgress.jsx", "Spinner.jsx", "Stepper.jsx"],
    "features": ["FeedbackWidget.jsx", "ShareModal.jsx"],
    "routing": ["ProtectedRoute.jsx"]
}

for folder, files in components_map.items():
    target_dir = os.path.join(components_dir, folder)
    os.makedirs(target_dir, exist_ok=True)
    for file in files:
        src = os.path.join(components_dir, file)
        dst = os.path.join(target_dir, file)
        if os.path.exists(src):
            shutil.move(src, dst)

# Fix relative paths inside moved components (../ to ../../)
moved_components = glob(os.path.join(components_dir, "*/*.jsx"))
for comp in moved_components:
    with open(comp, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # Change imports: `from "../` -> `from "../../`
    content = re.sub(r'(from\s+["\'])(\.\./)(.*?)', r'\1../../\3', content)
    # Also fix import statement like `import compassLogo from "../assets/logo.svg"`
    content = re.sub(r'(import\s+.*?from\s+["\'])(\.\./)(.*?)', r'\1../../\3', content)
    
    with open(comp, 'w', encoding='utf-8') as f:
        f.write(content)

# Fix imports in pages and App.jsx that refer to components
# From `from "../components/AppLayout"` to `from "../components/layout/AppLayout"`
# (App.jsx is at root, so it's `./components/AppLayout` to `./components/layout/AppLayout`)

def update_imports(file_path, is_app_jsx=False):
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    prefix = r'\./components/' if is_app_jsx else r'\.\./\.\./components/'
    for folder, files in components_map.items():
        for file in files:
            name = file.replace(".jsx", "")
            # e.g., App.jsx: from "./components/AppLayout" -> "./components/layout/AppLayout"
            # e.g., Page.jsx: from "../../components/Stepper" -> "../../components/ui/Stepper"
            if is_app_jsx:
                content = re.sub(f'(from\\s+["\'])\\./components/{name}(["\'])', f'\\1./components/{folder}/{name}\\2', content)
                content = re.sub(f'(import\\s+[^{{}}]*?from\\s+["\'])\\./components/{name}(["\'])', f'\\1./components/{folder}/{name}\\2', content)
            else:
                # Pages now live in pages/auth, pages/dashboard so their relative path to components is `../../components/`
                # If they already use `../../components/Stepper`, replace it with `../../components/ui/Stepper`
                content = re.sub(f'(from\\s+["\'])\\.\\./\\.\\./components/{name}(["\'])', f'\\1../../components/{folder}/{name}\\2', content)
                content = re.sub(f'(import\\s+[^{{}}]*?from\\s+["\'])\\.\\./\\.\\./components/{name}(["\'])', f'\\1../../components/{folder}/{name}\\2', content)

    with open(file_path, 'w', encoding='utf-8') as f:
        f.write(content)

# Update App.jsx
update_imports(os.path.join(FRONTEND_DIR, "App.jsx"), is_app_jsx=True)

# Update all pages
pages_files = glob(os.path.join(FRONTEND_DIR, "pages/*/*.jsx"))
for p in pages_files:
    update_imports(p, is_app_jsx=False)

print("Components refactored successfully.")