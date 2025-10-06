import { Request, Response } from 'express';
import prisma from '../prismaClient';

export async function getPublicProfileBySlug(req: Request, res: Response) {
  try {
    const { slug } = req.params;
    if (!slug) {
      return res.status(400).json({ error: 'slug is required' });
    }

    const user = await prisma.user.findUnique({
      where: { slug },
      select: {
        name: true,
        photoUrl: true,
        description: true,
        address: true,
        isActive: true,
        services: {
          where: { isActive: true },
          select: {
            id: true,
            name: true,
            price: true,
            durationMin: true,
          },
          orderBy: { name: 'asc' },
        },
      },
    });

    if (!user || !user.isActive) {
      return res.status(404).json({ error: 'Profile not found' });
    }

    return res.json({
      name: user.name,
      photoUrl: user.photoUrl,
      description: user.description,
      address: user.address,
      services: user.services,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Server error' });
  }
}
