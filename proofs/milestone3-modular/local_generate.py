"""Run one fixed-seed, local ComfyUI SDXL art study. No application integration."""

import json
import time
import urllib.request

BASE = "http://127.0.0.1:8188"
PROMPT = (
    "Single full body character, front-facing idle view, friendly young boy Brightling named Oliver, "
    "mint-green round face and body, short dark-purple tousled hair with chunky painted highlights, "
    "large expressive glossy brown eyes, rounded ears, smiling mouth, orange hooded sweatshirt "
    "with a single yellow star on chest, dark navy shorts, chunky navy canvas trainers with white "
    "rubber toe caps and white laces. Head about half of total height, small compact body, "
    "professional hand-painted 2D children's cartoon animation character art, rich soft cel "
    "shading, warm reflected light, varied deep-navy ink outlines, fabric folds, dimensional "
    "hands and shoes, cohesive polished television cartoon style. Full figure fully visible, "
    "standing on a plain near-white background, centered, no props, no text, no panels."
)
NEGATIVE = (
    "3D, realistic, photo, vector, flat icon, clip art, simple geometric shapes, thin limbs, "
    "detached limbs, extra arms, extra legs, deformed hands, cropped feet, text, logo, multiple "
    "characters, character sheet, background scenery, heavy texture, painterly oil canvas"
)

workflow = {
    "1": {"class_type": "CheckpointLoaderSimple", "inputs": {"ckpt_name": "sd_xl_base_1.0.safetensors"}},
    "2": {"class_type": "CLIPTextEncode", "inputs": {"text": PROMPT, "clip": ["1", 1]}},
    "3": {"class_type": "CLIPTextEncode", "inputs": {"text": NEGATIVE, "clip": ["1", 1]}},
    "4": {"class_type": "EmptyLatentImage", "inputs": {"width": 768, "height": 1024, "batch_size": 1}},
    "5": {"class_type": "KSampler", "inputs": {
        "seed": 817304, "steps": 28, "cfg": 7.0, "sampler_name": "dpmpp_2m",
        "scheduler": "karras", "denoise": 1.0, "model": ["1", 0], "positive": ["2", 0],
        "negative": ["3", 0], "latent_image": ["4", 0],
    }},
    "6": {"class_type": "VAEDecode", "inputs": {"samples": ["5", 0], "vae": ["1", 2]}},
    "7": {"class_type": "SaveImage", "inputs": {"images": ["6", 0], "filename_prefix": "OliverFrontStudy"}},
}

body = json.dumps({"prompt": workflow}).encode()
request = urllib.request.Request(BASE + "/prompt", data=body, headers={"Content-Type": "application/json"})
with urllib.request.urlopen(request, timeout=10) as response:
    queued = json.load(response)
if "prompt_id" not in queued:
    raise RuntimeError(queued)
prompt_id = queued["prompt_id"]
print("queued", prompt_id, flush=True)
for _ in range(180):
    time.sleep(2)
    with urllib.request.urlopen(BASE + "/history/" + prompt_id, timeout=10) as response:
        history = json.load(response)
    if prompt_id in history:
        item = history[prompt_id]
        print(json.dumps({"status": item.get("status"), "outputs": item.get("outputs")}), flush=True)
        break
else:
    raise TimeoutError("Local SDXL study did not complete within six minutes")
