/* KuT — Onboarding guidé animé (tour multi-pages avec effet « spotlight »).
 *
 * Un seul fichier inclus sur toutes les pages. Il :
 *  - assombrit tout l'écran sauf la zone présentée (spotlight),
 *  - traverse les pages (clients, offres, prestations… puis paramétrage),
 *  - ouvre les vrais formulaires pour montrer « ce qui se passe quand on clique »,
 *  - se relance à chaque ouverture tant que le salon n'est pas paramétré,
 *  - reste relançable à la demande via le bouton « Revoir le guide » (accueil).
 *
 * Aucune dépendance, aucun framework. L'état du tour transite d'une page à
 * l'autre via sessionStorage.
 */
(function () {
  "use strict";

  // ── Page courante (nom de fichier, « index.html » par défaut) ────────────
  var PAGE = (location.pathname.split("/").pop() || "").toLowerCase();
  if (!PAGE) PAGE = "index.html";

  // ── Clés d'état (session : recommence à chaque nouvelle ouverture d'app) ──
  var K_RUN = "kut-tour-run"; // tour en cours ("1")
  var K_STEP = "kut-tour-step"; // index de l'étape courante
  var K_DONE = "kut-tour-done"; // déjà vu/passé pendant cette session ("1")

  function ss(k) {
    try {
      return sessionStorage.getItem(k);
    } catch (e) {
      return null;
    }
  }
  function ssSet(k, v) {
    try {
      sessionStorage.setItem(k, v);
    } catch (e) {}
  }
  function ssDel(k) {
    try {
      sessionStorage.removeItem(k);
    } catch (e) {}
  }

  // ── Helpers page (appellent les fonctions globales définies par chaque page) ─
  function call(fnName) {
    try {
      if (typeof window[fnName] === "function") window[fnName]();
    } catch (e) {}
  }
  function openModalById(id) {
    // Repli générique si la page n'expose pas de fonction d'ouverture.
    var el = document.getElementById(id);
    if (el) el.classList.add("open");
  }
  function closeModalById(id) {
    var el = document.getElementById(id);
    if (el) el.classList.remove("open");
  }

  function salonConfigured() {
    try {
      var p = JSON.parse(localStorage.getItem("profil-magasin-v1") || "{}");
      return !!(p && (p.nom || "").trim());
    } catch (e) {
      return false;
    }
  }

  // ── Logo (ciseaux) pour la diapo de bienvenue ────────────────────────────
  var LOGO =
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="48" height="48" fill="#A22C29" aria-hidden="true"><path d="M22,7.82a1.25,1.25,0,0,0,0-.19v0h0l-2-5A1,1,0,0,0,19,2H5a1,1,0,0,0-.93.63l-2,5h0v0a1.25,1.25,0,0,0,0,.19A.58.58,0,0,0,2,8H2V8a4,4,0,0,0,2,3.4V21a1,1,0,0,0,1,1H19a1,1,0,0,0,1-1V11.44A4,4,0,0,0,22,8V8h0A.58.58,0,0,0,22,7.82ZM13,20H11V16h2Zm5,0H15V15a1,1,0,0,0-1-1H10a1,1,0,0,0-1,1v5H6V12a4,4,0,0,0,3-1.38,4,4,0,0,0,6,0A4,4,0,0,0,18,12Zm0-10a2,2,0,0,1-2-2,1,1,0,0,0-2,0,2,2,0,0,1-4,0A1,1,0,0,0,8,8a2,2,0,0,1-4,.15L5.68,4H18.32L20,8.15A2,2,0,0,1,18,10Z"></path></svg>';

  // ── Le scénario du tour ──────────────────────────────────────────────────
  // page    : fichier sur lequel l'étape se joue
  // sel     : sélecteur de la zone à éclairer (absent = diapo centrée)
  // before  : action jouée avant l'affichage (ex. ouvrir un formulaire)
  // cleanup : action jouée en quittant l'étape (ex. refermer le formulaire)
  var STEPS = [
    {
      page: "index.html",
      welcome: true,
      title: "Bienvenue dans KuT ✂️",
      body:
        "Votre salon, tout-en-un : fichier clients, fidélité, offres, campagnes email et caisse. Suivez ce petit guide animé pour découvrir l'app en moins d'une minute.",
    },
    {
      page: "index.html",
      sel: '.grid a[href="clients.html"]',
      title: "1 · Vos clients",
      body:
        "Le fichier de tous vos clients et leur historique de visites. C'est le point de départ de l'app.",
    },
    {
      page: "clients.html",
      sel: ".fab",
      title: "Ajouter un client",
      body:
        "Le bouton « + » en bas à droite crée une nouvelle fiche. Voyons ce qui se passe quand on clique…",
    },
    {
      page: "clients.html",
      sel: "#ov .modal",
      before: function () {
        call("openNew");
      },
      cleanup: function () {
        call("close_");
      },
      title: "La fiche client",
      body:
        "Renseignez le nom, le téléphone, l'email, la date de naissance (pour l'offre anniversaire) puis cochez l'accord d'envoi d'offres. Enfin « Enregistrer ».",
    },
    {
      page: "offres.html",
      sel: ".btn-hdr",
      title: "2 · Les offres",
      body:
        "Créez des promotions et avantages : remises, parrainage, anniversaire… Tout commence par « + Nouvelle offre ».",
    },
    {
      page: "offres.html",
      sel: "#overlay .modal",
      before: function () {
        call("openModal");
      },
      cleanup: function () {
        call("closeModal");
        closeModalById("overlay");
      },
      title: "Configurer l'offre",
      body:
        "Donnez un nom, une réduction, une description et une date de validité. Vous pouvez même y associer un email prêt à l'emploi.",
    },
    {
      page: "prestations.html",
      sel: "main .card",
      title: "3 · Vos prestations",
      body:
        "Listez vos prestations et leurs tarifs. Elles se cochent à chaque passage et alimentent le calcul du panier moyen.",
    },
    {
      page: "campagnes.html",
      sel: "main .card",
      title: "4 · Les campagnes",
      body:
        "Envoyez des emails ciblés depuis votre propre Gmail : choisissez les destinataires, un objet, un message, et c'est parti.",
    },
    {
      page: "templates.html",
      sel: ".btn-hdr",
      title: "5 · Les modèles d'email",
      body:
        "Gagnez du temps avec des modèles réutilisables pour vos campagnes. « + Nouveau » pour en créer un.",
    },
    {
      page: "caisse.html",
      sel: ".card--ecart",
      title: "6 · La caisse",
      body:
        "Faites votre clôture journalière : comptez les espèces, calculez l'écart de caisse et gardez l'historique.",
    },
    {
      page: "index.html",
      sel: ".btn-config",
      title: "7 · Le paramétrage",
      body:
        "Pour finir : le bouton « Mon salon » regroupe vos informations et la synchronisation Google Drive.",
    },
    {
      page: "index.html",
      sel: "#overlay .modal",
      last: true,
      before: function () {
        call("openModal");
      },
      // Pas de cleanup : on laisse la fiche ouverte pour qu'il la remplisse.
      title: "À vous de jouer ✂️",
      body:
        "Renseignez au moins le nom de votre salon pour démarrer — c'est la seule étape obligatoire. Vous pourrez revoir ce guide à tout moment. Bon salon !",
    },
  ];

  // ── Styles (injectés une seule fois) ───────────────────────────────────
  function injectCSS() {
    if (document.getElementById("kt-tour-css")) return;
    var css =
      "" +
      // Écrans figés pendant le tour : pas de curseur clignotant ni de sélection.
      "html.kt-touring input,html.kt-touring textarea{caret-color:transparent}" +
      "html.kt-touring ::selection{background:transparent}" +
      ".kt-ov{position:fixed;inset:0;z-index:2147483000;pointer-events:auto;opacity:0;transition:opacity .25s ease}" +
      ".kt-ov.kt-in{opacity:1}" +
      ".kt-spot{position:fixed;top:0;left:0;width:0;height:0;border-radius:16px;pointer-events:none;" +
      "box-shadow:0 0 0 9999px rgba(11,14,13,.74),0 0 0 3px rgba(162,44,41,.95),0 0 22px 6px rgba(162,44,41,.45);" +
      "transition:top .45s cubic-bezier(.6,.05,.25,1),left .45s cubic-bezier(.6,.05,.25,1),width .45s cubic-bezier(.6,.05,.25,1),height .45s cubic-bezier(.6,.05,.25,1)}" +
      ".kt-spot.kt-hidden{box-shadow:0 0 0 9999px rgba(11,14,13,.82);width:0;height:0;left:50%;top:50%}" +
      "@keyframes kt-pulse{0%,100%{box-shadow:0 0 0 9999px rgba(11,14,13,.74),0 0 0 3px rgba(162,44,41,.95),0 0 0 0 rgba(162,44,41,.5)}50%{box-shadow:0 0 0 9999px rgba(11,14,13,.74),0 0 0 3px rgba(162,44,41,.95),0 0 0 9px rgba(162,44,41,0)}}" +
      ".kt-spot.kt-pulse{animation:kt-pulse 1.8s ease-out infinite}" +
      ".kt-pop{position:fixed;z-index:2147483001;max-width:340px;width:calc(100vw - 32px);background:#fff;color:#1C2321;" +
      "border-radius:18px;padding:1.15rem 1.2rem 1rem;box-shadow:0 18px 50px rgba(0,0,0,.45);" +
      "font-family:'Manrope',-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;opacity:0;transform:translateY(8px);" +
      "transition:opacity .3s ease,transform .3s ease,top .35s ease,left .35s ease}" +
      ".kt-pop.kt-in{opacity:1;transform:translateY(0)}" +
      ".kt-pop h3{font-size:1.06rem;font-weight:800;margin:0 0 .4rem;letter-spacing:-.01em}" +
      ".kt-pop p{font-size:.9rem;line-height:1.45;color:#41484a;margin:0 0 .9rem}" +
      ".kt-logo{display:flex;justify-content:center;margin-bottom:.5rem}" +
      ".kt-pop.kt-welcome{text-align:center;max-width:360px}" +
      ".kt-pop.kt-welcome h3{font-size:1.35rem}" +
      ".kt-pop.kt-welcome p{font-size:.95rem;color:#41484a}" +
      ".kt-dots{display:flex;gap:5px;justify-content:center;margin-bottom:.85rem}" +
      ".kt-dot{width:6px;height:6px;border-radius:50%;background:#d4dbde;transition:all .25s}" +
      ".kt-dot.on{background:#A22C29;width:18px;border-radius:4px}" +
      ".kt-row{display:flex;align-items:center;gap:.5rem;justify-content:space-between}" +
      ".kt-btn{font-family:inherit;font-weight:700;font-size:.86rem;border-radius:11px;cursor:pointer;padding:.6rem 1rem;border:none;transition:all .15s;white-space:nowrap}" +
      ".kt-skip{background:none;color:#8a939a;padding:.6rem .4rem}" +
      ".kt-skip:hover{color:#41484a}" +
      ".kt-prev{background:#EEF1EF;color:#1C2321;padding:.6rem .8rem}" +
      ".kt-prev:hover{background:#e1e7e4}" +
      ".kt-next{background:#A22C29;color:#fff}" +
      ".kt-next:hover{background:#8a2422}" +
      ".kt-grow{flex:1}" +
      ".kt-replay{position:fixed;left:14px;bottom:14px;z-index:9000;background:#1C2321;color:#fff;border:none;" +
      "border-radius:22px;padding:.55rem .95rem;font-size:.8rem;font-weight:700;font-family:inherit;cursor:pointer;" +
      "box-shadow:0 4px 16px rgba(28,35,33,.28);display:flex;align-items:center;gap:.4rem;opacity:.92}" +
      ".kt-replay:hover{opacity:1}" +
      /* Mode sombre */
      'html[data-theme="dark"] .kt-pop{background:#1F2528;color:#E7ECEE}' +
      'html[data-theme="dark"] .kt-pop p{color:#9AA6AE}' +
      'html[data-theme="dark"] .kt-pop.kt-welcome p{color:#9AA6AE}' +
      'html[data-theme="dark"] .kt-dot{background:#3a4347}' +
      'html[data-theme="dark"] .kt-prev{background:#2a3236;color:#E7ECEE}' +
      'html[data-theme="dark"] .kt-prev:hover{background:#333d42}' +
      'html[data-theme="dark"] .kt-skip{color:#7f8c94}' +
      'html[data-theme="dark"] .kt-replay{background:#0E1214}';
    var st = document.createElement("style");
    st.id = "kt-tour-css";
    st.textContent = css;
    document.head.appendChild(st);
  }

  // ── État runtime ─────────────────────────────────────────────────────────
  var ov = null,
    spot = null,
    pop = null,
    curEl = null,
    curStep = -1;

  function buildUI() {
    injectCSS();
    if (ov) return;
    ov = document.createElement("div");
    ov.className = "kt-ov";
    spot = document.createElement("div");
    spot.className = "kt-spot";
    pop = document.createElement("div");
    pop.className = "kt-pop";
    ov.appendChild(spot);
    ov.appendChild(pop);
    document.body.appendChild(ov);
    // Bloque le scroll de fond, mais laisse les formulaires ouverts respirer.
    requestAnimationFrame(function () {
      ov.classList.add("kt-in");
    });
    window.addEventListener("resize", reposition, { passive: true });
    window.addEventListener("scroll", reposition, { passive: true, capture: true });
    document.addEventListener("keydown", onKey, true);
    // Rend les écrans montrés non interactifs (effet « capture figée ») :
    // aucun champ ne peut prendre le focus → pas de clavier mobile intempestif.
    document.documentElement.classList.add("kt-touring");
    document.addEventListener("focusin", guardFocus, true);
    lockFields();
    blurActive();
  }

  // Verrouille tous les champs en lecture seule AVANT que les formulaires
  // présentés ne tentent de se focus : un champ readonly n'ouvre jamais le
  // clavier mobile. Restauré à la fin du tour.
  var lockedFields = [];
  function lockFields() {
    lockedFields = [];
    var nodes = document.querySelectorAll("input, textarea");
    for (var i = 0; i < nodes.length; i++) {
      var n = nodes[i];
      var t = (n.type || "").toLowerCase();
      if (t === "checkbox" || t === "radio" || t === "file" || t === "hidden")
        continue;
      if (n.readOnly) continue; // déjà readonly : on n'y touche pas
      n.readOnly = true;
      n.setAttribute("data-kt-locked", "1");
      n.setAttribute("inputmode", "none");
      lockedFields.push(n);
    }
  }
  function unlockFields() {
    for (var i = 0; i < lockedFields.length; i++) {
      var n = lockedFields[i];
      n.readOnly = false;
      n.removeAttribute("data-kt-locked");
      n.removeAttribute("inputmode");
    }
    lockedFields = [];
  }

  // Empêche tout champ de garder le focus pendant le tour.
  function guardFocus(e) {
    var t = e.target;
    if (!t || !t.matches) return;
    if (t.closest && t.closest(".kt-pop")) return; // nos propres boutons
    if (t.matches('input,textarea,select,[contenteditable="true"]')) {
      try {
        t.blur();
      } catch (err) {}
    }
  }
  function blurActive() {
    try {
      var a = document.activeElement;
      if (a && a.blur && a !== document.body) a.blur();
    } catch (e) {}
  }

  function onKey(e) {
    if (e.key === "Escape") {
      e.preventDefault();
      end(false);
    } else if (e.key === "ArrowRight" || e.key === "Enter") {
      e.preventDefault();
      go(1);
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      go(-1);
    }
  }

  function teardown() {
    window.removeEventListener("resize", reposition, { passive: true });
    window.removeEventListener("scroll", reposition, { capture: true });
    document.removeEventListener("keydown", onKey, true);
    document.removeEventListener("focusin", guardFocus, true);
    unlockFields();
    document.documentElement.classList.remove("kt-touring");
    if (ov && ov.parentNode) ov.parentNode.removeChild(ov);
    ov = spot = pop = curEl = null;
    curStep = -1;
  }

  // ── Rendu d'une étape ────────────────────────────────────────────────────
  function showStep(i) {
    var s = STEPS[i];
    if (!s) {
      end(false);
      return;
    }
    curStep = i;
    if (s.before) {
      try {
        s.before();
      } catch (e) {}
    }

    if (s.welcome) {
      curEl = null;
      renderPop(i, null);
      spot.classList.add("kt-hidden");
      spot.classList.remove("kt-pulse");
      return;
    }

    spot.classList.remove("kt-hidden");
    // Laisse le temps à un éventuel formulaire de s'afficher avant la mesure.
    var delay = s.before ? 90 : 0;
    setTimeout(function () {
      var el = document.querySelector(s.sel);
      if (!el) {
        // Zone introuvable sur cette page : on passe sans bloquer.
        advanceSafe(i);
        return;
      }
      curEl = el;
      try {
        el.scrollIntoView({ block: "center", behavior: "smooth" });
      } catch (e) {}
      setTimeout(function () {
        placeSpot(el);
        renderPop(i, el);
      }, 260);
    }, delay);
  }

  // Évite une boucle si plusieurs zones manquent à la suite.
  function advanceSafe(i) {
    if (i + 1 >= STEPS.length) {
      end(false);
      return;
    }
    go(1);
  }

  function placeSpot(el) {
    var r = el.getBoundingClientRect();
    var pad = 8;
    var top = Math.max(6, r.top - pad);
    var left = Math.max(6, r.left - pad);
    var w = Math.min(window.innerWidth - 12, r.width + pad * 2);
    var h = Math.min(window.innerHeight - 12, r.height + pad * 2);
    spot.style.top = top + "px";
    spot.style.left = left + "px";
    spot.style.width = w + "px";
    spot.style.height = h + "px";
    spot.classList.add("kt-pulse");
  }

  function reposition() {
    if (!ov || curStep < 0) return;
    var s = STEPS[curStep];
    if (s && s.welcome) {
      centerPop();
      return;
    }
    if (curEl && document.body.contains(curEl)) {
      placeSpot(curEl);
      placePop(curEl);
    }
  }

  function renderPop(i, el) {
    var s = STEPS[i];
    var dots = "";
    for (var d = 0; d < STEPS.length; d++) {
      dots += '<span class="kt-dot' + (d === i ? " on" : "") + '"></span>';
    }
    var nextLabel = s.welcome
      ? "Commencer ✂️"
      : s.last
      ? "Terminer ✓"
      : "Suivant →";
    var prevBtn =
      i > 0
        ? '<button class="kt-btn kt-prev" data-kt="prev" aria-label="Précédent">←</button>'
        : "";
    var html =
      (s.welcome ? '<div class="kt-logo">' + LOGO + "</div>" : "") +
      "<h3>" +
      s.title +
      "</h3>" +
      "<p>" +
      s.body +
      "</p>" +
      '<div class="kt-dots">' +
      dots +
      "</div>" +
      '<div class="kt-row">' +
      '<button class="kt-btn kt-skip" data-kt="skip">Passer le guide</button>' +
      '<span class="kt-grow"></span>' +
      prevBtn +
      '<button class="kt-btn kt-next" data-kt="next">' +
      nextLabel +
      "</button>" +
      "</div>";
    pop.className = "kt-pop" + (s.welcome ? " kt-welcome" : "");
    pop.innerHTML = html;
    pop.onclick = function (e) {
      var b = e.target.closest("[data-kt]");
      if (!b) return;
      var a = b.getAttribute("data-kt");
      if (a === "next") go(1);
      else if (a === "prev") go(-1);
      else if (a === "skip") end(false);
    };

    if (s.welcome || !el) centerPop();
    else placePop(el);

    requestAnimationFrame(function () {
      pop.classList.add("kt-in");
    });
  }

  function centerPop() {
    pop.style.left = "50%";
    pop.style.top = "50%";
    pop.style.transform = "translate(-50%,-50%)";
  }

  function placePop(el) {
    var r = el.getBoundingClientRect();
    var vw = window.innerWidth,
      vh = window.innerHeight;
    var pr = pop.getBoundingClientRect();
    var pw = pr.width || 320,
      ph = pr.height || 180;
    var margin = 16;
    var tall = r.height > vh * 0.62;
    var below = vh - r.bottom;
    var above = r.top;
    var top, left;
    pop.style.transform = "none";

    if (tall || (below < ph + margin && above < ph + margin)) {
      // Cible trop grande (formulaire plein écran) : on épingle en bas.
      left = (vw - pw) / 2;
      top = vh - ph - margin;
      if (r.top > vh / 2) top = margin; // cible en bas → carte en haut
    } else if (below >= ph + margin) {
      top = r.bottom + margin;
      left = r.left + r.width / 2 - pw / 2;
    } else {
      top = r.top - ph - margin;
      left = r.left + r.width / 2 - pw / 2;
    }
    left = Math.max(margin, Math.min(left, vw - pw - margin));
    top = Math.max(margin, Math.min(top, vh - ph - margin));
    pop.style.left = left + "px";
    pop.style.top = top + "px";
  }

  // ── Navigation ───────────────────────────────────────────────────────────
  function runCleanup(i) {
    var s = STEPS[i];
    if (s && s.cleanup) {
      try {
        s.cleanup();
      } catch (e) {}
    }
  }

  function go(delta) {
    var cur = curStep;
    runCleanup(cur);
    var ni = cur + delta;
    if (ni < 0) ni = 0;
    if (ni >= STEPS.length) {
      end(true);
      return;
    }
    var nstep = STEPS[ni];
    ssSet(K_STEP, String(ni));
    ssSet(K_RUN, "1");
    if (nstep.page !== PAGE) {
      // L'étape suivante est sur une autre page : on y navigue, le tour reprend.
      location.href = nstep.page;
      return;
    }
    // Réinitialise l'animation d'entrée de la bulle.
    if (pop) pop.classList.remove("kt-in");
    showStep(ni);
  }

  function start(i) {
    ssSet(K_RUN, "1");
    ssSet(K_STEP, String(i || 0));
    ssDel(K_DONE);
    buildUI();
    showStep(i || 0);
  }

  // keepModal : ne ferme pas le dernier formulaire (paramétrage) pour qu'il
  // puisse être rempli immédiatement.
  function end(keepModal) {
    if (!keepModal) runCleanup(curStep);
    ssDel(K_RUN);
    ssDel(K_STEP);
    ssSet(K_DONE, "1");
    teardown();
    if (keepModal) {
      // Met le focus sur le nom du salon si le formulaire est ouvert.
      setTimeout(function () {
        var n = document.getElementById("fNom");
        if (n) {
          try {
            n.focus();
          } catch (e) {}
        }
      }, 200);
    }
  }

  // ── Bouton « Revoir le guide » (accueil uniquement) ──────────────────────
  function injectReplay() {
    if (PAGE !== "index.html") return;
    if (document.getElementById("kt-replay")) return;
    injectCSS();
    var b = document.createElement("button");
    b.id = "kt-replay";
    b.className = "kt-replay";
    b.type = "button";
    b.innerHTML =
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="15" height="15" fill="currentColor" aria-hidden="true"><path d="M12,2A10,10,0,1,0,22,12,1,1,0,0,0,20,12a8,8,0,1,1-2.3-5.6V8a1,1,0,0,0,2,0V3a1,1,0,0,0-1-1H14a1,1,0,0,0,0,2h2.4A10,10,0,0,0,12,2Zm-.2,5a1,1,0,0,0-1,1v4a1,1,0,0,0,.4.8l3,2.2a1,1,0,0,0,1.2-1.6L12.8,11.5V8A1,1,0,0,0,11.8,7Z"></path></svg>' +
      "Revoir le guide";
    b.addEventListener("click", function () {
      start(0);
    });
    document.body.appendChild(b);
  }

  // ── Démarrage ────────────────────────────────────────────────────────────
  function boot() {
    var running = ss(K_RUN) === "1";
    var stepIdx = parseInt(ss(K_STEP) || "0", 10) || 0;

    if (running) {
      var s = STEPS[stepIdx];
      if (s && s.page === PAGE) {
        buildUI();
        showStep(stepIdx);
      }
      // Sinon : étape sur une autre page, on attend d'y arriver.
    } else if (
      PAGE === "index.html" &&
      !salonConfigured() &&
      ss(K_DONE) !== "1"
    ) {
      // À chaque ouverture, tant que le salon n'est pas paramétré.
      start(0);
    }

    injectReplay();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
