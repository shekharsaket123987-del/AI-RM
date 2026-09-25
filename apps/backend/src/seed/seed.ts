import "dotenv/config";
import { PrismaClient as SourcePrismaClient } from "../generated/sourceClient/index.js";
import { PrismaClient as AiZonePrismaClient } from "../generated/aizoneClient/index.js";

// This is the ONLY place in the app allowed to write to the source DB — it
// stands in for a human updating Google Sheets (PRD section 21). Everywhere
// else, source data is read-only (see src/db/sourceDb.ts).
const source = new SourcePrismaClient();
const aizone = new AiZonePrismaClient();

const DAY = 24 * 60 * 60 * 1000;
const now = Date.now();
const daysAgo = (n: number) => new Date(now - n * DAY);
const daysFromNow = (n: number) => new Date(now + n * DAY);

async function main() {
  console.log("Clearing existing data...");
  await source.appointment.deleteMany();
  await source.feedback.deleteMany();
  await source.followup.deleteMany();
  await source.diet.deleteMany();
  await source.dietitianAssignment.deleteMany();
  await source.counselling.deleteMany();
  await source.plan.deleteMany();
  await source.client.deleteMany();
  await aizone.kbEntry.deleteMany();
  await aizone.escalation.deleteMany();
  await aizone.memoryNote.deleteMany();
  await aizone.conversation.deleteMany();
  await aizone.buddyFeedback.deleteMany();
  await aizone.takeoverState.deleteMany();
  await aizone.auditLog.deleteMany();

  console.log("Seeding clients (personas from PRD section 6)...");

  // 1. Priya — new client, onboarding (PRD scenarios 1, 4)
  await source.client.create({
    data: {
      id: "FT-10001",
      name: "Priya Verma",
      phone: "+919810000001",
      age: 29,
      profession: "IT professional",
      location: "Gurgaon",
      clientType: "new",
      plan: {
        create: {
          planName: "3-month Weight Loss",
          startDate: daysAgo(2),
          endDate: daysFromNow(88),
          status: "active",
          paymentStatus: "paid",
        },
      },
      counselling: {
        create: { status: "booked", scheduledAt: daysFromNow(2) },
      },
    },
  });

  // 2. Madan — struggling / travels for work; missed follow-up (scenario 38)
  const madan = await source.client.create({
    data: {
      id: "FT-10482",
      name: "Madan Sharma",
      phone: "+919810000002",
      age: 41,
      profession: "Sales, frequent travel",
      location: "Mumbai",
      clientType: "new",
      plan: {
        create: {
          planName: "3-month Weight Loss",
          startDate: daysAgo(35),
          endDate: daysFromNow(55),
          status: "active",
          paymentStatus: "paid",
        },
      },
      counselling: {
        create: {
          status: "completed",
          completedAt: daysAgo(35),
          lifestyle: "Desk job with heavy travel, office canteen at lunch",
          goals: "Lose 8kg before December",
          preferences: "Vegetarian",
          allergies: "None",
        },
      },
      dietitianAssignment: { create: { dietitianName: "Dt. Neha" } },
    },
  });
  await source.diet.create({
    data: {
      clientId: madan.id,
      week: 5,
      isCurrent: true,
      publishedDate: daysAgo(7),
      content: "Breakfast: 2 eggs + 1 multigrain toast. Lunch: 2 rotis + dal + sabzi + salad. " +
        "Snack: roasted chana. Dinner: 1 katori rice + paneer curry + vegetables.",
    },
  });
  await source.followup.createMany({
    data: [
      { clientId: madan.id, date: daysAgo(28), status: "completed", weightKg: 88.4, adherencePct: 75, notes: "Good start, finds office lunch hard", nextFocus: "Meal prep for lunch" },
      { clientId: madan.id, date: daysAgo(21), status: "completed", weightKg: 87.1, adherencePct: 70, notes: "Travelling next week, adherence dropped slightly", nextFocus: "Travel-friendly meal tips" },
      { clientId: madan.id, date: daysAgo(14), status: "completed", weightKg: 87.0, adherencePct: 60, notes: "Struggling with adherence, lunch difficult at office", nextFocus: "Simplify lunch options" },
      // Missed follow-up: call 1 + call 2 unanswered, continuation diet uploaded (scenario 38)
      { clientId: madan.id, date: daysAgo(7), status: "missed", notes: "Call 1 and call 2 unanswered" },
      { clientId: madan.id, date: daysFromNow(2), status: "scheduled" },
    ],
  });
  await source.feedback.create({ data: { clientId: madan.id, rating: 3, comment: "It's okay, hard to keep up while travelling", date: daysAgo(21) } });

  // 3. Ankit — highly motivated, marathon training, excellent progress (scenarios 14, 35)
  const ankit = await source.client.create({
    data: {
      id: "FT-10203",
      name: "Ankit Rao",
      phone: "+919810000003",
      age: 26,
      profession: "Software engineer",
      location: "Bangalore",
      clientType: "new",
      plan: { create: { planName: "6-month Fitness", startDate: daysAgo(60), endDate: daysFromNow(120), status: "active", paymentStatus: "paid" } },
      counselling: {
        create: {
          status: "completed",
          completedAt: daysAgo(60),
          lifestyle: "Trains 5x/week, preparing for a marathon",
          goals: "Improve endurance and lean out for race day",
          preferences: "Non-vegetarian, high protein",
          allergies: "None",
        },
      },
      dietitianAssignment: { create: { dietitianName: "Dt. Priya" } },
    },
  });
  await source.diet.create({
    data: { clientId: ankit.id, week: 8, isCurrent: true, publishedDate: daysAgo(7), content: "High-protein plan: eggs, chicken, dal, brown rice, extra hydration on training days." },
  });
  await source.followup.createMany({
    data: [
      { clientId: ankit.id, date: daysAgo(49), status: "completed", weightKg: 78.0, adherencePct: 95, notes: "Excellent adherence, training hard", nextFocus: "Increase protein slightly" },
      { clientId: ankit.id, date: daysAgo(35), status: "completed", weightKg: 76.5, adherencePct: 95, notes: "Great progress, high energy", nextFocus: "Maintain" },
      { clientId: ankit.id, date: daysAgo(21), status: "completed", weightKg: 75.6, adherencePct: 92, notes: "Marathon in December, on track", nextFocus: "Carb timing around long runs" },
      { clientId: ankit.id, date: daysAgo(7), status: "completed", weightKg: 74.8, adherencePct: 96, notes: "Best week yet", nextFocus: "Race-week nutrition" },
      { clientId: ankit.id, date: daysFromNow(6), status: "scheduled" },
    ],
  });
  await source.feedback.create({ data: { clientId: ankit.id, rating: 5, comment: "Loving the plan and the support", date: daysAgo(7) } });

  // 4. Sunita — on BP medication, restricted medical fields (scenarios 20, 21)
  const sunita = await source.client.create({
    data: {
      id: "FT-10077",
      name: "Sunita Iyer",
      phone: "+919810000004",
      age: 52,
      profession: "Homemaker",
      location: "Chennai",
      clientType: "new",
      plan: { create: { planName: "3-month Weight Loss", startDate: daysAgo(20), endDate: daysFromNow(70), status: "active", paymentStatus: "paid" } },
      counselling: {
        create: {
          status: "completed",
          completedAt: daysAgo(20),
          lifestyle: "Mostly sedentary, evening walks",
          goals: "Lose weight safely, manage blood pressure",
          preferences: "Vegetarian, low sodium",
          allergies: "None",
          medicalHistory: "Hypertension, diagnosed 3 years ago",
          medication: "Amlodipine 5mg once daily",
        },
      },
      dietitianAssignment: { create: { dietitianName: "Dt. Kavya" } },
    },
  });
  await source.diet.create({
    data: { clientId: sunita.id, week: 3, isCurrent: true, publishedDate: daysAgo(7), content: "Low-sodium meals: idli/dosa without pickle, dal, steamed vegetables, fruit for snacks." },
  });
  await source.followup.createMany({
    data: [
      { clientId: sunita.id, date: daysAgo(13), status: "completed", weightKg: 74.2, adherencePct: 80, notes: "Adjusting well to low-sodium meals", nextFocus: "Watch hidden salt in snacks" },
      { clientId: sunita.id, date: daysAgo(6), status: "completed", weightKg: 73.6, adherencePct: 85, notes: "Feeling good, BP stable per her report", nextFocus: "Continue" },
      { clientId: sunita.id, date: daysFromNow(1), status: "scheduled" },
    ],
  });

  // 5. Anjali — renewal client (scenario 2)
  const anjali = await source.client.create({
    data: {
      id: "FT-9911",
      name: "Anjali Mehta",
      phone: "+919810000005",
      age: 35,
      profession: "Marketing manager",
      location: "Pune",
      clientType: "renewal",
      plan: { create: { planName: "3-month Maintenance (renewal)", startDate: daysAgo(5), endDate: daysFromNow(85), status: "active", paymentStatus: "paid" } },
      counselling: {
        create: {
          status: "completed",
          completedAt: daysAgo(5),
          lifestyle: "Active, gym 3x/week",
          goals: "Maintain weight loss from last plan, build muscle",
          preferences: "Vegetarian",
          allergies: "Lactose sensitivity",
        },
      },
      dietitianAssignment: { create: { dietitianName: "Dt. Neha" } },
    },
  });
  await source.diet.create({
    data: { clientId: anjali.id, week: 1, isCurrent: true, publishedDate: daysAgo(4), content: "Maintenance plan: balanced macros, lactose-free dairy alternatives, protein at every meal." },
  });
  await source.followup.createMany({
    data: [
      { clientId: anjali.id, date: daysAgo(60), status: "completed", weightKg: 82.0, adherencePct: 88, notes: "(Previous plan) Round one — going well" },
      { clientId: anjali.id, date: daysAgo(30), status: "completed", weightKg: 77.0, adherencePct: 90, notes: "(Previous plan) Hit her goal weight" },
      { clientId: anjali.id, date: daysFromNow(4), status: "scheduled" },
    ],
  });

  // 6. Rohit — plateau (scenario 13)
  const rohit = await source.client.create({
    data: {
      id: "FT-10555",
      name: "Rohit Nair",
      phone: "+919810000006",
      age: 33,
      profession: "Teacher",
      location: "Kochi",
      clientType: "new",
      plan: { create: { planName: "3-month Weight Loss", startDate: daysAgo(45), endDate: daysFromNow(45), status: "active", paymentStatus: "paid" } },
      counselling: {
        create: {
          status: "completed",
          completedAt: daysAgo(45),
          lifestyle: "Sedentary, long teaching hours",
          goals: "Lose 6kg",
          preferences: "Vegetarian",
          allergies: "None",
        },
      },
      dietitianAssignment: { create: { dietitianName: "Dt. Kavya" } },
    },
  });
  await source.diet.create({
    data: { clientId: rohit.id, week: 6, isCurrent: true, publishedDate: daysAgo(7), content: "Calorie-controlled vegetarian plan, 3 meals + 1 snack." },
  });
  await source.followup.createMany({
    data: [
      { clientId: rohit.id, date: daysAgo(35), status: "completed", weightKg: 84.0, adherencePct: 85, notes: "Good early progress", nextFocus: "Keep it up" },
      { clientId: rohit.id, date: daysAgo(21), status: "completed", weightKg: 82.5, adherencePct: 82, notes: "Steady", nextFocus: "Continue" },
      { clientId: rohit.id, date: daysAgo(14), status: "completed", weightKg: 82.4, adherencePct: 80, notes: "Weight holding steady, adherence still good", nextFocus: "Review activity level" },
      { clientId: rohit.id, date: daysAgo(7), status: "completed", weightKg: 82.3, adherencePct: 78, notes: "Plateaued for 3 weeks, client frustrated", nextFocus: "Dietitian to review at next follow-up" },
      { clientId: rohit.id, date: daysFromNow(3), status: "scheduled" },
    ],
  });
  await source.feedback.create({ data: { clientId: rohit.id, rating: 2, comment: "Not seeing results anymore", date: daysAgo(7) } });

  console.log("Seeding knowledge base (PRD section 14 categories)...");
  await aizone.kbEntry.createMany({
    data: [
      { category: "Fitelo FAQs", question: "What does my plan include?", answer: "Your plan includes a personalised diet from your dietitian, weekly follow-ups, and progress tracking in the app.", owner: "Ops" },
      { category: "Fitelo FAQs", question: "How do I reach support?", answer: "You can message here anytime, or reach our support team in the Fitelo app under Help.", owner: "Ops" },
      { category: "Plan information", question: "How long does my plan last?", answer: "Plan durations range from 3 to 6 months depending on what you signed up for — check the app under My Plan for your exact dates.", owner: "Ops" },
      { category: "Plan information", question: "How often are follow-ups?", answer: "Follow-ups happen roughly once a week with your dietitian.", owner: "Ops" },
      { category: "Counselling and follow-up process", question: "How do I book a counselling session?", answer: "Open the Fitelo app, go to Appointments, and pick a slot that works for you.", owner: "Ops" },
      { category: "Counselling and follow-up process", question: "What should I prepare before counselling?", answer: "Keep your recent routine, meal timings and any reports handy so your dietitian can personalise your plan.", owner: "Ops" },
      { category: "App information", question: "Where can I find my diet?", answer: "Open the Fitelo app and go to the Plans tab — your current week's diet is there.", owner: "Tech / support" },
      { category: "App information", question: "How do I log in?", answer: "Use the phone number registered with Fitelo to log into the app; you'll get an OTP.", owner: "Tech / support" },
      { category: "App information", question: "Where is my progress graph?", answer: "Your weight and progress graph is under the Progress tab in the app.", owner: "Tech / support" },
      { category: "App information", question: "The app isn't loading, what do I do?", answer: "Try force-closing and reopening the app, or reinstalling it. If that doesn't work, let me know and I'll flag it for tech support.", owner: "Tech / support" },
      { category: "PT information", question: "What does PT include?", answer: "Personal training includes tailored workout plans and coaching alongside your diet plan.", owner: "Sales / PT" },
      { category: "General food education", question: "How much rice is a normal portion?", answer: "A standard portion is about 1 katori (roughly 150g cooked), but always follow the exact quantity in your own diet plan.", owner: "Head dietitian" },
      { category: "General food education", question: "How much water should I drink daily?", answer: "Most adults do well with 2.5-3 litres a day, more on hot or active days, unless your dietitian has advised otherwise.", owner: "Head dietitian" },
      { category: "General food education", question: "What are good protein sources for vegetarians?", answer: "Dal, paneer, curd, soya chunks, and sprouts are all good vegetarian protein sources.", owner: "Head dietitian" },
      { category: "General food education", question: "How do I read a nutrition label?", answer: "Check serving size first, then look at calories, protein, sugar and sodium per serving to compare products fairly.", owner: "Head dietitian" },
      { category: "Healthy lifestyle education", question: "How can I sleep better?", answer: "Keeping a consistent sleep/wake time, dimming screens an hour before bed, and avoiding heavy meals late at night all help sleep quality.", owner: "Head dietitian" },
      { category: "Healthy lifestyle education", question: "How do I manage everyday stress?", answer: "Short walks, deep breathing for a few minutes, and regular sleep all help with everyday stress — for anything ongoing, it's worth mentioning to your dietitian too.", owner: "Head dietitian" },
      { category: "Healthy lifestyle education", question: "How much should I walk daily?", answer: "Aiming for 6,000-8,000 steps a day is a good general target, adjusted to your fitness level and plan.", owner: "Head dietitian" },
    ],
  });

  console.log("Seed complete.");
  console.log("Seeded clients:");
  console.log("  Priya Verma   +919810000001  (new / onboarding)");
  console.log("  Madan Sharma  +919810000002  (struggling / missed follow-up)");
  console.log("  Ankit Rao     +919810000003  (highly motivated)");
  console.log("  Sunita Iyer   +919810000004  (medical / medication on file)");
  console.log("  Anjali Mehta  +919810000005  (renewal)");
  console.log("  Rohit Nair    +919810000006  (plateau)");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await source.$disconnect();
    await aizone.$disconnect();
  });
