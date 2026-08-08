import { PrismaClient } from "@prisma/client";
const p = new PrismaClient();
const branches = await p.branch.findMany({ select: { id: true, name: true, latitude: true, longitude: true, geofenceRadiusMeters: true } });
console.log(JSON.stringify(branches, null, 2));
await p['$disconnect']();
