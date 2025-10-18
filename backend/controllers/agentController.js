const asyncHandler = require("express-async-handler");
const Message = require("../models/messageModel");
const User = require("../models/userModel");
const Chat = require("../models/chatModel");

// Lazy import to avoid hard crash if package not installed yet
let GoogleGenerativeAI;
try {
  GoogleGenerativeAI = require("@google/generative-ai").GoogleGenerativeAI;
} catch (e) {
  GoogleGenerativeAI = null;
}

const AGENT_NAME = "Alumni Agent";
const AGENT_EMAIL = "agent@system";

async function ensureAgentUser() {
  let agent = await User.findOne({ email: AGENT_EMAIL });
  if (!agent) {
    agent = await User.create({
      name: AGENT_NAME,
      email: AGENT_EMAIL,
      company: "AlumniConnect",
      year: 0,
      resume: "",
      // Random strong password; it will be hashed by pre-save
      password: Math.random().toString(36) + "!Agent#2024",
      pic: "https://icon-library.com/images/robot-icon/robot-icon-18.jpg",
      isAdmin: false,
    });
  }
  return agent;
}

// GET /api/agent/user -> ensure and return the agent user
const getAgentUser = asyncHandler(async (req, res) => {
  const agent = await ensureAgentUser();
  res.json({ _id: agent._id, name: agent.name, email: agent.email, pic: agent.pic });
});

// POST /api/agent/ask
// body: { chatId: string, prompt: string }
const askAgent = asyncHandler(async (req, res) => {
  const { chatId, prompt } = req.body || {};
  if (!chatId || !prompt) {
    return res.status(400).json({ message: "chatId and prompt are required" });
  }

  if (!GoogleGenerativeAI) {
    return res.status(500).json({
      message:
        "@google/generative-ai is not installed. Please run `npm i @google/generative-ai` in the backend and set GOOGLE_API_KEY in your environment.",
    });
  }

  const apiKey = process.env.GOOGLE_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ message: "GOOGLE_API_KEY is not set" });
  }

  const agentUser = await ensureAgentUser();

  // Optional: ensure the chat exists and includes the agent
  const chat = await Chat.findById(chatId).populate("users", "name email pic");
  if (!chat) return res.status(404).json({ message: "Chat not found" });

  // If agent is not part of the chat, you can choose to add them or block
  const agentInChat = chat.users.some((u) => String(u._id) === String(agentUser._id));
  if (!agentInChat) {
    // add agent to the chat if it's a group OR allow 1:1 by using accessChat route from UI
    chat.users.push(agentUser._id);
    await chat.save();
  }

  // Call Gemini (with model fallback)
  const genAI = new GoogleGenerativeAI(apiKey);
  const primaryModelName = process.env.GEMINI_MODEL || "gemini-1.5-pro-latest";
  // In case certain aliases are not available for your key/region, try these fallbacks
  const fallbackModels = [
    "gemini-1.5-flash-8b",
    "gemini-1.5-flash",
    "gemini-1.0-pro",
  ];
  let aiText = "";
  async function runWithModel(modelName) {
    const model = genAI.getGenerativeModel({ model: modelName });
    const result = await model.generateContent(prompt);
    const response = result && result.response;
    let text = "";
    if (response && typeof response.text === "function") {
      text = response.text();
    } else if (response && response.candidates && response.candidates[0]?.content?.parts?.length) {
      text = String(response.candidates[0].content.parts.map((p) => p.text || "").join("\n")).trim();
    }
    return text || "I couldn't generate a response right now.";
  }

  try {
    const modelsToTry = [primaryModelName, ...fallbackModels];
    let lastErr = null;
    for (const m of modelsToTry) {
      try {
        aiText = await runWithModel(m);
        if (aiText) {
          lastErr = null;
          break;
        }
      } catch (e) {
        lastErr = e;
        const msg = String(e?.message || "");
        const is404 = msg.includes("404") || msg.includes("Not Found");
        if (!is404) {
          // non-404 errors should bubble up
          throw e;
        }
        // else continue to next model
      }
    }
    if (!aiText) {
      // Detect available models via ListModels (v1) and pick one supporting generateContent
      const listUrl = `https://generativelanguage.googleapis.com/v1/models?key=${apiKey}`;
      const listResp = await fetch(listUrl);
      if (listResp.ok) {
        const listJson = await listResp.json();
        const models = Array.isArray(listJson?.models) ? listJson.models : [];
        // Prefer latest 1.5 pro/flash, then any supporting generateContent
        const preferredOrder = [
          /gemini-1\.5-pro.*latest/i,
          /gemini-1\.5-flash.*latest/i,
          /gemini-1\.5-pro/i,
          /gemini-1\.5-flash/i,
          /gemini-1\.0-pro/i,
        ];
        const genCapable = models.filter((m) =>
          Array.isArray(m.supportedGenerationMethods) && m.supportedGenerationMethods.includes("generateContent")
        );
        let chosen = null;
        for (const re of preferredOrder) {
          chosen = genCapable.find((m) => re.test(m.name));
          if (chosen) break;
        }
        if (!chosen && genCapable.length) chosen = genCapable[0];
        if (chosen) {
          // Use REST v1 generateContent with the chosen model
          const url = `https://generativelanguage.googleapis.com/v1/${chosen.name}:generateContent?key=${apiKey}`;
          const resp = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ contents: [{ role: "user", parts: [{ text: String(prompt) }] }] }),
          });
          if (!resp.ok) {
            const t = await resp.text();
            throw new Error(`REST ${chosen.name} ${resp.status}: ${t}`);
          }
          const json = await resp.json();
          const parts = json?.candidates?.[0]?.content?.parts;
          aiText = Array.isArray(parts) ? parts.map((p) => p?.text || "").join("\n").trim() : "";
        }
      }
      if (!aiText && lastErr) throw lastErr;
    }
  } catch (err) {
    console.error("Gemini error:", err?.response?.data || err?.message || err);
    return res.status(500).json({ message: `Gemini error: ${err?.message || 'unknown error'}` });
  }

  // Create bot message
  let botMessage = await Message.create({
    sender: agentUser._id,
    content: aiText,
    chat: chatId,
  });

  botMessage = await botMessage.populate("sender", "name pic").execPopulate();
  botMessage = await botMessage.populate("chat").execPopulate();
  botMessage = await User.populate(botMessage, {
    path: "chat.users",
    select: "name pic email",
  });

  await Chat.findByIdAndUpdate(chatId, { latestMessage: botMessage });

  return res.json(botMessage);
});

module.exports = { askAgent, getAgentUser };
