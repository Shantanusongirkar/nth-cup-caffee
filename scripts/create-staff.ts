import { getPrisma } from '../lib/prisma';
import bcrypt from 'bcryptjs';
import * as readline from 'readline';

const prisma = getPrisma();

function ask(question: string): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer);
    });
  });
}

async function main() {
  // Since User is linked to a Cafe, find the existing cafe first.
  const cafe = await prisma.cafe.findFirst();

  if (!cafe) {
    console.error('No cafe found in the database. Create a Cafe record first.');
    process.exit(1);
  }

  console.log(`Using cafe: ${cafe.name} (${cafe.slug})`);

  const name = await ask('Staff name: ');
  const email = await ask('Staff email: ');
  const password = await ask('Staff password (min 8 chars): ');

  if (!name || !email || !password || password.length < 8) {
    console.error('Name, email are required and password must be at least 8 characters.');
    process.exit(1);
  }

  const passwordHash = await bcrypt.hash(password, 12);

  const user = await prisma.user.upsert({
    where: { email },
    update: { passwordHash, name },
    create: {
      cafeId: cafe.id,
      name,
      email,
      passwordHash,
      role: 'OWNER',
    },
  });

  console.log(`✅ Staff account ready: ${user.email} (role: ${user.role})`);
}

main()
  .catch((err) => {
    console.error('Error creating staff account:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());