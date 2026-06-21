import { PrismaClient } from "@prisma/client";
import dotenv from "dotenv";

dotenv.config();

const prisma = new PrismaClient();

async function run() {
  console.log("Connecting to database...");

  // Get the main salon ID
  const salon = await prisma.salon.findFirst();
  if (!salon) {
    console.log("No Salon found in the database. Aborting.");
    process.exit(1);
  }
  const salonId = salon.id;
  console.log("Salon ID found:", salonId);

  try {
    console.log("Deleting all existing services and categories...");
    
    // Disconnect relationships first
    await prisma.staffServiceAssignment.deleteMany({ where: { service: { salonId } } });
    await prisma.appointmentServiceStaff.deleteMany({ where: { appointmentService: { service: { salonId } } } });
    await prisma.appointmentService.deleteMany({ where: { service: { salonId } } });
    await prisma.packageService.deleteMany({ where: { service: { salonId } } });
    await prisma.membershipPlanService.deleteMany({ where: { service: { salonId } } });

    // Now delete services and categories
    await prisma.service.deleteMany({ where: { salonId } });
    await prisma.serviceCategory.deleteMany({ where: { salonId } });
    
    console.log("Old services and categories deleted successfully.");
    console.log("Inserting premium, well-structured categories and services...");

    // ==========================================
    // 1. HAIR SERVICES
    // ==========================================
    const hairServices = await prisma.serviceCategory.create({
      data: { salonId, name: "Hair Services" }
    });
    const haircutsStyling = await prisma.serviceCategory.create({
      data: { salonId, name: "Haircuts & Styling", parentId: hairServices.id }
    });
    const hairColoring = await prisma.serviceCategory.create({
      data: { salonId, name: "Hair Coloring & Highlights", parentId: hairServices.id }
    });
    const hairTreatments = await prisma.serviceCategory.create({
      data: { salonId, name: "Hair Treatments & Rituals", parentId: hairServices.id }
    });

    // ==========================================
    // 2. SKIN & FACE CARE
    // ==========================================
    const skinFaceCare = await prisma.serviceCategory.create({
      data: { salonId, name: "Skin & Face Care" }
    });
    const facialsCleanups = await prisma.serviceCategory.create({
      data: { salonId, name: "Facials & Cleanups", parentId: skinFaceCare.id }
    });
    const bleachTanRemoval = await prisma.serviceCategory.create({
      data: { salonId, name: "Bleach & Tan Removal", parentId: skinFaceCare.id }
    });
    const threadingWaxing = await prisma.serviceCategory.create({
      data: { salonId, name: "Threading & Face Waxing", parentId: skinFaceCare.id }
    });

    // ==========================================
    // 3. NAIL & HAND/FOOT CARE
    // ==========================================
    const nailCare = await prisma.serviceCategory.create({
      data: { salonId, name: "Nail & Hand/Foot Care" }
    });
    const manicurePedicure = await prisma.serviceCategory.create({
      data: { salonId, name: "Manicure & Pedicure", parentId: nailCare.id }
    });
    const nailArtExtensions = await prisma.serviceCategory.create({
      data: { salonId, name: "Nail Art & Extensions", parentId: nailCare.id }
    });

    // ==========================================
    // 4. BODY & WELLNESS CARE
    // ==========================================
    const bodyWellness = await prisma.serviceCategory.create({
      data: { salonId, name: "Body & Wellness Care" }
    });
    const bodyWaxing = await prisma.serviceCategory.create({
      data: { salonId, name: "Body Waxing (Rica Wax)", parentId: bodyWellness.id }
    });
    const massagesTherapy = await prisma.serviceCategory.create({
      data: { salonId, name: "Massages & Therapy", parentId: bodyWellness.id }
    });

    // ==========================================
    // 5. MAKEUP & BRIDAL STYLING
    // ==========================================
    const makeupBridal = await prisma.serviceCategory.create({
      data: { salonId, name: "Makeup & Bridal Styling" }
    });
    const bridalGroom = await prisma.serviceCategory.create({
      data: { salonId, name: "Bridal & Groom Makeovers", parentId: makeupBridal.id }
    });
    const occasionParty = await prisma.serviceCategory.create({
      data: { salonId, name: "Occasion & Party Styling", parentId: makeupBridal.id }
    });

    // ==========================================
    // SERVICES SEED DATA
    // ==========================================
    const servicesData = [
      // --- Haircuts & Styling ---
      { salonId, categoryId: haircutsStyling.id, name: "Men's Classic Haircut", gender: "MALE", price: 500, durationMin: 30, isPublicVisible: true },
      { salonId, categoryId: haircutsStyling.id, name: "Women's Signature Haircut", gender: "FEMALE", price: 1200, durationMin: 60, isPopular: true, isPublicVisible: true },
      { salonId, categoryId: haircutsStyling.id, name: "Kid's Haircut (Under 12)", gender: "UNISEX", price: 350, durationMin: 30, isPublicVisible: true },
      { salonId, categoryId: haircutsStyling.id, name: "Blow Dry & Styling (Classic)", gender: "FEMALE", price: 600, durationMin: 30, isPublicVisible: true },
      { salonId, categoryId: haircutsStyling.id, name: "Premium Hair Styling (Updos, Curls)", gender: "FEMALE", price: 1500, durationMin: 60, isPublicVisible: true },
      { salonId, categoryId: haircutsStyling.id, name: "Beard Trim & Styling", gender: "MALE", price: 300, durationMin: 30, isPublicVisible: true },

      // --- Hair Coloring & Highlights ---
      { salonId, categoryId: hairColoring.id, name: "Global Hair Color (L'Oreal)", gender: "FEMALE", price: 2500, durationMin: 90, isPublicVisible: true },
      { salonId, categoryId: hairColoring.id, name: "Root Touch-up", gender: "FEMALE", price: 1200, durationMin: 60, isPublicVisible: true },
      { salonId, categoryId: hairColoring.id, name: "Balayage / Ombre Highlights", gender: "FEMALE", price: 5500, durationMin: 150, isFeatured: true, isPublicVisible: true },
      { salonId, categoryId: hairColoring.id, name: "Fashion Color Streaks (Per Streak)", gender: "UNISEX", price: 500, durationMin: 45, isPublicVisible: true },
      { salonId, categoryId: hairColoring.id, name: "Beard Coloring", gender: "MALE", price: 400, durationMin: 30, isPublicVisible: true },

      // --- Hair Treatments & Rituals ---
      { salonId, categoryId: hairTreatments.id, name: "Premium Keratin Treatment", gender: "UNISEX", price: 6500, durationMin: 180, isPopular: true, isPublicVisible: true },
      { salonId, categoryId: hairTreatments.id, name: "Olaplex Hair Repair Ritual", gender: "UNISEX", price: 3000, durationMin: 90, isPublicVisible: true },
      { salonId, categoryId: hairTreatments.id, name: "L'Oreal Hair Spa (Deep Nourishing)", gender: "UNISEX", price: 1500, durationMin: 60, isPublicVisible: true },
      { salonId, categoryId: hairTreatments.id, name: "Anti-Dandruff & Scalp Purifying Spa", gender: "UNISEX", price: 1800, durationMin: 60, isPublicVisible: true },

      // --- Facials & Cleanups ---
      { salonId, categoryId: facialsCleanups.id, name: "HydraFacial MD (Ultimate Renewal)", gender: "UNISEX", price: 4500, durationMin: 60, isFeatured: true, isPopular: true, isPublicVisible: true },
      { salonId, categoryId: facialsCleanups.id, name: "O3+ Brightening & Whitening Facial", gender: "FEMALE", price: 3000, durationMin: 75, isPublicVisible: true },
      { salonId, categoryId: facialsCleanups.id, name: "Charcoal Detox Facial", gender: "UNISEX", price: 2000, durationMin: 60, isPublicVisible: true },
      { salonId, categoryId: facialsCleanups.id, name: "Fruit Nourishing Facial (Basic)", gender: "UNISEX", price: 1200, durationMin: 45, isPublicVisible: true },
      { salonId, categoryId: facialsCleanups.id, name: "Deep Pore Cleansing Cleanup", gender: "UNISEX", price: 1000, durationMin: 45, isPublicVisible: true },

      // --- Bleach & Tan Removal ---
      { salonId, categoryId: bleachTanRemoval.id, name: "Full Face Oxy Bleach", gender: "UNISEX", price: 500, durationMin: 30, isPublicVisible: true },
      { salonId, categoryId: bleachTanRemoval.id, name: "Face & Neck D-Tan Pack", gender: "UNISEX", price: 600, durationMin: 30, isPublicVisible: true },
      { salonId, categoryId: bleachTanRemoval.id, name: "Arms & Legs D-Tan Therapy", gender: "UNISEX", price: 1200, durationMin: 45, isPublicVisible: true },

      // --- Threading & Face Waxing ---
      { salonId, categoryId: threadingWaxing.id, name: "Eyebrow Threading & Shaping", gender: "FEMALE", price: 100, durationMin: 15, isPublicVisible: true },
      { salonId, categoryId: threadingWaxing.id, name: "Upper Lip Threading", gender: "FEMALE", price: 50, durationMin: 10, isPublicVisible: true },
      { salonId, categoryId: threadingWaxing.id, name: "Full Face Threading/Waxing", gender: "FEMALE", price: 400, durationMin: 30, isPublicVisible: true },

      // --- Manicure & Pedicure ---
      { salonId, categoryId: manicurePedicure.id, name: "Classic Spa Manicure", gender: "UNISEX", price: 800, durationMin: 45, isPublicVisible: true },
      { salonId, categoryId: manicurePedicure.id, name: "Classic Spa Pedicure", gender: "UNISEX", price: 1000, durationMin: 60, isPublicVisible: true },
      { salonId, categoryId: manicurePedicure.id, name: "Premium Ice Cream Pedicure", gender: "FEMALE", price: 1800, durationMin: 75, isPopular: true, isPublicVisible: true },
      { salonId, categoryId: manicurePedicure.id, name: "Detan Manicure & Pedicure Combo", gender: "UNISEX", price: 2200, durationMin: 90, isPublicVisible: true },

      // --- Nail Art & Extensions ---
      { salonId, categoryId: nailArtExtensions.id, name: "Acrylic Nail Extensions (Full Set)", gender: "FEMALE", price: 2500, durationMin: 90, isPublicVisible: true },
      { salonId, categoryId: nailArtExtensions.id, name: "Gel Polish Application (Hands)", gender: "FEMALE", price: 800, durationMin: 45, isPublicVisible: true },
      { salonId, categoryId: nailArtExtensions.id, name: "Gel Polish Application (Feet)", gender: "FEMALE", price: 800, durationMin: 45, isPublicVisible: true },
      { salonId, categoryId: nailArtExtensions.id, name: "Custom Nail Art (Per Nail)", gender: "FEMALE", price: 150, durationMin: 20, isPublicVisible: true },
      { salonId, categoryId: nailArtExtensions.id, name: "Extension Removal & Nail Care", gender: "FEMALE", price: 600, durationMin: 45, isPublicVisible: true },

      // --- Body Waxing (Rica Wax) ---
      { salonId, categoryId: bodyWaxing.id, name: "Full Arms Rica Waxing", gender: "FEMALE", price: 700, durationMin: 30, isPublicVisible: true },
      { salonId, categoryId: bodyWaxing.id, name: "Full Legs Rica Waxing", gender: "FEMALE", price: 900, durationMin: 45, isPublicVisible: true },
      { salonId, categoryId: bodyWaxing.id, name: "Underarms Rica Waxing", gender: "FEMALE", price: 200, durationMin: 15, isPublicVisible: true },
      { salonId, categoryId: bodyWaxing.id, name: "Full Body Honey/Rica Waxing", gender: "FEMALE", price: 2500, durationMin: 120, isPublicVisible: true },

      // --- Massages & Therapy ---
      { salonId, categoryId: massagesTherapy.id, name: "Swedish Body Massage", gender: "UNISEX", price: 2500, durationMin: 60, isPublicVisible: true },
      { salonId, categoryId: massagesTherapy.id, name: "Deep Tissue Therapy Massage", gender: "UNISEX", price: 3000, durationMin: 60, isPublicVisible: true },
      { salonId, categoryId: massagesTherapy.id, name: "Aromatherapy Stress Relief", gender: "UNISEX", price: 3500, durationMin: 90, isPublicVisible: true },
      { salonId, categoryId: massagesTherapy.id, name: "Back & Shoulder Relaxer Massage", gender: "UNISEX", price: 1200, durationMin: 30, isPublicVisible: true },

      // --- Bridal & Groom Makeovers ---
      { salonId, categoryId: bridalGroom.id, name: "HD Bridal Makeup & Draping", gender: "FEMALE", price: 15000, durationMin: 180, isFeatured: true, isPublicVisible: true },
      { salonId, categoryId: bridalGroom.id, name: "Premium Airbrush Bridal Makeover", gender: "FEMALE", price: 22000, durationMin: 180, isFeatured: true, isPublicVisible: true },
      { salonId, categoryId: bridalGroom.id, name: "Grooming HD Makeover", gender: "MALE", price: 8000, durationMin: 90, isPublicVisible: true },

      // --- Occasion & Party Styling ---
      { salonId, categoryId: occasionParty.id, name: "Party Makeup & Hair Styling", gender: "FEMALE", price: 4500, durationMin: 90, isPublicVisible: true },
      { salonId, categoryId: occasionParty.id, name: "Glam / Evening Party Makeup", gender: "FEMALE", price: 3500, durationMin: 60, isPublicVisible: true },
      { salonId, categoryId: occasionParty.id, name: "Saree Draping & Hair Bun", gender: "FEMALE", price: 1200, durationMin: 45, isPublicVisible: true }
    ];

    await prisma.service.createMany({
      data: servicesData
    });

    console.log(`Successfully seeded ${servicesData.length} new premium services!`);

  } catch (error) {
    console.error("Error during seeding:", error);
  } finally {
    await prisma.$disconnect();
    console.log("Done.");
  }
}

run();
