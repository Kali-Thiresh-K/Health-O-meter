import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { body, validationResult } from 'express-validator';
import crypto from 'crypto';
import fs from 'fs/promises';
import path from 'path';
import mongoose from 'mongoose';
import { fileURLToPath } from 'url';
import User from '../models/User.js';

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

const mapUserResponse = (user) => ({
  id: user._id?.toString?.() || user.id,
  email: user.email,
  firstName: user.firstName,
  lastName: user.lastName || ''
});

const findUserByEmail = async (email) => {
  if (isMongoReady()) {
    return User.findOne({ email });
  }

  const users = await readDevUsers();
  return users.find((user) => user.email === email.toLowerCase()) || null;
};

const findUserById = async (id) => {
  if (isMongoReady()) {
    return User.findById(id);
  }

  const users = await readDevUsers();
  return users.find((user) => user.id === id) || null;
};

const createUser = async ({ email, password, firstName, lastName, referredBy, referredById, inviteCode }) => {
  if (isMongoReady()) {
    const user = new User({
      email,
      password,
      firstName,
      lastName: lastName || '',
      referredBy,
      referredById,
      inviteCode
    });

    await user.save();
    return user;
  }

  const users = await readDevUsers();
  const user = {
    id: crypto.randomUUID(),
    email,
    password,
    firstName,
    lastName: lastName || '',
    referredBy,
    referredById,
    inviteCode
  };

  users.push(user);
  await writeDevUsers(users);
  return user;
};

// Middleware to verify JWT token
export const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key', (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid or expired token' });
    }
    req.user = user;
    next();
  });
};

// Register user
router.post('/register', [
  body('email').isEmail().normalizeEmail(),
  body('password').isLength({ min: 6 }),
  body('firstName').notEmpty()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: 'Invalid input', details: errors.array() });
    }

    const { email, password, firstName, lastName, referrerName, referrerId, inviteCode } = req.body;
    const normalizedEmail = email.toLowerCase();

    // Check if user exists
    const existingUser = await findUserByEmail(normalizedEmail);
    if (existingUser) {
      return res.status(400).json({ error: 'User already exists' });
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Create user
    const user = await createUser({
      email: normalizedEmail,
      password: hashedPassword,
      firstName,
      lastName,
      referredBy: referrerName,
      referredById: referrerId,
      inviteCode
    });

    // Generate JWT
    const token = jwt.sign(
      { userId: user._id?.toString?.() || user.id, email: user.email, firstName: user.firstName },
      process.env.JWT_SECRET || 'your-secret-key',
      { expiresIn: '7d' }
    );

    res.status(201).json({
      message: 'User created successfully',
      token,
      user: mapUserResponse(user)
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Login user
router.post('/login', [
  body('email').isEmail().normalizeEmail(),
  body('password').notEmpty()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: 'Invalid input', details: errors.array() });
    }

    const { email, password } = req.body;
    const normalizedEmail = email.toLowerCase();

    // Find user
    const user = await findUserByEmail(normalizedEmail);
    if (!user) {
      return res.status(400).json({ error: 'Invalid credentials' });
    }

    // Check password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ error: 'Invalid credentials' });
    }

    // Generate JWT
    const token = jwt.sign(
      { userId: user._id?.toString?.() || user.id, email: user.email, firstName: user.firstName },
      process.env.JWT_SECRET || 'your-secret-key',
      { expiresIn: '7d' }
    );

    res.json({
      message: 'Login successful',
      token,
      user: mapUserResponse(user)
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get current user
router.get('/me', authenticateToken, async (req, res) => {
  try {
    const user = await findUserById(req.user.userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const responseUser = isMongoReady()
      ? user.toObject ? user.toObject() : user
      : { ...user };

    delete responseUser.password;
    res.json({ user: responseUser });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;