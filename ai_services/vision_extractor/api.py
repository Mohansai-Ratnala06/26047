import uuid
from datetime import datetime
from fastapi import FastAPI, File, UploadFile, HTTPException
from vision_extractor import extract_clinical_data

app = FastAPI(
    title="MediKiosk Clinical Document AI",
    description="Multimodal pipeline accepting images and PDFs to output structured JSON, drug safety alerts, and ABDM FHIR R4 Bundles."
)

ALLOWED_MIME_TYPES = {
    "image/jpeg": ".jpg",
    "image/jpg": ".jpg",
    "image/png": ".png",
    "application/pdf": ".pdf"
}

def check_drug_safety(medications: list) -> list:
    """Basic interaction and contraindication checks."""
    alerts = []
    med_names = [m.get("name", "").lower() for m in medications if m.get("name")]
    
    # Example alert rule: Paracetamol duplicate or NSAID overlap
    nsaids = ["ibuprofen", "naproxen", "diclofenac", "aspirin"]
    detected_nsaids = [m for m in med_names if any(n in m for n in nsaids)]
    if len(detected_nsaids) > 1:
        alerts.append({
            "severity": "HIGH",
            "type": "DRUG_DUPLICATION",
            "message": f"Multiple concurrent NSAIDs detected: {', '.join(detected_nsaids)}. High risk of gastric ulceration."
        })
    return alerts

def build_fhir_bundle(clinical_data: dict) -> dict:
    """Transforms extracted JSON into a compliant ABDM FHIR R4 Document Bundle."""
    bundle_id = str(uuid.uuid4())
    composition_id = str(uuid.uuid4())
    patient_id = str(uuid.uuid4())
    timestamp = datetime.utcnow().isoformat() + "Z"

    entries = []
    medication_references = []
    vital_references = []
    test_references = []

    # 1. Patient Resource
    patient_info = clinical_data.get("patient") or {}
    patient_resource = {
        "resourceType": "Patient",
        "id": patient_id,
        "name": [{"text": patient_info.get("name") or "Unknown"}],
        "gender": (patient_info.get("gender") or "unknown").lower()
    }
    patient_entry = {
        "fullUrl": f"urn:uuid:{patient_id}",
        "resource": patient_resource
    }

    # 2. MedicationRequest Resources
    med_entries = []
    for med in clinical_data.get("medications", []):
        med_id = str(uuid.uuid4())
        med_entries.append({
            "fullUrl": f"urn:uuid:{med_id}",
            "resource": {
                "resourceType": "MedicationRequest",
                "id": med_id,
                "status": "active",
                "intent": "order",
                "subject": {"reference": f"urn:uuid:{patient_id}"},
                "medicationCodeableConcept": {"text": med.get("name")},
                "dosageInstruction": [{
                    "text": f"Dosage: {med.get('dosage')}, Frequency: {med.get('frequency')}, Duration: {med.get('duration')}"
                }]
            }
        })
        medication_references.append({"reference": f"urn:uuid:{med_id}"})

    # 3. Vital Sign Observations
    vital_entries = []
    for vital in clinical_data.get("vitals", []):
        obs_id = str(uuid.uuid4())
        vital_entries.append({
            "fullUrl": f"urn:uuid:{obs_id}",
            "resource": {
                "resourceType": "Observation",
                "id": obs_id,
                "status": "final",
                "category": [{"coding": [{"code": "vital-signs", "display": "Vital Signs"}]}],
                "code": {"text": vital.get("parameter")},
                "subject": {"reference": f"urn:uuid:{patient_id}"},
                "valueString": f"{vital.get('value')} {vital.get('unit') or ''}".strip()
            }
        })
        vital_references.append({"reference": f"urn:uuid:{obs_id}"})

    # 4. Laboratory Test Observations
    test_entries = []
    for test in clinical_data.get("tests", []):
        obs_id = str(uuid.uuid4())
        test_resource = {
            "resourceType": "Observation",
            "id": obs_id,
            "status": "final",
            "category": [{"coding": [{"code": "laboratory", "display": "Laboratory"}]}],
            "code": {"text": test.get("test_name")},
            "subject": {"reference": f"urn:uuid:{patient_id}"},
            "valueString": f"{test.get('result')} {test.get('unit') or ''}".strip()
        }
        if test.get("reference_range"):
            test_resource["referenceRange"] = [{"text": test.get("reference_range")}]
        
        test_entries.append({
            "fullUrl": f"urn:uuid:{obs_id}",
            "resource": test_resource
        })
        test_references.append({"reference": f"urn:uuid:{obs_id}"})

    # 5. Composition Resource (Entry 0)
    sections = []
    if medication_references:
        sections.append({
            "title": "Prescription",
            "code": {"coding": [{"system": "http://snomed.info/sct", "code": "440545006", "display": "Prescription record"}]},
            "entry": medication_references
        })
    if vital_references:
        sections.append({
            "title": "Vital Signs",
            "code": {"coding": [{"system": "http://snomed.info/sct", "code": "1184593002", "display": "Vital signs"}]},
            "entry": vital_references
        })
    if test_references:
        sections.append({
            "title": "Diagnostic Investigations",
            "code": {"coding": [{"system": "http://snomed.info/sct", "code": "721981007", "display": "Diagnostic studies report"}]},
            "entry": test_references
        })

    composition_resource = {
        "resourceType": "Composition",
        "id": composition_id,
        "status": "final",
        "type": {
            "coding": [{
                "system": "http://snomed.info/sct",
                "code": "440545006",
                "display": "Prescription record"
            }],
            "text": "Prescription record"
        },
        "subject": {"reference": f"urn:uuid:{patient_id}"},
        "date": timestamp,
        "title": "Prescription Record",
        "section": sections
    }

    # Assemble bundle
    entries.append({
        "fullUrl": f"urn:uuid:{composition_id}",
        "resource": composition_resource
    })
    entries.append(patient_entry)
    entries.extend(med_entries)
    entries.extend(vital_entries)
    entries.extend(test_entries)

    return {
        "resourceType": "Bundle",
        "id": bundle_id,
        "meta": {
            "versionId": "1",
            "lastUpdated": timestamp,
            "profile": ["https://nrces.in/ndhm/fhir/r4/StructureDefinition/DocumentBundle"]
        },
        "identifier": {
            "system": "https://ndhm.in/phr",
            "value": bundle_id
        },
        "type": "document",
        "timestamp": timestamp,
        "entry": entries
    }

@app.post("/scan-and-summarize")
async def scan_and_summarize(file: UploadFile = File(...)):
    # Fallback to application/pdf if filename ends with .pdf but content_type is octet-stream
    content_type = file.content_type
    if file.filename.lower().endswith(".pdf") and content_type != "application/pdf":
        content_type = "application/pdf"

    if content_type not in ALLOWED_MIME_TYPES:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file type: {content_type}. Accepted formats are PDF, JPG, and PNG."
        )

    file_bytes = await file.read()
    if not file_bytes:
        raise HTTPException(status_code=400, detail="Uploaded file is empty.")

    try:
        clinical_data = extract_clinical_data(file_bytes=file_bytes, mime_type=content_type)
        safety_alerts = check_drug_safety(clinical_data.get("medications", []))
        fhir_bundle = build_fhir_bundle(clinical_data)

        return {
            "success": True,
            "filename": file.filename,
            "document_type": content_type,
            "extracted_data": clinical_data,
            "safety_alerts": safety_alerts,
            "fhir_bundle": fhir_bundle
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
