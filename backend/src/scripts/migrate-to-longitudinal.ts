import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/vaidyaarc_db';

async function generatePatientCode(db: mongoose.mongo.Db): Promise<string> {
  const counterDoc = await db.collection<any>('counters').findOneAndUpdate(
    { _id: 'patient' },
    { $inc: { seq: 1 } },
    { upsert: true, returnDocument: 'after' }
  );
  const seq = counterDoc?.seq || 1;
  return `PAT-${seq.toString().padStart(6, '0')}`;
}

async function migrate() {
  console.log('Connecting to MongoDB...');
  await mongoose.connect(MONGODB_URI);
  const db = mongoose.connection.db;
  if (!db) {
    throw new Error('Database connection failed');
  }

  console.log('Successfully connected. Starting migration...');

  // 1. Migrate Users to Patients
  console.log('Migrating Users to Patients...');
  const usersCursor = db.collection('users').find({ role: 'patient' });
  let newPatientsCount = 0;
  for await (const user of usersCursor) {
    const existingPatient = await db.collection('patients').findOne({ userId: user._id });
    if (!existingPatient) {
      const patientCode = await generatePatientCode(db);
      const nameParts = (user.name || '').split(' ');
      const firstName = nameParts[0] || '';
      const lastName = nameParts.slice(1).join(' ') || '';

      await db.collection('patients').insertOne({
        userId: user._id,
        patientCode,
        demographics: {
          firstName,
          lastName,
        },
        contact: {
          phone: user.phone,
          email: user.email,
        },
        identifiers: {
          abhaId: user.abhaId,
        },
        status: 'active',
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      newPatientsCount++;
    }
  }
  console.log(`Created ${newPatientsCount} new patient records.`);

  // 2. Migrate HealthProfiles
  console.log('Migrating HealthProfiles...');
  const healthProfilesCursor = db.collection('healthprofiles').find({});
  let hpUpdatedCount = 0;
  for await (const hp of healthProfilesCursor) {
    const updates: any = { $set: {}, $unset: {} };
    let needsUpdate = false;

    // Migrate user to patientId
    const oldUserRef = hp.user || hp.userId;
    if (oldUserRef && !hp.patientId) {
      const patient = await db.collection('patients').findOne({ userId: oldUserRef });
      if (patient) {
        updates.$set.patientId = patient._id;
        updates.$unset.user = '';
        updates.$unset.userId = '';
        needsUpdate = true;
      }
    }

    // Migrate chronicConditions from string[] to object[]
    if (hp.chronicConditions && hp.chronicConditions.length > 0 && typeof hp.chronicConditions[0] === 'string') {
      updates.$set.chronicConditions = hp.chronicConditions.map((c: string) => ({
        condition: c,
        status: 'unknown'
      }));
      needsUpdate = true;
    }

    // Migrate allergies from string[] to object[]
    if (hp.allergies && hp.allergies.length > 0 && typeof hp.allergies[0] === 'string') {
      updates.$set.allergies = hp.allergies.map((a: string) => ({
        substance: a,
        verified: false
      }));
      needsUpdate = true;
    }

    // Migrate medicines to medications
    if (hp.medicines && Array.isArray(hp.medicines)) {
      if (hp.medicines.length > 0 && typeof hp.medicines[0] === 'string') {
        updates.$set.medications = hp.medicines.map((m: string) => ({
          name: m,
          status: 'unknown'
        }));
      } else {
        updates.$set.medications = hp.medicines; // If already objects
      }
      updates.$unset.medicines = '';
      needsUpdate = true;
    }

    if (hp.usesRegularMedicines !== undefined) {
      updates.$unset.usesRegularMedicines = '';
      needsUpdate = true;
    }
    if (hp.healthGoals !== undefined) {
      updates.$unset.healthGoals = '';
      needsUpdate = true;
    }

    if (Object.keys(updates.$set).length === 0) delete updates.$set;
    if (Object.keys(updates.$unset).length === 0) delete updates.$unset;

    if (needsUpdate) {
      await db.collection('healthprofiles').updateOne({ _id: hp._id }, updates);
      hpUpdatedCount++;
    }
  }
  console.log(`Updated ${hpUpdatedCount} health profiles.`);

  // 3. Migrate Episodes
  console.log('Migrating Episodes...');
  const episodesCursor = db.collection('episodes').find({});
  let episodesUpdatedCount = 0;
  for await (const ep of episodesCursor) {
    const updates: any = { $set: {}, $unset: {} };
    let needsUpdate = false;

    const oldUserRef = ep.user || ep.userId;
    if (oldUserRef && !ep.patientId) {
      const patient = await db.collection('patients').findOne({ userId: oldUserRef });
      if (patient) {
        updates.$set.patientId = patient._id;
        updates.$unset.user = '';
        if (oldUserRef.toString() !== updates.$set.patientId.toString()) {
          updates.$unset.userId = ''; 
        }
        needsUpdate = true;
      }
    }
    
    if (!ep.episodeCode) {
      const counterDoc = await db.collection<any>('counters').findOneAndUpdate(
        { _id: 'episode' },
        { $inc: { seq: 1 } },
        { upsert: true, returnDocument: 'after' }
      );
      const seq = counterDoc?.seq || 1;
      updates.$set.episodeCode = `EP-${seq.toString().padStart(6, '0')}`;
      needsUpdate = true;
    }

    if (Object.keys(updates.$set).length === 0) delete updates.$set;
    if (Object.keys(updates.$unset).length === 0) delete updates.$unset;

    if (needsUpdate) {
      await db.collection('episodes').updateOne({ _id: ep._id }, updates);
      episodesUpdatedCount++;
    }
  }
  console.log(`Updated ${episodesUpdatedCount} episodes.`);

  // 4. Migrate Consents
  console.log('Migrating Consents...');
  const consentsCursor = db.collection('consents').find({});
  let consentsUpdatedCount = 0;
  for await (const consent of consentsCursor) {
    const updates: any = { $set: {}, $unset: {} };
    let needsUpdate = false;

    const oldUserRef = consent.user || consent.userId;
    if (oldUserRef && !consent.patientId) {
      const patient = await db.collection('patients').findOne({ userId: oldUserRef });
      if (patient) {
        updates.$set.patientId = patient._id;
        updates.$unset.user = '';
        if (oldUserRef.toString() !== updates.$set.patientId.toString()) {
          updates.$unset.userId = ''; 
        }
        needsUpdate = true;
      }
    }

    if (Object.keys(updates.$set).length === 0) delete updates.$set;
    if (Object.keys(updates.$unset).length === 0) delete updates.$unset;

    if (needsUpdate) {
      await db.collection('consents').updateOne({ _id: consent._id }, updates);
      consentsUpdatedCount++;
    }
  }
  console.log(`Updated ${consentsUpdatedCount} consents.`);

  console.log('Migration completed safely!');
  process.exit(0);
}

migrate().catch(console.error);
