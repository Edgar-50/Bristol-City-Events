document.addEventListener("DOMContentLoaded", () => {

  /* ================= THEME ================= */
  const themeToggle = document.getElementById("theme-toggle");

  themeToggle.addEventListener("click", () => {
    document.body.classList.toggle("light");
    themeToggle.textContent =
      document.body.classList.contains("light") ? "🌙" : "☀️";
  });

  /* ================= AI CHAT ================= */
  const aiInput = document.getElementById("ai-input");
  const aiSend = document.getElementById("ai-send");
  const aiResponse = document.getElementById("ai-response");

  function addMessage(text, type = "ai") {
    const div = document.createElement("div");
    div.className = `ai-message ${type}`;
    div.textContent = text;
    aiResponse.appendChild(div);
    aiResponse.scrollTop = aiResponse.scrollHeight;
  }

  const responses = {
    greetings: ["Hello! 👋", "Hi there 😄"],
    mission: ["We empower local events 🎉"],
    vision: ["We build community 🌍"],
    fallback: ["Interesting 🤔", "Ask me something else!"]
  };

  function getAIResponse(input) {
    const q = input.toLowerCase();
    if (/hello|hi/.test(q)) return responses.greetings[Math.floor(Math.random()*2)];
    if (/mission/.test(q)) return responses.mission[0];
    if (/vision/.test(q)) return responses.vision[0];
    return responses.fallback[Math.floor(Math.random()*2)];
  }

  aiSend.addEventListener("click", () => {
    const q = aiInput.value.trim();
    if (!q) return;

    addMessage(q, "user");
    aiInput.value = "";

    setTimeout(() => {
      addMessage(getAIResponse(q), "ai");
    }, 600);
  });

  /* ================= CAROUSEL ================= */
  const container = document.getElementById("carousel-container");

  const events = [
    { title: "Jazz Night" },
    { title: "Food Fest" },
    { title: "AI Hackathon" }
  ];

  events.forEach(ev => {
    const div = document.createElement("div");
    div.className = "carousel-item";
    div.innerHTML = `<h4>${ev.title}</h4>`;
    container.appendChild(div);
  });

  /* ================= PARTICLES ================= */
  const canvas = document.getElementById("particles");
  const ctx = canvas.getContext("2d");

  function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  }

  resize();
  window.addEventListener("resize", resize);

  const particles = Array.from({ length: 80 }, () => ({
    x: Math.random() * canvas.width,
    y: Math.random() * canvas.height,
    vx: Math.random() - 0.5,
    vy: Math.random() - 0.5
  }));

  function animate() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    particles.forEach(p => {
      p.x += p.vx;
      p.y += p.vy;

      ctx.fillStyle = "#ff004c";
      ctx.fillRect(p.x, p.y, 2, 2);
    });

    requestAnimationFrame(animate);
  }

  animate();

  /* ================= BCE TYPING ================= */
  const desc = document.querySelector(".bce-description");

  const phrases = [
    "Founded by the patrons of Party 🎉",
    "Fun that brings the community together 😄",
    "Contribution that makes a difference 💖"
  ];

  let i = 0, j = 0;

  function type() {
    if (j < phrases[i].length) {
      desc.textContent += phrases[i][j++];
      setTimeout(type, 50);
    } else {
      setTimeout(erase, 1200);
    }
  }

  function erase() {
    if (j > 0) {
      desc.textContent = phrases[i].substring(0, --j);
      setTimeout(erase, 30);
    } else {
      i = (i + 1) % phrases.length;
      setTimeout(type, 300);
    }
  }

  type();
});