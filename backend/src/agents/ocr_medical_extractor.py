import sys
import os
import json
import re
import asyncio
from PIL import Image

try:
    import winocr
    HAS_WINOCR = True
except ImportError:
    HAS_WINOCR = False

CLINICAL_PATTERNS = {
    'rx_header': [
        r'\brx\b', r'\bdr[\.\s]', r'\bdoctor\b', r'\bmbbs\b', r'\bmd\b', r'\bms\b',
        r'\bconsultant\b', r'\bphysician\b', r'\bsurgeon\b', r'\breg[\.\s]*no\b',
        r'\bpathology\b', r'\blaboratory\b', r'\blab\b', r'\bhospital\b', r'\bclinic\b',
        r'\bopd\b', r'\bipd\b', r'\bdispensary\b'
    ],
    'medications': [
        r'\btab[\.\s]', r'\btablet\b', r'\bcap[\.\s]', r'\bcapsule\b', r'\bsyr[\.\s]',
        r'\bsyrup\b', r'\binj[\.\s]', r'\binjection\b', r'\bointment\b', r'\bdrops\b',
        r'\b\d+\s*(?:mg|mcg|ml|gm)\b', r'\b(?:od|bd|bid|tds|tid|qid|sos|hs|stat)\b',
        r'\b(?:before|after)\s+food\b',
        r'\b(?:paracetamol|amoxicillin|azithromycin|pantoprazole|omeprazole|cetirizine|metformin|atorvastatin|ibuprofen|cefixime|ciprofloxacin|telmisartan|amlodipine|dolo|augmentin|montelukast|calpol|ascoril)\b'
    ],
    'diagnostics': [
        r'\bhemoglobin\b', r'\bhaemoglobin\b', r'\brbc\b', r'\bwbc\b', r'\bplatelet\b',
        r'\bcreatinine\b', r'\bbilirubin\b', r'\bsgot\b', r'\bsgpt\b', r'\bglucose\b',
        r'\bhba1c\b', r'\bcholesterol\b', r'\btriglycerides\b', r'\btsh\b', r'\bcrp\b',
        r'\bref(?:erence)?[\.\s]*range\b', r'\bx-ray\b', r'\becg\b', r'\busg\b',
        r'\bultrasound\b', r'\bct\s*scan\b', r'\bmri\b', r'\bg/dl\b', r'\bmg/dl\b',
        r'\bcomplete blood count\b', r'\bcbc\b', r'\burine routine\b'
    ],
    'clinical_sections': [
        r'\bchief complaint\b', r'\bc/o\b', r'\bprovisional diagnosis\b', r'\bdiagnosis\b',
        r'\bdiagnoses\b', r'\bdischarge summary\b', r'\btreatment\b', r'\badvice\b',
        r'\bvitals\b', r'\bclinical notes\b', r'\binvestigations?\b', r'\bhistory\b', r'\bh/o\b'
    ],
    'vitals': [
        r'\bbp[\s:]*\d+/\d+', r'\bblood\s*pressure\b', r'\bpulse[\s:]*\d+',
        r'\bspo2[\s:]*\d+', r'\btemp(?:erature)?[\s:]*\d+', r'\bheart\s*rate\b'
    ]
}

# Negative keywords indicating an in-app UI screenshot rather than a physical medical record
APP_UI_KEYWORDS = [
    'upload health record', 'smart report', 'original report', 'confirm & save',
    'this data has been extracted', 'patient & clinical metadata', 'doc-000',
    'not specified', 'clinical facility', 'no specific diagnostic findings',
    'my records', 'linked records', 'patient health journey', 'voice consultation'
]

async def extract_text_from_image(file_path: str) -> str:
    if not os.path.exists(file_path):
        return ""
    if not HAS_WINOCR:
        return ""

    try:
        with Image.open(file_path) as img:
            # winocr requires PIL Image
            res = await winocr.recognize_pil(img, 'en')
            return res.text if hasattr(res, 'text') else str(res)
    except Exception as e:
        sys.stderr.write(f"OCR Error: {e}\n")
        return ""

def analyze_clinical_text(text: str, original_filename: str) -> dict:
    clean_text = text.strip()
    text_lower = clean_text.lower()

    if not clean_text:
        return {
            "is_medical_document": False,
            "medical_document_confidence": 0.99,
            "document_classification": "Non-Medical Upload",
            "rejection_reason": "No medical data found. Please check your image and ensure you upload a clear medical document (such as a doctor prescription, lab report, or discharge summary).",
            "extracted_text": "",
            "patient": None,
            "clinic": None,
            "document_date": None,
            "diagnoses": [],
            "immunizations": [],
            "procedures": [],
            "medications": [],
            "tests": [],
            "vitals": [],
            "advice": []
        }

    # Count UI screenshot markers
    ui_hits = sum(1 for kw in APP_UI_KEYWORDS if kw in text_lower)

    # Calculate clinical keyword matches across domains
    matched_domains = 0
    total_clinical_matches = 0
    detected_medications = []
    detected_diagnoses = []
    detected_tests = []
    detected_vitals = []
    detected_advice = []

    for domain, patterns in CLINICAL_PATTERNS.items():
        domain_hits = 0
        for pat in patterns:
            found = re.findall(pat, text_lower)
            if found:
                domain_hits += len(found)
        if domain_hits > 0:
            matched_domains += 1
            total_clinical_matches += domain_hits

    # A screenshot of the app UI itself (e.g. preview screen) must be rejected
    is_app_ui = ui_hits >= 3

    # Medical document threshold: Must have genuine clinical matches and not be an app screenshot
    is_medical = (total_clinical_matches >= 2 or matched_domains >= 2) and not is_app_ui

    if not is_medical:
        return {
            "is_medical_document": False,
            "medical_document_confidence": 0.98,
            "document_classification": "Non-Medical / No Clinical Data",
            "rejection_reason": "No medical data found. Please check your image and ensure you upload a clear medical document (such as a doctor prescription, lab report, or discharge summary).",
            "extracted_text": clean_text,
            "patient": None,
            "clinic": None,
            "document_date": None,
            "diagnoses": [],
            "immunizations": [],
            "procedures": [],
            "medications": [],
            "tests": [],
            "vitals": [],
            "advice": []
        }

    # --- Structured Clinical Extraction from OCR Text ---
    # 1. Patient Name
    patient_name = None
    pat_match = re.search(r'(?:patient|pt\.?|name)[\s:]+([A-Z][a-zA-Z\s]{2,25})', clean_text, re.IGNORECASE)
    if pat_match:
        patient_name = pat_match.group(1).strip()

    # 2. Patient Age & Gender
    age = None
    gender = None
    age_match = re.search(r'\b(\d{1,3})\s*(?:yrs|years|y|yr)?\b', text_lower)
    if age_match:
        age = age_match.group(1)
    if re.search(r'\b(female|fem|f)\b', text_lower):
        gender = "Female"
    elif re.search(r'\b(male|m)\b', text_lower):
        gender = "Male"

    # 3. Doctor Name
    doctor_name = None
    doc_match = re.search(r'(?:Dr\.?|Doctor)\s+([A-Z][a-zA-Z\.\s]{2,30})', clean_text)
    if doc_match:
        doctor_name = f"Dr. {doc_match.group(1).strip()}"

    # 4. Clinic / Hospital Name
    clinic_name = None
    clinic_match = re.search(r'([A-Z][a-zA-Z0-9\s]{2,35}\s+(?:Clinic|Hospital|Pathology|Labs?|Healthcare|Dispensary))', clean_text, re.IGNORECASE)
    if clinic_match:
        clinic_name = clinic_match.group(1).strip()

    # 5. Date
    doc_date = None
    date_match = re.search(r'\b(\d{1,2}[/-]\d{1,2}[/-]\d{2,4}|\d{4}[/-]\d{1,2}[/-]\d{1,2})\b', clean_text)
    if date_match:
        doc_date = date_match.group(1)

    # 6. Extract Medications
    lines = clean_text.split('\n')
    for line in lines:
        l_lower = line.lower().strip()
        if any(prefix in l_lower for prefix in ['tab', 'cap', 'syr', 'inj', 'mg', 'od', 'bd', 'tds', 'qid', 'hs', 'sos']):
            clean_line = re.sub(r'^\d+[\.\)]\s*', '', line).strip()
            if len(clean_line) > 3:
                detected_medications.append({
                    "name": clean_line,
                    "dosage": None,
                    "frequency": None,
                    "duration": None
                })

    # 7. Extract Diagnoses
    diag_match = re.search(r'(?:diagnosis|provisional diagnosis|dx|c/o|complaints?)[\s:]+([^\n\r.]+)', clean_text, re.IGNORECASE)
    if diag_match:
        diag_text = diag_match.group(1).strip()
        if len(diag_text) > 3:
            detected_diagnoses.append(diag_text)

    # 8. Extract Lab Tests
    for line in lines:
        test_line = line.strip()
        t_lower = test_line.lower()
        if any(marker in t_lower for marker in ['hemoglobin', 'haemoglobin', 'rbc', 'wbc', 'platelet', 'creatinine', 'glucose', 'hba1c', 'cholesterol', 'tsh', 'g/dl', 'mg/dl']):
            parts = re.split(r'[:\-]', test_line, maxsplit=1)
            if len(parts) == 2:
                detected_tests.append({
                    "test_name": parts[0].strip(),
                    "result": parts[1].strip(),
                    "unit": None,
                    "reference_range": None
                })

    # 9. Extract Vitals
    bp_match = re.search(r'\b(?:bp|blood pressure)[\s:]*(\d{2,3}/\d{2,3})', clean_text, re.IGNORECASE)
    if bp_match:
        detected_vitals.append({"parameter": "Blood Pressure", "value": bp_match.group(1), "unit": "mmHg"})

    pulse_match = re.search(r'\b(?:pulse|heart rate)[\s:]*(\d{2,3})', clean_text, re.IGNORECASE)
    if pulse_match:
        detected_vitals.append({"parameter": "Pulse", "value": pulse_match.group(1), "unit": "bpm"})

    # 10. Extract Advice
    advice_match = re.search(r'(?:advice|instructions?)[\s:]+([^\n\r]+)', clean_text, re.IGNORECASE)
    if advice_match:
        detected_advice.append(advice_match.group(1).strip())

    doc_class = "Doctor Prescription"
    if detected_tests and not detected_medications:
        doc_class = "Laboratory / Pathology Report"
    elif "discharge" in text_lower:
        doc_class = "Hospital Discharge Summary"

    return {
        "is_medical_document": True,
        "medical_document_confidence": 0.96,
        "document_classification": doc_class,
        "rejection_reason": None,
        "extracted_text": clean_text,
        "patient": {
            "name": patient_name,
            "age": age,
            "gender": gender,
            "date": doc_date
        },
        "clinic": {
            "name": clinic_name,
            "doctor": doctor_name
        },
        "document_date": doc_date,
        "diagnoses": detected_diagnoses,
        "immunizations": [],
        "procedures": [],
        "medications": detected_medications,
        "tests": detected_tests,
        "vitals": detected_vitals,
        "advice": detected_advice
    }

async def main():
    if len(sys.argv) < 2:
        print(json.dumps({"error": "No file path provided"}))
        sys.exit(1)

    file_path = sys.argv[1]
    filename = os.path.basename(file_path)

    # Run OCR recognition model
    ocr_text = await extract_text_from_image(file_path)

    # Analyze extracted text for medical document validation & structured clinical data
    result = analyze_clinical_text(ocr_text, filename)
    print(json.dumps(result))

if __name__ == "__main__":
    asyncio.run(main())
