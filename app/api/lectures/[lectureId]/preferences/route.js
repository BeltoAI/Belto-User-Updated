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
    let aiPreferences = await AIPreference.findOne({ lectureId: lectureId });
    
    console.log("Query result:", aiPreferences);    if (!aiPreferences) {
      // Create default preferences if they don't exist
      console.log("Creating default AI preferences for lecture:", lectureId);
      aiPreferences = new AIPreference({
        lectureId: lectureId,
        model: 'gpt-4',
        temperature: 0.7,
        maxTokens: 2000,
        numPrompts: 50,
        accessUrl: "",
        streaming: false,
        formatText: 'markdown',
        citationStyle: 'APA',
        tokenPredictionLimit: 30000,
        ragSettings: {
          enableRAG: true,
          ragSimilarityThreshold: 0.7,
          maxContextChunks: 5,
          chunkSize: 1000,
          chunkOverlap: 200,
          contextPriorityMode: 'automatic',
          includeSourceAttribution: true,
          semanticSearchMode: 'moderate'
        },
        processingRules: {
          removeSensitiveData: false,
          allowUploads: true,
          formatText: true,
          removeHyperlinks: false,
          addCitations: true
        },
        systemPrompts: [{
          name: 'default',
          content: 'You are a helpful AI assistant for educational content. When provided with lecture materials context, use that information to give accurate, well-sourced responses that help students understand the material better.'
        }]
      });
      
      await aiPreferences.save();
      console.log("Default AI preferences created:", aiPreferences);
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

export async function PUT(request, context) {
  await connectDB();

  try {
    // Await the params before using its properties
    const params = await Promise.resolve(context.params);
    const lectureId = params.lectureId;
    const body = await request.json();

    console.log("Updating AI preferences for lecture:", lectureId);
    console.log("Update data:", body);

    if (!lectureId) {
      return NextResponse.json(
        { error: "Lecture ID is required" },
        { status: 400 }
      );
    }

    // Update existing preferences or create new ones
    const updatedPreferences = await AIPreference.findOneAndUpdate(
      { lectureId: lectureId },
      {
        ...body,
        lectureId: lectureId,
        updatedAt: new Date()
      },
      {
        new: true, // Return the updated document
        upsert: true // Create if doesn't exist
      }
    );

    console.log("Updated AI preferences:", updatedPreferences);

    return NextResponse.json({
      success: true,
      data: updatedPreferences
    });
  } catch (error) {
   