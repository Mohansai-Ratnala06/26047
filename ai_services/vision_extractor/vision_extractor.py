import os
import io
import json
import base64
import requests
from PIL import Image
from dotenv import load_dotenv

load_dotenv()

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
BASE_URL = "https://generativelanguage.googleapis.com/v1beta/models"

EXTRACTION_PROMPT = """
You are an expert clinical document analyzer. Analyze the provided clinical document (handwritten prescription, lab report, or diagnostic summary) and extract all clinical details into a strictly valid JSON object.

Follow these strict output rules:
1. Return ONLY the raw JSON object. Do not include markdown code block syntax (like ```json), commentary, or extra text.
2. Use the exact keys provided below. If a value is missing or not applicable, use null or empty lists [].

Required JSON Schema:
{
  "patient": {
    "name": string or null,
    "age": string or null,
    "gender": string or null,
    "date": string or null
  },
  "vitals": [
    {
      "parameter": string,
      "value": string,
      "unit": string or null
    }
  ],
  "diagnoses": [string],
  "medications": [
    {
      "name": string,
      "dosage": string or null,
      "frequency": string or null,
      "duration": string or null
    }
  ],
  "tests": [
    {
      "test_name": string,
      "result": string,
      "unit": string or null,
      "reference_range": string or null
    }
  ],
  "advice": [string]
}
"""

def extract_clinical_data(file_bytes: bytes, mime_type: str = "image/jpeg") -> dict:
    if not GEMINI_API_KEY:
        raise ValueError("GEMINI_API_KEY is not set in environment.")

    # Normalize image dimensions only if it is an image
    if mime_type.startswith("image/"):
        try:
            image = Image.open(io.BytesIO(file_bytes))
            if image.mode in ("RGBA", "P"):
                image = image.convert("RGB")
            
            # Scale down oversized images to prevent timeout
            max_dimension = 2048
            if max(image.size) > max_dimension:
                image.thumbnail((max_dimension, max_dimension), Image.Resampling.LANCZOS)
                
            buffer = io.BytesIO()
            image.save(buffer, format="JPEG", quality=90)
            file_bytes = buffer.getvalue()
            mime_type = "image/jpeg"
        except Exception:
            pass  # If PIL cannot open it, send raw bytes with original mime_type

    encoded_data = base64.b64encode(file_bytes).decode("utf-8")

    payload = {
        "contents": [
            {
                "parts": [
                    {"text": EXTRACTION_PROMPT},
                    {
                        "inline_data": {
                            "mime_type": mime_type,
                            "data": encoded_data
                        }
                    }
                ]
            }
        ],
        "generationConfig": {
            "temperature": 0.1,
            "response_mime_type": "application/json"
        }
    }

    # Model fallback hierarchy
    models = [
        "gemini-2.0-flash",
        "gemini-1.5-flash",
        "gemini-robotics-er-2-preview",
        "gemini-2.5-computer-use-preview-10-2025"
    ]
    last_error = None

    for model in models:
        url = f"{BASE_URL}/{model}:generateContent?key={GEMINI_API_KEY}"
        headers = {"Content-Type": "application/json"}
        try:
            response = requests.post(url, headers=headers, json=payload, timeout=60)
            
            if response.status_code == 200:
                res_json = response.json()
                try:
                    candidate_text = res_json["candidates"][0]["content"]["parts"][0]["text"]
                    cleaned_text = candidate_text.strip().removeprefix("```json").removeprefix("```").removesuffix("```").strip()
                    return json.loads(cleaned_text)
                except (KeyError, IndexError, json.JSONDecodeError) as e:
                    raise ValueError(f"Failed to parse LLM response: {e}")
            else:
                last_error = response.text
        except requests.exceptions.RequestException as req_err:
            last_error = str(req_err)

    raise RuntimeError(f"All model endpoints failed. Last error: {last_error}")
