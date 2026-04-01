const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Name is required'],
    trim: true,
    maxlength: 100,
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    lowercase: true,
    trim: true,
    match: [/^\S+@\S+\.\S+$/, 'Please enter a valid email'],
  },
  password: {
    type: String,
    required: [true, 'Password is required'],
    minlength: 6,
    select: false,
  },
  avatar: {
    type: String,
    default: '',
  },
  currentRole: {
    type: String,
    default: '',
  },
  targetRole: {
    type: String,
    default: '',
  },
  experience: {
    type: String,
    enum: ['fresher', '1-2 years', '3-5 years', '5+ years'],
    default: 'fresher',
  },
  skills: [{ type: String }],
  linkedinUrl: { type: String, default: '' },
  githubUrl: { type: String, default: '' },
  points: { type: Number, default: 0 },
  badges: [{ title: String, icon: String, earnedAt: Date }],
  resumeParseCount: { type: Number, default: 0 },
  isActive: { type: Boolean, default: true },
}, { timestamps: true });

// Hash password before saving
userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

// Compare password
userSchema.methods.comparePassword = async function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

module.exports = mongoose.model('User', userSchema);
