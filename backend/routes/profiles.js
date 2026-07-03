import express from 'express';
import { body, validationResult } from 'express-validator';
import crypto from 'crypto';
import fs from 'fs/promises';
import path from 'path';
import mongoose from 'mongoose';
import { fileURLToPath } from 'url';
import User from '../models/User.js';
import { authenticateToken } from './auth.js';

const router = express.Router();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DEV_USERS_FILE = path.join(__dirname, '..', 'dev-users.json');

const isMongoReady = () => mongoose.connection.readyState === 1;

const readDevUsers = async () => {
  try {
    const raw = await fs.readFile(DEV_USERS_FILE, 'utf8');
    return JSON.parse(raw);
  } catch (error) {
    if (error.code === 'ENOENT') {
      return [];
    }

    throw error;
  }
};

const writeDevUsers = async (users) => {
  await fs.writeFile(DEV_USERS_FILE, JSON.stringify(users, null, 2));
};

const mapProfile = (user) => ({
  user_metadata: {
    first_name: user.firstName || '',
    last_name: user.lastName || ''
  },
  avatar_url: user.avatarUrl,
  current_streak: user.currentStreak ?? 0,
  total_badges: user.totalBadges ?? 0,
  health_conditions: user.healthConditions || [],
  dietary_goals: user.dietaryGoals || '',
  weekly_target: user.weeklyTarget ?? 70,
  daily_meal_target: user.dailyMealTarget ?? 3,
  age: user.age,
  weight_kg: user.weightKg,
  height_cm: user.heightCm,
  activity_level: user.activityLevel,
  goals: user.goals || [],
  hydration_target_glasses: user.hydrationTargetGlasses ?? 8,
  hydration_progress_glasses: user.hydrationProgressGlasses ?? 0,
  points: user.points ?? 0,
  level: user.level ?? 'beginner',
  avatar_state: user.avatarState ?? 'neutral',
  fatigue: user.fatigue ?? 10,
  last_sleep_hours: user.lastSleepHours,
  last_workout_minutes: user.lastWorkoutMinutes,
  last_workout_type: user.lastWorkoutType
});

const findUserById = async (id) => {
  if (isMongoReady()) {
    return User.findById(id);
  }

  const users = await readDevUsers();
  return users.find((user) => user.id === id) || null;
};

const persistUser = async (user) => {
  if (isMongoReady()) {
    await user.save();
    return user;
  }

  const users = await readDevUsers();
  const nextUsers = users.map((existingUser) => (existingUser.id === user.id ? user : existingUser));
  await writeDevUsers(nextUsers);
  return user;
};

const normalizeUpdatePayload = (body) => {
  const updateFields = {};

  if (body.user_metadata) {
    if (body.user_metadata.first_name !== undefined) updateFields.firstName = body.user_metadata.first_name;
    if (body.user_metadata.last_name !== undefined) updateFields.lastName = body.user_metadata.last_name;
  }

  if (body.firstName !== undefined) updateFields.firstName = body.firstName;
  if (body.lastName !== undefined) updateFields.lastName = body.lastName;
  if (body.avatarUrl !== undefined) updateFields.avatarUrl = body.avatarUrl;
  if (body.avatar_url !== undefined) updateFields.avatarUrl = body.avatar_url;
  if (body.currentStreak !== undefined) updateFields.currentStreak = body.currentStreak;
  if (body.current_streak !== undefined) updateFields.currentStreak = body.current_streak;
  if (body.totalBadges !== undefined) updateFields.totalBadges = body.totalBadges;
  if (body.total_badges !== undefined) updateFields.totalBadges = body.total_badges;
  if (body.healthConditions !== undefined) updateFields.healthConditions = body.healthConditions;
  if (body.health_conditions !== undefined) updateFields.healthConditions = body.health_conditions;
  if (body.dietaryGoals !== undefined) updateFields.dietaryGoals = body.dietaryGoals;
  if (body.dietary_goals !== undefined) updateFields.dietaryGoals = body.dietary_goals;
  if (body.weeklyTarget !== undefined) updateFields.weeklyTarget = body.weeklyTarget;
  if (body.weekly_target !== undefined) updateFields.weeklyTarget = body.weekly_target;
  if (body.dailyMealTarget !== undefined) updateFields.dailyMealTarget = body.dailyMealTarget;
  if (body.daily_meal_target !== undefined) updateFields.dailyMealTarget = body.daily_meal_target;
  if (body.age !== undefined) updateFields.age = body.age;
  if (body.weightKg !== undefined) updateFields.weightKg = body.weightKg;
  if (body.weight_kg !== undefined) updateFields.weightKg = body.weight_kg;
  if (body.heightCm !== undefined) updateFields.heightCm = body.heightCm;
  if (body.height_cm !== undefined) updateFields.heightCm = body.height_cm;
  if (body.activityLevel !== undefined) updateFields.activityLevel = body.activityLevel;
  if (body.activity_level !== undefined) updateFields.activityLevel = body.activity_level;
  if (body.goals !== undefined) updateFields.goals = body.goals;
  if (body.hydrationTargetGlasses !== undefined) updateFields.hydrationTargetGlasses = body.hydrationTargetGlasses;
  if (body.hydration_target_glasses !== undefined) updateFields.hydrationTargetGlasses = body.hydration_target_glasses;
  if (body.hydrationProgressGlasses !== undefined) updateFields.hydrationProgressGlasses = body.hydrationProgressGlasses;
  if (body.hydration_progress_glasses !== undefined) updateFields.hydrationProgressGlasses = body.hydration_progress_glasses;
  if (body.points !== undefined) updateFields.points = body.points;
  if (body.level !== undefined) updateFields.level = body.level;
  if (body.avatarState !== undefined) updateFields.avatarState = body.avatarState;
  if (body.avatar_state !== undefined) updateFields.avatarState = body.avatar_state;
  if (body.fatigue !== undefined) updateFields.fatigue = body.fatigue;
  if (body.lastSleepHours !== undefined) updateFields.lastSleepHours = body.lastSleepHours;
  if (body.last_sleep_hours !== undefined) updateFields.lastSleepHours = body.last_sleep_hours;
  if (body.lastWorkoutMinutes !== undefined) updateFields.lastWorkoutMinutes = body.lastWorkoutMinutes;
  if (body.last_workout_minutes !== undefined) updateFields.lastWorkoutMinutes = body.last_workout_minutes;
  if (body.lastWorkoutType !== undefined) updateFields.lastWorkoutType = body.lastWorkoutType;
  if (body.last_workout_type !== undefined) updateFields.lastWorkoutType = body.last_workout_type;

  return updateFields;
};

// All routes require authentication
router.use(authenticateToken);

// Get user profile
router.get('/', async (req, res) => {
  try {
    const user = await findUserById(req.user.userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json(mapProfile(user));
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Update user profile
router.put('/', [
  body('firstName').optional().notEmpty(),
  body('lastName').optional(),
  body('currentStreak').optional().isInt({ min: 0 }),
  body('totalBadges').optional().isInt({ min: 0 }),
  body('healthConditions').optional().isArray(),
  body('dietaryGoals').optional(),
  body('weeklyTarget').optional().isInt({ min: 0, max: 100 }),
  body('dailyMealTarget').optional().isInt({ min: 1, max: 6 }),
  // Onboarding fields
  body('age').optional().isInt({ min: 1, max: 120 }),
  body('weightKg').optional().isFloat({ min: 1, max: 1000 }),
  body('heightCm').optional().isFloat({ min: 30, max: 300 }),
  body('activityLevel').optional().isIn(['sedentary', 'light', 'moderate', 'active', 'very_active']),
  body('goals').optional().isArray(),
  body('hydrationTargetGlasses').optional().isInt({ min: 1, max: 20 }),
  body('hydrationProgressGlasses').optional().isInt({ min: 0, max: 20 }),
  body('points').optional().isInt({ min: 0 }),
  body('level').optional().isIn(['beginner', 'intermediate', 'pro']),
  body('avatarState').optional().isIn(['happy', 'neutral', 'sad'])
  ,
  body('fatigue').optional().isInt({ min: 0, max: 50 }),
  body('lastSleepHours').optional().isFloat({ min: 0, max: 24 }),
  body('lastWorkoutMinutes').optional().isInt({ min: 0, max: 300 }),
  body('lastWorkoutType').optional().isIn(['walk', 'run', 'strength', 'yoga', 'cycling', 'none'])
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: 'Invalid input', details: errors.array() });
    }

    const updateFields = normalizeUpdatePayload(req.body);
    const user = await findUserById(req.user.userId);

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    Object.assign(user, updateFields);

    const savedUser = isMongoReady()
      ? await User.findByIdAndUpdate(req.user.userId, updateFields, { new: true, runValidators: true }).select('-password')
      : await persistUser(user);

    res.json({
      message: 'Profile updated successfully',
      user: mapProfile(savedUser)
    });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Update streak and badges (for game mechanics)
router.patch('/progress', [
  body('currentStreak').optional().isInt({ min: 0 }),
  body('totalBadges').optional().isInt({ min: 0 })
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: 'Invalid input', details: errors.array() });
    }

    const updateFields = {};
    if (req.body.currentStreak !== undefined) {
      updateFields.currentStreak = req.body.currentStreak;
    }
    if (req.body.totalBadges !== undefined) {
      updateFields.totalBadges = req.body.totalBadges;
    }

    const user = await findUserById(req.user.userId);

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    Object.assign(user, updateFields);

    const savedUser = isMongoReady()
      ? await User.findByIdAndUpdate(req.user.userId, updateFields, { new: true, runValidators: true }).select('-password')
      : await persistUser(user);

    res.json({
      message: 'Progress updated successfully',
      current_streak: savedUser.currentStreak ?? 0,
      total_badges: savedUser.totalBadges ?? 0
    });
  } catch (error) {
    console.error('Update progress error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;