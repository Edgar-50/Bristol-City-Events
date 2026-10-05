document.addEventListener("DOMContentLoaded", () => {
  // === Flip between login/register ===
  const card = document.getElementById("card");
  const flipToRegister = document.getElementById("flipToRegister");
  const flipToLogin = document.getElementById("flipToLogin");

  if (flipToRegister && card) {
    flipToRegister.addEventListener("click", (e) => {
      e.preventDefault();
      card.classList.add("flip");
    });
  }

  if (flipToLogin && card) {
    flipToLogin.addEventListener("click", (e) => {
      e.preventDefault();
      card.classList.remove("flip");
    });
  }

  // === Theme Toggle ===
  const themeToggle = document.getElementById("themeToggle");
  const body = document.body;

  if (localStorage.getItem("theme") === "light") {
    body.classList.remove("dark");
    body.classList.add("light");
    themeToggle?.classList.add("active");
  }

  themeToggle?.addEventListener("click", () => {
    body.classList.toggle("light");
    body.classList.toggle("dark");
    themeToggle.classList.toggle("active");

    const isLight = body.classList.contains("light");
    localStorage.setItem("theme", isLight ? "light" : "dark");
  });

  // === Sound Toggle with Animated Equalizer ===
  const audio = document.getElementById("bgAudio");
  const soundToggle = document.getElementById("soundToggle");
  const soundIcon = soundToggle?.querySelector(".sound-icon");
  const soundTrack = soundToggle?.querySelector(".sound-track");
  const soundThumb = soundToggle?.querySelector(".sound-thumb");

  let playing = false;
  let eqInterval = null;

  function startEqualizer() {
    stopEqualizer();
    eqInterval = setInterval(() => {
      const glow = Math.floor(Math.random() * 40) + 20;
      const width = Math.floor(Math.random() * 40) + 20;
      if (soundTrack) {
        soundTrack.style.background = `linear-gradient(90deg, rgba(0,200,255,0.6) ${width}%, rgba(255,255,255,0.2) ${width}%)`;
      }
      if (soundThumb) {
        soundThumb.style.boxShadow = `0 0 ${glow / 2}px rgba(0,200,255,0.7)`;
      }
    }, 120);
  }

  function stopEqualizer() {
    clearInterval(eqInterval);
    eqInterval = null;
    if (soundTrack) {
      soundTrack.style.background = "rgba(255,255,255,0.25)";
    }
    if (soundThumb) {
      soundThumb.style.boxShadow = "";
    }
  }

  soundToggle?.addEventListener("click", async () => {
    soundToggle.classList.toggle("active");

    if (!playing) {
      try {
        await audio?.play();
        if (soundIcon) soundIcon.textContent = "🔊";
        playing = true;
        startEqualizer();
      } catch (error) {
        soundToggle.classList.remove("active");
      }
    } else {
      audio?.pause();
      if (soundIcon) soundIcon.textContent = "🔇";
      playing = false;
      stopEqualizer();
    }
  });

  // === Animated Canvas Background ===
  const canvas = document.getElementById("bg");
  const ctx = canvas?.getContext("2d");
  let w, h, t = 0;

  function resize() {
    if (!canvas) return;
    w = canvas.width = window.innerWidth;
    h = canvas.height = window.innerHeight;
  }

  if (canvas && ctx) {
    window.addEventListener("resize", resize);
    resize();

    function draw() {
      t += 0.01;

      const grad = ctx.createLinearGradient(0, 0, w, h);
      if (body.classList.contains("light")) {
        grad.addColorStop(0, "#c9d6ff");
        grad.addColorStop(1, "#e2e2e2");
      } else {
        grad.addColorStop(0, "#141e30");
        grad.addColorStop(1, "#243b55");
      }

      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);

      for (let i = 0; i < 3; i++) {
        ctx.beginPath();
        for (let x = 0; x < w; x += 10) {
          const y = Math.sin(x * 0.01 + t + i) * 20 + h / 2 + i * 50;
          ctx.lineTo(x, y);
        }

        ctx.strokeStyle = body.classList.contains("light")
          ? `rgba(100,100,255,0.${3 + i})`
          : `rgba(0,200,255,0.${3 + i})`;

        ctx.lineWidth = 2;
        ctx.stroke();
      }

      requestAnimationFrame(draw);
    }

    draw();
  }
});