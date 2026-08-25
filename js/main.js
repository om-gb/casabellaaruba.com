/* Casabella Aruba — sticky header, mobile nav, scroll reveal, project filter,
   enquiry form. No dependencies. */
(function () {
  "use strict";

  /* --- Sticky header --------------------------------------------------- */
  var header = document.getElementById("header");
  var onScroll = function () {
    header.classList.toggle("is-stuck", window.scrollY > 24);
  };
  onScroll();
  window.addEventListener("scroll", onScroll, { passive: true });

  /* --- Mobile nav ------------------------------------------------------ */
  var toggle = document.querySelector(".nav-toggle");
  var nav = document.getElementById("primary-nav");

  if (toggle && nav) {
    toggle.addEventListener("click", function () {
      var open = toggle.getAttribute("aria-expanded") === "true";
      toggle.setAttribute("aria-expanded", String(!open));
      nav.classList.toggle("is-open", !open);
    });

    nav.addEventListener("click", function (e) {
      if (e.target.closest("a")) {
        toggle.setAttribute("aria-expanded", "false");
        nav.classList.remove("is-open");
      }
    });
  }

  /* --- Scroll reveal --------------------------------------------------- */
  var revealables = document.querySelectorAll("[data-reveal]");

  if (!("IntersectionObserver" in window)) {
    revealables.forEach(function (el) {
      el.classList.add("is-visible");
    });
  } else {
    var io = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) return;
          entry.target.classList.add("is-visible");
          io.unobserve(entry.target);
        });
      },
      { rootMargin: "0px 0px -8% 0px", threshold: 0.08 }
    );
    revealables.forEach(function (el) {
      io.observe(el);
    });
  }

  /* --- Project filter --------------------------------------------------
     Counts are read off the cards themselves, so adding a project to the
     HTML is the only edit needed. */
  var grid = document.getElementById("project-grid");

  if (grid) {
    var cards = Array.prototype.slice.call(grid.querySelectorAll(".project"));
    var buttons = Array.prototype.slice.call(document.querySelectorAll(".filter"));
    var empty = document.getElementById("projects-empty");

    buttons.forEach(function (btn) {
      var key = btn.dataset.filter;
      var n =
        key === "all"
          ? cards.length
          : cards.filter(function (c) {
              return c.dataset.status === key;
            }).length;

      // The label is indented in the source; collapse it before appending
      // the count so the gap is the margin, not stray whitespace.
      btn.textContent = btn.textContent.trim();

      var count = document.createElement("span");
      count.className = "filter__count";
      count.textContent = n;
      btn.appendChild(count);

      // A stage with nothing in it is not worth offering.
      if (n === 0) btn.hidden = true;
    });

    var apply = function (key) {
      var shown = 0;

      cards.forEach(function (card) {
        var match = key === "all" || card.dataset.status === key;
        card.hidden = !match;
        if (match) {
          shown++;
          card.classList.add("is-visible");
        }
      });

      buttons.forEach(function (btn) {
        btn.setAttribute("aria-pressed", String(btn.dataset.filter === key));
      });

      if (empty) empty.hidden = shown > 0;
    };

    buttons.forEach(function (btn) {
      btn.addEventListener("click", function () {
        apply(btn.dataset.filter);
      });
    });
  }

  /* --- Enquiry form ----------------------------------------------------
     Posts to the Cloudflare Pages Function at /api/enquiry, which is where
     the recipient addresses live. They are never in this source. */
  var form = document.getElementById("enquiry-form");
  var status = document.getElementById("form-status");

  var FALLBACK =
    "We could not send that. Please call +297 593 7285 and we will pick it up from there.";

  if (form) {
    form.addEventListener("submit", function (e) {
      e.preventDefault();

      var button = form.querySelector('button[type="submit"]');
      var original = button ? button.textContent : "";

      if (button) {
        button.disabled = true;
        button.textContent = "Sending…";
      }

      fetch(form.getAttribute("action"), {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams(new FormData(form)).toString()
      })
        .then(function (res) {
          // Read the body either way — the function explains its own failures.
          return res
            .json()
            .catch(function () {
              return {};
            })
            .then(function (data) {
              return { ok: res.ok && data.ok, error: data.error };
            });
        })
        .catch(function () {
          return { ok: false };
        })
        .then(function (result) {
          status.hidden = false;

          if (result.ok) {
            form.reset();
            status.textContent =
              "Thank you — your enquiry is with us. We answer within a day.";
          } else {
            status.textContent = result.error || FALLBACK;
          }

          if (button) {
            button.disabled = false;
            button.textContent = original;
          }
        });
    });
  }

  /* --- Footer year ----------------------------------------------------- */
  var year = document.getElementById("year");
  if (year) year.textContent = new Date().getFullYear();
})();
