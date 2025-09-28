import { Request, Response } from 'express';
import prisma from '../prismaClient';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { slugifyName } from '../utils/slug';
import '../types/express';

const SALT_ROUNDS = 10;

export async function register(req: Request, res: Response) {
  try {
    const { email, password, name, phone } = req.body;
    if (!email || !password || !name) {
      return res
        .status(400)
        .json({ error: 'email, password and name are required' });
    }

    // проверяем, не занят ли email
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) return res.status(400).json({ error: 'User already exists' });

    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

    // генерируем базовый slug и делаем уникальным при необходимости
    const baseSlug = slugifyName(name);
    let slug = baseSlug;
    let i = 0;
    while (await prisma.user.findUnique({ where: { slug } })) {
      i += 1;
      slug = `${baseSlug}-${i}`;
      if (i > 100) break; // страховка
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

    // НИКОГДА не возвращаем passwordHash
    return res.status(201).json({
      id: user.id,
      email: user.email,
      name: user.name,
      slug: user.slug,
      phone: user.phone,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Server error' });
  }
}

export async function login(req: Request, res: Response) {
  try {
    const { email, password } = req.body;
    if (!email || !password)
      return res.status(400).json({ error: 'email and password required' });

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });

    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) return res.status(401).json({ error: 'Invalid credentials' });

    const token = jwt.sign(
      { userId: user.id },
      process.env.JWT_SECRET as string,
      { expiresIn: '7d' }
    );

    return res.json({ token });
  } catch (err) {
    console.error(err);
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
    console.error(err);
    return res.status(500).json({ error: 'Server error' });
  }
}
