import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import { GoogleGenAI } from "@google/genai";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT) || 3000;

interface CoachRequestBody {
  question?: string;
  disaster?: "earthquake" | "flood" | "fire" | "general";
  runSummary?: {
    disaster: string;
    mode: string;
    victory: boolean;
    score: number;
    timeSurvived: number;
    safetyAccuracy: number;
    damageTaken: number;
    objectivesCompleted: number;
    totalObjectives: number;
    failureReason?: string;
    actionLog: string[];
  };
}

function buildOfflineCoachReply(body: CoachRequestBody): string {
  const { question, disaster = "general", runSummary } = body;

  if (runSummary) {
    const statusLine = runSummary.victory
      ? `You survived ${runSummary.disaster.toUpperCase()} in ${runSummary.timeSurvived.toFixed(1)}s with ${runSummary.safetyAccuracy}% safety accuracy.`
      : `Your ${runSummary.disaster.toUpperCase()} run ended early: ${runSummary.failureReason || "hazardous exposure"}.`;

    const disasterTips: Record<string, string[]> = {
      earthquake: [
        "Drop, Cover, and Hold On under a sturdy table or desk as soon as shaking starts.",
        "Stay away from windows, tall bookshelves, and exterior walls—glass and toppling furniture cause most indoor injuries.",
        "Wait until shaking stops before evacuating, shut off gas if safe, and clear debris carefully on your way out.",
      ],
      flood: [
        "Turn Around, Don't Drown: never walk or drive into moving floodwater—just 6 inches can knock an adult off their feet.",
        "Stay far clear of downed power lines and energized puddles around utility poles.",
        "Monitor official weather radio alerts and move promptly to designated higher ground or emergency shelters.",
      ],
      fire: [
        "Evacuate immediately when the fire alarm sounds; never use elevators during a fire.",
        "Stay low beneath toxic smoke where cooler, cleaner air remains near the floor.",
        "Check closed doors for heat before opening. If a door is hot or blocked, switch to an alternate stairwell exit.",
      ],
    };

    const tips = disasterTips[runSummary.disaster] || disasterTips.earthquake;
    return [
      statusLine,
      "",
      `Performance notes (${runSummary.objectivesCompleted}/${runSummary.totalObjectives} objectives, ${runSummary.damageTaken} damage taken):`,
      runSummary.damageTaken === 0
        ? "• Excellent hazard awareness—you avoided direct environmental injuries."
        : "• Watch environmental warning cues closely to minimize hazard exposure and protect your health.",
      "",
      "Key Preparedness Principles:",
      ...tips.map((t) => `• ${t}`),
    ].join("\n");
  }

  const q = (question || "").toLowerCase();
  if (q.includes("earthquake") || disaster === "earthquake") {
    return [
      "Earthquake Preparedness Guide:",
      "1. During shaking: Drop to your hands and knees, take Cover under a sturdy table or desk away from windows, and Hold On until shaking stops.",
      "2. Never run outside while the building is actively shaking—falling glass and exterior debris near doorways are major hazards.",
      "3. After shaking stops: Check for gas leaks, fallen power lines, and blocked exits, then evacuate carefully to an open assembly courtyard.",
    ].join("\n");
  }
  if (q.includes("flood") || disaster === "flood") {
    return [
      "Flash Flood Preparedness Guide:",
      "1. Listen to emergency radio/phone alerts early and gather a waterproof emergency kit before roads flood.",
      "2. Never drive or wade through floodwater. Water hides sharp debris, open drains, and swept-away pavement.",
      "3. Stay clear of utility poles and downed electrical lines—water conducts electricity over wide areas. Always move to higher ground.",
    ].join("\n");
  }
  if (q.includes("fire") || disaster === "fire") {
    return [
      "Building Fire Survival Guide:",
      "1. Pull the nearest fire alarm to alert everyone, then prioritize immediate evacuation over fighting large fires.",
      "2. Always take emergency stairs—never use elevators, which can trap occupants or fill with smoke.",
      "3. Stay low beneath smoke layers and feel closed doors with the back of your hand before opening; if hot, use an alternate exit.",
    ].join("\n");
  }

  return [
    "SURVIVE 60 Emergency Readiness Brief:",
    "• Earthquake: Drop, Cover, and Hold On under sturdy furniture until shaking stops, then evacuate to open ground.",
    "• Flood: Avoid floodwater and downed power lines completely; follow official warnings to higher ground.",
    "• Fire: Trigger the alarm, stay low under smoke, check doors before opening, use stairs (never elevators), and meet at the outdoor assembly point.",
  ].join("\n");
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: "256kb" }));

  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok", aiConfigured: Boolean(process.env.GEMINI_API_KEY) });
  });

  app.post("/api/coach", async (req, res) => {
    const body = (req.body || {}) as CoachRequestBody;
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      res.json({
        reply: buildOfflineCoachReply(body),
        source: "offline-guide",
      });
      return;
    }

    try {
      const ai = new GoogleGenAI({
        apiKey,
        httpOptions: {
          headers: {
            "User-Agent": "aistudio-build",
          },
        },
      });

      const systemInstruction = [
        "You are an expert Emergency Management & Disaster Preparedness Coach for the 2D survival game SURVIVE 60.",
        "Give clear, practical, scientifically accurate disaster safety advice based on FEMA, Red Cross, and NFPA protocols.",
        "Keep answers concise (under 180 words), structured with short bullet points, and directly tied to real-world actions (Earthquake: Drop, Cover, Hold On; Flood: Turn Around Don't Drown, electrical safety, high ground; Fire: Stay low, check doors, stairs not elevators, evacuate first).",
        "Never use markdown code blocks. Keep tone calm, supportive, and authoritative.",
      ].join(" ");

      let userPrompt = "";
      if (body.runSummary) {
        const s = body.runSummary;
        userPrompt = [
          `Debrief this player's ${s.disaster} run (${s.mode} mode):`,
          `Outcome: ${s.victory ? "SURVIVED" : "FAILED"} (${s.failureReason || "completed evacuation"})`,
          `Score: ${s.score}, Time: ${s.timeSurvived.toFixed(1)}s, Safety Accuracy: ${s.safetyAccuracy}%, Damage Taken: ${s.damageTaken}, Objectives: ${s.objectivesCompleted}/${s.totalObjectives}`,
          `Recorded player actions: ${s.actionLog.slice(-12).join(" | ") || "None recorded"}`,
          body.question ? `Player's specific question: ${body.question}` : "Provide a concise performance summary, what they did well, and 2 actionable safety improvements.",
        ].join("\n");
      } else {
        userPrompt = `Topic: ${body.disaster || "general"} preparedness. Question: ${body.question || "What are the most critical survival steps during the first 60 seconds?"}`;
      }

      const response = await ai.models.generateContent({
        model: "gemini-4-hydrogen",
        contents: userPrompt,
        config: {
          systemInstruction,
        },
      });

      const replyText = response.text?.trim();
      if (!replyText) {
        res.json({
          reply: buildOfflineCoachReply(body),
          source: "offline-guide",
        });
        return;
      }

      res.json({
        reply: replyText,
        source: "gemini",
      });
    } catch (error) {
      console.error("AI Coach fallback triggered:", error instanceof Error ? error.message : error);
      res.json({
        reply: buildOfflineCoachReply(body),
        source: "offline-guide",
      });
    }
  });

  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, "dist");
    app.use(express.static(distPath));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`SURVIVE 60 server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer();
