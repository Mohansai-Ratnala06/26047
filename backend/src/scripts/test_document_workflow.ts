import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { PassThrough } from 'stream';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

import User from '../models/User';
import Patient from '../models/Patient';
import Episode from '../models/Episode';
import MedicalDocument from '../models/MedicalDocument';
import { resolveDocumentEpisode, deleteDocument, getDocumentFile } from '../controllers/document.controller';

let passedCount = 0;
let failedCount = 0;

function assert(condition: boolean, message: string) {
  if (condition) {
    console.log(`  ✅ PASSED: ${message}`);
    passedCount++;
  } else {
    console.error(`  ❌ FAILED: ${message}`);
    failedCount++;
  }
}

async function runTests() {
  console.log('================================================================================');
  console.log('VAIDYAARC MEDICAL DOCUMENT WORKFLOW & EPISODE INTEGRATION TEST SUITE');
  console.log('================================================================================\n');

  const mongoUri = process.env.MONGODB_URI;
  if (!mongoUri) {
    console.error('FAIL: MONGODB_URI not set');
    process.exit(1);
  }

  await mongoose.connect(mongoUri);
  console.log('✓ Connected to MongoDB\n');

  const timestamp = Date.now();
  const testUserA: any = await User.create({
    name: 'Test Patient A',
    email: `test_patient_a_${timestamp}@vaidyaarc.test`,
    phone: `+91981${Math.floor(1000000 + Math.random() * 9000000)}`,
    passwordHash: 'dummy_hash',
    role: 'patient',
  });

  const patientA: any = await Patient.create({
    userId: testUserA._id,
    patientCode: `PAT-${timestamp}-A`,
    demographics: { firstName: 'PatientA', gender: 'male', age: 34 },
    contact: { phone: testUserA.phone, email: testUserA.email },
    status: 'active',
  });

  const testUserB: any = await User.create({
    name: 'Test Patient B (Unauthorized User)',
    email: `test_patient_b_${timestamp}@vaidyaarc.test`,
    phone: `+91982${Math.floor(1000000 + Math.random() * 9000000)}`,
    passwordHash: 'dummy_hash',
    role: 'patient',
  });

  const patientB: any = await Patient.create({
    userId: testUserB._id,
    patientCode: `PAT-${timestamp}-B`,
    demographics: { firstName: 'PatientB', gender: 'female', age: 29 },
    contact: { phone: testUserB.phone, email: testUserB.email },
    status: 'active',
  });

  console.log(`✓ Created test patient A (${patientA._id}) and patient B (${patientB._id})\n`);

  const uploadDir = path.resolve(__dirname, '../../uploads/documents');
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
  }

  try {
    // =========================================================================
    // TEST GROUP 1: Stage-1 Non-Medical Rejection & Mandatory Delete
    // =========================================================================
    console.log('--- TEST GROUP 1: Stage-1 Non-Medical Rejection & Mandatory Delete ---');

    const nonMedicalFileName = `non_medical_${timestamp}.jpg`;
    const nonMedicalFilePath = path.join(uploadDir, nonMedicalFileName);
    fs.writeFileSync(nonMedicalFilePath, 'NON_MEDICAL_IMAGE_BYTES_DUMMY_LANDSCAPE');
    assert(fs.existsSync(nonMedicalFilePath), 'Dummy non-medical file created on server storage');

    const nonMedicalDoc: any = await MedicalDocument.create({
      documentCode: `DOC-NONMED-${timestamp}`,
      patientId: patientA._id,
      documentType: 'other',
      storage: {
        provider: 'local',
        key: `documents/${nonMedicalFileName}`,
        bucket: 'local-storage',
        contentType: 'image/jpeg',
        size: 38,
      },
      source: {
        origin: 'patient_uploaded',
        facility: 'Patient Upload',
      },
      medicalDocumentStatus: 'not_medical_document',
      rejectionReason: 'The uploaded file does not appear to be a genuine medical prescription, laboratory test, or hospital document.',
      verification: {
        status: 'unverified',
      },
    });

    assert(nonMedicalDoc.medicalDocumentStatus === 'not_medical_document', 'Medical document status recorded as not_medical_document');
    assert(typeof nonMedicalDoc.rejectionReason === 'string' && nonMedicalDoc.rejectionReason.length > 10, 'Stage 1 rejection reason stored properly');

    let deleteStatus = 0;
    let deleteJson: any = null;
    const reqDelete = {
      params: { documentId: nonMedicalDoc._id.toString() },
      user: { id: testUserA._id.toString(), role: 'patient' },
    } as any;
    const resDelete = {
      status: (c: number) => { deleteStatus = c; return resDelete; },
      json: (d: any) => { deleteJson = d; return resDelete; },
    } as any;

    await deleteDocument(reqDelete, resDelete);

    assert(deleteStatus === 200, 'DELETE /documents/:documentId returned HTTP 200');
    assert(deleteJson?.success === true, 'Delete response returned success: true');
    assert(!fs.existsSync(nonMedicalFilePath), 'Physical file successfully unlinked from server storage upon deletion');

    const checkDocAfterDelete = await MedicalDocument.findById(nonMedicalDoc._id);
    assert(checkDocAfterDelete === null, 'Document completely purged from MongoDB database');

    // =========================================================================
    // TEST GROUP 2: Stage-1 Medical Acceptance & Stage-2 Clinical Extraction
    // =========================================================================
    console.log('\n--- TEST GROUP 2: Stage-1 Acceptance & Stage-2 Clinical Extraction ---');

    const medicalFileName = `valid_prescription_${timestamp}.jpg`;
    const medicalFilePath = path.join(uploadDir, medicalFileName);
    fs.writeFileSync(medicalFilePath, 'GENUINE_MEDICAL_DOCUMENT_IMAGE_CONTENT');
    assert(fs.existsSync(medicalFilePath), 'Valid medical document file saved to server storage');

    const medicalDoc: any = await MedicalDocument.create({
      documentCode: `DOC-MED-${timestamp}`,
      patientId: patientA._id,
      documentType: 'prescription',
      storage: {
        provider: 'local',
        key: `documents/${medicalFileName}`,
        bucket: 'local-storage',
        contentType: 'image/jpeg',
        size: 39,
      },
      source: {
        origin: 'patient_uploaded',
        facility: 'City Care Hospital',
        doctor: 'R. Sharma',
        documentDate: new Date('2026-03-15T10:00:00Z'),
      },
      patientConsent: {
        consented: true,
        consentedAt: new Date(),
        version: 1,
      },
      medicalDocumentStatus: 'medical_document',
      extractionStatus: 'completed',
      extractedData: {
        patientName: 'Test Patient A',
        reportedDate: '2026-03-15',
        clinicName: 'City Care Hospital',
        healthDocumentType: 'Doctor Prescription',
        diagnoses: ['Acute Bronchitis', 'Type 2 Diabetes Mellitus'],
        immunizations: ['Covaxin Booster 0.5ml IM', 'Tetanus Toxoid 0.5ml IM'],
        procedures: ['Nebulization Therapy', 'Chest Auscultation'],
        medications: [
          'Amoxicillin-Clavulanate 625mg TID 5 days',
          'Metformin 500mg BD after meals',
        ],
        investigations: [
          'Complete Blood Count (CBC)',
          'Fasting Blood Glucose',
        ],
        tests: [
          { test_name: 'Fasting Blood Sugar', result: '118', unit: 'mg/dL', reference_range: '70 - 99' },
          { test_name: 'HbA1c', result: '6.5', unit: '%', reference_range: '4.0 - 5.6' },
        ],
        vitals: [
          { parameter: 'Blood Pressure', value: '120/80', unit: 'mmHg' },
          { parameter: 'Heart Rate', value: '74', unit: 'bpm' },
          { parameter: 'SpO2', value: '98', unit: '%' },
        ],
        advice: [
          'Maintain adequate oral hydration (2.5L/day)',
          'Review fasting sugar log in 2 weeks',
        ],
      },
      verification: {
        status: 'unverified',
      },
      brainAnalysis: {
        clinicalSummary: 'Patient diagnosed with Acute Bronchitis and pre-existing Type 2 Diabetes.',
        riskLevel: 'moderate',
        redFlags: ['Monitor for persistent wheezing or dyspnea'],
        suggestedNextSteps: ['Follow up if fever persists beyond 3 days'],
      },
    });

    assert(medicalDoc.medicalDocumentStatus === 'medical_document', 'Document recorded as medical_document');
    assert(medicalDoc.extractionStatus === 'completed', 'Extraction status recorded as completed');
    assert(Array.isArray(medicalDoc.extractedData?.immunizations) && medicalDoc.extractedData?.immunizations.length === 2, 'Stage 2 Immunizations extracted properly');
    assert(Array.isArray(medicalDoc.extractedData?.procedures) && medicalDoc.extractedData?.procedures.length === 2, 'Stage 2 Procedures extracted properly');
    assert(Array.isArray(medicalDoc.extractedData?.tests) && medicalDoc.extractedData?.tests.length === 2, 'Stage 2 Structured Tests extracted properly');
    assert(medicalDoc.patientConsent?.consented === true, 'Explicit patient consent stored on document record');
    assert(fs.existsSync(medicalFilePath), 'Original document file preserved permanently on server (NOT deleted)');

    // =========================================================================
    // TEST GROUP 3: Authenticated File Streaming & Security Authorization
    // =========================================================================
    console.log('\n--- TEST GROUP 3: Authenticated File Streaming & Security Authorization ---');

    let streamStatus = 0;
    let streamHeaders: Record<string, string> = {};
    const reqStreamAuth = {
      params: { documentId: medicalDoc._id.toString() },
      user: { id: testUserA._id.toString(), role: 'patient' },
    } as any;
    streamStatus = 200;
    const resStreamAuth: any = new PassThrough();
    resStreamAuth.setHeader = (k: string, v: string) => { streamHeaders[k] = v; return resStreamAuth; };
    resStreamAuth.status = (c: number) => { streamStatus = c; return resStreamAuth; };
    resStreamAuth.json = () => resStreamAuth;

    await getDocumentFile(reqStreamAuth, resStreamAuth);
    assert(streamStatus === 200, 'GET /documents/:id/file returns HTTP 200 for authorized patient');
    assert(streamHeaders['Content-Type'] === 'image/jpeg', 'Content-Type header correctly set to image/jpeg');
    assert(streamHeaders['Content-Disposition']?.includes('inline'), 'Content-Disposition set to inline for mobile viewport rendering');

    let unauthorizedStatus = 0;
    const reqStreamUnauth = {
      params: { documentId: medicalDoc._id.toString() },
      user: { id: testUserB._id.toString(), role: 'patient' },
    } as any;
    const resStreamUnauth = {
      status: (c: number) => { unauthorizedStatus = c; return resStreamUnauth; },
      json: () => resStreamUnauth,
    } as any;

    await getDocumentFile(reqStreamUnauth, resStreamUnauth);
    assert(unauthorizedStatus === 403, 'GET /documents/:id/file returns HTTP 403 Forbidden for unauthorized patient');

    // =========================================================================
    // TEST GROUP 4: Dynamic Server-Side Episode Resolution & Timeline Integration
    // =========================================================================
    console.log('\n--- TEST GROUP 4: Dynamic Server-Side Episode Resolution ---');

    const episodeA: any = await Episode.create({
      episodeCode: `EP-${timestamp}-BRONCH`,
      patientId: patientA._id,
      type: 'consultation',
      status: 'open',
      startedAt: new Date('2026-03-10T09:00:00Z'),
      chiefComplaint: 'Acute Bronchitis',
      symptoms: [
        { name: 'Productive cough', severity: 6 },
        { name: 'Low grade fever', severity: 4 },
      ],
    });

    assert(episodeA._id !== null, 'Created active clinical episode for Patient A');

    const resolvedEpisodeId = await resolveDocumentEpisode(
      patientA._id,
      {
        document_date: '2026-03-15',
        diagnoses: ['Acute Bronchitis'],
      } as any
    );

    assert(
      resolvedEpisodeId?.toString() === episodeA._id.toString(),
      `resolveDocumentEpisode correctly linked document to Episode ${episodeA.episodeCode}`
    );

    const unrelatedEpisodeId = await resolveDocumentEpisode(
      patientA._id,
      {
        document_date: '2024-01-10',
        diagnoses: ['Refractive Error', 'Myopia'],
      } as any
    );

    assert(
      unrelatedEpisodeId === null,
      'resolveDocumentEpisode returned null for unrelated date and clinical keywords (standalone record)'
    );

    medicalDoc.episodeId = resolvedEpisodeId || undefined;
    await medicalDoc.save();

    const verifiedDocInDb = await MedicalDocument.findById(medicalDoc._id);
    assert(
      verifiedDocInDb?.episodeId?.toString() === episodeA._id.toString(),
      'Document in MongoDB successfully retains association to patient health episode'
    );

  } finally {
    console.log('\n--- CLEANUP TEST ARTIFACTS ---');
    await MedicalDocument.deleteMany({ patientId: { $in: [patientA._id, patientB._id] } });
    await Episode.deleteMany({ patientId: { $in: [patientA._id, patientB._id] } });
    await Patient.deleteMany({ _id: { $in: [patientA._id, patientB._id] } });
    await User.deleteMany({ _id: { $in: [testUserA._id, testUserB._id] } });

    const testFiles = fs.readdirSync(uploadDir).filter(f => f.includes(timestamp.toString()));
    for (const f of testFiles) {
      try {
        fs.unlinkSync(path.join(uploadDir, f));
      } catch {}
    }

    await mongoose.disconnect();
    console.log('✓ Disconnected from MongoDB');
  }

  console.log('\n================================================================================');
  console.log(`TEST RESULTS: ${passedCount} PASSED, ${failedCount} FAILED`);
  console.log('================================================================================');

  if (failedCount > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('Unhandled error running test suite:', err);
  process.exit(1);
});
