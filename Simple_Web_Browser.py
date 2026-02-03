import server
from aiohttp import web
import os
import json
import torch
import numpy as np
from PIL import Image
import requests
import io
import folder_paths
import time

NODE_DIR = os.path.dirname(os.path.abspath(__file__))
BOOKMARKS_FILE = os.path.join(NODE_DIR, "grok_bookmarks.json")  # Renamed for this variant

def load_bookmarks():
    if not os.path.exists(BOOKMARKS_FILE):
        return [{"categoryName": "Grok Links", "bookmarks": []}]
    try:
        with open(BOOKMARKS_FILE, 'r', encoding='utf-8') as f:
            data = json.load(f)
        # Basic migration/sanitization (kept minimal)
        if not isinstance(data, list) or not all(isinstance(cat, dict) and 'categoryName' in cat and 'bookmarks' in cat for cat in data):
            return [{"categoryName": "Grok Links", "bookmarks": []}]
        return data
    except (IOError, json.JSONDecodeError):
        return [{"categoryName": "Grok Links", "bookmarks": []}]

def save_bookmarks(data):
    try:
        with open(BOOKMARKS_FILE, 'w', encoding='utf-8') as f:
            json.dump(data, f, indent=4, ensure_ascii=False)
    except IOError as e:
        print(f"Grok Browser Node: Error saving bookmarks: {e}")

class GrokImagineBrowser:
    @classmethod
    def IS_CHANGED(cls, image_url, **kwargs):
        return image_url

    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {},
            "hidden": {
                "unique_id": "UNIQUE_ID",
                "image_url": ("STRING", {"default": "", "multiline": True}),
            },
        }

    RETURN_TYPES = ("IMAGE", "MASK")
    RETURN_NAMES = ("image", "mask")
    FUNCTION = "load_image"
    OUTPUT_NODE = False
    CATEGORY = "utils/browser"  # Or change to "Grok/Tools" or whatever category you prefer

    def load_image(self, unique_id, image_url=""):
        empty_image = torch.zeros(1, 1, 1, 3)
        empty_mask = torch.zeros(1, 1, 1)

        if not image_url or not image_url.strip():
            return (empty_image, empty_mask)

        try:
            if image_url.startswith("http://") or image_url.startswith("https://"):
                print(f"Grok Browser: Loading image from URL: {image_url}")
                headers = {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'}
                response = requests.get(image_url, headers=headers, timeout=30)
                response.raise_for_status()
                img = Image.open(io.BytesIO(response.content))
            else:
                # Temp file path handling (from uploaded pastes)
                print(f"Grok Browser: Loading from temp file: {image_url}")
                filename_only = os.path.basename(image_url)
                temp_dir = folder_paths.get_temp_directory()
                image_path = os.path.join(temp_dir, filename_only)

                if not os.path.exists(image_path):
                    raise FileNotFoundError(f"Temp file not found: {image_path}")

                img = Image.open(image_path)

            # Convert to RGB + extract alpha mask
            img_rgba = img.convert("RGBA")
            img_rgb = Image.new("RGB", img_rgba.size, (0, 0, 0))
            img_rgb.paste(img_rgba, mask=img_rgba.split()[3])
            mask_array = np.array(img_rgba.getchannel('A')).astype(np.float32) / 255.0
            mask = torch.from_numpy(mask_array).unsqueeze(0)
            image_array = np.array(img_rgb).astype(np.float32) / 255.0
            image = torch.from_numpy(image_array).unsqueeze(0)

            return (image, mask)

        except Exception as e:
            print(f"Grok Browser: Failed to load image - {e}")
            return (empty_image, empty_mask)

# ────────────────────────────────────────────────
# Server Routes (unchanged except minor logging)
# ────────────────────────────────────────────────

@server.PromptServer.instance.routes.get("/browser/get_bookmarks")
async def get_bookmarks(request):
    return web.json_response(load_bookmarks())

@server.PromptServer.instance.routes.post("/browser/save_bookmarks")
async def post_bookmarks(request):
    try:
        data = await request.json()
        save_bookmarks(data)
        return web.json_response({"status": "ok"})
    except Exception as e:
        return web.json_response({"status": "error", "message": str(e)}, status=500)

@server.PromptServer.instance.routes.post("/browser/upload_temp_image")
async def upload_temp_image(request):
    post = await request.post()
    image_data = post.get("image")
    if not image_data:
        return web.json_response({"error": "No image data"}, status=400)

    filename = f"grok_paste_{int(time.time())}.png"
    temp_dir = folder_paths.get_temp_directory()
    filepath = os.path.join(temp_dir, filename)

    with open(filepath, 'wb') as f:
        f.write(image_data.file.read())

    # Return path relative to temp dir (how ComfyUI often handles it)
    response_name = os.path.join("temp", filename)
    return web.json_response({"name": response_name})


# ────────────────────────────────────────────────
# Node Registration
# ────────────────────────────────────────────────

NODE_CLASS_MAPPINGS = {
    "GrokImagineBrowser": GrokImagineBrowser
}

NODE_DISPLAY_NAME_MAPPINGS = {
    "GrokImagineBrowser": "Grok Imagine Mini Browser"
}
