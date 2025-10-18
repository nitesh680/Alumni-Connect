const express = require("express");
const { askAgent, getAgentUser } = require("../controllers/agentController");
const { protect } = require("../middleware/authMiddleware");

const router = express.Router();

// Ask the AI agent a question within a chat
router.post("/ask", protect, askAgent);

// Ensure and return the agent user (for creating a 1:1 chat from UI)
router.get("/user", protect, getAgentUser);

module.exports = router;
