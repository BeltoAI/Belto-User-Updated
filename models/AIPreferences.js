import mongoose from 'mongoose';

const AIPreferenceSchema = new mongoose.Schema({
  lectureId: {
    type: String,  
    required: true
  },
  model: {
    type: String,
    required: true
  },
  maxTokens: {
    type: Number,
    required: true
  },
  numPrompts: {
    type: Number,
    required: true
  },
  accessUrl: {
    type: String,
    default: ""  // Changed from required
  },
  temperature: {
    type: Number,
    required: true
  },
  streaming: {
    type: Boolean,
    required: true
  },
  formatText: {
    type: String,
    required: true
  },
  citationStyle: {
    type: String,
    required: true
  },  tokenPredictionLimit: {
    type: Number,
    default: 30000  // Added default value
  },
  // RAG (Retrieval-Augmented Generation) Settings
  ragSettings: {
    enableRAG: {
      type: Boolean,
      default: true
    },
    ragSimilarityThreshold: {
      type: Number,
      default: 0.7,
      min: 0.0,
      max: 1.0
    },
    maxContextChunks: {
      type: Number,
      default: 5,
      min: 1,
      max: 20
    },
    chunkSize: {
      type: Number,
      default: 1000,
      min: 100,
      max: 4000
    },
    chunkOverlap: {
      type: Number,
      default: 200,
      min: 0,
      max: 1000
    },
    contextPriorityMode: {
      type: String,
      enum: ['automatic', 'semantic-only', 'uploads-only'],
      default: 'automatic'
    },
    includeSourceAttribution: {
      type: Boolean,
      default: true
    },
    semanticSearchMode: {
      type: String,
      enum: ['conservative', 'moderate', 'aggressive'],
      default: 'moderate'
    }
  },
  processingRules: {
    removeSensitiveData: {
      type: Boolean,
      required: true
    },
    allowUploads: {
      type: Boolean,
      required: true
    },
    formatText: {
      type: Boolean,
      required: true
    },
    removeHyperlinks: {
      type: Boolean,
      required: true
    },
    addCitations: {
      type: Boolean,
      required: true
    }
  },
  systemPrompts: [{
    name: String,
    content: String
  }]
}, {
  timestamps: true
});

export default mongoose.models.AIPreference ||
mongoose.model('AIPreference', AIPreferenceSchema);