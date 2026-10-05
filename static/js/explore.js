document.addEventListener("DOMContentLoaded", () => {
  /* ------------------- THEME TOGGLE ------------------- */
  const themeToggle = document.getElementById("theme-toggle");
  themeToggle?.addEventListener("click", () => {
    document.body.classList.toggle("dark");
    themeToggle.classList.add("clicked");
    setTimeout(() => themeToggle.classList.remove("clicked"), 300);
  });

  /* ------------------- RANDOM FACTS ------------------- */
  const facts = [
    "Bristol has over 1,600 hours of sunshine annually.",
    "Clifton Suspension Bridge opened in 1864.",
    "SS Great Britain was the first iron steamship to cross the Atlantic.",
    "Bristol is famous for street art and graffiti."
  ];

  const factText = document.getElementById("fact-text");
  const newFactBtn = document.getElementById("new-fact-btn");

  function showFact() {
    if (!factText) return;
    factText.textContent = "";
    const fact = facts[Math.floor(Math.random() * facts.length)];
    let i = 0;

    const type = setInterval(() => {
      factText.textContent += fact[i++];
      if (i >= fact.length) clearInterval(type);
    }, 30);
  }

  showFact();
  newFactBtn?.addEventListener("click", showFact);
  setInterval(showFact, 15000);

  /* ------------------- WEATHER ------------------- */
  (async function loadWeather() {
    const lat = 51.4545;
    const lon = -2.5879;

    const tempValue = document.getElementById("temp-value");
    const rainValue = document.getElementById("rain-value");
    const windValue = document.getElementById("wind-value");
    const conditionIcon = document.getElementById("condition-icon");
    const tempFeels = document.getElementById("temp-feels");

    const tempVisual = document.getElementById("temp-visual");
    const rainVisual = document.getElementById("rain-visual");
    const windVisual = document.getElementById("wind-visual");

    const mock = [
      { temp: 9.2, wind: 12.6, rain: 1.8, code: 2 },
      { temp: 11.0, wind: 9.4, rain: 0.3, code: 1 },
      { temp: 13.2, wind: 7.2, rain: 0.0, code: 0 },
      { temp: 10.5, wind: 14.1, rain: 2.1, code: 3 },
      { temp: 8.9, wind: 16.8, rain: 3.4, code: 61 }
    ];

    let i = 0;
    let fallback = false;

    try {
      const res = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true&hourly=precipitation`);
      const data = await res.json();

      const w = data.current_weather;
      simulate({
        temp: w.temperature,
        wind: w.windspeed,
        rain: data.hourly.precipitation[0],
        code: w.weathercode || 0
      });
    } catch (err) {
      console.warn("Weather API failed — using simulation:", err);
      fallback = true;
      simulate(mock[0]);
    }

    setInterval(() => {
      i = (i + 1) % mock.length;
      simulate(fallback ? mock[i] : randomizeFromCurrent());
    }, 10000);

    function randomizeFromCurrent() {
      return {
        temp: parseFloat(tempValue.textContent) + (Math.random() - 0.5) * 0.5,
        wind: parseFloat(windValue.textContent) + (Math.random() - 0.5) * 0.5,
        rain: parseFloat(rainValue.textContent) + (Math.random() - 0.5) * 0.3,
        code: Math.floor(Math.random() * 3)
      };
    }

    function simulate({ temp, wind, rain, code }) {
      tempValue.textContent = `${temp.toFixed(1)}°C`;
      tempFeels.textContent = `Feels like: ${(temp - 0.5 + Math.random()).toFixed(1)}°C`;
      rainValue.textContent = `${rain.toFixed(1)} mm`;
      windValue.textContent = `${wind.toFixed(1)} km/h`;

      let iconUrl = "/static/assets/sun.svg";
      if (rain > 1.5) iconUrl = "/static/assets/rain.svg";
      else if (code >= 1 && code <= 3) iconUrl = "/static/assets/cloud.svg";

      if (conditionIcon) {
        conditionIcon.style.opacity = 0;
        setTimeout(() => {
          conditionIcon.src = iconUrl;
          conditionIcon.style.opacity = 1;
        }, 200);
      }

      [tempVisual, rainVisual, windVisual].forEach((v) => {
        if (v) v.innerHTML = "";
      });

      tempVisual?.classList.remove("sunny-bg");

      if (rain > 1) simulateRain();
      if (wind > 10) simulateWind();
      if (rain < 0.5 && wind < 10) simulateSun();
    }

    function simulateRain() {
      for (let i = 0; i < 40; i++) {
        const drop = document.createElement("div");
        drop.className = "rain-drop";
        drop.style.left = `${Math.random() * 100}%`;
        drop.style.animationDuration = `${0.5 + Math.random() * 0.8}s`;
        rainVisual?.appendChild(drop);
      }
    }

    function simulateWind() {
      for (let i = 0; i < 6; i++) {
        const swoosh = document.createElement("div");
        swoosh.className = "wind-swoosh";
        swoosh.style.top = `${Math.random() * 80}%`;
        swoosh.style.animationDelay = `${Math.random() * 2}s`;
        windVisual?.appendChild(swoosh);
      }
    }

    function simulateSun() {
      tempVisual?.classList.add("sunny-bg");
      setTimeout(() => tempVisual?.classList.remove("sunny-bg"), 9000);
    }
  })();

  /* ------------------- FRIENDS & EVENTS FEED ------------------- */
  (() => {
    const feedContainer = document.getElementById("feed-container");
    if (!feedContainer) return;

    const feedItems = [
      {
        img: "/static/assets/harbourfest.jpg",
        title: "Bristol Harbour Festival",
        desc: "Live music, food stalls, and boat parades at the waterfront.",
        tag: "Festival"
      },
      {
        img: "/static/assets/artshow.jpg",
        title: "Graffiti Art Showcase",
        desc: "Local artists transform the walls of Stokes Croft this weekend.",
        tag: "Art"
      },
      {
        img: "/static/assets/market.jpg",
        title: "Sunday Street Market",
        desc: "Handmade crafts and local produce — every Sunday in Old City.",
        tag: "Market"
      },
      {
        img: "/static/assets/concert.jpg",
        title: "Harbourside Jazz Night",
        desc: "Chill tunes & cocktails by the water — 7PM this Friday.",
        tag: "Music"
      },
      {
        img: "/static/assets/friend-checkin.jpg",
        title: "Ella checked in at Clifton Observatory",
        desc: "Sunset view was unreal! 🌇",
        tag: "Friend"
      },
      {
        img: "/static/assets/friend-bike.jpg",
        title: "Tom joined the Bristol Cycling Club 🚴",
        desc: "Next meetup: Sunday morning ride to Ashton Court.",
        tag: "Friend"
      }
    ];

    function renderFeed() {
      feedContainer.innerHTML = "";
      const shuffled = [...feedItems].sort(() => Math.random() - 0.5);

      shuffled.slice(0, 4).forEach((item) => {
        const card = document.createElement("div");
        card.className = "feed-card";
        card.innerHTML = `
          <img src="${item.img}" alt="${item.title}">
          <h3>${item.title}</h3>
          <p>${item.desc}</p>
          <span class="feed-tag">${item.tag}</span>
        `;
        feedContainer.appendChild(card);
        setTimeout(() => card.classList.add("show"), 100);
      });
    }

    renderFeed();
    setInterval(renderFeed, 20000);
  })();

  /* ------------------- CART ------------------- */
  (() => {
    const cartBtn = document.getElementById("cart-btn");
    const cartCount = document.getElementById("cart-count");
    const cartModal = document.getElementById("cart-modal");
    const cartItemsList = document.getElementById("cart-items");
    const checkoutBtn = document.getElementById("checkout-btn");

    const quickCart = document.createElement("div");
    quickCart.classList.add("quick-cart");
    quickCart.innerHTML = "🛒";
    document.body.appendChild(quickCart);

    const badge = document.createElement("span");
    badge.style.cssText = `
      position:absolute;
      top:6px;
      right:10px;
      background:#fff;
      color:#ff0080;
      font-weight:700;
      font-size:0.8rem;
      border-radius:50%;
      width:20px;
      height:20px;
      display:flex;
      align-items:center;
      justify-content:center;
      box-shadow:0 0 10px rgba(255,0,128,0.4);
    `;
    quickCart.style.position = "relative";
    quickCart.appendChild(badge);

    const cart = [];

    function totalQty() {
      return cart.reduce((acc, item) => acc + item.qty, 0);
    }

    function updateCartDisplay() {
      cartItemsList.innerHTML = "";

      if (cart.length === 0) {
        cartItemsList.innerHTML = "<li>Your cart is empty.</li>";
      } else {
        cart.forEach((item, idx) => {
          const li = document.createElement("li");
          li.innerHTML = `
            <span>${item.name} x${item.qty}</span>
            <span style="cursor:pointer;color:#ff0080;" data-remove="${idx}">✕</span>
          `;
          cartItemsList.appendChild(li);
        });
      }

      const total = totalQty();
      cartCount.textContent = total;
      badge.textContent = total > 0 ? total : "";
      badge.style.display = total > 0 ? "flex" : "none";
    }

    function addToCart(name, price) {
      const existing = cart.find((i) => i.name === name);
      if (existing) existing.qty += 1;
      else cart.push({ name, price, qty: 1 });

      updateCartDisplay();
      quickCart.animate(
        [{ transform: "scale(1.1)" }, { transform: "scale(1)" }],
        { duration: 300, easing: "ease-in-out" }
      );
    }

    document.querySelectorAll(".buy-btn").forEach((button) => {
      button.addEventListener("click", () => {
        const itemName = button.dataset.item;
        const price = Number(button.dataset.price || 0);
        addToCart(itemName, price);

        const originalText = button.textContent;
        button.textContent = "✔ Added!";
        button.style.background = "linear-gradient(135deg,#00d084,#66ffbb)";
        setTimeout(() => {
          button.textContent = originalText;
          button.style.background = "";
        }, 1000);
      });
    });

    cartItemsList.addEventListener("click", (e) => {
      const idx = e.target.dataset.remove;
      if (idx !== undefined) {
        cart.splice(Number(idx), 1);
        updateCartDisplay();
      }
    });

    function toggleCart(show) {
      cartModal.classList.toggle("active", show);
    }

    cartBtn?.addEventListener("click", () => toggleCart(true));
    quickCart.addEventListener("click", () => toggleCart(true));

    cartModal.addEventListener("click", (e) => {
      if (e.target === cartModal) toggleCart(false);
    });

    checkoutBtn?.addEventListener("click", () => {
      if (cart.length === 0) {
        alert("🛍️ Your cart is empty!");
        return;
      }

      alert("🎉 Thank you for supporting Bristol Events & Culture!");
      cart.length = 0;
      updateCartDisplay();
      toggleCart(false);
    });

    updateCartDisplay();
  })();
});