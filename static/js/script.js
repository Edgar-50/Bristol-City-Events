document.addEventListener("DOMContentLoaded", () => {
  // === Horizontal Scrollable Carousel ===
  const carousel = document.getElementById("carousel");
  let isDown = false;
  let startX = 0;
  let scrollLeft = 0;

  if (carousel) {
    carousel.addEventListener("mousedown", (e) => {
      isDown = true;
      carousel.classList.add("active");
      startX = e.pageX - carousel.offsetLeft;
      scrollLeft = carousel.scrollLeft;
    });

    carousel.addEventListener("mouseleave", () => {
      isDown = false;
      carousel.classList.remove("active");
    });

    carousel.addEventListener("mouseup", () => {
      isDown = false;
      carousel.classList.remove("active");
    });

    carousel.addEventListener("mousemove", (e) => {
      if (!isDown) return;
      e.preventDefault();
      const x = e.pageX - carousel.offsetLeft;
      const walk = (x - startX) * 2;
      carousel.scrollLeft = scrollLeft - walk;
    });

    function autoScroll() {
      carousel.scrollBy({ left: 2, behavior: "smooth" });
      if (carousel.scrollLeft + carousel.clientWidth >= carousel.scrollWidth) {
        carousel.scrollLeft = 0;
      }
    }

    setInterval(autoScroll, 40);
  }

  // === Login Modal ===
  const modal = document.getElementById("auth-modal");
  const btn = document.getElementById("login-btn");
  const close = document.querySelector(".close");

  if (btn) {
    btn.addEventListener("click", () => {
      // For now redirect to login page instead of modal
      window.location.href = "/login";
    });
  }

  if (close && modal) {
    close.addEventListener("click", () => {
      modal.style.display = "none";
    });

    window.addEventListener("click", (e) => {
      if (e.target === modal) modal.style.display = "none";
    });
  }

  // === Dark / Light Mode Toggle ===
  const toggle = document.getElementById("theme-toggle");
  const body = document.body;

  if (toggle) {
    let savedTheme = localStorage.getItem("theme");

    if (!savedTheme) {
      savedTheme = window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
      localStorage.setItem("theme", savedTheme);
    }

    body.classList.toggle("dark", savedTheme === "dark");
    body.classList.toggle("light", savedTheme === "light");
    toggle.textContent = savedTheme === "light" ? "🌞" : "🌙";

    toggle.addEventListener("click", () => {
      const isLight = body.classList.contains("light");
      body.classList.toggle("light", !isLight);
      body.classList.toggle("dark", isLight);

      const newTheme = isLight ? "dark" : "light";
      toggle.textContent = newTheme === "light" ? "🌞" : "🌙";
      localStorage.setItem("theme", newTheme);
    });
  }

  // === Smooth Scroll ===
  const scrollDown = document.querySelector(".scroll-down");
  if (scrollDown) {
    scrollDown.addEventListener("click", () => {
      document.querySelector(".carousel-section")?.scrollIntoView({ behavior: "smooth" });
    });
  }

  // === Modal Form Placeholder ===
  const authForm = modal?.querySelector("form");
  if (authForm) {
    authForm.addEventListener("submit", (e) => {
      e.preventDefault();
      alert("Demo login successful ✅");
      modal.style.display = "none";
    });
  }

  // === Pill Indicator ===
  const pills = document.querySelectorAll(".pill");
  const pillList = document.querySelector(".pill-list");

  if (pillList && pills.length > 0) {
    const indicator = document.createElement("div");
    indicator.classList.add("pill-indicator");
    pillList.appendChild(indicator);

    function moveIndicator(el) {
      indicator.style.left = el.offsetLeft + "px";
      indicator.style.width = el.offsetWidth + "px";
    }

    pills.forEach((p) => {
      p.addEventListener("click", () => {
        pills.forEach((x) => x.classList.remove("active"));
        p.classList.add("active");
        moveIndicator(p);
      });
    });

    const active = document.querySelector(".pill.active");
    if (active) moveIndicator(active);
  }

  // === Chart ===
  const chartCanvas = document.getElementById("attendanceChart");
  if (chartCanvas) {
    const ctx = chartCanvas.getContext("2d");

    new Chart(ctx, {
      type: "bar",
      data: {
        labels: [
          "Harbour Festival",
          "St Paul's Carnival",
          "Balloon Fiesta",
          "Street Art Tour",
          "Winter Market"
        ],
        datasets: [{
          label: "Attendees",
          data: [5000, 3000, 7000, 2500, 4000],
          backgroundColor: "rgba(230, 57, 70, 0.7)",
          borderColor: "rgba(230, 57, 70, 1)",
          borderWidth: 1
        }]
      },
      options: {
        responsive: true,
        plugins: {
          legend: { display: false },
          title: {
            display: true,
            text: "Event Attendance in 2025",
            font: { size: 18 }
          }
        },
        scales: {
          y: {
            beginAtZero: true
          }
        }
      }
    });
  }
});