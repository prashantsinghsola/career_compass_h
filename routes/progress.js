const express = require('express');
const Progress = require('../models/Progress');
const User = require('../models/User');
const { protect } = require('../middleware/auth');

const router = express.Router();

// @route  GET /api/progress
router.get('/', protect, async (req, res) => {
  try {
    const progress = await Progress.find({ user: req.user._id }).sort({ updatedAt: -1 });
    res.json({ success: true, progress });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// @route  POST /api/progress
router.post('/', protect, async (req, res) => {
  try {
    const { skill, targetDate } = req.body;
    const existing = await Progress.findOne({ user: req.user._id, skill });
    if (existing) {
      return res.status(400).json({ success: false, message: 'Skill already being tracked.' });
    }
    const progress = await Progress.create({ user: req.user._id, skill, targetDate });
    res.status(201).json({ success: true, progress });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// @route  PUT /api/progress/:id
router.put('/:id', protect, async (req, res) => {
  try {
    const { status, completionPercentage, notes, resourceAccessed } = req.body;
    const progress = await Progress.findOne({ _id: req.params.id, user: req.user._id });
    if (!progress) return res.status(404).json({ success: false, message: 'Progress not found.' });

    if (status) progress.status = status;
    if (completionPercentage !== undefined) progress.completionPercentage = completionPercentage;
    if (notes) progress.notes = notes;
    if (resourceAccessed) progress.resourcesAccessed.push(resourceAccessed);

    if (status === 'completed') {
      progress.completedAt = new Date();
      // Award points
      await User.findByIdAndUpdate(req.user._id, { $inc: { points: 100 } });
    }

    await progress.save();
    res.json({ success: true, progress });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// @route  GET /api/progress/stats
router.get('/stats/summary', protect, async (req, res) => {
  try {
    const all = await Progress.find({ user: req.user._id });
    const stats = {
      total: all.length,
      completed: all.filter(p => p.status === 'completed').length,
      inProgress: all.filter(p => p.status === 'in-progress').length,
      notStarted: all.filter(p => p.status === 'not-started').length,
      avgCompletion: all.length
        ? Math.round(all.reduce((sum, p) => sum + p.completionPercentage, 0) / all.length)
        : 0,
    };
    res.json({ success: true, stats });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

module.exports = router;
