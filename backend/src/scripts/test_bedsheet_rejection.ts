import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

import User from '../models/User';
import Patient from '../models/Patient';
import MedicalDocument from '../models/MedicalDocument';
import { visionExtractorAgent } from '../agents/VisionExtractorAgent';
import { uploadDocument, deleteDocument } from '../controllers/document.controller';

let passed = 0;
let failed = 0;

function assert(condition: boolean, description: string) {
  if (condition) {
    console.log(`  ✅ PASSED: ${description}`);
    passed++;
  } else {
    console.error(`  ❌ FAILED: ${description}`);
    failed++;
  }
}

async function runValidationTests() {
  console.log('================================================================================');
  console.log('TEST SUITE: REAL OCR RECOGNITION & MEDICAL DOCUMENT DECISION ENGINE');
  console.log('================================================================================\n');

  const mongoUri = process.env.MONGODB_URI;
  if (!mongoUri) {
    console.error('FAIL: MONGODB_URI not set');
    process.exit(1);
  }

  await mongoose.connect(mongoUri);
  console.log('✓ Connected to MongoDB\n');

  const screenshotPath = path.resolve(
    'C:/Users/mohan/.gemini/antigravity/brain/9eba7713-597d-45ee-8556-492aaa8373ee/.user_uploaded/media_1789281201548.jpg'
  );
  const bedsheetPath = path.resolve(__dirname, '../../uploads/documents/doc-1789279682202-11846525.jpeg');
  const prescriptionPath = path.resolve(__dirname, '../../uploads/documents/sample_prescription_test.jpg');

  // -------------------------------------------------------------------------
  // TEST 1: OCR Decision on Mobile App UI Screenshot
  // -------------------------------------------------------------------------
  console.log('--- TEST 1: OCR Recognition & Decision on Mobile App Screenshot ---');
  assert(fs.existsSync(screenshotPath), `Screenshot exists at ${screenshotPath}`);

  const screenshotResult = await visionExtractorAgent.scanAndSummarize(
    screenshotPath,
    'app_screenshot.jpg',
    'image/jpeg'
  );

  assert(
    screenshotResult.extracted_data.is_medical_document === false,
    'OCR decision: App screenshot is classified as is_medical_document === false'
  );
  assert(
    screenshotResult.extracted_data.rejection_reason?.includes('No medical data found') === true,
    `Rejection message appropriately informs patient: "${screenshotResult.extracted_data.rejection_reason}"`
  );
  assert(
    (screenshotResult.extracted_data.diagnoses || []).length === 0,
    'No clinical diagnoses fabricated from app screenshot'
  );
  assert(
    (screenshotResult.extracted_data.medications || []).length === 0,
    'No medications fabricated from app screenshot'
  );

  // -------------------------------------------------------------------------
  // TEST 2: OCR Decision on Bedsheet Image (Zero Text / Object Photo)
  // -------------------------------------------------------------------------
  console.log('\n--- TEST 2: OCR Recognition & Decision on Bedsheet / Fabric Photo ---');
  assert(fs.existsSync(bedsheetPath), `Bedsheet image exists at ${bedsheetPath}`);

  const bedsheetResult = await visionExtractorAgent.scanAndSummarize(
    bedsheetPath,
    'bedsheet_sample.jpg',
    'image/jpeg'
  );

  assert(
    bedsheetResult.extracted_data.is_medical_document === false,
    'OCR decision: Bedsheet is classified as is_medical_document === false'
  );
  assert(
    bedsheetResult.extracted_data.rejection_reason?.includes('No medical data found') === true,
    `Rejection message appropriately informs patient: "${bedsheetResult.extracted_data.rejection_reason}"`
  );
  assert(
    (bedsheetResult.extracted_data.medications || []).length === 0,
    'No medications fabricated from bedsheet'
  );

  // -------------------------------------------------------------------------
  // TEST 3: OCR Decision on Genuine Medical Prescription Image
  // -------------------------------------------------------------------------
  console.log('\n--- TEST 3: OCR Recognition & Decision on Genuine Medical Prescription ---');
  assert(fs.existsSync(prescriptionPath), `Sample prescription exists at ${prescriptionPath}`);

  const prescriptionResult = await visionExtractorAgent.scanAndSummarize(
    prescriptionPath,
    'prescription.jpg',
    'image/jpeg'
  );

  assert(
    prescriptionResult.extracted_data.is_medical_document === true,
    'OCR decision: Real prescription is classified as is_medical_document === true'
  );
  assert(
    prescriptionResult.extracted_data.rejection_reason === null,
    'No rejection reason given for genuine medical document'
  );
  assert(
    (prescriptionResult.extracted_data.medications || []).length > 0,
    `Medications parsed from prescription: ${prescriptionResult.extracted_data.medications.length} items`
  );

  // -------------------------------------------------------------------------
  // TEST 4: Document Controller uploadDocument End-to-End on Screenshot
  // -------------------------------------------------------------------------
  console.log('\n--- TEST 4: Full Controller uploadDocument Workflow with App Screenshot ---');
  const timestamp = Date.now();
  const testUser: any = await User.create({
    name: 'Test Patient Screenshot Check',
    email: `screenshot_test_${timestamp}@vaidyaarc.test`,
    phone: `+91984${Math.floor(1000000 + Math.random() * 9000000)}`,
    passwordHash: 'dummy_hash',
    role: 'patient',
  });

  const testPatient: any = await Patient.create({
    userId: testUser._id,
    patientCode: `PAT-SCREENSHOT-${timestamp}`,
    demographics: { firstName: 'Test', gender: 'other', age: 25 },
    contact: { phone: testUser.phone, email: testUser.email },
    status: 'active',
  });

  const mockReq: any = {
    user: { id: testUser._id.toString() },
    file: {
      path: screenshotPath,
      filename: path.basename(screenshotPath),
      originalname: 'screenshot_upload.jpg',
      mimetype: 'image/jpeg',
      size: fs.statSync(screenshotPath).size,
    },
    body: {
      documentType: 'prescription',
      hospital: 'Self Uploaded',
      consent: 'true',
    },
  };

  let responseStatus = 0;
  let responseData: any = null;

  const mockRes: any = {
    status(code: number) {
      responseStatus = code;
      return this;
    },
    json(body: any) {
      responseData = body;
      return this;
    },
  };

  await uploadDocument(mockReq, mockRes);

  assert(responseStatus === 200, `uploadDocument returned HTTP status 200 (got ${responseStatus})`);
  assert(responseData?.success === true, 'Response indicates valid API completion');

  const uploadedDoc = responseData?.data;
  assert(
    uploadedDoc?.medicalDocumentStatus === 'not_medical_document',
    `Document status is strictly "not_medical_document" (got "${uploadedDoc?.medicalDocumentStatus}")`
  );
  assert(
    uploadedDoc?.extractionStatus === 'failed',
    `Extraction status is "failed" (got "${uploadedDoc?.extractionStatus}")`
  );
  assert(
    uploadedDoc?.rejectionReason?.includes('No medical data found'),
    `rejectionReason stored on document: "${uploadedDoc?.rejectionReason}"`
  );

  // -------------------------------------------------------------------------
  // TEST 5: Frontend Stage-1 Gate Contract (Never Go to Preview)
  // -------------------------------------------------------------------------
  console.log('\n--- TEST 5: Frontend Stage-1 Gate Contract (Never Go to Preview) ---');
  const isApprovedScreenshot =
    uploadedDoc?.medicalDocumentStatus === 'medical_document' &&
    uploadedDoc?.extractedData?.is_medical_document !== false;

  assert(
    isApprovedScreenshot === false,
    'Frontend Stage-1 check BLOCKS app screenshot: isApproved is FALSE (never sets step="preview")'
  );

  // -------------------------------------------------------------------------
  // TEST 6: Cleanup & Deletion Flow
  // -------------------------------------------------------------------------
  console.log('\n--- TEST 6: Deletion Flow for Rejected Document ---');
  const tempTestFile = path.resolve(__dirname, '../../uploads/documents/temp_test_del_ocr.jpeg');
  fs.copyFileSync(bedsheetPath, tempTestFile);

  const docToDelete: any = await MedicalDocument.create({
    documentCode: `DOC-TEST-DEL-${timestamp}`,
    patientId: testPatient._id,
    documentType: 'prescription',
    medicalDocumentStatus: 'not_medical_document',
    rejectionReason: 'No medical data found. Please check your image.',
    storage: {
      provider: 'local',
      bucket: 'uploads/documents',
      key: path.basename(tempTestFile),
      contentType: 'image/jpeg',
      size: 100,
    },
    extractionStatus: 'failed',
    verification: { status: 'unverified' },
  });

  const delReq: any = {
    user: { id: testUser._id.toString() },
    params: { documentId: docToDelete._id.toString() },
  };
  let delStatus = 0;
  let delBody: any = null;
  const delRes: any = {
    status(code: number) {
      delStatus = code;
      return this;
    },
    json(body: any) {
      delBody = body;
      return this;
    },
  };

  await deleteDocument(delReq, delRes);
  assert(delStatus === 200, `deleteDocument returned HTTP 200 (got ${delStatus})`);
  assert(delBody?.success === true, 'deleteDocument returned success: true');

  const foundAfterDel = await MedicalDocument.findById(docToDelete._id);
  assert(foundAfterDel === null, 'Rejected document record permanently deleted from MongoDB');
  assert(!fs.existsSync(tempTestFile), 'Physical file permanently deleted from disk');

  // Cleanup test user and patient
  await MedicalDocument.findByIdAndDelete(uploadedDoc._id);
  await Patient.findByIdAndDelete(testPatient._id);
  await User.findByIdAndDelete(testUser._id);

  console.log('\n================================================================================');
  console.log(`TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('================================================================================');

  await mongoose.disconnect();
  process.exit(failed > 0 ? 1 : 0);
}

runValidationTests().catch((err) => {
  console.error('Test runner encountered error:', err);
  process.exit(1);
});
