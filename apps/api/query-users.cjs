const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
p.user.findMany({ take: 5, select: { email: true, role: true } })
  .then(u => { console.log(JSON.stringify(u)); return p.$disconnect(); })
  .catch(e => { console.error(e.message); return p.$disconnect(); });
