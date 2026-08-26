/* ==========================================================================
   Casabella Tower — site behaviour
   Vanilla, no dependencies. Loaded with `defer` from every page.
   ========================================================================== */

(function () {
  "use strict";

  /* --- Configuration ------------------------------------------------------
     Where the enquiry form posts. Paste the Formspree endpoint for the form
     here — it looks like "https://formspree.io/f/xxxxxxxx".

     Leave it as an empty string and the form falls back to handing the
     enquiry to the visitor's own mail client, so nothing is ever silently
     dropped while the endpoint is still being set up.
     ---------------------------------------------------------------------- */

  var ENQUIRY_ENDPOINT = "/api/enquiry";

  var doc = document;
  var body = doc.body;
  var reduceMotion =
    window.matchMedia &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* --- Sticky header state ---------------------------------------------- */

  var header = doc.querySelector(".site-header");

  function onScroll() {
    if (!header) return;
    header.classList.toggle("is-stuck", window.scrollY > 24);
  }

  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  /* --- Mobile navigation ------------------------------------------------- */

  var toggle = doc.querySelector(".nav-toggle");
  var nav = doc.querySelector(".nav");

  function closeNav() {
    body.classList.remove("nav-open");
    if (toggle) toggle.setAttribute("aria-expanded", "false");
  }

  if (toggle && nav) {
    toggle.addEventListener("click", function () {
      var open = body.classList.toggle("nav-open");
      toggle.setAttribute("aria-expanded", open ? "true" : "false");
    });

    nav.addEventListener("click", function (e) {
      if (e.target.closest("a")) closeNav();
    });

    doc.addEventListener("keydown", function (e) {
      if (e.key === "Escape") closeNav();
    });
  }

  /* --- Scroll reveal ----------------------------------------------------- */

  var revealables = doc.querySelectorAll("[data-reveal]");

  if (!("IntersectionObserver" in window)) {
    revealables.forEach(function (el) {
      el.classList.add("is-visible");
    });
  } else {
    var revealObserver = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) return;
          entry.target.classList.add("is-visible");
          revealObserver.unobserve(entry.target);
        });
      },
      { rootMargin: "0px 0px -12% 0px", threshold: 0.08 }
    );

    revealables.forEach(function (el, i) {
      // Stagger siblings slightly so grids cascade instead of snapping in.
      el.style.transitionDelay = (i % 4) * 90 + "ms";
      revealObserver.observe(el);
    });
  }

  /* --- Active section in nav --------------------------------------------- */

  var sections = doc.querySelectorAll("main section[id]");
  var navLinks = doc.querySelectorAll('.nav a[href^="#"]');

  if (sections.length && navLinks.length && "IntersectionObserver" in window) {
    var sectionObserver = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) return;
          var id = entry.target.id;
          navLinks.forEach(function (link) {
            link.classList.toggle(
              "is-active",
              link.getAttribute("href") === "#" + id
            );
          });
        });
      },
      { rootMargin: "-45% 0px -50% 0px" }
    );

    sections.forEach(function (s) {
      sectionObserver.observe(s);
    });
  }

  /* --- Plan sheet lightbox ------------------------------------------------
     The plan links stay real links, so with JS off (or without <dialog>)
     they still open the sheet in a new tab. With JS the click is intercepted
     and the sheet grows into an overlay on the same page instead.
     ---------------------------------------------------------------------- */

  var planLinks = doc.querySelectorAll("[data-lightbox]");
  var hasDialog =
    typeof window.HTMLDialogElement === "function" &&
    typeof window.HTMLDialogElement.prototype.showModal === "function";

  if (planLinks.length && hasDialog) {
    var es = (doc.documentElement.lang || "en").slice(0, 2) === "es";
    var t = es
      ? {
          viewer: "Visor de planos",
          close: "Cerrar",
          prev: "Lámina anterior",
          next: "Lámina siguiente",
          of: "de"
        }
      : {
          viewer: "Floor plan viewer",
          close: "Close",
          prev: "Previous sheet",
          next: "Next sheet",
          of: "of"
        };

    var sheets = Array.prototype.map.call(planLinks, function (link) {
      var heading = link.querySelector(".plan__label h3");
      var sub = link.querySelector(".plan__label span");
      return {
        link: link,
        href: link.getAttribute("href"),
        thumb: link.querySelector("img"),
        title: heading ? heading.textContent.trim() : "",
        sub: sub ? sub.textContent.trim() : ""
      };
    });

    var dlg = doc.createElement("dialog");
    dlg.className = "lightbox";
    dlg.setAttribute("aria-label", t.viewer);
    // One floating panel — the site stays visible and blurred behind it.
    dlg.innerHTML =
      '<div class="lightbox__panel">' +
      '<button class="lightbox__close" type="button" aria-label="' +
      t.close +
      '">&times;</button>' +
      '<button class="lightbox__nav lightbox__nav--prev" type="button" aria-label="' +
      t.prev +
      '">&#8249;</button>' +
      '<button class="lightbox__nav lightbox__nav--next" type="button" aria-label="' +
      t.next +
      '">&#8250;</button>' +
      '<div class="lightbox__stage">' +
      '<img class="lightbox__img" alt="" />' +
      "</div>" +
      '<div class="lightbox__bar">' +
      '<strong class="lightbox__title"></strong>' +
      '<span class="lightbox__sub"></span>' +
      '<span class="lightbox__count"></span>' +
      "</div>" +
      "</div>";
    body.appendChild(dlg);

    var panel = dlg.querySelector(".lightbox__panel");
    var stage = dlg.querySelector(".lightbox__stage");
    var imgEl = dlg.querySelector(".lightbox__img");
    var titleEl = dlg.querySelector(".lightbox__title");
    var subEl = dlg.querySelector(".lightbox__sub");
    var countEl = dlg.querySelector(".lightbox__count");
    var index = 0;
    var lastFocus = null;

    // Grow the sheet out of the thumbnail it was opened from, rather than
    // having it appear from nowhere.
    function growFrom(rect) {
      if (!rect || reduceMotion || !panel.animate) return;
      var to = panel.getBoundingClientRect();
      if (!to.width || !to.height) return;
      panel.animate(
        [
          {
            transform:
              "translate(" +
              (rect.left + rect.width / 2 - (to.left + to.width / 2)) +
              "px," +
              (rect.top + rect.height / 2 - (to.top + to.height / 2)) +
              "px) scale(" +
              rect.width / to.width +
              "," +
              rect.height / to.height +
              ")",
            opacity: 0.35
          },
          { transform: "none", opacity: 1 }
        ],
        { duration: 340, easing: "cubic-bezier(0.22, 0.61, 0.36, 1)" }
      );
    }

    function show(i, fromRect) {
      index = (i + sheets.length) % sheets.length;
      var at = index;
      var sheet = sheets[at];

      imgEl.classList.remove("is-zoomed");
      stage.scrollTop = 0;
      stage.scrollLeft = 0;

      // The thumbnail is already decoded, so it fills the frame instantly.
      // The full sheet replaces it as soon as it has loaded.
      if (sheet.thumb) {
        imgEl.src = sheet.thumb.currentSrc || sheet.thumb.src;
        imgEl.alt = sheet.thumb.alt || sheet.title;
      }
      titleEl.textContent = sheet.title;
      subEl.textContent = sheet.sub;
      countEl.textContent = at + 1 + " " + t.of + " " + sheets.length;

      dlg.classList.add("is-loading");
      var full = new Image();
      full.onload = function () {
        if (index !== at) return; // moved on while this was loading
        imgEl.src = sheet.href;
        dlg.classList.remove("is-loading");
      };
      full.onerror = function () {
        if (index === at) dlg.classList.remove("is-loading");
      };
      full.src = sheet.href;

      if (!dlg.open) {
        lastFocus = doc.activeElement;
        dlg.showModal();
        body.classList.add("has-modal");
      }
      growFrom(fromRect);
    }

    // Every dismissal route runs this. Idempotent, and not left to the
    // dialog's own close event, which some engines fire unreliably.
    function hide() {
      if (dlg.open) dlg.close();
      body.classList.remove("has-modal");
      imgEl.classList.remove("is-zoomed");
      if (lastFocus && lastFocus.focus) lastFocus.focus();
      lastFocus = null;
    }

    function step(delta) {
      var current = sheets[index].thumb;
      show(index + delta, current ? current.getBoundingClientRect() : null);
    }

    planLinks.forEach(function (link, i) {
      link.addEventListener("click", function (e) {
        // Let modified clicks (new tab, save) behave normally.
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
        e.preventDefault();
        var thumb = sheets[i].thumb;
        show(i, thumb ? thumb.getBoundingClientRect() : null);
      });
    });

    dlg.querySelector(".lightbox__close").addEventListener("click", hide);
    dlg.querySelector(".lightbox__nav--prev").addEventListener("click", function () {
      step(-1);
    });
    dlg.querySelector(".lightbox__nav--next").addEventListener("click", function () {
      step(1);
    });

    // Click the sheet itself to zoom in one more step for the small print.
    imgEl.addEventListener("click", function () {
      var zoom = imgEl.classList.toggle("is-zoomed");
      if (zoom) {
        stage.scrollTop = (stage.scrollHeight - stage.clientHeight) / 2;
        stage.scrollLeft = (stage.scrollWidth - stage.clientWidth) / 2;
      }
    });

    // Click the page showing around the panel to dismiss.
    dlg.addEventListener("click", function (e) {
      if (e.target === dlg) hide();
    });

    dlg.addEventListener("keydown", function (e) {
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        step(-1);
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        step(1);
      } else if (e.key === "Escape") {
        e.preventDefault();
        hide();
      }
    });

    // Swipe between sheets on touch.
    var touchX = null;
    var touchY = null;
    dlg.addEventListener(
      "touchstart",
      function (e) {
        if (e.touches.length !== 1 || imgEl.classList.contains("is-zoomed")) {
          touchX = null;
          return;
        }
        touchX = e.touches[0].clientX;
        touchY = e.touches[0].clientY;
      },
      { passive: true }
    );
    dlg.addEventListener(
      "touchend",
      function (e) {
        if (touchX === null) return;
        var dx = e.changedTouches[0].clientX - touchX;
        var dy = e.changedTouches[0].clientY - touchY;
        if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy)) step(dx < 0 ? 1 : -1);
        touchX = null;
      },
      { passive: true }
    );

    // Backstop for any close route not covered above (browser UI, back nav).
    dlg.addEventListener("close", hide);
    dlg.addEventListener("cancel", hide);
  }

  /* --- Gallery overlay --------------------------------------------------- */

  var galleryItems = doc.querySelectorAll("[data-gallery]");

  if (galleryItems.length && hasDialog) {
    var galleryEs = (doc.documentElement.lang || "en").slice(0, 2) === "es";
    var galleryCopy = galleryEs
      ? { viewer: "Galería de imágenes", close: "Cerrar", prev: "Imagen anterior", next: "Imagen siguiente", of: "de" }
      : { viewer: "Image gallery", close: "Close", prev: "Previous image", next: "Next image", of: "of" };
    var galleryData = Array.prototype.map.call(galleryItems, function (item) {
      var image = item.querySelector("img");
      return {
        item: item,
        src: item.getAttribute("data-full") || (image && (image.currentSrc || image.src)),
        alt: image ? image.alt : "",
        caption: (item.getAttribute("aria-label") || "").replace(/^Enlarge /, "").replace(/^Ampliar /, "")
      };
    });
    var galleryDialog = doc.createElement("dialog");
    galleryDialog.className = "lightbox gallery-lightbox";
    galleryDialog.setAttribute("aria-label", galleryCopy.viewer);
    galleryDialog.innerHTML =
      '<div class="lightbox__panel">' +
      '<button class="lightbox__close" type="button" aria-label="' + galleryCopy.close + '">&times;</button>' +
      '<button class="lightbox__nav lightbox__nav--prev" type="button" aria-label="' + galleryCopy.prev + '">&#8249;</button>' +
      '<button class="lightbox__nav lightbox__nav--next" type="button" aria-label="' + galleryCopy.next + '">&#8250;</button>' +
      '<div class="lightbox__stage"><img class="lightbox__img" alt="" /></div>' +
      '<div class="lightbox__bar"><span class="lightbox__sub"></span><span class="lightbox__count"></span></div>' +
      '</div>';
    body.appendChild(galleryDialog);

    var galleryImage = galleryDialog.querySelector(".lightbox__img");
    var galleryCaption = galleryDialog.querySelector(".lightbox__sub");
    var galleryCount = galleryDialog.querySelector(".lightbox__count");
    var galleryIndex = 0;
    var galleryLastFocus = null;

    function showGallery(i) {
      galleryIndex = (i + galleryData.length) % galleryData.length;
      var image = galleryData[galleryIndex];
      galleryImage.src = image.src;
      galleryImage.alt = image.alt;
      galleryCaption.textContent = image.caption || image.alt;
      galleryCount.textContent = galleryIndex + 1 + " " + galleryCopy.of + " " + galleryData.length;
      if (!galleryDialog.open) {
        galleryLastFocus = doc.activeElement;
        galleryDialog.showModal();
        body.classList.add("has-modal");
      }
    }

    function hideGallery() {
      if (galleryDialog.open) galleryDialog.close();
      body.classList.remove("has-modal");
      if (galleryLastFocus && galleryLastFocus.focus) galleryLastFocus.focus();
      galleryLastFocus = null;
    }

    galleryItems.forEach(function (item, i) {
      item.addEventListener("click", function () { showGallery(i); });
      item.addEventListener("keydown", function (e) {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          showGallery(i);
        }
      });
    });
    galleryDialog.querySelector(".lightbox__close").addEventListener("click", hideGallery);
    galleryDialog.querySelector(".lightbox__nav--prev").addEventListener("click", function () { showGallery(galleryIndex - 1); });
    galleryDialog.querySelector(".lightbox__nav--next").addEventListener("click", function () { showGallery(galleryIndex + 1); });
    galleryDialog.addEventListener("click", function (e) { if (e.target === galleryDialog) hideGallery(); });
    galleryDialog.addEventListener("keydown", function (e) {
      if (e.key === "ArrowLeft") showGallery(galleryIndex - 1);
      if (e.key === "ArrowRight") showGallery(galleryIndex + 1);
      if (e.key === "Escape") {
        e.preventDefault();
        hideGallery();
      }
    });
    galleryDialog.addEventListener("close", function () {
      body.classList.remove("has-modal");
    });
  }

  /* --- Interactive floor-plan explorer ----------------------------------
     The original architect sheet is the image. SVG is used only as a clear,
     transparent hit area over each real residence footprint.
     ---------------------------------------------------------------------- */

  var floorExplorer = doc.querySelector("[data-floor-explorer]");

  if (floorExplorer) {
    var planIsEs = (doc.documentElement.lang || "en").slice(0, 2) === "es";
    var SVG_NS = "http://www.w3.org/2000/svg";
    var floorImage = floorExplorer.querySelector("[data-floor-image]");
    var floorOverlay = floorExplorer.querySelector("[data-floor-overlay]");
    var floorName = floorExplorer.querySelector("[data-floor-name]");
    var floorUnits = floorExplorer.querySelector("[data-floor-units]");
    var floorFull = floorExplorer.querySelector("[data-floor-full]");
    var floorButtons = floorExplorer.querySelectorAll("[data-floor]");
    var unitKicker = floorExplorer.querySelector("[data-unit-kicker]");
    var unitTitle = floorExplorer.querySelector("[data-unit-title]");
    var unitIntro = floorExplorer.querySelector("[data-unit-intro]");
    var unitId = floorExplorer.querySelector("[data-unit-id]");
    var unitType = floorExplorer.querySelector("[data-unit-type]");
    var unitBeds = floorExplorer.querySelector("[data-unit-beds]");
    var unitBaths = floorExplorer.querySelector("[data-unit-baths]");
    var unitArea = floorExplorer.querySelector("[data-unit-area]");
    var unitOutdoor = floorExplorer.querySelector("[data-unit-outdoor]");
    var unitPriceWrap = floorExplorer.querySelector("[data-unit-price-wrap]");
    var unitPrice = floorExplorer.querySelector("[data-unit-price]");
    var planEnquire = floorExplorer.querySelector("[data-plan-enquire]");
    var activePlanUnit = "";

    function planText(en, esText) {
      return planIsEs ? esText : en;
    }

    var PLAN_UNITS = {
      "APT.1":  { type: ["Residence A", "Residencia A"], floor: ["1st Floor", "1ª Planta"], beds: 2, baths: 2, area: "82.57 m²", areaBasis: ["Drawing callouts", "Cotas del plano"], outdoor: ["Two private balconies", "Dos balcones privados"], price: "$453,287", interest: ["Residence A", "Residencia A"], note: ["North-east corner residence at the upper end of the exterior hallway.", "Residencia de esquina noreste, en el extremo superior del pasillo exterior."] },
      "APT.2":  { type: ["Residence B", "Residencia B"], floor: ["1st Floor", "1ª Planta"], beds: 2, baths: 2, area: "86.45 m²", areaBasis: ["Drawing callouts", "Cotas del plano"], outdoor: ["Two private balconies", "Dos balcones privados"], price: "$473,556", interest: ["Residence B", "Residencia B"], note: ["North-west corner residence opposite Apartment 1.", "Residencia de esquina noroeste, frente al Apartamento 1."] },
      "APT.3":  { type: ["Residence C", "Residencia C"], floor: ["1st Floor", "1ª Planta"], beds: 2, baths: 2, area: "87.38 m²", areaBasis: ["Drawing callouts", "Cotas del plano"], outdoor: ["Two private balconies", "Dos balcones privados"], price: "$475,942", interest: ["Residence C", "Residencia C"], note: ["South-west corner residence below the exterior hallway core.", "Residencia de esquina suroeste, bajo el núcleo del pasillo exterior."] },
      "APT.4":  { type: ["Residence D", "Residencia D"], floor: ["1st Floor", "1ª Planta"], beds: 2, baths: 2, area: "84.99 m²", areaBasis: ["Drawing callouts", "Cotas del plano"], outdoor: ["Two private balconies", "Dos balcones privados"], price: "$462,516", interest: ["Residence D", "Residencia D"], note: ["South-east corner residence beside the lower end of the hallway.", "Residencia de esquina sureste, junto al extremo inferior del pasillo."] },
      "APT.5":  { type: ["Residence A", "Residencia A"], floor: ["2nd Floor", "2ª Planta"], beds: 2, baths: 2, area: "82.59 m²", areaBasis: ["Drawing callouts", "Cotas del plano"], outdoor: ["Two private balconies", "Dos balcones privados"], price: "$453,287", interest: ["Residence A", "Residencia A"], note: ["North-east corner residence at the upper end of the exterior hallway.", "Residencia de esquina noreste, en el extremo superior del pasillo exterior."] },
      "APT.6":  { type: ["Residence B", "Residencia B"], floor: ["2nd Floor", "2ª Planta"], beds: 2, baths: 2, area: "86.45 m²", areaBasis: ["Drawing callouts", "Cotas del plano"], outdoor: ["Two private balconies", "Dos balcones privados"], price: "$473,556", interest: ["Residence B", "Residencia B"], note: ["North-west corner residence opposite Apartment 5.", "Residencia de esquina noroeste, frente al Apartamento 5."] },
      "APT.7":  { type: ["Residence C", "Residencia C"], floor: ["2nd Floor", "2ª Planta"], beds: 2, baths: 2, area: "87.40 m²", areaBasis: ["Drawing callouts", "Cotas del plano"], outdoor: ["Two private balconies", "Dos balcones privados"], price: "$475,942", interest: ["Residence C", "Residencia C"], note: ["South-west corner residence below the exterior hallway core.", "Residencia de esquina suroeste, bajo el núcleo del pasillo exterior."] },
      "APT.8":  { type: ["Residence D", "Residencia D"], floor: ["2nd Floor", "2ª Planta"], beds: 2, baths: 2, area: "84.99 m²", areaBasis: ["Drawing callouts", "Cotas del plano"], outdoor: ["Two private balconies", "Dos balcones privados"], price: "$462,516", interest: ["Residence D", "Residencia D"], note: ["South-east corner residence beside the lower end of the hallway.", "Residencia de esquina sureste, junto al extremo inferior del pasillo."] },
      "APT.9":  { type: ["Residence A", "Residencia A"], floor: ["3rd Floor", "3ª Planta"], beds: 2, baths: 2, area: "82.56 m²", areaBasis: ["Net / leasable, balcony included", "Neta / arrendable, balcón incluido"], outdoor: ["Two private balconies", "Dos balcones privados"], price: "$453,287", interest: ["Residence A", "Residencia A"], note: ["North-east corner residence at the upper end of the exterior hallway.", "Residencia de esquina noreste, en el extremo superior del pasillo exterior."] },
      "APT.10": { type: ["Residence B", "Residencia B"], floor: ["3rd Floor", "3ª Planta"], beds: 2, baths: 2, area: "86.45 m²", areaBasis: ["Net / leasable, balcony included", "Neta / arrendable, balcón incluido"], outdoor: ["Two private balconies", "Dos balcones privados"], price: "$473,556", interest: ["Residence B", "Residencia B"], note: ["North-west corner residence opposite Apartment 9.", "Residencia de esquina noroeste, frente al Apartamento 9."] },
      "APT.11": { type: ["Residence C", "Residencia C"], floor: ["3rd Floor", "3ª Planta"], beds: 2, baths: 2, area: "87.39 m²", areaBasis: ["Net / leasable, balcony included", "Neta / arrendable, balcón incluido"], outdoor: ["Two private balconies", "Dos balcones privados"], price: "$475,942", interest: ["Residence C", "Residencia C"], note: ["South-west corner residence below the exterior hallway core.", "Residencia de esquina suroeste, bajo el núcleo del pasillo exterior."] },
      "APT.12": { type: ["Residence D", "Residencia D"], floor: ["3rd Floor", "3ª Planta"], beds: 2, baths: 2, area: "83.35 m²", areaBasis: ["Net / leasable, balcony included", "Neta / arrendable, balcón incluido"], outdoor: ["Two private balconies", "Dos balcones privados"], price: "$462,516", interest: ["Residence D", "Residencia D"], note: ["South-east corner residence beside the lower end of the hallway.", "Residencia de esquina sureste, junto al extremo inferior del pasillo."] },
      "A13": { type: ["Fourth-floor residence", "Residencia de la 4ª planta"], floor: ["4th Floor", "4ª Planta"], beds: 2, baths: 2, area: "70.10 m²", areaBasis: ["Net / leasable, balcony included", "Neta / arrendable, balcón incluido"], outdoor: ["Two private balconies", "Dos balcones privados"], price: "$392,783", interest: ["Two-bedroom residence", "Residencia de dos dormitorios"], note: ["South-west residence below Loft 3.", "Residencia suroeste, debajo del Loft 3."] },
      "A14": { type: ["Fourth-floor residence", "Residencia de la 4ª planta"], floor: ["4th Floor", "4ª Planta"], beds: 2, baths: 2, area: "66.14 m²", areaBasis: ["Net / leasable, balcony included", "Neta / arrendable, balcón incluido"], outdoor: ["Two private balconies", "Dos balcones privados"], price: "$370,286", interest: ["Two-bedroom residence", "Residencia de dos dormitorios"], note: ["South-east residence below the elevator and stair core.", "Residencia sureste, debajo del núcleo de ascensor y escaleras."] },
      "L1": { type: ["Loft maisonette", "Dúplex loft"], floor: ["4th + Loft", "4ª planta + Loft"], beds: 2, baths: 2, area: "111.13 m²", areaBasis: ["Net / leasable, balcony included", "Neta / arrendable, balcón incluido"], outdoor: ["Private balcony", "Balcón privado"], price: "$934,190", interest: ["Loft maisonette", "Dúplex loft"], note: ["North-east two-level home with the largest total area.", "Vivienda de dos niveles al noreste, con la mayor superficie total."] },
      "L2": { type: ["Loft maisonette", "Dúplex loft"], floor: ["4th + Loft", "4ª planta + Loft"], beds: 2, baths: 2, area: "106.29 m²", areaBasis: ["Net / leasable, balcony included", "Neta / arrendable, balcón incluido"], outdoor: ["Private balcony", "Balcón privado"], price: "$917,569", interest: ["Loft maisonette", "Dúplex loft"], note: ["North-west two-level home opposite Loft 1.", "Vivienda de dos niveles al noroeste, frente al Loft 1."] },
      "L3": { type: ["Loft maisonette", "Dúplex loft"], floor: ["4th + Loft", "4ª planta + Loft"], beds: 2, baths: 2, area: "86.58 m²", areaBasis: ["Net / leasable", "Neta / arrendable"], outdoor: ["No private balcony shown", "No se muestra balcón privado"], price: "$805,535", interest: ["Loft maisonette", "Dúplex loft"], note: ["Mid-west two-level home between Loft 2 and A13.", "Vivienda de dos niveles al oeste, entre Loft 2 y A13."] }
    };

    var PLAN_FLOORS = {
      "1": {
        name: ["1st Floor", "1ª Planta"], unitsLabel: "APT.1 – APT.4", image: "/tower/assets/img/floorplans/floor-1.webp", full: "/tower/assets/img/floorplans/floor-1@1200.webp", width: 1600, height: 2648,
        intro: ["Four residences surround the exterior hallway, elevator and stair core.", "Cuatro residencias rodean el pasillo exterior, el ascensor y las escaleras."],
        hotspots: [
          { id: "APT.1", points: "805,280 1215,280 1365,455 1365,1085 1040,1085 1040,1060 805,1060 805,800 700,800 700,460 805,460", label: [1080, 690] },
          { id: "APT.2", points: "265,610 405,460 805,460 805,1060 715,1060 715,1285 265,1285", label: [525, 870] },
          { id: "APT.3", points: "265,1285 715,1285 715,1515 805,1515 805,2205 265,2205", label: [525, 1740] },
          { id: "APT.4", points: "805,1400 1040,1400 1040,1375 1365,1375 1365,2205 805,2205", label: [1090, 1760] }
        ]
      },
      "2": {
        name: ["2nd Floor", "2ª Planta"], unitsLabel: "APT.5 – APT.8", image: "/tower/assets/img/floorplans/floor-2.webp", full: "/tower/assets/img/floorplans/floor-2@1200.webp", width: 1600, height: 2604,
        intro: ["Four residences repeat the corner arrangement around the exterior circulation core.", "Cuatro residencias repiten la distribución en esquina alrededor del núcleo de circulación exterior."],
        hotspots: [
          { id: "APT.5", points: "810,300 1245,300 1395,490 1395,1125 1045,1125 1045,1090 810,1090 810,820 705,820 705,490 810,490", label: [1090, 720] },
          { id: "APT.6", points: "235,650 390,490 810,490 810,1090 715,1090 715,1375 235,1375", label: [520, 930] },
          { id: "APT.7", points: "235,1375 715,1375 715,1540 810,1540 810,2390 235,2390", label: [520, 1820] },
          { id: "APT.8", points: "810,1490 1050,1490 1050,1460 1395,1460 1395,2390 810,2390", label: [1090, 1870] }
        ]
      },
      "3": {
        name: ["3rd Floor", "3ª Planta"], unitsLabel: "APT.9 – APT.12", image: "/tower/assets/img/floorplans/floor-3.webp", full: "/tower/assets/img/floorplans/floor-3@1200.webp", width: 1616, height: 2624,
        intro: ["Four residences repeat the real stacked plan around the exterior hallway.", "Cuatro residencias repiten el plano apilado real alrededor del pasillo exterior."],
        hotspots: [
          { id: "APT.9", points: "810,300 1245,300 1400,500 1400,1140 1045,1140 1045,1110 810,1110 810,830 700,830 700,500 810,500", label: [1090, 735] },
          { id: "APT.10", points: "220,660 375,500 810,500 810,1110 710,1110 710,1380 220,1380", label: [510, 940] },
          { id: "APT.11", points: "220,1380 710,1380 710,1535 810,1535 810,2400 220,2400", label: [510, 1840] },
          { id: "APT.12", points: "810,1495 1040,1495 1040,1470 1400,1470 1400,2400 810,2400", label: [1100, 1870] }
        ]
      },
      "4": {
        name: ["4th Floor", "4ª Planta"], unitsLabel: "A13, A14 & L1 – L3", image: "/tower/assets/img/floorplans/floor-4.webp", full: "/tower/assets/img/floorplans/floor-4@1200.webp", width: 1600, height: 2630,
        intro: ["Two single-level residences share this floor with the lower living levels of the three loft maisonettes.", "Dos residencias de una sola planta comparten este nivel con las zonas de estar inferiores de los tres dúplex loft."],
        hotspots: [
          { id: "L2", points: "220,660 365,500 805,500 805,1165 735,1165 735,1220 220,1220", label: [510, 880] },
          { id: "L1", points: "810,310 1245,310 1395,500 1395,1175 1100,1175 1100,1215 810,1215", label: [1100, 780] },
          { id: "L3", points: "220,1220 735,1220 735,1270 810,1270 810,1785 220,1785", label: [500, 1490] },
          { id: "A13", points: "220,1785 810,1785 810,2500 220,2500", label: [500, 2140] },
          { id: "A14", points: "810,1550 1080,1550 1080,1515 1395,1515 1395,2500 810,2500", label: [1100, 2110] }
        ]
      },
      "loft": {
        name: ["Loft & Roof", "Loft y azotea"], unitsLabel: "LOFT.1 – LOFT.3", image: "/tower/assets/img/floorplans/floor-loft.webp", full: "/tower/assets/img/floorplans/floor-loft@1200.webp", width: 1600, height: 2630,
        intro: ["Select a loft upper level; the price and area describe the complete two-level maisonette.", "Seleccione el nivel superior de un loft; el precio y la superficie corresponden al dúplex completo."],
        hotspots: [
          { id: "L2", points: "220,650 365,500 805,500 805,1165 735,1165 735,1220 220,1220", label: [510, 860] },
          { id: "L1", points: "810,500 1245,500 1395,680 1395,1165 1100,1165 1100,1215 810,1215", label: [1100, 820] },
          { id: "L3", points: "220,1220 810,1220 810,1800 220,1800", label: [500, 1510] }
        ]
      }
    };

    function createPlanSvg(name, attrs) {
      var el = doc.createElementNS(SVG_NS, name);
      Object.keys(attrs || {}).forEach(function (key) {
        el.setAttribute(key, attrs[key]);
      });
      return el;
    }

    function resetUnitPanel(floor) {
      activePlanUnit = "";
      unitKicker.textContent = planText(floor.name[0], floor.name[1]);
      unitTitle.textContent = planText("Select a residence", "Seleccione una residencia");
      unitIntro.textContent = planText(floor.intro[0], floor.intro[1]);
      [unitId, unitType, unitBeds, unitBaths, unitArea, unitOutdoor].forEach(function (el) { el.textContent = "—"; });
      unitPriceWrap.hidden = true;
      planEnquire.hidden = true;
    }

    function selectPlanUnit(id) {
      var unit = PLAN_UNITS[id];
      if (!unit) return;
      activePlanUnit = id;
      floorOverlay.querySelectorAll(".floor-hotspot").forEach(function (hotspot) {
        var selected = hotspot.getAttribute("data-unit") === id;
        hotspot.classList.toggle("is-selected", selected);
        hotspot.setAttribute("aria-pressed", selected ? "true" : "false");
      });
      unitKicker.textContent = planText("Selected residence", "Residencia seleccionada");
      unitTitle.textContent = id;
      unitIntro.textContent = planText(unit.note[0], unit.note[1]);
      unitId.textContent = id;
      unitType.textContent = planText(unit.type[0], unit.type[1]);
      unitBeds.textContent = String(unit.beds);
      unitBaths.textContent = String(unit.baths);
      unitArea.textContent = unit.area + " · " + planText(unit.areaBasis[0], unit.areaBasis[1]);
      unitOutdoor.textContent = planText(unit.outdoor[0], unit.outdoor[1]);
      unitPrice.textContent = unit.price;
      unitPriceWrap.hidden = false;
      planEnquire.hidden = false;
    }

    function renderPlanFloor(key) {
      var floor = PLAN_FLOORS[key];
      if (!floor) return;
      floorButtons.forEach(function (button) {
        var selected = button.getAttribute("data-floor") === key;
        button.setAttribute("aria-selected", selected ? "true" : "false");
        button.tabIndex = selected ? 0 : -1;
      });
      floorName.textContent = planText(floor.name[0], floor.name[1]);
      floorUnits.textContent = floor.unitsLabel;
      floorFull.href = floor.full;
      floorImage.src = floor.image;
      floorImage.width = floor.width;
      floorImage.height = floor.height;
      floorImage.alt = planText(
        "Architect's " + floor.name[0] + " plan showing " + floor.unitsLabel,
        "Plano arquitectónico de " + floor.name[1] + " con " + floor.unitsLabel
      );
      floorOverlay.setAttribute("viewBox", "0 0 " + floor.width + " " + floor.height);
      floorOverlay.setAttribute("aria-label", planText(
        "Selectable residences on the " + floor.name[0] + " plan",
        "Residencias seleccionables en el plano de " + floor.name[1]
      ));
      floorOverlay.replaceChildren();

      floor.hotspots.forEach(function (hotspot) {
        var unit = PLAN_UNITS[hotspot.id];
        var group = createPlanSvg("g", {
          "class": "floor-hotspot",
          "data-unit": hotspot.id,
          "role": "button",
          "tabindex": "0",
          "aria-pressed": "false",
          "aria-label": planText("Select ", "Seleccionar ") + hotspot.id + ", " + planText(unit.type[0], unit.type[1]) + ", " + unit.price
        });
        group.appendChild(createPlanSvg("polygon", { "class": "floor-hotspot__shape", "points": hotspot.points }));
        var label = createPlanSvg("g", { "class": "floor-hotspot__label", "transform": "translate(" + hotspot.label[0] + " " + hotspot.label[1] + ")" });
        label.appendChild(createPlanSvg("rect", { "x": "-150", "y": "-42", "width": "300", "height": "84", "rx": "12" }));
        var textEl = createPlanSvg("text", { "x": "0", "y": "12" });
        textEl.textContent = planText("Select ", "Elegir ") + hotspot.id;
        label.appendChild(textEl);
        group.appendChild(label);
        group.addEventListener("click", function () { selectPlanUnit(hotspot.id); });
        group.addEventListener("keydown", function (event) {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            selectPlanUnit(hotspot.id);
          }
        });
        floorOverlay.appendChild(group);
      });
      resetUnitPanel(floor);
    }

    floorButtons.forEach(function (button) {
      button.addEventListener("click", function () {
        renderPlanFloor(button.getAttribute("data-floor"));
      });
      button.addEventListener("keydown", function (event) {
        if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
        event.preventDefault();
        var buttons = Array.prototype.slice.call(floorButtons);
        var current = buttons.indexOf(button);
        var direction = event.key === "ArrowRight" ? 1 : -1;
        var next = buttons[(current + direction + buttons.length) % buttons.length];
        next.focus();
        renderPlanFloor(next.getAttribute("data-floor"));
      });
    });

    planEnquire.addEventListener("click", function () {
      var unit = PLAN_UNITS[activePlanUnit];
      if (!unit) return;
      var interest = doc.querySelector("#interest");
      var message = doc.querySelector("#message");
      var desired = planText(unit.interest[0], unit.interest[1]);
      if (interest) {
        Array.prototype.some.call(interest.options, function (option) {
          if (option.textContent.trim() !== desired) return false;
          interest.value = option.value || option.textContent;
          return true;
        });
      }
      if (message && !message.value.trim()) {
        message.value = planText(
          "I am interested in " + activePlanUnit + ". Please send current availability and the full plan.",
          "Me interesa " + activePlanUnit + ". Por favor, envíenme la disponibilidad actual y el plano completo."
        );
      }
    });

    renderPlanFloor("1");
  }

  /* --- Brochure / quick-contact overlay --------------------------------- */

  var enquiryDialog = doc.querySelector("[data-enquiry-dialog]");
  var enquiryOpeners = doc.querySelectorAll("[data-open-enquiry]");

  if (enquiryDialog && hasDialog) {
    function openEnquiryDialog() {
      if (!enquiryDialog.open) enquiryDialog.showModal();
      body.classList.add("has-modal");
    }

    function closeEnquiryDialog() {
      if (enquiryDialog.open) enquiryDialog.close();
      body.classList.remove("has-modal");
    }

    enquiryOpeners.forEach(function (opener) {
      opener.addEventListener("click", openEnquiryDialog);
    });
    enquiryDialog.querySelector("[data-close-enquiry]").addEventListener("click", closeEnquiryDialog);
    enquiryDialog.addEventListener("click", function (e) {
      if (e.target === enquiryDialog) closeEnquiryDialog();
    });
    enquiryDialog.addEventListener("close", function () { body.classList.remove("has-modal"); });
    var jumpEnquiry = enquiryDialog.querySelector("[data-jump-enquiry]");
    if (jumpEnquiry) {
      jumpEnquiry.addEventListener("click", function () {
        closeEnquiryDialog();
        window.setTimeout(function () {
          var firstField = doc.querySelector("[data-enquiry-form] input:not([type='hidden'])");
          if (firstField) firstField.focus({ preventScroll: true });
        }, 450);
      });
    }
  } else {
    enquiryOpeners.forEach(function (opener) {
      opener.addEventListener("click", function () {
        var target = doc.querySelector("#enquire");
        if (target) target.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth" });
      });
    });
  }

  /* --- Enquiry form ------------------------------------------------------
     Posts to ENQUIRY_ENDPOINT (see the top of this file). If no endpoint is
     configured yet, or the request fails, the enquiry is handed to the
     visitor's mail client instead so it is never silently lost.
     ---------------------------------------------------------------------- */

  var form = doc.querySelector("[data-enquiry-form]");

  if (form) {
    var statusEl = form.querySelector(".form__status");
    var submitBtn = form.querySelector('[type="submit"]');
    var busy = false;
    var startedAt = form.querySelector("[data-started-at]");
    var endpoint = form.getAttribute("data-endpoint") || ENQUIRY_ENDPOINT;

    if (startedAt) startedAt.value = String(Date.now());

    function say(key, state) {
      if (!statusEl) return;
      statusEl.textContent = statusEl.getAttribute("data-msg-" + key) || "";
      statusEl.setAttribute("data-state", state);
    }

    function handToMailClient(lines) {
      var to = form.getAttribute("data-mailto") || "";
      var subject = form.getAttribute("data-subject") || "Website enquiry";
      window.location.href =
        "mailto:" +
        to +
        "?subject=" +
        encodeURIComponent(subject) +
        "&body=" +
        encodeURIComponent(lines.join("\n"));
    }

    form.addEventListener("submit", function (e) {
      e.preventDefault();

      if (busy) return;
      if (!form.reportValidity()) return;

      var data = new FormData(form);
      var lines = [];
      data.forEach(function (value, key) {
        if (key.charAt(0) === "_") return; // service control fields
        lines.push(key + ": " + value);
      });

      // A bot filled the hidden trap field. Accept it and send nothing.
      if (data.get("_gotcha")) {
        say("ok", "ok");
        form.reset();
        return;
      }

      if (!endpoint || !window.fetch) {
        handToMailClient(lines);
        say("mailto", "ok");
        return;
      }

      data.set("_subject", form.getAttribute("data-subject") || "Website enquiry");
      // Found by type, not by name — the field is "Email" on EN, "Correo" on ES.
      var emailField = form.querySelector('input[type="email"]');
      if (emailField && emailField.value) data.set("_replyto", emailField.value);

      busy = true;
      if (submitBtn) submitBtn.disabled = true;
      say("sending", "pending");

      window
        .fetch(endpoint, {
          method: "POST",
          body: data,
          credentials: "same-origin",
          headers: { Accept: "application/json" }
        })
        .then(function (res) {
          if (!res.ok) throw new Error("HTTP " + res.status);
          say("ok", "ok");
          form.reset();
          if (startedAt) startedAt.value = String(Date.now());
        })
        .catch(function () {
          say("error", "error");
          handToMailClient(lines);
        })
        .then(function () {
          busy = false;
          if (submitBtn) submitBtn.disabled = false;
        });
    });
  }

  /* --- Year stamp -------------------------------------------------------- */

  doc.querySelectorAll("[data-year]").forEach(function (el) {
    el.textContent = new Date().getFullYear();
  });
})();
