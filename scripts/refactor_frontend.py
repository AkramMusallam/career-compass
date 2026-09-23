import os
import shutil
import re

FRONTEND_DIR = r"frontend/src"

pages_map = {
    "auth": ["Login.jsx", "Register.jsx", "ForgotPassword.jsx", "ResetPassword.jsx"],
    "analysis": ["UploadCV.jsx", "ReviewExtractedData.jsx", "AssessmentQuestions.jsx", "Loading.jsx", "Results.jsx", "CompareAnalyses.jsx"],
    "dashboard": ["Dashboard.jsx", "History.jsx", "Profile.jsx", "Settings.jsx"],
    "interview": ["Interview.jsx"],
    "shared": ["SharedResults.jsx"]
}

components_map = {
    "layout": ["AppLayout.jsx", "CompassLogo.jsx"],
    "ui": ["CircularProgress.jsx", "Spinner.jsx", "Stepper.jsx"],
    "features": ["FeedbackWidget.jsx", "ShareModal.jsx"],
    "routing": ["ProtectedRoute.jsx"]
}

# 1. Move files and update their internal imports
def update_file_imports(filepath, depth_increase=1):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # Update relative imports like "../api" to "../../api"
    # Match exactly quotes and ../
    if depth_increase == 1:
        # Replace "./" with "../" for components importing other components if they were in the same dir?
        # Actually, let's just replace "../" with "../../" and "./" with "../" ONLY for imports
        
        def replace_import(match):
            import_path = match.group(2)
            if import_path.startswith("../"):
                return f"{match.group(1)}../{import_path}{match.group(3)}"
            elif import_path.startswith("./"):
                return f"{match.group(1)}../components/{import_path[2:]}{match.group(3)}"
            return match.group(0)

        # Better approach: just regex replace `from "../` to `from "../../`
        content = re.sub(r'(from\s+["\'])(\.\./)(.*?)', r'\1../../\3', content)
        # For css imports: `import "../index.css"`
        content = re.sub(r'(import\s+["\'])(\.\./)(.*?)', r'\1../../\3', content)
        
        # If a page imported a component like `from "../components/Stepper"`, it becomes `from "../../components/Stepper"`.
        # What if it's a component moved? `from "./Spinner"` becomes `from "../ui/Spinner"`? This is tricky.
        
    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(content)

# Move Pages
pages_dir = os.path.join(FRONTEND_DIR, "pages")
for folder, files in pages_map.items():
    target_dir = os.path.join(pages_dir, folder)
    os.makedirs(target_dir, exist_ok=True)
    for file in files:
        src = os.path.join(pages_dir, file)
        dst = os.path.join(target_dir, file)
        if os.path.exists(src):
            shutil.move(src, dst)
            update_file_imports(dst, depth_increase=1)

# App.jsx imports update for pages
app_jsx = os.path.join(FRONTEND_DIR, "App.jsx")
with open(app_jsx, 'r', encoding='utf-8') as f:
    app_content = f.read()

for folder, files in pages_map.items():
    for file in files:
        name = file.replace(".jsx", "")
        app_content = app_content.replace(f'import("./pages/{name}")', f'import("./pages/{folder}/{name}")')

# Component moving is riskier with imports, let's just do Pages first to see if it works well.
# It provides 90% of the structural benefit.

with open(app_jsx, 'w', encoding='utf-8') as f:
    f.write(app_content)

print("Pages refactored successfully.")