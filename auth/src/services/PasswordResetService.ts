import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { prisma } from '@dreamscape/db';
import { isSendGridConfigured, sendPasswordResetEmail, FRONTEND_URL } from './EmailService';

export async function requestPasswordReset(email: string): Promise<{ success: boolean }> {
  // Always return success to prevent email enumeration
  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, email: true, firstName: true, lastName: true },
  });

  if (!user) {
    return { success: true };
  }

  // Invalidate all existing unused tokens for this user
  await prisma.passwordReset.updateMany({
    where: { userId: user.id, used: false },
    data: { used: true },
  });

  // Generate a secure random token
  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

  await prisma.passwordReset.create({
    data: { userId: user.id, token, expiresAt },
  });

  const resetLink = `${FRONTEND_URL}/reset-password?token=${token}`;
  const userName = [user.firstName, user.lastName].filter(Boolean).join(' ') || user.email;

  if (isSendGridConfigured()) {
    await sendPasswordResetEmail({ to: user.email, userName, resetLink });
  } else {
    console.log(`[DEV] Password reset link for ${user.email}: ${resetLink}`);
  }

  return { success: true };
}

export async function resetPassword(token: string, newPassword: string): Promise<{ success: boolean }> {
  const record = await prisma.passwordReset.findUnique({
    where: { token },
    include: { user: true },
  });

  if (!record || record.used || record.expiresAt < new Date()) {
    throw new Error('Invalid or expired token');
  }

  const hashedPassword = await bcrypt.hash(newPassword, 12);

  await prisma.user.update({
    where: { id: record.userId },
    data: { password: hashedPassword },
  });

  // Mark token as used
  await prisma.passwordReset.update({
    where: { token },
    data: { used: true },
  });

  // Force logout all sessions (security: revoke all active sessions)
  await prisma.session.deleteMany({ where: { userId: record.userId } });

  return { success: true };
}
