import mongoose from "mongoose";
export async function connectDB(uri = process.env.MONGO_URI) {
  try {
    await mongoose.connect(uri, { serverSelectionTimeoutMS: 5000 });
    console.log("MongoDB connected successfully");
  } catch {
    throw new Error(
      "MongoDB connection failed. Check MONGO_URI, database credentials, DNS, and Atlas Network Access (or start local MongoDB for development).",
    );
  }
}
