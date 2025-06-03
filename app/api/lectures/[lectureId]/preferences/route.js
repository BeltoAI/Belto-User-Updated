import { NextResponse } from 'next/server';
import mongoose from 'mongoose';
import AIPreference from '@/models/AIPreferences';  // Note the capital 'AI' matching your model file
import connectDB from '@/lib/db';

export async function GET(request, context) {
  await connectDB();

  try {
    // Await the params before using its properties
    const params = await Promise.resolve(context.params);
    const lectureId = params.lectureId;

    console.log("Lecture ID:", lectureId);

    if (!lectureId) {
      return NextResponse.json(
        { error: "Lecture ID is required" },
        { status: 400 }
      );
    }

    // Query using the string value directly - don't convert to ObjectId
    const aiPreferences = await AIPreference.findOne({ lectureId: lectureId });
    
    console.log("Query result:", aiPreferences);

    if (!aiPreferences) {
      return NextResponse.json(
        { error: "AI preferences not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(aiPreferences);
  } catch (error) {
    console.error("Error fetching AI preferences:", error);
    return NextResponse.json(
      { error: "Failed to fetch AI preferences" },
      { status: 500 }
    );
  }
}