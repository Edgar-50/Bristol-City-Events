// SEARCH FILTER
document.getElementById("search").addEventListener("input", e => {
  const value = e.target.value.toLowerCase();

  document.querySelectorAll(".card").forEach(card => {
    card.style.display =
      card.innerText.toLowerCase().includes(value)
        ? "block"
        : "none";
  });
});


// BOOKING (REAL BACKEND)
document.querySelectorAll(".book-btn").forEach(btn => {
  btn.addEventListener("click", async () => {

    const eventId = btn.dataset.id;

    const res = await fetch(`/api/book/${eventId}`, {
      method: "POST"
    });

    const data = await res.json();

    // NOT LOGGED IN
    if (res.status === 401) {
      window.location.href = data.redirect;
      return;
    }

    if (!data.success) {
      alert(data.message);
      return;
    }

    alert("✅ Booking successful!");
  });
});