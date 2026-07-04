import { prisma } from "../../../lib/prisma.js";
import { toAmount } from "../../../lib/phase2.js";
import { requireSalonPermission } from "../../../middlewares/rbac.js";

export const registerMyPageRoutes = (ownerRouter) => {
  ownerRouter.get("/my-dashboard", requireSalonPermission("myDashboard", "view"), async (req, res) => {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(startOfDay);
    endOfDay.setDate(endOfDay.getDate() + 1);
    const [profile, scopedAppointments, notifications, todayAttendance, salonSetting] = await Promise.all([
      prisma.userSalon.findFirst({
        where: { id: req.user.membershipId, salonId: req.salonId },
        include: { branch: true, serviceAssignments: { include: { service: true } } }
      }),
      prisma.appointment.findMany({
        where: {
          salonId: req.salonId,
          items: { some: { assignedStaff: { some: { userSalonId: req.user.membershipId } } } }
        },
        include: { customer: true },
        orderBy: { startAt: "desc" },
        take: 10
      }),
      prisma.appointmentLog.findMany({
        where: {
          appointment: {
            salonId: req.salonId,
            items: { some: { assignedStaff: { some: { userSalonId: req.user.membershipId } } } }
          }
        },
        include: { appointment: { include: { customer: true, branch: true } } },
        orderBy: { createdAt: "desc" },
        take: 8
      }),
      prisma.attendanceRecord.findFirst({
        where: {
          salonId: req.salonId,
          userSalonId: req.user.membershipId,
          attendanceDate: { gte: startOfDay, lt: endOfDay }
        },
        include: { branch: true },
        orderBy: { createdAt: "desc" }
      }),
      prisma.salonSetting.findFirst({
        where: { salonId: req.salonId, branchId: null }
      })
    ]);
    res.json({
      todayAppointments: scopedAppointments.filter((item) => new Date(item.startAt).toDateString() === new Date().toDateString()),
      recentAppointments: scopedAppointments.slice(0, 5),
      assignedServices: profile?.serviceAssignments || [],
      notifications,
      profile,
      todayAttendance,
      attendanceSettings: salonSetting?.advancedSettings?.attendanceSettings || null
    });
  });

  ownerRouter.get("/my-notifications", requireSalonPermission("myDashboard", "view"), async (req, res) => {
    res.json(await prisma.appointmentLog.findMany({
      where: {
        appointment: {
          salonId: req.salonId,
          items: { some: { assignedStaff: { some: { userSalonId: req.user.membershipId } } } }
        }
      },
      include: { appointment: { include: { customer: true, branch: true } } },
      orderBy: { createdAt: "desc" },
      take: 15
    }));
  });

  ownerRouter.get("/my-appointments", requireSalonPermission("myAppointments", "view"), async (req, res) => {
    res.json(await prisma.appointment.findMany({
      where: {
        salonId: req.salonId,
        items: { some: { assignedStaff: { some: { userSalonId: req.user.membershipId } } } }
      },
      include: { customer: true, branch: true, items: { include: { service: true } } },
      orderBy: { startAt: "asc" }
    }));
  });

  ownerRouter.get("/my-schedule", requireSalonPermission("mySchedule", "view"), async (req, res) => {
    res.json({
      schedules: await prisma.staffSchedule.findMany({ where: { userSalonId: req.user.membershipId }, orderBy: { weekday: "asc" } }),
      breaks: await prisma.staffBreak.findMany({ where: { userSalonId: req.user.membershipId }, orderBy: [{ weekday: "asc" }, { startTime: "asc" }] })
    });
  });

  ownerRouter.get("/my-profile", requireSalonPermission("myProfile", "view"), async (req, res) => {
    const profile = await prisma.userSalon.findFirst({
      where: { id: req.user.membershipId, salonId: req.salonId },
      include: { user: true, branch: true, serviceAssignments: { include: { service: true } } }
    });
    const attendanceHistory = await prisma.attendanceRecord.findMany({
      where: { salonId: req.salonId, userSalonId: req.user.membershipId },
      include: { branch: true },
      orderBy: [{ attendanceDate: "desc" }, { checkInAt: "desc" }],
      take: 20
    });
    res.json({ ...profile, attendanceHistory });
  });

  ownerRouter.patch("/my-profile", requireSalonPermission("myProfile", "edit"), async (req, res) => {
    const profile = await prisma.userSalon.findFirst({ where: { id: req.user.membershipId, salonId: req.salonId } });
    if (!profile) return res.status(404).json({ message: "Profile not found" });
    res.json(await prisma.userSalon.update({
      where: { id: profile.id },
      data: {
        phone: req.body.phone ?? profile.phone,
        profileNote: req.body.profileNote ?? profile.profileNote,
        avatarUrl: req.body.avatarUrl ?? profile.avatarUrl
      }
    }));
  });
};
