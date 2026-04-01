const express = require('express');
const multer = require('multer');
const pdfParse = require('pdf-parse');
const mammoth = require('mammoth');
const axios = require('axios');
const Resume = require('../models/Resume');
const User = require('../models/User');
const { protect } = require('../middleware/auth');

const router = express.Router();

// Multer storage in memory
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'text/plain'
    ];
    if (allowed.includes(file.mimetype)) cb(null, true);
    else cb(new Error('Only PDF, DOCX, or TXT files are allowed'));
  },
});

// Extract text from file
async function extractText(buffer, mimetype) {
  if (mimetype === 'application/pdf') {
    const data = await pdfParse(buffer);
    return data.text;
  } else if (mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
    const result = await mammoth.extractRawText({ buffer });
    return result.value;
  } else {
    return buffer.toString('utf-8');
  }
}

// Call Gemini AI for resume analysis
async function analyzeResumeWithAI(resumeText) {
  const prompt = `You are an expert career coach and resume analyst. Analyze the following resume and provide a comprehensive JSON response.

RESUME TEXT:
${resumeText}

Respond ONLY with valid JSON (no markdown, no backticks) in this exact structure:
{
  "parsedData": {
    "name": "string",
    "email": "string",
    "phone": "string",
    "location": "string",
    "summary": "string",
    "education": [{"degree": "string", "institution": "string", "year": "string", "cgpa": "string"}],
    "experience": [{"title": "string", "company": "string", "duration": "string", "description": "string"}],
    "skills": ["skill1", "skill2"],
    "certifications": ["cert1"],
    "projects": [{"title": "string", "description": "string", "technologies": ["tech1"]}],
    "languages": ["English"]
  },
  "analysis": {
    "atsScore": 75,
    "overallStrength": "good",
    "summary": "Brief overall assessment in 2-3 sentences",
    "strengths": ["strength1", "strength2", "strength3"],
    "weaknesses": ["weakness1", "weakness2"],
    "suggestions": ["actionable suggestion 1", "actionable suggestion 2", "actionable suggestion 3"],
    "skillGaps": [
      {
        "skill": "Docker",
        "importance": "critical",
        "resources": [
          {"title": "Docker for Beginners", "url": "https://www.youtube.com/watch?v=pg19Z8LL06w", "type": "video"},
          {"title": "Docker Official Docs", "url": "https://docs.docker.com/get-started/", "type": "article"}
        ]
      }
    ],
    "jobRecommendations": [
      {
        "title": "Software Engineer",
        "company": "Tech Company",
        "location": "Remote / India",
        "type": "full-time",
        "matchScore": 85,
        "salary": "8-15 LPA",
        "skills": ["JavaScript", "React", "Node.js"],
        "linkedinUrl": "https://www.linkedin.com/jobs/search/?keywords=Software+Engineer&location=India",
        "description": "Build scalable web applications using modern technologies"
      }
    ],
    "learningPaths": [
      {
        "skill": "Cloud Computing",
        "resources": [
          {"title": "AWS Cloud Practitioner", "url": "https://www.coursera.org/learn/aws-cloud-practitioner-essentials", "platform": "Coursera", "duration": "30 hours", "type": "course"},
          {"title": "Google Cloud Skills Boost", "url": "https://www.cloudskillsboost.google/", "platform": "Google", "duration": "Self-paced", "type": "course"}
        ]
      }
    ]
  }
}

Rules:
- ATS score: 0-100 based on formatting, keywords, completeness
- Provide 3-5 skill gaps with real learning resources (actual URLs)
- Provide 5-8 job recommendations with real LinkedIn search URLs using format: https://www.linkedin.com/jobs/search/?keywords=JOB+TITLE&location=India
- Provide 3-5 learning paths for missing skills
- Be specific and actionable`;

  const response = await axios.post(
  'https://api.groq.com/openai/v1/chat/completions',
  {
    model: 'llama-3.3-70b-versatile',
    messages: [{ role: 'user', content: prompt }],
    max_tokens: 4000,
    temperature: 0.3,
  },
  {
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
    }
  }
);

const text = response.data.choices[0].message.content.trim();
const clean = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
return JSON.parse(clean);
}  // ← THIS CLOSING BRACE WAS MISSING!


function sanitizeAIResult(aiResult) {
  const importanceMap = {
    'high': 'critical',
    'medium': 'important',
    'low': 'nice-to-have',
    'critical': 'critical',
    'important': 'important',
    'nice-to-have': 'nice-to-have',
  };

  const typeMap = {
    'specialization': 'course',
    'certification': 'course',
    'tutorial': 'video',
    'documentation': 'article',
    'blog': 'article',
    'course': 'course',
    'video': 'video',
    'article': 'article',
    'book': 'book',
    'project': 'project',
  };

  // Helper — safely parse resources whether it's a string or array
  function parseResources(resources) {
  // Handle string input
  if (typeof resources === 'string') {
    try {
      // First try standard JSON parse
      resources = JSON.parse(resources);
    } catch {
      try {
        // Fix single quotes → double quotes for JS-style strings
        const fixed = resources
          .replace(/'/g, '"')           // single to double quotes
          .replace(/(\w+):/g, '"$1":')  // unquoted keys → quoted keys
          .replace(/,\s*}/g, '}')       // trailing commas
          .replace(/,\s*]/g, ']');      // trailing commas in arrays
        resources = JSON.parse(fixed);
      } catch {
        return []; // still can't parse — return empty
      }
    }
  }

  if (!Array.isArray(resources)) return [];

  return resources.map(res => {
    if (typeof res === 'string') {
      try {
        // Try to parse each item if it's a string
        const fixed = res
          .replace(/'/g, '"')
          .replace(/(\w+):/g, '"$1":')
          .replace(/,\s*}/g, '}');
        res = JSON.parse(fixed);
      } catch { return null; }
    }
    if (!res || typeof res !== 'object') return null;

    return {
      title: res.title || 'Resource',
      url: res.url || '#',
      type: typeMap[res.type?.toLowerCase()] || 'article',
    };
  }).filter(Boolean);
}
  // Fix skillGaps
  if (aiResult.analysis?.skillGaps) {
    aiResult.analysis.skillGaps = aiResult.analysis.skillGaps.map(gap => ({
      ...gap,
      importance: importanceMap[gap.importance?.toLowerCase()] || 'important',
      resources: parseResources(gap.resources),
    }));
  }

  // Fix learningPaths
  if (aiResult.analysis?.learningPaths) {
    aiResult.analysis.learningPaths = aiResult.analysis.learningPaths.map(path => ({
      ...path,
      resources: parseResources(path.resources).map(res => ({
        ...res,
        platform: res.platform || 'Online',
        duration: res.duration || 'Self-paced',
      })),
    }));
  }

  return aiResult;
}
// @route  POST /api/resume/upload
router.post('/upload', protect, upload.single('resume'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file uploaded.' });
    }

    const rawText = await extractText(req.file.buffer, req.file.mimetype);

    if (!rawText || rawText.trim().length < 100) {
      return res.status(400).json({ success: false, message: 'Could not extract text from resume. Please check the file.' });
    }

    await Resume.updateMany({ user: req.user._id }, { isLatest: false });

    const resume = await Resume.create({
      user: req.user._id,
      fileName: req.file.originalname,
      rawText,
      status: 'processing',
    });

    try {
      const aiResult = await analyzeResumeWithAI(rawText);
      const sanitized = sanitizeAIResult(aiResult);   // ← ADD THIS LINE
      resume.parsedData = sanitized.parsedData;        // ← CHANGE aiResult to sanitized
      resume.analysis = sanitized.analysis;            // ← CHANGE aiResult to sanitized
      resume.status = 'completed';
      if (sanitized.parsedData.skills?.length > 0) {
  await User.findByIdAndUpdate(req.user._id, {
    skills: sanitized.parsedData.skills,
          $inc: { resumeParseCount: 1, points: 50 },
        });
      }
    } catch (aiError) {
      console.error('AI analysis error full:', JSON.stringify(aiError.response?.data));
      resume.status = 'failed';
    }

    await resume.save();
    res.status(201).json({ success: true, message: 'Resume uploaded and analyzed!', resume });

  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ success: false, message: error.message || 'Server error during upload.' });
  }
});

// @route  GET /api/resume/latest
router.get('/latest', protect, async (req, res) => {
  try {
    const resume = await Resume.findOne({ user: req.user._id, isLatest: true }).sort({ createdAt: -1 });
    if (!resume) {
      return res.status(404).json({ success: false, message: 'No resume found. Please upload your resume.' });
    }
    res.json({ success: true, resume });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// @route  GET /api/resume/history
router.get('/history', protect, async (req, res) => {
  try {
    const resumes = await Resume.find({ user: req.user._id })
      .select('fileName status analysis.atsScore createdAt isLatest')
      .sort({ createdAt: -1 });
    res.json({ success: true, resumes });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// @route  GET /api/resume/:id
router.get('/:id', protect, async (req, res) => {
  try {
    const resume = await Resume.findOne({ _id: req.params.id, user: req.user._id });
    if (!resume) return res.status(404).json({ success: false, message: 'Resume not found.' });
    res.json({ success: true, resume });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

module.exports = router;