"""One local SDXL image-to-image style-retention test; diagnostic only."""

import json
import time
import urllib.request

BASE = "http://127.0.0.1:8188"
PROMPT = (
    "Full body front idle character illustration in exactly the same children's cartoon show, "
    "same head-to-body scale and same softly painted dimensional finish as the supplied reference. "
    "A genuinely new friendly Brightling boy: mint green face and hands, short dark purple swept "
    "hair instead of teal spikes, big warm brown expressive eyes, orange star hoodie, dark navy "
    "shorts, blue and white cartoon canvas trainers. Rounded compact silhouette, clean deep "
    "navy variable-width outlines, richly shaded painted curls and cloth folds, natural connected "
    "hands and shoes, a single yellow star on the orange hoodie, cheerful front-facing smile, "
    "standing with both feet grounded, white background. No text or props."
)
NEGATIVE = (
    "photorealistic, 3D, anime, manga, tall child, jacket, hat, animal ears, boots, flat vector, "
    "clip art, geometric shapes, extra limbs, disconnected arms, cropped feet, text, multiple "
    "characters, scenery"
)

workflow = {
    "1": {"class_type": "CheckpointLoaderSimple", "inputs": {"ckpt_name": "sd_xl_base_1.0.safetensors"}},
    "2": {"class_type": "CLIPTextEncode", "inputs": {"text": PROMPT, "clip": ["1", 1]}},
    "3": {"class_type": "CLIPTextEncode", "inputs": {"text": NEGATIVE, "clip": ["1", 1]}},
    "4": {"class_type": "LoadImage", "inputs": {"image": "max-style-reference.png"}},
    "5": {"class_type": "VAEEncode", "inputs": {"pixels": ["4", 0], "vae": ["1", 2]}},
    "6": {"class_type": "KSampler", "inputs": {
        "seed": 817304, "steps": 28, "cfg": 6.5, "sampler_name": "dpmpp_2m",
        "scheduler": "karras", "denoise": 0.82, "model": ["1", 0], "positive": ["2", 0],
        "negative": ["3", 0], "latent_image": ["5", 0],
    }},
    "7": {"class_type": "VAEDecode", "inputs": {"samples": ["6", 0], "vae": ["1", 2]}},
    "8": {"class_type": "SaveImage", "inputs": {"images": ["7", 0], "filename_prefix": "OliverStyleStudy"}},
}

request = urllib.request.Request(
    BASE + "/prompt", data=json.dumps({"prompt": workflow}).encode(),
    headers={"Content-Type": "application/json"},
)
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
    raise TimeoutError("Local SDXL style study did not complete within six minutes")
