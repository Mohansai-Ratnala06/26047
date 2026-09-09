import mongoose from 'mongoose';

export const connectDB = async (): Promise<void> => {
  try {
    const mongoUri = process.env.MONGODB_URI;
    if (!mongoUri) {
      throw new Error('MONGODB_URI is not defined in the environment variables');
    }
    
    await mongoose.connect(mongoUri);
    console.log(`\x1b[32m[MongoDB]\x1b[0m Connected to database successfully`);

    // Clean up any legacy or stale indexes in collections that cause collisions
    try {
      const collections = await mongoose.connection.db?.listCollections().toArray();
      const targetCols = ['patients', 'healthprofiles'];
      for (const colName of targetCols) {
        if (collections?.some((c) => c.name === colName)) {
          const col = mongoose.connection.collection(colName);
          const indexes = await col.indexes();
          for (const idx of indexes) {
            if (idx.name === 'user_1') {
              await col.dropIndex('user_1');
              console.log(`\x1b[33m[MongoDB]\x1b[0m Dropped obsolete legacy index 'user_1' from ${colName}`);
            }
          }
        }
      }
    } catch (indexErr) {
      console.warn('[MongoDB] Index cleanup notice:', indexErr);
    }
  } catch (error) {
    console.error(`\x1b[31m[MongoDB]\x1b[0m Connection failed:`, error);
    process.exit(1);
  }
};
