# __init__.py - Entry point for the Grok Imagine Mini Browser custom node
# This file loads the node definitions and tells ComfyUI where the frontend JS is.

from .Simple_Web_Browser import NODE_CLASS_MAPPINGS, NODE_DISPLAY_NAME_MAPPINGS
# If you renamed the Python file (e.g., to grok_browser.py), change the import above to:
# from .grok_browser import NODE_CLASS_MAPPINGS, NODE_DISPLAY_NAME_MAPPINGS

WEB_DIRECTORY = "./js"  # Points to the js/ folder containing your modified Simple_Web_Browser.js

__all__ = ['NODE_CLASS_MAPPINGS', 'NODE_DISPLAY_NAME_MAPPINGS', 'WEB_DIRECTORY']
