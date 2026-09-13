import sys
import json
import os
from PIL import Image
import numpy as np

def analyze_image(file_path: str) -> dict:
    if not os.path.exists(file_path):
        return {
            "is_document_surface": False,
            "confidence": 0.99,
            "detected_type": "Missing File",
            "reason": "File does not exist."
        }

    # If it's a PDF, treat as document format
    if file_path.lower().endswith(".pdf"):
        return {
            "is_document_surface": True,
            "confidence": 0.95,
            "detected_type": "PDF Document",
            "reason": None
        }

    try:
        with Image.open(file_path) as img:
            # Normalize to RGB
            if img.mode != "RGB":
                img = img.convert("RGB")

            # Resize to 300x300 for deterministic, sub-200ms processing
            thumb = img.resize((300, 300))

            # Grayscale analysis
            gray = np.array(thumb.convert("L"), dtype=np.float32)
            mean_brightness = float(gray.mean())
            std_brightness = float(gray.std())
            white_paper_ratio = float((gray > 170).mean())
            dark_ink_ratio = float((gray < 70).mean())

            # HSV Saturation analysis
            hsv = np.array(thumb.convert("HSV"), dtype=np.float32)
            sat = hsv[:, :, 1]
            mean_sat = float(sat.mean())
            high_sat_ratio = float((sat > 50).mean())

            # Gradient / Edge analysis
            grad_x = np.abs(gray[:, 1:] - gray[:, :-1])
            grad_y = np.abs(gray[1:, :] - gray[:-1, :])
            mean_grad = float((grad_x.mean() + grad_y.mean()) / 2.0)

            # Heuristic decision tree for document paper vs everyday photo/fabric/object
            is_non_medical = False
            detected_type = "Document"
            rejection_reason = None

            # Case 1: High color saturation and low white paper (e.g. bedsheet, blanket, clothing, flower)
            if high_sat_ratio > 0.35 and white_paper_ratio < 0.40:
                is_non_medical = True
                detected_type = "Fabric / Texture / Non-Medical"
                rejection_reason = "The uploaded file appears to be a photo of everyday fabric or an object, not a medical document."

            # Case 2: Very high overall saturation (medical documents are predominantly black/blue on white)
            elif mean_sat > 70 and white_paper_ratio < 0.50:
                is_non_medical = True
                detected_type = "Colorful Scene / Non-Medical"
                rejection_reason = "The uploaded image is too colorful to be a standard medical record or prescription."

            # Case 3: Extremely dark image / underexposed / black screen
            elif mean_brightness < 60:
                is_non_medical = True
                detected_type = "Dark Image / Unreadable"
                rejection_reason = "The uploaded image is too dark or underexposed to read clinical data."

            # Case 4: Completely flat / uniform surface (blank wall, single-color object)
            elif std_brightness < 14:
                is_non_medical = True
                detected_type = "Uniform Surface / Blank"
                rejection_reason = "The uploaded image contains no legible text or medical record markings."

            # Case 5: Very little white background and low dark ink contrast
            elif white_paper_ratio < 0.20 and dark_ink_ratio < 0.03:
                is_non_medical = True
                detected_type = "Non-Document Object"
                rejection_reason = "The uploaded image does not show paper document boundaries or clinical text."

            if is_non_medical:
                return {
                    "is_document_surface": False,
                    "confidence": 0.96,
                    "detected_type": detected_type,
                    "reason": rejection_reason,
                    "metrics": {
                        "mean_brightness": round(mean_brightness, 1),
                        "white_paper_ratio": round(white_paper_ratio, 3),
                        "mean_saturation": round(mean_sat, 1),
                        "high_sat_ratio": round(high_sat_ratio, 3),
                        "mean_grad": round(mean_grad, 1)
                    }
                }
            else:
                return {
                    "is_document_surface": True,
                    "confidence": 0.95,
                    "detected_type": "Paper Document",
                    "reason": None,
                    "metrics": {
                        "mean_brightness": round(mean_brightness, 1),
                        "white_paper_ratio": round(white_paper_ratio, 3),
                        "mean_saturation": round(mean_sat, 1),
                        "high_sat_ratio": round(high_sat_ratio, 3),
                        "mean_grad": round(mean_grad, 1)
                    }
                }

    except Exception as e:
        return {
            "is_document_surface": False,
            "confidence": 0.5,
            "detected_type": "Error",
            "reason": f"Unable to process image: {str(e)}"
        }

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(json.dumps({"error": "No file path provided"}))
        sys.exit(1)

    result = analyze_image(sys.argv[1])
    print(json.dumps(result))
