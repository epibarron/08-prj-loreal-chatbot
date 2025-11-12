// Beginner-friendly chat script that sends requests to your Cloudflare Worker.
// Replace WORKER_URL with your deployed Worker URL (do NOT put API keys here).

/* DOM elements */
const chatForm = document.getElementById("chatForm");
const userInput = document.getElementById("userInput");
const chatWindow = document.getElementById("chatWindow");
const sendBtn = document.getElementById("sendBtn");

// Cloudflare Worker URL (replace with your published worker URL)
const WORKER_URL = "https://REPLACE_WITH_YOUR_WORKER_URL.workers.dev";

// Initial message
chatWindow.textContent = "👋 Hello! How can I help you today?";

/* Assistant behavior guidelines (system message) */
const assistantGuidelines = `
You are a helpful assistant that ONLY answers questions about L'Oréal products, routines, and recommendations. Stay strictly on-topic. Scope includes:
- Product details (names, ingredients, key benefits)
- Recommended skincare and haircare routines using L'Oréal products
- How to use products and application tips
- Suitability for common skin/hair types
- Where to buy or find official L'Oréal information

If a question is outside this scope, reply exactly:
"Sorry — I can only answer questions about L'Oréal products, routines, and recommendations."
`.trim();

/* Helper: append a message to the chat window */
function appendMessage(role, text) {
  const msgDiv = document.createElement("div");
  msgDiv.className = `msg ${role}`;
  msgDiv.textContent = text;
  chatWindow.appendChild(msgDiv);
  chatWindow.scrollTop = chatWindow.scrollHeight;
}

/* Helper: show temporary "thinking" indicator and return a remover */
function showThinking() {
  const thinking = document.createElement("div");
  thinking.className = "msg ai";
  thinking.textContent = "…thinking";
  chatWindow.appendChild(thinking);
  chatWindow.scrollTop = chatWindow.scrollHeight;
  return () => thinking.remove();
}

/* Helper: display the latest question above the assistant reply.
   This element is removed/resetted on each new question. */
function showLatestQuestion(questionText) {
  // Remove existing latest-question if present
  const existing = chatWindow.querySelector(".latest-question");
  if (existing) existing.remove();

  const q = document.createElement("div");
  q.className = "latest-question";
  q.textContent = `Question: ${questionText}`;
  // Insert at the end so it appears just before assistant reply when we append it
  chatWindow.appendChild(q);
  chatWindow.scrollTop = chatWindow.scrollHeight;
}

/* Main: send messages to Cloudflare Worker which proxies OpenAI */
async function getChatbotReply(userText) {
  if (!WORKER_URL || WORKER_URL.includes("REPLACE_WITH_YOUR_WORKER_URL")) {
    throw new Error(
      "WORKER_URL not configured. Replace WORKER_URL with your deployed Cloudflare Worker URL."
    );
  }

  // Build messages array: system (guidelines) + user
  const messages = [
    { role: "system", content: assistantGuidelines },
    { role: "user", content: userText },
  ];

  // Send to Worker (Worker calls OpenAI using a secure secret)
  const resp = await fetch(WORKER_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ messages }),
  });

  if (!resp.ok) {
    const errText = await resp.text();
    throw new Error(`Worker error: ${resp.status} ${errText}`);
  }

  const data = await resp.json();

  // Follow workspace instructions: read data.choices[0].message.content
  const content =
    data &&
    data.choices &&
    data.choices[0] &&
    data.choices[0].message &&
    data.choices[0].message.content;

  if (!content) {
    throw new Error("No content returned from Worker / OpenAI.");
  }

  return content;
}

/* Handle form submit: capture input, show user message, call API, display latest question + reply */
chatForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const text = userInput.value.trim();
  if (!text) return;

  // Show the user's chat bubble (keeps history)
  appendMessage("user", `You: ${text}`);

  // Clear input and disable UI while waiting
  userInput.value = "";
  userInput.disabled = true;
  sendBtn.disabled = true;

  // Show thinking indicator
  const removeThinking = showThinking();

  try {
    // Call Worker for assistant reply
    const reply = await getChatbotReply(text);

    // Remove thinking indicator
    removeThinking();

    // Display the latest question just above the assistant reply (resets each time)
    showLatestQuestion(text);

    // Display assistant reply
    appendMessage("ai", reply);
  } catch (err) {
    removeThinking();
    appendMessage("ai", `Error: ${err.message}`);
    console.error(err);
  } finally {
    userInput.disabled = false;
    sendBtn.disabled = false;
    userInput.focus();
  }
});
