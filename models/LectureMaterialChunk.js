import mongoose from 'mongoose';

const LectureMaterialChunkSchema = new mongoose.Schema({
  lectureId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Lecture',
    required: true,
    index: true,
  },
  materialId: { // Unique identifier for the specific material within the lecture
    type: String,
    required: true,
    index: true,
  },
  materialTitle: { // Title of the material from the lecture materials array
    type: String,
    required: true,
  },
  originalFilename: { // Original filename for context
    type: String,
    required: false,
  },
  fileType: { // File type (pdf, docx, txt, etc.)
    type: String,
    required: true,
  },
  chunkIndex: {
    type: Number,
    required: true,
  },
  content: {
    type: String,
    required: true,
  },
  embedding: {
    type: [Number], // Array of numbers for the vector embedding
    required: true,
  },
  metadata: { // Additional metadata (page numbers, section, etc.)
    type: Object,
    default: {},
  },
  processed: { // Processing status
    type: Boolean,
    default: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
});

// Compound indexes for efficient querying
LectureMaterialChunkSchema.index({ lectureId: 1, materialId: 1 });
LectureMaterialChunkSchema.index({ lectureId: 1, chunkIndex: 1 });
LectureMaterialChunkSchema.index({ materialId: 1, chunkIndex: 1 });

// Update the updatedAt field before saving
LectureMaterialChunkSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

export default mongoose.models.LectureMaterialChunk || mongoose.model('LectureMaterialChunk', LectureMaterialChunkSchema);
