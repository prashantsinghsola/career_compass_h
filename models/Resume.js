const mongoose = require('mongoose');

const resumeSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  fileName: { type: String, required: true },
  rawText: { type: String, default: '' },

  // Parsed data
  parsedData: {
    name: String,
    email: String,
    phone: String,
    location: String,
    summary: String,
    education: [{ degree: String, institution: String, year: String, cgpa: String }],
    experience: [{ title: String, company: String, duration: String, description: String }],
    skills: [String],
    certifications: [String],
    projects: [{ title: String, description: String, technologies: [String] }],
    languages: [String],
  },

  // AI Analysis
  analysis: {
    atsScore: { type: Number, min: 0, max: 100, default: 0 },
    overallStrength: { type: String, enum: ['weak', 'average', 'good', 'excellent'], default: 'average' },
    summary: { type: String, default: '' },

    skillGaps: [{
      skill: String,
      importance: {
        type: String,
        enum: ['critical', 'important', 'nice-to-have'],
        default: 'important'
      },
      resources: { type: mongoose.Schema.Types.Mixed, default: [] },
    }],

    strengths: [String],
    weaknesses: [String],
    suggestions: [String],

    jobRecommendations: [{
      title: String,
      company: String,
      location: String,
      type: { type: String, enum: ['full-time', 'part-time', 'internship', 'contract'] },
      matchScore: Number,
      salary: String,
      skills: [String],
      linkedinUrl: String,
      description: String,
    }],

    learningPaths: [{
      skill: String,
      resources: { type: mongoose.Schema.Types.Mixed, default: [] },
    }],

  },  // ← closes analysis

  // These are TOP LEVEL — outside analysis
  status: {
    type: String,
    enum: ['pending', 'processing', 'completed', 'failed'],
    default: 'pending',
  },
  isLatest: { type: Boolean, default: true },

}, { timestamps: true });

module.exports = mongoose.model('Resume', resumeSchema);