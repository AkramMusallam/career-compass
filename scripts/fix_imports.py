import os
import re
from glob import glob

FRONTEND_DIR = r"frontend/src"
components_files = glob(os.path.join(FRONTEND_DIR, "components/*/*.jsx"))

for comp in components_files:
    with open(comp, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # Fix the over-replaced paths
    # from "../../../context" to "../../context"
    content = content.replace('from "../../../context', 'from "../../context')
    content = content.replace('from "../../../api', 'from "../../api')
    content = content.replace('from "../../../assets', 'from "../../assets')
    
    # Also in ProtectedRoute.jsx: import Spinner from "./Spinner" -> should be import Spinner from "../ui/Spinner"
    content = content.replace('import Spinner from "./Spinner"', 'import Spinner from "../ui/Spinner"')
    
    # AppLayout.jsx: CompassLogo from "./CompassLogo" -> "./CompassLogo" is correct because both are in layout/
    
    # What about Results.jsx importing FeedbackWidget?
    # It was `from "../../components/FeedbackWidget"`
    # It became `from "../../components/features/FeedbackWidget"` -> correct.
    
    # What about ShareModal? It's in features.
    # Results imports ShareModal.
    # It was `from "../../components/ShareModal"`.
    # Let's check other things.
    
    with open(comp, 'w', encoding='utf-8') as f:
        f.write(content)

# We should also check pages importing components
pages_files = glob(os.path.join(FRONTEND_DIR, "pages/*/*.jsx"))
for p in pages_files:
    with open(p, 'r', encoding='utf-8') as f:
        content = f.read()
        
    # CompassLogo was moved to layout
    content = content.replace('from "../../components/CompassLogo"', 'from "../../components/layout/CompassLogo"')
    # Stepper -> ui
    content = content.replace('from "../../components/Stepper"', 'from "../../components/ui/Stepper"')
    # Spinner -> ui
    content = content.replace('from "../../components/Spinner"', 'from "../../components/ui/Spinner"')
    # CircularProgress -> ui
    content = content.replace('from "../../components/CircularProgress"', 'from "../../components/ui/CircularProgress"')
    # FeedbackWidget -> features
    content = content.replace('from "../../components/FeedbackWidget"', 'from "../../components/features/FeedbackWidget"')
    # ShareModal -> features
    content = content.replace('from "../../components/ShareModal"', 'from "../../components/features/ShareModal"')
    
    with open(p, 'w', encoding='utf-8') as f:
        f.write(content)

print("Imports fixed.")