import { prisma } from '@dreamscape/db';

interface ListUsersParams {
  page: number;
  limit: number;
  search?: string;
  role?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export async function listUsers(params: ListUsersParams) {
  const { page, limit, search, role, sortBy = 'createdAt', sortOrder = 'desc' } = params;
  const skip = (page - 1) * limit;

  const where: any = {};

  if (search) {
    where.OR = [
      { email: { contains: search, mode: 'insensitive' } },
      { firstName: { contains: search, mode: 'insensitive' } },
      { lastName: { contains: search, mode: 'insensitive' } },
      { username: { contains: search, mode: 'insensitive' } },
    ];
  }

  if (role) {
    where.role = role;
  }

  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where,
      select: {
        id: true,
        email: true,
        username: true,
        firstName: true,
        lastName: true,
        role: true,
        isVerified: true,
        userCategory: true,
        createdAt: true,
        updatedAt: true,
        onboardingCompleted: true,
        _count: {
          select: {
            searches: true,
            favorites: true,
            notifications: true,
          },
        },
      },
      orderBy: { [sortBy]: sortOrder },
      skip,
      take: limit,
    }),
    prisma.user.count({ where }),
  ]);

  return {
    users,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
}

export async function getUserById(id: string) {
  const user = await prisma.user.findUnique({
    where: { id },
    select: {
      id: true,
      email: true,
      username: true,
      firstName: true,
      lastName: true,
      phoneNumber: true,
      dateOfBirth: true,
      nationality: true,
      role: true,
      userCategory: true,
      isVerified: true,
      onboardingCompleted: true,
      onboardingCompletedAt: true,
      createdAt: true,
      updatedAt: true,
      _count: {
        select: {
          searches: true,
          favorites: true,
          history: true,
          notifications: true,
        },
      },
    },
  });

  if (!user) throw new Error('User not found');
  return user;
}

interface UpdateUserData {
  firstName?: string;
  lastName?: string;
  email?: string;
  role?: string;
  isVerified?: boolean;
  userCategory?: string;
}

export async function updateUser(id: string, data: UpdateUserData) {
  const existing = await prisma.user.findUnique({ where: { id } });
  if (!existing) throw new Error('User not found');

  if (data.email && data.email !== existing.email) {
    const emailTaken = await prisma.user.findUnique({ where: { email: data.email } });
    if (emailTaken) throw new Error('Email already in use');
  }

  const user = await prisma.user.update({
    where: { id },
    data: data as any,
    select: {
      id: true,
      email: true,
      username: true,
      firstName: true,
      lastName: true,
      role: true,
      isVerified: true,
      userCategory: true,
      updatedAt: true,
    },
  });

  return user;
}

export async function deleteUser(id: string) {
  const existing = await prisma.user.findUnique({ where: { id } });
  if (!existing) throw new Error('User not found');

  await prisma.user.delete({ where: { id } });
  return { id };
}
