import express from 'express';
import { body, validationResult } from 'express-validator';
import crypto from 'crypto';
import fs from 'fs/promises';
import path from 'path';
import mongoose from 'mongoose';
import { fileURLToPath } from 'url';
import FoodLog from '../models/FoodLog.js';
import { authenticateToken } from './auth.js';

const router = express.Router();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DEV_FOOD_LOGS_FILE = path.join(__dirname, '..', 'dev-foodlogs.json');

const isMongoReady = () => mongoose.connection.readyState === 1;

const readDevFoodLogs = async () => {
  try {
    const raw = await fs.readFile(DEV_FOOD_LOGS_FILE, 'utf8');
    return JSON.parse(raw);
  } catch (error) {
    if (error.code === 'ENOENT') {
      return [];
    }

    throw error;
  }
};

const writeDevFoodLogs = async (logs) => {
  await fs.writeFile(DEV_FOOD_LOGS_FILE, JSON.stringify(logs, null, 2));
};

const mapFoodLog = (log) => ({
  id: log._id?.toString?.() || log.id,
  name: log.foodName,
  meal_type: log.mealType,
  health_score: log.healthScore,
  logged_at: new Date(log.loggedAt).toISOString()
});

const getUserFoodLogs = async (userId) => {
  if (isMongoReady()) {
    return FoodLog.find({ userId }).sort({ loggedAt: -1 });
  }

  const logs = await readDevFoodLogs();
  return logs
    .filter((log) => log.userId === userId)
    .sort((a, b) => new Date(b.loggedAt) - new Date(a.loggedAt));
};

const saveFoodLog = async (log) => {
  if (isMongoReady()) {
    await log.save();
    return log;
  }

  const logs = await readDevFoodLogs();
  const nextLogs = [...logs, log];
  await writeDevFoodLogs(nextLogs);
  return log;
};

const deleteDevFoodLog = async (userId, id) => {
  const logs = await readDevFoodLogs();
  const nextLogs = logs.filter((log) => !(log.id === id && log.userId === userId));
  const removed = nextLogs.length !== logs.length;
  if (removed) {
    await writeDevFoodLogs(nextLogs);
  }
  return removed;
};

// All routes require authentication
router.use(authenticateToken);

// Get user's food logs
router.get('/', async (req, res) => {
  try {
    const foodLogs = await getUserFoodLogs(req.user.userId);
    const formattedLogs = foodLogs.map(mapFoodLog);

    res.json(formattedLogs);
  } catch (error) {
    console.error('Get food logs error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Create new food log
router.post('/', [
  body('foodName').notEmpty().trim(),
  body('mealType').isIn(['morning', 'afternoon', 'evening']),
  body('healthScore').isInt({ min: 0, max: 100 })
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: 'Invalid input', details: errors.array() });
    }

    const { foodName, mealType, healthScore } = req.body;

    const foodLog = isMongoReady()
      ? new FoodLog({
          userId: req.user.userId,
          foodName,
          mealType,
          healthScore,
          loggedAt: new Date()
        })
      : {
          id: crypto.randomUUID(),
          userId: req.user.userId,
          foodName,
          mealType,
          healthScore,
          loggedAt: new Date().toISOString()
        };

    await saveFoodLog(foodLog);

    res.status(201).json({
      message: 'Food logged successfully',
      foodLog: mapFoodLog(foodLog)
    });
  } catch (error) {
    console.error('Create food log error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get today's food logs
router.get('/today', async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const allLogs = await getUserFoodLogs(req.user.userId);
    const todayLogs = allLogs.filter((log) => {
      const loggedAt = new Date(log.loggedAt);
      return loggedAt >= today && loggedAt < tomorrow;
    });

    const formattedLogs = todayLogs.map(mapFoodLog);

    res.json(formattedLogs);
  } catch (error) {
    console.error('Get today logs error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Delete food log
router.delete('/:id', async (req, res) => {
  try {
    let foodLog = null;

    if (isMongoReady()) {
      foodLog = await FoodLog.findOneAndDelete({
        _id: req.params.id,
        userId: req.user.userId
      });
    } else {
      const removed = await deleteDevFoodLog(req.user.userId, req.params.id);
      foodLog = removed ? { id: req.params.id } : null;
    }

    if (!foodLog) {
      return res.status(404).json({ error: 'Food log not found' });
    }

    res.json({ message: 'Food log deleted successfully' });
  } catch (error) {
    console.error('Delete food log error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;