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
  },
  tokenPredictionLimit: {
    type: Number,
    default: 30000  // Added default value
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