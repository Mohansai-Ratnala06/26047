import mongoose from 'mongoose';

export const connectDB = async (): Promise<void> => {
  try {
    const mongoUri = process.env.MONGODB_URI;
    if (!mongoUri) {
      throw new Error('MONGODB_URI is not defined in the environment variables');
    }
    
    await mongoose.connect(mongoUri);
    console.log(`\x1b[32m[MongoDB]\x1b[0m Connected to database successfully`);
  } catch (error) {
    console.error(`\x1b[31m[MongoDB]\x1b[0m Connection failed:`, error);
    process.exit(1);
  }
};
