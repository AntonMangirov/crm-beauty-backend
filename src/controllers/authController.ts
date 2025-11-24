import { Request, Response } from 'express';
import prisma from '../prismaClient';
import jwt from 'jsonwebtoken';
import { slugifyName } from '../utils/slug';
import {
  RegisterRequestSchema,
  RegisterResponseSchema,
  LoginRequestSchema,
  LoginResponseSchema,
} from '../schemas/auth';
import { hashPassword, verifyPassword } from '../utils/password';
import { logError } from '../utils/logger';

declare global {
  namespace Express {
    interface Request {
      user?: { id: string };
    }
  }
}

export async function register(req: Request, res: Response) {
  try {
    const { email, password, name, phone } = RegisterRequestSchema.parse(
      req.body
    );
    if (!email || !password || !name) {
      return res
        .status(400)
        .json({ error: 'email, password and name are required' });
    }

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) return res.status(400).json({ error: 'User already exists' });

    const passwordHash = await hashPassword(password);

    const baseSlug = slugifyName(name);
    let slug = '';
    let attempts = 0;
    while (attempts < 20) {
      const suffix = String(Math.floor(100 + Math.random() * 900));
      const candidate = `${baseSlug}-${suffix}`;
      const exists = await prisma.user.findUnique({
        where: { slug: candidate },
      });
      if (!exists) {
        slug = candidate;
        break;
      }
      attempts += 1;
    }

    if (!slug) {
      slug = `${baseSlug}-${Date.now().toString().slice(-3)}`;
    }

    const user = await prisma.user.create({
      data: {
        email,
        passwordHash,
        name,
        phone,
        slug,
      },
    });

    const response = RegisterResponseSchema.parse({
      id: user.id,
      email: user.email,
      name: user.name,
      slug: user.slug,
      phone: user.phone,
    });
    return res.status(201).json(response);
  } catch (err) {
    logError('Ошибка регистрации', err);
    return res.status(500).json({ error: 'Server error' });
  }
}

export async function login(req: Request, res: Response) {
  try {
    const { email, password } = LoginRequestSchema.parse(req.body);
    if (!email || !password)
      return res.status(400).json({ error: 'email and password required' });

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });

    const ok = await verifyPassword(password, user.passwordHash);
    if (!ok) return res.status(401).json({ error: 'Invalid credentials' });

    const token = jwt.sign(
      { userId: user.id },
      process.env.JWT_SECRET as string,
      { expiresIn: '7d' }
    );

    const response = LoginResponseSchema.parse({ token });
    return res.json(response);
  } catch (err) {
    logError('Ошибка входа', err);
    return res.status(500).json({ error: 'Server error' });
  }
}

export async function me(req: Request, res: Response) {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        phone: true,
        slug: true,
        description: true,
        photoUrl: true,
      },
    });

    if (!user) return res.status(404).json({ error: 'User not found' });
    return res.json(user);
  } catch (err) {
    logError('Ошибка получения профиля', err);
    return res.status(500).json({ error: 'Server error' });
  }
}
