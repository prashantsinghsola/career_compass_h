const mongoose = require('mongoose');

const progressSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  skill: { type: String, required: true },
  status: {
    type: String,
    enum: ['not-started', 'in-progress', 'completed'],
    default: 'not-started',
  },
  completionPercentage: { type: Number, min: 0, max: 100, default: 0 },
  resourcesAccessed: [{
    title: String,
    url: String,
    accessedAt: { type: Date, default: Date.now },
  }],
  notes: { type: String, default: '' },
  targetDate: Date,
  completedAt: Date,
}, { timestamps: true });

module.exports = mongoose.model('Progress', progressSchema);
