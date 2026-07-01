import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const staffPermissions = {
  appointments: ["view", "edit"],
  customers: ["view"],
  feedback: ["view"],
  myDashboard: ["view"],
  myAppointments: ["view"],
  mySchedule: ["view"],
  myCommission: ["view"],
  myAttendance: ["view", "create", "edit"],
  myLeaves: ["view", "create"],
  myPayroll: ["view"],
  myPerformance: ["view"],
  myProfile: ["view", "edit"],
  attendance: ["view", "create", "edit"]
};

const managerPermissions = {
  dashboard: ["view", "edit"],
  appointments: ["view", "create", "edit", "delete"],
  staff: ["view", "create", "edit"],
  customers: ["view", "create", "edit"],
  invoices: ["view", "create", "edit"],
  payments: ["view", "create"],
  inventory: ["view", "create", "edit"],
  reports: ["view"],
  attendance: ["view", "create", "edit"],
  leaves: ["view", "create", "edit"],
  myDashboard: ["view"],
  myAttendance: ["view", "create", "edit"],
  myProfile: ["view", "edit"]
};

const receptionistPermissions = {
  appointments: ["view", "create", "edit", "delete"],
  customers: ["view", "create", "edit"],
  invoices: ["view", "create", "edit"],
  payments: ["view", "create"],
  feedback: ["view"],
  myDashboard: ["view"],
  myAppointments: ["view"],
  mySchedule: ["view"],
  myAttendance: ["view", "create", "edit"],
  myLeaves: ["view", "create"],
  myPayroll: ["view"],
  myProfile: ["view", "edit"],
  attendance: ["view", "create", "edit"]
};

const branchGPS = {
  "Main Branch": { latitude: 28.6315, longitude: 77.2167 },
  "DHA Branch": { latitude: 19.0370, longitude: 72.8478 },
  "Gulberg Branch": { latitude: 12.9716, longitude: 77.5946 },
  "Johar Town Branch": { latitude: 13.0827, longitude: 80.2707 }
};

async function main() {
  console.log("Finding salon...");
  const salon = await prisma.salon.findFirst({ where: { slug: "demo-salon" } });
  if (!salon) { console.error("No salon found!"); process.exit(1); }
  console.log(`Salon: ${salon.name} (${salon.id})`);

  const ownerUserSalon = await prisma.userSalon.findFirst({
    where: { salonId: salon.id, salonRole: "SALON_OWNER" }
  });
  if (!ownerUserSalon) { console.error("No owner found!"); process.exit(1); }
  const ownerUserId = ownerUserSalon.userId;

  console.log("Setting GPS coordinates on branches...");
  const branches = await prisma.branch.findMany({ where: { salonId: salon.id } });
  for (const branch of branches) {
    const gps = Object.entries(branchGPS).find(([key]) => branch.name.includes(key.split(" ")[0]));
    if (gps) {
      await prisma.branch.update({
        where: { id: branch.id },
        data: { latitude: gps[1].latitude, longitude: gps[1].longitude, geofenceRadiusMeters: 75 }
      });
      console.log(`  ${branch.name}: ${gps[1].latitude}, ${gps[1].longitude}`);
    }
  }

  console.log("Deleting all non-owner staff...");
  const nonOwnerUserSalons = await prisma.userSalon.findMany({
    where: { salonId: salon.id, userId: { not: ownerUserId } },
    select: { id: true }
  });
  const nonOwnerIds = nonOwnerUserSalons.map((us) => us.id);
  console.log(`Found ${nonOwnerIds.length} non-owner staff memberships to delete`);

  if (nonOwnerIds.length > 0) {
    const deleteOps = [
      ["AppointmentServiceStaff", { userSalonId: { in: nonOwnerIds } }],
      ["AttendanceRecord", { userSalonId: { in: nonOwnerIds } }],
      ["LeaveRequest", { userSalonId: { in: nonOwnerIds } }],
      ["PayrollItem", { userSalonId: { in: nonOwnerIds } }],
      ["StaffSchedule", { userSalonId: { in: nonOwnerIds } }],
      ["StaffBreak", { userSalonId: { in: nonOwnerIds } }],
      ["StaffServiceAssignment", { userSalonId: { in: nonOwnerIds } }],
      ["InvoiceItem", { userSalonId: { in: nonOwnerIds } }],
    ];
    for (const [modelName, where] of deleteOps) {
      try {
        const result = await prisma[modelName].deleteMany({ where });
        if (result.count > 0) console.log(`  Deleted ${result.count} ${modelName} records`);
      } catch (e) { /* table might not exist */ }
    }
    const deletedStaff = await prisma.userSalon.deleteMany({ where: { id: { in: nonOwnerIds } } });
    console.log(`Deleted ${deletedStaff.count} UserSalon records`);
  }

  console.log("Deleting orphaned staff users...");
  const allRemainingUserSalons = await prisma.userSalon.findMany({ select: { userId: true } });
  const keptUserIds = new Set(allRemainingUserSalons.map((us) => us.userId));
  const superAdmins = await prisma.user.findMany({ where: { systemRole: "SUPER_ADMIN" }, select: { id: true } });
  superAdmins.forEach((sa) => keptUserIds.add(sa.id));
  keptUserIds.add(ownerUserId);

  const orphanedUsers = await prisma.user.findMany({
    where: { id: { notIn: [...keptUserIds] }, systemRole: "SALON_USER", isDemoAccount: false }
  });
  if (orphanedUsers.length > 0) {
    await prisma.user.deleteMany({ where: { id: { in: orphanedUsers.map((u) => u.id) } } });
    console.log(`Deleted ${orphanedUsers.length} orphaned User records`);
  }

  console.log("Deleting all custom roles for salon...");
  const deletedRoles = await prisma.customRole.deleteMany({ where: { salonId: salon.id } });
  console.log(`Deleted ${deletedRoles.count} CustomRole records`);

  console.log("Creating new custom roles...");
  const roles = [
    { name: "Senior Stylist", desc: "Experienced stylist handling premium client services", perms: { appointments: ["view", "create", "edit"], services: ["view"], customers: ["view", "create"] } },
    { name: "Junior Stylist", desc: "Entry-level stylist performing standard services", perms: { appointments: ["view", "create"], services: ["view"] } },
    { name: "Receptionist Manager", desc: "Front desk manager handling bookings and billing", perms: { appointments: ["view", "create", "edit", "delete"], invoices: ["view", "create", "edit"], customers: ["view", "create", "edit"] } },
    { name: "Skin Care Specialist", desc: "Certified skincare treatment professional", perms: { appointments: ["view", "create", "edit"], services: ["view"], customers: ["view", "create"] } },
    { name: "Makeup Artist", desc: "Professional makeup artist for all occasions", perms: { appointments: ["view", "create", "edit"], services: ["view"], customers: ["view", "create"] } }
  ];

  const createdRoles = {};
  for (const r of roles) {
    const role = await prisma.customRole.create({
      data: { salonId: salon.id, name: r.name, description: r.desc, permissions: r.perms }
    });
    createdRoles[r.name] = role;
    console.log(`  Created role: ${r.name}`);
  }

  console.log("Creating new staff...");
  const mainBranch = branches.find((b) => b.name.includes("Main")) || branches[0];
  const dhaBranch = branches.find((b) => b.name.includes("DHA")) || branches[1];
  const gulbergBranch = branches.find((b) => b.name.includes("Gulberg")) || branches[2];
  const joharBranch = branches.find((b) => b.name.includes("Johar")) || branches[3];

  const staffList = [
    { name: "Rahul Sharma", email: "rahul.sharma@respark.local", phone: "+919876543201", salonRole: "STAFF", customRoleId: createdRoles["Senior Stylist"].id, branchId: mainBranch.id, designation: "Senior Stylist", perms: staffPermissions },
    { name: "Priya Kapoor", email: "priya.kapoor@respark.local", phone: "+919876543202", salonRole: "RECEPTIONIST", customRoleId: createdRoles["Receptionist Manager"].id, branchId: mainBranch.id, designation: "Receptionist Manager", perms: receptionistPermissions },
    { name: "Amit Verma", email: "amit.verma@respark.local", phone: "+919876543203", salonRole: "MANAGER", customRoleId: null, branchId: mainBranch.id, designation: "Salon Manager", perms: managerPermissions },
    { name: "Sneha Iyer", email: "sneha.iyer@respark.local", phone: "+919876543204", salonRole: "STAFF", customRoleId: createdRoles["Skin Care Specialist"].id, branchId: dhaBranch.id, designation: "Skin Care Specialist", perms: staffPermissions },
    { name: "Vikram Rajput", email: "vikram.rajput@respark.local", phone: "+919876543205", salonRole: "STAFF", customRoleId: createdRoles["Senior Stylist"].id, branchId: gulbergBranch.id, designation: "Senior Barber", perms: staffPermissions },
    { name: "Neha Joshi", email: "neha.joshi@respark.local", phone: "+919876543206", salonRole: "STAFF", customRoleId: createdRoles["Makeup Artist"].id, branchId: joharBranch.id, designation: "Makeup Artist", perms: staffPermissions },
    { name: "Arjun Nair", email: "arjun.nair@respark.local", phone: "+919876543207", salonRole: "STAFF", customRoleId: createdRoles["Junior Stylist"].id, branchId: dhaBranch.id, designation: "Junior Stylist", perms: staffPermissions },
    { name: "Kavita Deshmukh", email: "kavita.deshmukh@respark.local", phone: "+919876543208", salonRole: "STAFF", customRoleId: createdRoles["Skin Care Specialist"].id, branchId: joharBranch.id, designation: "Skin Care Specialist", perms: staffPermissions }
  ];

  const passwordHash = await bcrypt.hash("Staff@123", 10);
  let createdCount = 0;

  for (const s of staffList) {
    try {
      const user = await prisma.user.create({
        data: { email: s.email, name: s.name, systemRole: "SALON_USER", passwordHash }
      });

      await prisma.userSalon.create({
        data: {
          userId: user.id,
          salonId: salon.id,
          salonRole: s.salonRole,
          branchId: s.branchId,
          customRoleId: s.customRoleId,
          phone: s.phone,
          designation: s.designation,
          profileNote: `${s.name} - ${s.designation}`,
          joiningDate: new Date("2025-01-15"),
          attendanceEnabled: true,
          permissions: s.perms
        }
      });
      createdCount++;
      console.log(`  Created: ${s.name} (${s.salonRole} - ${s.designation}) [attendance: ON]`);
    } catch (err) {
      console.error(`  Failed to create ${s.name}: ${err.message}`);
    }
  }

  console.log("\n=== SUMMARY ===");
  console.log(`Roles deleted: ${deletedRoles.count}`);
  console.log(`New roles created: ${roles.length}`);
  console.log(`New staff created: ${createdCount}`);
  console.log(`Branches GPS: Updated`);
  console.log("\nLogin credentials (all staff): password = Staff@123");
  for (const s of staffList) {
    console.log(`  ${s.name} - ${s.email} - ${s.salonRole} (${s.designation})`);
  }
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
