document.addEventListener("DOMContentLoaded", () => {
  
  const hero = document.querySelector(".hero-bg");
  const canvas = document.createElement("canvas");
  hero.appendChild(canvas);
  const ctx = canvas.getContext("2d");

  let w, h;

  function resizeCanvas() {
    w = canvas.width = hero.offsetWidth;
    h = canvas.height = hero.offsetHeight;
  }

  window.addEventListener("resize", resizeCanvas);
  resizeCanvas();

  const particles = [];
  const colors = ["#ff0080", "#ff66aa", "#ffccff"];

  for (let i = 0; i < 80; i++) {
    particles.push({
      x: Math.random() * w,
      y: Math.random() * h,
      r: Math.random() * 3 + 1,
      dx: (Math.random() - 0.5) * 0.7,
      dy: (Math.random() - 0.5) * 0.7,
      color: colors[Math.floor(Math.random() * colors.length)]
    });
  }

  function animateParticles() {
    ctx.clearRect(0, 0, w, h);

    particles.forEach((p) => {
      p.x += p.dx;
      p.y += p.dy;

      if (p.x < 0 || p.x > w) p.dx *= -1;
      if (p.y < 0 || p.y > h) p.dy *= -1;

      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fillStyle = p.color;
      ctx.fill();
    });

    requestAnimationFrame(animateParticles);
  }

  animateParticles();

  
  const themeToggle = document.getElementById("theme-toggle");
  themeToggle.addEventListener("click", () => {
    document.body.classList.toggle("light");
  });

  
  const aiInput = document.getElementById("ai-input");
  const aiSend = document.getElementById("ai-send");
  const aiResponse = document.getElementById("ai-response");

  const mockResponses = [
    "Hello! How can I assist you today?",
    "We have many events happening this month in Bristol!",
    "Feel free to ask about ticket info or schedules.",
    "Thanks for reaching out! Our team will reply shortly.",
    "Bristol City Events is your hub for local happenings!"
  ];

  function addMessage(message, sender) {
    const msg = document.createElement("div");
    msg.classList.add("ai-message", sender);
    msg.textContent = message;
    aiResponse.appendChild(msg);
    aiResponse.scrollTop = aiResponse.scrollHeight;
  }

  function sendMessage() {
    const text = aiInput.value.trim();
    if (!text) return;

    addMessage(text, "user");
    aiInput.value = "";

    setTimeout(() => {
      const botReply = mockResponses[Math.floor(Math.random() * mockResponses.length)];
      addMessage(botReply, "bot");
    }, 800);
  }

  aiSend.addEventListener("click", sendMessage);

  aiInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  });
});