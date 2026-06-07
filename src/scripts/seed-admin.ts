import 'dotenv/config';
import { eq } from 'drizzle-orm';
import { hashPassword } from '@/auth/password';
import { db } from '@/db/client';
import { users } from '@/db/schema/index';

const email = process.argv[2] ?? 'admin@spleenet.com';
const password = process.argv[3] ?? 'AdminPass123!';

const existing = await db.query.users.findFirst({
  where: eq(users.email, email.toLowerCase()),
});

if (existing) {
  console.log(`Admin user already exists: ${email}`);
  process.exit(0);
}

const passwordHash = await hashPassword(password);

const [admin] = await db
  .insert(users)
  .values({
    email: email.toLowerCase(),
    passwordHash,
    role: 'admin',
    status: 'active',
    emailVerified: true,
  })
  .returning();

console.log(`Admin user created: ${admin.email} (id: ${admin.id})`);
console.log('Password:', password);
