/* Beijer Elektro: navigatie, projectfoto's en het offerteformulier. */

(function () {
  "use strict";

  /* ---------------------------------------------------------------
     Mobiel menu
     --------------------------------------------------------------- */
  const toggle = document.querySelector("[data-nav-toggle]");
  const nav = document.getElementById("nav");

  if (toggle && nav) {
    const openIcon = toggle.querySelector("[data-icon-open]");
    const closeIcon = toggle.querySelector("[data-icon-close]");

    const setOpen = (open) => {
      nav.dataset.open = String(open);
      toggle.setAttribute("aria-expanded", String(open));
      if (openIcon) openIcon.hidden = open;
      if (closeIcon) closeIcon.hidden = !open;
    };

    toggle.addEventListener("click", () => {
      setOpen(nav.dataset.open !== "true");
    });

    nav.addEventListener("click", (event) => {
      if (event.target.closest("a")) setOpen(false);
    });

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && nav.dataset.open === "true") {
        setOpen(false);
        toggle.focus();
      }
    });

    window.addEventListener("resize", () => {
      if (window.innerWidth > 900 && nav.dataset.open === "true") setOpen(false);
    });
  }

  /* ---------------------------------------------------------------
     Projectfoto's: de illustratie wordt vervangen zodra er een foto
     met dezelfde bestandsnaam in assets/img/projecten staat.
     --------------------------------------------------------------- */
  const photoSlots = document.querySelectorAll("[data-photo-slot]");

  if (photoSlots.length > 0) {
    fetch("assets/img/projecten/manifest.json", { cache: "no-store" })
      .then((response) => (response.ok ? response.json() : {}))
      .then((manifest) => {
        photoSlots.forEach((slot) => {
          const photo = manifest[slot.dataset.photoSlot];
          if (!photo) return;

          const image = document.createElement("img");
          image.className = "project__photo";
          image.src = photo.src;
          image.alt = photo.alt;
          image.width = 1200;
          image.height = 900;
          image.loading = "lazy";
          image.decoding = "async";

          const placeholder = slot.querySelector(".project__slot");
          if (placeholder) placeholder.replaceWith(image);
        });
      })
      .catch(() => {
        /* Geen manifest of netwerkfout: de illustraties blijven staan. */
      });
  }

  /* ---------------------------------------------------------------
     Offerteaanvraag
     --------------------------------------------------------------- */
  const form = document.getElementById("offerte-form");

  if (!form) return;

  const status = document.getElementById("form-status");
  const result = document.getElementById("form-result");
  const resultTitle = result.querySelector("[data-result-title]");
  const resultText = result.querySelector("[data-result-text]");
  const resetButton = result.querySelector("[data-result-reset]");
  const submitButton = form.querySelector("[data-submit]");
  const submitLabel = form.querySelector("[data-submit-label]");
  const spinner = form.querySelector("[data-spinner]");

  const rules = {
    naam: (value) =>
      value.trim().length >= 2 ? "" : "Vul uw naam in, minimaal 2 letters.",
    telefoon: (value) => {
      const digits = value.replace(/\D/g, "");
      return digits.length >= 6 ? "" : "Vul een telefoonnummer in waar wij u kunnen bellen.";
    },
    email: (value) =>
      /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value.trim())
        ? ""
        : "Vul een geldig e-mailadres in.",
    type: (value) => (value ? "" : "Kies het type klus."),
    omschrijving: (value) =>
      value.trim().length >= 10
        ? ""
        : "Omschrijf kort wat er moet gebeuren, minimaal 10 tekens.",
  };

  const errorElement = (field) => document.getElementById(field.id + "-error");

  const setError = (field, message) => {
    const target = errorElement(field);
    if (!target) return;
    target.textContent = message;
    target.hidden = message === "";
    if (message) {
      field.setAttribute("aria-invalid", "true");
    } else {
      field.removeAttribute("aria-invalid");
    }
  };

  const clearAllErrors = () => {
    Object.keys(rules).forEach((name) => {
      const field = form.elements[name];
      if (field) setError(field, "");
    });
    const checkbox = form.elements["akkoord"];
    if (checkbox) setError(checkbox, "");
  };

  const validate = () => {
    const problems = [];

    Object.keys(rules).forEach((name) => {
      const field = form.elements[name];
      if (!field) return;
      const message = rules[name](field.value);
      setError(field, message);
      if (message) problems.push(field);
    });

    const checkbox = form.elements["akkoord"];
    if (checkbox) {
      const message = checkbox.checked ? "" : "Zet dit vinkje aan om uw aanvraag te versturen.";
      setError(checkbox, message);
      if (message) problems.push(checkbox);
    }

    return problems;
  };

  let submitted = false;

  form.addEventListener("input", (event) => {
    if (!submitted) return;
    const field = event.target;
    if (field.name && rules[field.name]) {
      setError(field, rules[field.name](field.value));
    }
    if (field.name === "akkoord") {
      setError(field, field.checked ? "" : "Zet dit vinkje aan om uw aanvraag te versturen.");
    }
  });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    submitted = true;

    const problems = validate();

    if (problems.length > 0) {
      status.className = "form-card__note form-card__note--error";
      status.textContent =
        problems.length === 1
          ? "Er staat nog 1 veld klaar dat wij nog nodig hebben."
          : "Er staan nog " +
            problems.length +
            " velden klaar die wij nog nodig hebben.";
      problems[0].focus();
      return;
    }

    const payload = {
      naam: form.elements["naam"].value.trim(),
      telefoon: form.elements["telefoon"].value.trim(),
      email: form.elements["email"].value.trim(),
      adres: form.elements["adres"].value.trim(),
      plaats: form.elements["plaats"].value.trim(),
      type: form.elements["type"].value,
      spoed: form.elements["spoed"].value,
      omschrijving: form.elements["omschrijving"].value.trim(),
      akkoord: form.elements["akkoord"].checked ? "ja" : "nee",
      website: form.elements["website"].value,
    };

    submitButton.disabled = true;
    submitButton.setAttribute("aria-disabled", "true");
    submitLabel.textContent = "Bezig met versturen";
    if (spinner) spinner.hidden = false;
    status.className = "form-card__note";
    status.textContent = "Wij versturen uw aanvraag.";

    try {
      const response = await fetch("/api/offertes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        if (data.errors) {
          Object.keys(data.errors).forEach((name) => {
            const field = form.elements[name];
            if (field) setError(field, data.errors[name]);
          });
          const firstName = Object.keys(data.errors)[0];
          if (firstName && form.elements[firstName]) form.elements[firstName].focus();
        }
        throw new Error("verzenden mislukt");
      }

      form.hidden = true;
      result.hidden = false;
      resultTitle.textContent = "Aanvraag verzonden";
      resultText.textContent =
        "Wij nemen binnen 24 uur contact met u op. Spoed? Bel gerust zelf " +
        "0181 212 765, wij zijn 24/7 bereikbaar.";
      result.focus();
    } catch (error) {
      status.className = "form-card__note form-card__note--error";
      status.textContent =
        "Verzenden lukte niet. Probeer het nog eens, of bel ons op 0181 212 765. Uw ingevulde gegevens staan nog in het formulier.";
    } finally {
      submitButton.disabled = false;
      submitButton.removeAttribute("aria-disabled");
      submitLabel.textContent = "Offerte aanvragen";
      if (spinner) spinner.hidden = true;
    }
  });

  resetButton.addEventListener("click", () => {
    form.reset();
    clearAllErrors();
    submitted = false;
    result.hidden = true;
    form.hidden = false;
    status.className = "form-card__note";
    status.textContent = "Velden met een sterretje zijn verplicht.";
    form.elements["naam"].focus();
  });
})();
