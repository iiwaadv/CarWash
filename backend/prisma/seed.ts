import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { hashPin } from "../src/utils/pin";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Seeding CarWash Ops Engine demo data...");

  const branchA = await prisma.branch.create({
    data: { name: "فرع الرياض - العليا", status: "open" },
  });
  const branchB = await prisma.branch.create({
    data: { name: "فرع جدة - الروضة", status: "open" },
  });

  const [bayA1, bayA2, bayA3] = await Promise.all([
    prisma.bay.create({ data: { branchId: branchA.id, bayName: "موقف 1 - عادي", bayType: "normal" } }),
    prisma.bay.create({ data: { branchId: branchA.id, bayName: "موقف 2 - VIP", bayType: "vip" } }),
    prisma.bay.create({ data: { branchId: branchA.id, bayName: "موقف 3 - عادي", bayType: "normal" } }),
  ]);
  const [bayB1, bayB2] = await Promise.all([
    prisma.bay.create({ data: { branchId: branchB.id, bayName: "موقف 1 - عادي", bayType: "normal" } }),
    prisma.bay.create({ data: { branchId: branchB.id, bayName: "موقف 2 - VIP", bayType: "vip" } }),
  ]);

  const manager = await prisma.employee.create({
    data: {
      branchId: branchA.id,
      name: "خالد المدير العام",
      role: "manager",
      pinCode: hashPin("9999"),
    },
  });

  const supervisorA = await prisma.employee.create({
    data: { branchId: branchA.id, name: "سعيد المشرف", role: "supervisor", pinCode: hashPin("1234") },
  });
  const supervisorB = await prisma.employee.create({
    data: { branchId: branchB.id, name: "منى المشرفة", role: "supervisor", pinCode: hashPin("4321") },
  });

  const washer1 = await prisma.employee.create({
    data: { branchId: branchA.id, name: "علي - غسيل", role: "washer", pinCode: hashPin("1111") },
  });
  const washer2 = await prisma.employee.create({
    data: { branchId: branchA.id, name: "فهد - تنشيف", role: "detailer", pinCode: hashPin("2222") },
  });

  await prisma.bayCrewAssignment.createMany({
    data: [
      { bayId: bayA1.id, employeeId: washer1.id, shiftDate: new Date() },
      { bayId: bayA2.id, employeeId: washer2.id, shiftDate: new Date() },
    ],
  });

  const services = await Promise.all([
    prisma.service.create({
      data: { serviceName: "تعقيم بالضباب", basePrice: 25, suggestedTrigger: "small" },
    }),
    prisma.service.create({
      data: { serviceName: "واكس", basePrice: 40, suggestedTrigger: "medium" },
    }),
    prisma.service.create({
      data: { serviceName: "شامبو نانو", basePrice: 60, suggestedTrigger: "large" },
    }),
    prisma.service.create({ data: { serviceName: "تلميع إطارات", basePrice: 20 } }),
    prisma.service.create({ data: { serviceName: "تعطير داخلي", basePrice: 15 } }),
    prisma.service.create({ data: { serviceName: "تنظيف مقاعد الجلد", basePrice: 80 } }),
    prisma.service.create({ data: { serviceName: "غسيل محرك", basePrice: 50 } }),
    prisma.service.create({ data: { serviceName: "طلاء نانو سيراميك", basePrice: 250 } }),
  ]);

  const job = await prisma.jobOrder.create({
    data: {
      branchId: branchA.id,
      bayId: bayA1.id,
      plateNumber: "أ ب ج 1234",
      customerPhone: "0500000000",
      carType: "medium",
      status: "washing",
      isHighlyDirty: false,
    },
  });

  await prisma.qualityLog.create({
    data: {
      jobId: job.id,
      stage: "pre_wash_photos",
      photosJson: JSON.stringify([
        { url: "/uploads/photos/demo-front.jpg", angle: 1, takenAt: new Date().toISOString() },
        { url: "/uploads/photos/demo-back.jpg", angle: 2, takenAt: new Date().toISOString() },
        { url: "/uploads/photos/demo-left.jpg", angle: 3, takenAt: new Date().toISOString() },
        { url: "/uploads/photos/demo-right.jpg", angle: 4, takenAt: new Date().toISOString() },
      ]),
      inspectorId: supervisorA.id,
    },
  });

  await prisma.upsellingLog.create({
    data: { jobId: job.id, serviceId: services[1].id, status: "accepted", bonusAmount: 4, extraInvoiceNo: "INV-9001" },
  });

  await prisma.cleanlinessCheck.create({
    data: {
      branchId: branchA.id,
      supervisorId: supervisorA.id,
      dueAt: new Date(Date.now() + 4 * 60 * 60 * 1000),
    },
  });

  // جدول الصيانة الوقائية الدورية للمعدات (Preventive Maintenance)
  await prisma.maintenanceSchedule.createMany({
    data: [
      {
        branchId: branchA.id,
        equipmentName: "مضخة ضغط عالي - موقف 1",
        intervalDays: 30,
        lastPerformedAt: new Date(Date.now() - 35 * 24 * 60 * 60 * 1000),
        nextDueAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000), // متأخرة عمداً للعرض التجريبي
        notes: "فحص الزيوت والفلاتر",
      },
      {
        branchId: branchA.id,
        equipmentName: "ماكينة تلميع كهربائية",
        intervalDays: 60,
        lastPerformedAt: new Date(),
        nextDueAt: new Date(Date.now() + 45 * 24 * 60 * 60 * 1000),
      },
      {
        branchId: branchB.id,
        equipmentName: "خزان المياه المعالجة",
        intervalDays: 14,
        lastPerformedAt: new Date(Date.now() - 12 * 24 * 60 * 60 * 1000),
        nextDueAt: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
        notes: "تنظيف الفلاتر والتحقق من نسبة الكلور",
      },
    ],
  });

  console.log("✅ Seed complete.");
  console.log("   PIN تسجيل الدخول:");
  console.log(`   - مدير عام: فرع #${branchA.id} / PIN 9999`);
  console.log(`   - مشرف فرع الرياض: فرع #${branchA.id} / PIN 1234`);
  console.log(`   - مشرف فرع جدة: فرع #${branchB.id} / PIN 4321`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
