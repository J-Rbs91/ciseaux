/* KuT — Onboarding guidé animé (tour multi-pages, cinématique).
 *
 * Un seul fichier inclus sur toutes les pages. Il :
 *  - floute tout l'écran sauf la zone présentée (qui reste nette),
 *  - joue chaque slide en plusieurs « plans » animés (zoom/dézoom) qui
 *    s'enchaînent tout seuls, sans avoir à cliquer « Suivant »,
 *  - en fin de slide, propose « Revoir » ou « Suivant »,
 *  - traverse les pages (clients, offres, prestations… puis paramétrage),
 *  - ouvre les vrais formulaires pour montrer « ce qui se passe »,
 *  - se relance à chaque ouverture tant que le salon n'est pas paramétré,
 *  - reste relançable via le bouton « Revoir le guide » (accueil).
 *
 * Aucune dépendance. L'état du tour transite d'une page à l'autre via
 * sessionStorage.
 */
(function () {
  "use strict";

  // ── Page courante ────────────────────────────────────────────────────────
  var PAGE = (location.pathname.split("/").pop() || "").toLowerCase();
  if (!PAGE) PAGE = "index.html";

  // ── Clés d'état (session) ────────────────────────────────────────────────
  var K_RUN = "kut-tour-run";
  var K_STEP = "kut-tour-step";
  var K_DONE = "kut-tour-done";

  function ss(k) { try { return sessionStorage.getItem(k); } catch (e) { return null; } }
  function ssSet(k, v) { try { sessionStorage.setItem(k, v); } catch (e) {} }
  function ssDel(k) { try { sessionStorage.removeItem(k); } catch (e) {} }

  function call(fnName) {
    try { if (typeof window[fnName] === "function") window[fnName](); } catch (e) {}
  }
  function closeModalById(id) {
    var el = document.getElementById(id);
    if (el) el.classList.remove("open");
  }

  function salonConfigured() {
    try {
      var p = JSON.parse(localStorage.getItem("profil-magasin-v1") || "{}");
      return !!(p && (p.nom || "").trim());
    } catch (e) { return false; }
  }

  var LOGO =
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="48" height="48" fill="#A22C29" aria-hidden="true"><path d="M22,7.82a1.25,1.25,0,0,0,0-.19v0h0l-2-5A1,1,0,0,0,19,2H5a1,1,0,0,0-.93.63l-2,5h0v0a1.25,1.25,0,0,0,0,.19A.58.58,0,0,0,2,8H2V8a4,4,0,0,0,2,3.4V21a1,1,0,0,0,1,1H19a1,1,0,0,0,1-1V11.44A4,4,0,0,0,22,8V8h0A.58.58,0,0,0,22,7.82ZM13,20H11V16h2Zm5,0H15V15a1,1,0,0,0-1-1H10a1,1,0,0,0-1,1v5H6V12a4,4,0,0,0,3-1.38,4,4,0,0,0,6,0A4,4,0,0,0,18,12Zm0-10a2,2,0,0,1-2-2,1,1,0,0,0-2,0,2,2,0,0,1-4,0A1,1,0,0,0,8,8a2,2,0,0,1-4,.15L5.68,4H18.32L20,8.15A2,2,0,0,1,18,10Z"></path></svg>';

  // ── Scénario ──────────────────────────────────────────────────────────────
  // Chaque slide peut définir :
  //  page, welcome, last, before, cleanup, title, body
  //  overviewSel : zone montrée en plan d'ensemble (1er plan de la slide)
  //  sel         : zone unique (slide simple sans sous-plans)
  //  shots[]     : sous-plans { sel, text, zoom?, hold? }
  var SLIDES = [
    {
      page: "index.html",
      welcome: true,
      title: "Bienvenue dans KuT ✂️",
      body:
        "Votre salon, tout-en-un : fichier clients, fidélité, offres, campagnes email et caisse. Laissez-vous guider, tout défile tout seul.",
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
      before: function () { call("openNew"); },
      cleanup: function () { call("close_"); },
      title: "La fiche client",
      body: "Voici la fiche : on renseigne les infos du client, puis on enregistre.",
      overviewSel: "#ov .modal",
      shots: [
        { sel: "#fN", text: "Le nom et prénom du client — champ obligatoire." },
        { sel: "#fT", text: "Son numéro de téléphone." },
        { sel: "#fE", text: "Son email — obligatoire lui aussi (offres, campagnes, rappels)." },
        { sel: "#fDob", text: "Sa date de naissance, pour l'offre d'anniversaire." },
        { sel: "#ov .check", text: "L'accord pour recevoir les offres par email." },
        { sel: "#ov .btn-p", text: "Puis « Enregistrer ». Et voilà, fiche créée !" },
      ],
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
      before: function () { call("openModal"); },
      cleanup: function () { call("closeModal"); closeModalById("overlay"); },
      title: "Configurer l'offre",
      body: "Une offre se compose en quelques champs.",
      overviewSel: "#overlay .modal",
      shots: [
        { sel: "#fNom", text: "Le nom de l'offre." },
        { sel: "#fReduction", text: "La réduction ou l'avantage accordé." },
        { sel: "#fDesc", text: "Une petite description." },
        { sel: "#fDate", text: "Sa date de validité." },
        { sel: "#fAnniv", text: "Option : en faire une offre anniversaire automatique." },
        { sel: "#overlay .btn-primary", text: "« Enregistrer » pour publier l'offre." },
      ],
    },
    {
      page: "prestations.html",
      sel: "main .card",
      title: "3 · Vos prestations",
      body:
        "Listez vos prestations et leurs tarifs. Elles se cochent à chaque passage et alimentent le panier moyen.",
    },
    {
      page: "campagnes.html",
      sel: "main .card",
      title: "4 · Les campagnes",
      body:
        "Envoyez des emails ciblés depuis votre propre Gmail : destinataires, objet, message, et c'est parti.",
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
        "Pour finir : le bouton « Mon salon » regroupe vos infos et la synchronisation Google Drive.",
    },
    {
      page: "index.html",
      last: true,
      before: function () { call("openModal"); },
      title: "À vous de jouer ✂️",
      body: "Dernière étape : renseignez les infos de votre salon.",
      overviewSel: "#overlay .modal",
      shots: [
        { sel: "#fNom", text: "Le nom de votre salon — la seule info obligatoire." },
        { sel: "#fAdresse", text: "Votre adresse." },
        { sel: "#fTel", text: "Votre téléphone." },
        { sel: "#fMail", text: "Votre email." },
        { sel: "#overlay .btn-primary", text: "« Enregistrer » et c'est parti. Bon salon ! ✂️" },
      ],
    },
  ];

  // Capacité du navigateur à découper un trou net dans le flou.
  var SUPPORTS_HOLE =
    !!(window.CSS && CSS.supports && CSS.supports("clip-path", 'path("M0 0Z")'));

  // ── Styles ─────────────────────────────────────────────────────────────
  function injectCSS() {
    if (document.getElementById("kt-tour-css")) return;
    var ease = "cubic-bezier(.6,.05,.25,1)";
    var css =
      "" +
      // Écrans figés : pas de curseur, pas de sélection.
      "html.kt-touring input,html.kt-touring textarea{caret-color:transparent}" +
      "html.kt-touring ::selection{background:transparent}" +
      "html.kt-touring [data-kt-locked]{opacity:1!important;cursor:default!important;-webkit-text-fill-color:currentColor;color:inherit}" +
      // Élément mis en avant : zoomé en douceur (effet « loupe »).
      ".kt-zoom{transition:transform .55s cubic-bezier(.34,1.25,.45,1)!important;will-change:transform}" +
      // Conteneur
      ".kt-ov{position:fixed;inset:0;z-index:2147483000;pointer-events:auto;opacity:0;transition:opacity .3s ease}" +
      ".kt-ov.kt-in{opacity:1}" +
      // Couche floue + sombre, avec trou net (clip-path) qui se déplace.
      ".kt-blur{position:fixed;inset:0;background:rgba(9,12,11,.46);" +
      "-webkit-backdrop-filter:blur(7px);backdrop-filter:blur(7px);" +
      "transition:clip-path .55s " + ease + ",-webkit-clip-path .55s " + ease + "}" +
      // Repli sans clip-path : simple assombrissement par box-shadow.
      ".kt-spot{position:fixed;top:0;left:0;width:0;height:0;border-radius:18px;pointer-events:none;" +
      "box-shadow:0 0 0 9999px rgba(9,12,11,.76);" +
      "transition:top .55s " + ease + ",left .55s " + ease + ",width .55s " + ease + ",height .55s " + ease + "}" +
      // Anneau lumineux autour de la zone nette.
      ".kt-ring{position:fixed;top:0;left:0;width:0;height:0;border-radius:18px;pointer-events:none;opacity:0;" +
      "box-shadow:0 0 0 2px rgba(255,255,255,.92),0 0 0 5px rgba(162,44,41,.92),0 0 30px 7px rgba(162,44,41,.5);" +
      "transition:top .55s " + ease + ",left .55s " + ease + ",width .55s " + ease + ",height .55s " + ease + ",opacity .3s ease}" +
      ".kt-ring.kt-on{opacity:1}" +
      "@keyframes kt-breathe{0%,100%{box-shadow:0 0 0 2px rgba(255,255,255,.92),0 0 0 5px rgba(162,44,41,.92),0 0 18px 3px rgba(162,44,41,.35)}50%{box-shadow:0 0 0 2px rgba(255,255,255,.92),0 0 0 5px rgba(162,44,41,.92),0 0 34px 10px rgba(162,44,41,.6)}}" +
      ".kt-ring.kt-on{animation:kt-breathe 2.2s ease-in-out infinite}" +
      // Popup détachée : grande ombre, liseré, barre d'accent, flèche.
      ".kt-pop{position:fixed;z-index:2147483002;max-width:360px;width:calc(100vw - 28px);" +
      "background:#fff;color:#1C2321;border-radius:20px;padding:1.2rem 1.25rem 1.05rem;" +
      "box-shadow:0 28px 80px rgba(0,0,0,.6),0 6px 18px rgba(0,0,0,.32);" +
      "border:1px solid rgba(255,255,255,.7);overflow:hidden;" +
      "font-family:'Manrope',-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;" +
      "opacity:0;transform:translateY(10px) scale(.97);" +
      "transition:opacity .32s ease,transform .42s cubic-bezier(.34,1.3,.5,1),top .42s ease,left .42s ease}" +
      ".kt-pop.kt-in{opacity:1;transform:translateY(0) scale(1)}" +
      ".kt-pop::before{content:'';position:absolute;top:0;left:0;right:0;height:4px;background:linear-gradient(90deg,#A22C29,#d6504c)}" +
      ".kt-pop h3{font-size:1.08rem;font-weight:800;margin:.15rem 0 .4rem;letter-spacing:-.01em}" +
      ".kt-text{font-size:.92rem;line-height:1.5;color:#41484a;margin:0 0 .85rem;min-height:2.6em}" +
      ".kt-logo{display:flex;justify-content:center;margin:.1rem 0 .5rem}" +
      ".kt-pop.kt-welcome{text-align:center;max-width:370px}" +
      ".kt-pop.kt-welcome h3{font-size:1.4rem}" +
      ".kt-pop.kt-welcome .kt-text{font-size:.96rem}" +
      // Flèche de rattachement.
      ".kt-arrow{position:absolute;width:18px;height:18px;background:#fff;transform:rotate(45deg);z-index:-1;display:none;" +
      "box-shadow:0 6px 18px rgba(0,0,0,.18)}" +
      ".kt-pop.kt-arr-up .kt-arrow{display:block;top:-7px}" +
      ".kt-pop.kt-arr-down .kt-arrow{display:block;bottom:-7px}" +
      // Progression du plan en cours.
      ".kt-prog{display:flex;align-items:center;gap:.55rem;margin-bottom:.7rem}" +
      ".kt-play{flex:0 0 auto;width:26px;height:26px;border-radius:50%;border:none;cursor:pointer;" +
      "background:#EEF1EF;color:#1C2321;font-size:.7rem;display:flex;align-items:center;justify-content:center;padding:0}" +
      ".kt-play:hover{background:#e1e7e4}" +
      ".kt-bar{flex:1;height:4px;border-radius:3px;background:#e7ecee;overflow:hidden}" +
      ".kt-bar i{display:block;height:100%;width:0;border-radius:3px;background:linear-gradient(90deg,#A22C29,#d6504c)}" +
      ".kt-shots{display:flex;gap:5px;justify-content:center;margin-bottom:.6rem}" +
      ".kt-sh{flex:1;max-width:26px;height:4px;border-radius:3px;background:#e1e7e4;transition:background .25s}" +
      ".kt-sh.done{background:#c98b89}" +
      ".kt-sh.on{background:#A22C29}" +
      ".kt-dots{display:flex;gap:5px;justify-content:center;margin-bottom:.85rem}" +
      ".kt-dot{width:6px;height:6px;border-radius:50%;background:#d4dbde;transition:all .25s}" +
      ".kt-dot.on{background:#A22C29;width:18px;border-radius:4px}" +
      ".kt-row{display:flex;align-items:center;gap:.45rem}" +
      ".kt-btn{font-family:inherit;font-weight:700;font-size:.86rem;border-radius:11px;cursor:pointer;padding:.6rem 1rem;border:none;transition:all .15s;white-space:nowrap}" +
      ".kt-skip{background:none;color:#8a939a;padding:.6rem .35rem}" +
      ".kt-skip:hover{color:#41484a}" +
      ".kt-grow{flex:1}" +
      ".kt-prev{background:#EEF1EF;color:#1C2321;padding:.6rem .75rem}" +
      ".kt-prev:hover{background:#e1e7e4}" +
      ".kt-replay{background:#EEF1EF;color:#1C2321;padding:.6rem .8rem}" +
      ".kt-replay:hover{background:#e1e7e4}" +
      ".kt-next{background:#A22C29;color:#fff}" +
      ".kt-next:hover{background:#8a2422}" +
      // Bouton « Revoir le guide » (accueil).
      ".kt-replaybtn{position:fixed;left:14px;bottom:14px;z-index:9000;background:#1C2321;color:#fff;border:none;" +
      "border-radius:22px;padding:.55rem .95rem;font-size:.8rem;font-weight:700;font-family:inherit;cursor:pointer;" +
      "box-shadow:0 4px 16px rgba(28,35,33,.28);display:flex;align-items:center;gap:.4rem;opacity:.92}" +
      ".kt-replaybtn:hover{opacity:1}" +
      // Mode sombre
      'html[data-theme="dark"] .kt-pop{background:#1F2528;color:#E7ECEE;border-color:rgba(255,255,255,.08)}' +
      'html[data-theme="dark"] .kt-text{color:#9AA6AE}' +
      'html[data-theme="dark"] .kt-arrow{background:#1F2528}' +
      'html[data-theme="dark"] .kt-play,html[data-theme="dark"] .kt-prev,html[data-theme="dark"] .kt-replay{background:#2a3236;color:#E7ECEE}' +
      'html[data-theme="dark"] .kt-bar{background:#2a3236}' +
      'html[data-theme="dark"] .kt-sh{background:#2a3236}' +
      'html[data-theme="dark"] .kt-dot{background:#3a4347}' +
      'html[data-theme="dark"] .kt-skip{color:#7f8c94}' +
      'html[data-theme="dark"] .kt-replaybtn{background:#0E1214}';
    var st = document.createElement("style");
    st.id = "kt-tour-css";
    st.textContent = css;
    document.head.appendChild(st);
  }

  // ── État runtime ─────────────────────────────────────────────────────────
  var ov = null, blur = null, spot = null, ring = null, pop = null;
  var curSlide = -1;        // index de la slide dans SLIDES
  var shots = [];           // plans résolus de la slide en cours
  var curShot = -1;         // plan en cours
  var shotTimer = null;     // minuterie d'auto-enchaînement
  var shotStart = 0, shotHold = 0; // pour pause/reprise
  var playing = false, ended = false;
  var curEl = null, curZoom = 1; // élément + zoom du plan en cours
  var zoomedEl = null;           // élément actuellement transformé (à restaurer)

  function buildUI() {
    injectCSS();
    if (ov) return;
    ov = document.createElement("div");
    ov.className = "kt-ov";
    blur = document.createElement("div");
    blur.className = "kt-blur";
    spot = document.createElement("div");
    spot.className = "kt-spot";
    ring = document.createElement("div");
    ring.className = "kt-ring";
    pop = document.createElement("div");
    pop.className = "kt-pop";
    if (SUPPORTS_HOLE) ov.appendChild(blur);
    else ov.appendChild(spot);
    ov.appendChild(ring);
    ov.appendChild(pop);
    document.body.appendChild(ov);
    requestAnimationFrame(function () { ov.classList.add("kt-in"); });

    window.addEventListener("resize", reposition, { passive: true });
    window.addEventListener("scroll", reposition, { passive: true, capture: true });
    document.addEventListener("keydown", onKey, true);
    document.documentElement.classList.add("kt-touring");
    document.addEventListener("focusin", guardFocus, true);
    // Tap sur le fond (hors popup) : pause / reprise de l'animation.
    ov.addEventListener("click", function (e) {
      if (e.target === ov || e.target === blur || e.target === spot || e.target === ring)
        togglePlay();
    });
    lockFields();
    watchFields();
    blurActive();
  }

  // ── Anti-clavier : champs désactivés pendant le tour ─────────────────────
  var lockedFields = [];
  var FIELD_SEL = "input, textarea, select";
  function lockField(n) {
    var t = (n.type || "").toLowerCase();
    if (t === "hidden") return;
    if (n.getAttribute("data-kt-locked") === "1") return;
    n.setAttribute("data-kt-locked", "1");
    n.setAttribute("data-kt-dis", n.disabled ? "1" : "0");
    n.disabled = true;
    lockedFields.push(n);
  }
  function lockFields() {
    var nodes = document.querySelectorAll(FIELD_SEL);
    for (var i = 0; i < nodes.length; i++) lockField(nodes[i]);
  }
  function unlockFields() {
    for (var i = 0; i < lockedFields.length; i++) {
      var n = lockedFields[i];
      if (n.getAttribute("data-kt-dis") !== "1") n.disabled = false;
      n.removeAttribute("data-kt-locked");
      n.removeAttribute("data-kt-dis");
    }
    lockedFields = [];
  }
  var fieldObserver = null;
  function watchFields() {
    if (fieldObserver || typeof MutationObserver !== "function") return;
    fieldObserver = new MutationObserver(function (muts) {
      for (var i = 0; i < muts.length; i++) {
        var added = muts[i].addedNodes;
        for (var j = 0; j < added.length; j++) {
          var node = added[j];
          if (node.nodeType !== 1) continue;
          if (node.matches && node.matches(FIELD_SEL)) lockField(node);
          if (node.querySelectorAll) {
            var sub = node.querySelectorAll(FIELD_SEL);
            for (var k = 0; k < sub.length; k++) lockField(sub[k]);
          }
        }
      }
    });
    fieldObserver.observe(document.body, { childList: true, subtree: true });
  }
  function unwatchFields() {
    if (fieldObserver) { fieldObserver.disconnect(); fieldObserver = null; }
  }
  function guardFocus(e) {
    var t = e.target;
    if (!t || !t.matches) return;
    if (t.closest && t.closest(".kt-pop")) return;
    if (t.matches('input,textarea,select,[contenteditable="true"]')) {
      try { t.blur(); } catch (err) {}
    }
  }
  function blurActive() {
    try {
      var a = document.activeElement;
      if (a && a.blur && a !== document.body) a.blur();
    } catch (e) {}
  }

  function onKey(e) {
    if (e.key === "Escape") { e.preventDefault(); end(false); }
    else if (e.key === "ArrowRight") { e.preventDefault(); go(1); }
    else if (e.key === "ArrowLeft") { e.preventDefault(); go(-1); }
    else if (e.key === "Enter") { e.preventDefault(); go(1); }
    else if (e.key === " " || e.key === "Spacebar") { e.preventDefault(); togglePlay(); }
  }

  function teardown() {
    clearTimeout(shotTimer);
    clearZoom();
    window.removeEventListener("resize", reposition, { passive: true });
    window.removeEventListener("scroll", reposition, { capture: true });
    document.removeEventListener("keydown", onKey, true);
    document.removeEventListener("focusin", guardFocus, true);
    unwatchFields();
    unlockFields();
    document.documentElement.classList.remove("kt-touring");
    if (ov && ov.parentNode) ov.parentNode.removeChild(ov);
    ov = blur = spot = ring = pop = curEl = null;
    curSlide = curShot = -1;
    shots = []; playing = false; ended = false;
  }

  // ── Géométrie : trou net, anneau, zoom ───────────────────────────────────
  function holePath(x, y, w, h, r) {
    var W = window.innerWidth, H = window.innerHeight;
    r = Math.max(0, Math.min(r, w / 2, h / 2));
    var inner =
      "M" + (x + r) + "," + y +
      "H" + (x + w - r) +
      "A" + r + "," + r + " 0 0 1 " + (x + w) + "," + (y + r) +
      "V" + (y + h - r) +
      "A" + r + "," + r + " 0 0 1 " + (x + w - r) + "," + (y + h) +
      "H" + (x + r) +
      "A" + r + "," + r + " 0 0 1 " + x + "," + (y + h - r) +
      "V" + (y + r) +
      "A" + r + "," + r + " 0 0 1 " + (x + r) + "," + y + "Z";
    var outer = "M0,0H" + W + "V" + H + "H0Z";
    return 'path(evenodd, "' + outer + inner + '")';
  }

  function applyHole(x, y, w, h) {
    var W = window.innerWidth, H = window.innerHeight;
    x = Math.max(6, x); y = Math.max(6, y);
    if (x + w > W - 6) w = W - 6 - x;
    if (y + h > H - 6) h = H - 6 - y;
    if (SUPPORTS_HOLE && blur) {
      var p = holePath(x, y, w, h, 16);
      blur.style.clipPath = p;
      blur.style.webkitClipPath = p;
    } else if (spot) {
      spot.style.left = x + "px";
      spot.style.top = y + "px";
      spot.style.width = w + "px";
      spot.style.height = h + "px";
    }
    if (ring) {
      ring.style.left = x + "px";
      ring.style.top = y + "px";
      ring.style.width = w + "px";
      ring.style.height = h + "px";
      ring.classList.add("kt-on");
    }
  }

  function fullBlur() {
    // Pas de zone nette (diapo centrée) : tout est flouté.
    if (SUPPORTS_HOLE && blur) { blur.style.clipPath = "none"; blur.style.webkitClipPath = "none"; }
    else if (spot) { spot.style.width = "0"; spot.style.height = "0"; spot.style.left = "50%"; spot.style.top = "50%"; }
    if (ring) ring.classList.remove("kt-on");
  }

  function defaultZoom(rect) {
    var area = rect.width * rect.height;
    var vp = window.innerWidth * window.innerHeight;
    var f = area / vp;
    if (f < 0.02) return 1.22;
    if (f < 0.06) return 1.12;
    if (f < 0.16) return 1.06;
    return 1.0;
  }

  // L'élément à mettre en avant et son cadre : on présente le champ entier
  // (étiquette + saisie + aide) plutôt que le seul <input>, pour un cadrage
  // propre. Repli sur l'élément lui-même hors formulaire.
  function frameOf(el) {
    if (!el) return el;
    var f = el.closest && el.closest(".field, .anniv-check, .check");
    return f || el;
  }

  function clearZoom() {
    if (zoomedEl) {
      zoomedEl.classList.remove("kt-zoom");
      zoomedEl.style.transform = zoomedEl.__ktTr || "";
      zoomedEl.style.transformOrigin = zoomedEl.__ktTo || "";
      try { delete zoomedEl.__ktTr; delete zoomedEl.__ktTo; } catch (e) {}
      zoomedEl = null;
    }
  }

  // Cadre la zone d'un élément : zoom de l'élément + trou + anneau + popup.
  function focusTarget(el, zoom) {
    clearZoom();
    curEl = el;
    var vw = window.innerWidth, vh = window.innerHeight;
    var r = el.getBoundingClientRect(); // non transformé
    var cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    if (zoom == null) zoom = defaultZoom(r);
    // On borne le zoom pour que la zone nette ne déborde jamais de l'écran.
    var pad = 14;
    zoom = Math.min(zoom, (vw - 2 * pad - 16) / r.width, (vh - 2 * pad - 16) / r.height);
    zoom = Math.max(1, zoom);
    curZoom = zoom;

    if (zoom > 1.001) {
      el.__ktTr = el.style.transform || "";
      el.__ktTo = el.style.transformOrigin || "";
      el.style.transformOrigin = "center center";
      el.classList.add("kt-zoom");
      // Force le reflow pour que la transition parte de l'état courant.
      void el.offsetWidth;
      el.style.transform = (el.__ktTr ? el.__ktTr + " " : "") + "scale(" + zoom + ")";
      zoomedEl = el;
    }

    var sw = r.width * zoom, sh = r.height * zoom;
    var hx = cx - sw / 2 - pad, hy = cy - sh / 2 - pad;
    var hw = sw + pad * 2, hh = sh + pad * 2;
    applyHole(hx, hy, hw, hh);
    placePop({ left: Math.max(6, hx), top: Math.max(6, hy), width: hw, height: hh });
  }

  function reposition() {
    if (!ov || curSlide < 0) return;
    var slide = SLIDES[curSlide];
    if (slide && slide.welcome) { centerPop(); return; }
    if (curEl && document.body.contains(curEl)) {
      var r = curEl.getBoundingClientRect(); // déjà transformé si zoomé
      var pad = 14;
      var hx = r.left - pad, hy = r.top - pad, hw = r.width + pad * 2, hh = r.height + pad * 2;
      applyHole(hx, hy, hw, hh);
      placePop({ left: Math.max(6, hx), top: Math.max(6, hy), width: hw, height: hh });
    }
  }

  // ── Moteur de slides / plans ──────────────────────────────────────────────
  function resolveShots(slide) {
    var out = [];
    if (slide.welcome) return out; // diapo centrée, pas de plan
    if (slide.overviewSel)
      out.push({ sel: slide.overviewSel, text: slide.body, zoom: 1.0, overview: true });
    if (slide.shots && slide.shots.length) {
      for (var i = 0; i < slide.shots.length; i++) out.push(slide.shots[i]);
    } else if (slide.sel) {
      out.push({ sel: slide.sel, text: slide.body });
    }
    return out;
  }

  // Temps de lecture confortable pour un premier utilisateur.
  function readingTime(text) {
    var words = (text || "").trim().split(/\s+/).filter(Boolean).length;
    var ms = 2000 + words * 460; // ~130 mots/min + temps d'observation
    return Math.max(3600, Math.min(ms, 8500));
  }

  function showSlide(i) {
    var slide = SLIDES[i];
    if (!slide) { end(false); return; }
    curSlide = i;
    ended = false;
    clearTimeout(shotTimer);

    if (slide.before) {
      try { slide.before(); } catch (e) {}
      lockFields();
      blurActive();
    }

    shots = resolveShots(slide);

    if (slide.welcome || !shots.length) {
      // Diapo centrée, sans animation de zone.
      curShot = -1; curEl = null;
      fullBlur();
      renderPop(slide);
      ended = true;
      updateControls();
      return;
    }

    renderPop(slide);
    // Laisse le temps à un formulaire ouvert de finir son animation d'ouverture
    // avant de mesurer la 1re zone (sinon cadrage faussé).
    var delay = slide.before ? 320 : 60;
    setTimeout(function () { playShot(0); }, delay);
  }

  function playShot(j) {
    clearTimeout(shotTimer);
    if (j >= shots.length) { onSlideEnd(); return; }
    curShot = j;
    playing = true;
    var shot = shots[j];
    var el = document.querySelector(shot.sel);
    if (!el) {
      // Zone absente : on passe au plan suivant sans bloquer.
      nextShot();
      return;
    }
    var frame = frameOf(el);
    // Affiche le texte tout de suite : l'utilisateur peut commencer à lire.
    setText(shot.text);
    updateShotUI(j);
    // Défilement instantané (fond flouté, invisible) PUIS cadrage : le trou
    // glisse en un seul mouvement propre vers la zone, sans à-coups.
    try { frame.scrollIntoView({ block: "center", behavior: "auto" }); } catch (e) {}
    requestAnimationFrame(function () {
      if (curShot !== j) return;
      focusTarget(frame, shot.zoom);
    });
    // Recadre une fois le zoom stabilisé (sécurité).
    setTimeout(function () { if (curShot === j) reposition(); }, 640);
    var hold = shot.hold || readingTime(shot.text);
    shotStart = Date.now(); shotHold = hold;
    startBar(hold);
    shotTimer = setTimeout(nextShot, hold);
  }

  function nextShot() {
    if (curShot + 1 < shots.length) playShot(curShot + 1);
    else onSlideEnd();
  }

  function onSlideEnd() {
    playing = false; ended = true;
    clearTimeout(shotTimer);
    freezeBar(true);
    updateShotUI(shots.length); // tous faits
    updateControls();
  }

  function replaySlide() {
    ended = false;
    playShot(0);
    updateControls();
  }

  function togglePlay() {
    if (ended || !shots.length) return;
    if (playing) {
      // Pause
      playing = false;
      clearTimeout(shotTimer);
      var elapsed = Date.now() - shotStart;
      shotHold = Math.max(300, shotHold - elapsed);
      freezeBar(false);
    } else {
      // Reprise du plan courant
      playing = true;
      shotStart = Date.now();
      startBar(shotHold);
      shotTimer = setTimeout(nextShot, shotHold);
    }
    updateControls();
  }

  // ── Barre de progression du plan ─────────────────────────────────────────
  function barFill() { return pop ? pop.querySelector(".kt-bar i") : null; }
  function startBar(ms) {
    var f = barFill(); if (!f) return;
    f.style.transition = "none";
    f.style.width = "0%";
    void f.offsetWidth;
    f.style.transition = "width " + ms + "ms linear";
    f.style.width = "100%";
  }
  function freezeBar(complete) {
    var f = barFill(); if (!f) return;
    if (complete) { f.style.transition = "none"; f.style.width = "100%"; return; }
    var w = getComputedStyle(f).width;
    f.style.transition = "none";
    f.style.width = w;
  }

  // ── Rendu de la popup ─────────────────────────────────────────────────────
  function renderPop(slide) {
    var multi = shots.length > 1;
    var dots = "";
    for (var d = 0; d < SLIDES.length; d++)
      dots += '<span class="kt-dot' + (d === curSlide ? " on" : "") + '"></span>';
    var shotbars = "";
    if (multi) {
      shotbars = '<div class="kt-shots">';
      for (var s = 0; s < shots.length; s++) shotbars += '<span class="kt-sh" data-i="' + s + '"></span>';
      shotbars += "</div>";
    }
    var prog = multi
      ? '<div class="kt-prog"><button class="kt-play" data-kt="play" aria-label="Pause">⏸</button><div class="kt-bar"><i></i></div></div>'
      : "";

    var html =
      '<span class="kt-arrow"></span>' +
      (slide.welcome ? '<div class="kt-logo">' + LOGO + "</div>" : "") +
      "<h3>" + slide.title + "</h3>" +
      '<p class="kt-text">' + slide.body + "</p>" +
      prog + shotbars +
      '<div class="kt-dots">' + dots + "</div>" +
      '<div class="kt-row" data-controls></div>';

    pop.className = "kt-pop" + (slide.welcome ? " kt-welcome" : "");
    pop.innerHTML = html;
    pop.onclick = function (e) {
      var b = e.target.closest("[data-kt]"); if (!b) return;
      var a = b.getAttribute("data-kt");
      if (a === "next") go(1);
      else if (a === "prev") go(-1);
      else if (a === "skip") end(false);
      else if (a === "replay") replaySlide();
      else if (a === "play") togglePlay();
    };
    updateControls();

    if (slide.welcome) centerPop();
    requestAnimationFrame(function () { pop.classList.add("kt-in"); });
  }

  function setText(t) {
    var p = pop && pop.querySelector(".kt-text");
    if (p) p.textContent = t;
  }
  function updateShotUI(j) {
    var bars = pop ? pop.querySelectorAll(".kt-sh") : [];
    for (var i = 0; i < bars.length; i++) {
      bars[i].className = "kt-sh" + (i < j ? " done" : i === j ? " on" : "");
    }
    var play = pop && pop.querySelector(".kt-play");
    if (play) play.textContent = playing ? "⏸" : "▶";
  }
  function updateControls() {
    var row = pop && pop.querySelector("[data-controls]");
    if (!row) return;
    var slide = SLIDES[curSlide] || {};
    var nextLabel = slide.welcome ? "Commencer ✂️" : slide.last ? "Terminer ✓" : "Suivant →";
    var prevBtn = curSlide > 0 ? '<button class="kt-btn kt-prev" data-kt="prev" aria-label="Précédent">←</button>' : "";
    var replayBtn = (!slide.welcome && shots.length)
      ? '<button class="kt-btn kt-replay" data-kt="replay" aria-label="Revoir">↺ Revoir</button>'
      : "";
    row.innerHTML =
      '<button class="kt-btn kt-skip" data-kt="skip">Passer</button>' +
      '<span class="kt-grow"></span>' +
      prevBtn + replayBtn +
      '<button class="kt-btn kt-next" data-kt="next">' + nextLabel + "</button>";
    var play = pop.querySelector(".kt-play");
    if (play) play.textContent = playing ? "⏸" : "▶";
  }

  function centerPop() {
    pop.classList.remove("kt-arr-up", "kt-arr-down");
    pop.style.left = "50%";
    pop.style.top = "50%";
    pop.style.transform = "translate(-50%,-50%)";
    pop.classList.add("kt-in");
  }

  // Place la popup à côté de la zone (rect en px viewport) et oriente la flèche.
  function placePop(rect) {
    if (!pop) return;
    var vw = window.innerWidth, vh = window.innerHeight;
    var pr = pop.getBoundingClientRect();
    var pw = pr.width || 320, ph = pr.height || 200;
    var margin = 16;
    var below = vh - (rect.top + rect.height);
    var above = rect.top;
    var top, left, arrow = "";
    pop.style.transform = "none";

    var tall = rect.height > vh * 0.6;
    if (tall || (below < ph + margin && above < ph + margin)) {
      // Zone trop grande : on épingle en haut ou en bas, sans flèche.
      left = (vw - pw) / 2;
      top = rect.top > vh / 2 ? margin : vh - ph - margin;
    } else if (below >= ph + margin) {
      top = rect.top + rect.height + margin;
      left = rect.left + rect.width / 2 - pw / 2;
      arrow = "up";
    } else {
      top = rect.top - ph - margin;
      left = rect.left + rect.width / 2 - pw / 2;
      arrow = "down";
    }
    left = Math.max(margin, Math.min(left, vw - pw - margin));
    top = Math.max(margin, Math.min(top, vh - ph - margin));
    pop.style.left = left + "px";
    pop.style.top = top + "px";

    pop.classList.remove("kt-arr-up", "kt-arr-down");
    var arr = pop.querySelector(".kt-arrow");
    if (arrow && arr) {
      pop.classList.add(arrow === "up" ? "kt-arr-up" : "kt-arr-down");
      var ax = rect.left + rect.width / 2 - left - 9;
      ax = Math.max(16, Math.min(ax, pw - 34));
      arr.style.left = ax + "px";
    }
  }

  // ── Navigation entre slides ──────────────────────────────────────────────
  function runCleanup(i) {
    var s = SLIDES[i];
    if (s && s.cleanup) { try { s.cleanup(); } catch (e) {} }
  }

  function go(delta) {
    clearTimeout(shotTimer);
    clearZoom();
    var cur = curSlide;
    runCleanup(cur);
    var ni = cur + delta;
    if (ni < 0) ni = 0;
    if (ni >= SLIDES.length) { end(true); return; }
    var nslide = SLIDES[ni];
    ssSet(K_STEP, String(ni));
    ssSet(K_RUN, "1");
    if (nslide.page !== PAGE) { location.href = nslide.page; return; }
    if (pop) pop.classList.remove("kt-in");
    showSlide(ni);
  }

  function start(i) {
    ssSet(K_RUN, "1");
    ssSet(K_STEP, String(i || 0));
    ssDel(K_DONE);
    buildUI();
    showSlide(i || 0);
  }

  function end(keepModal) {
    if (!keepModal) runCleanup(curSlide);
    clearTimeout(shotTimer);
    ssDel(K_RUN);
    ssDel(K_STEP);
    ssSet(K_DONE, "1");
    teardown();
    if (keepModal) {
      setTimeout(function () {
        var n = document.getElementById("fNom");
        if (n) { try { n.focus(); } catch (e) {} }
      }, 200);
    }
  }

  // ── Bouton « Revoir le guide » (accueil) ─────────────────────────────────
  function injectReplay() {
    if (PAGE !== "index.html") return;
    if (document.getElementById("kt-replaybtn")) return;
    injectCSS();
    var b = document.createElement("button");
    b.id = "kt-replaybtn";
    b.className = "kt-replaybtn";
    b.type = "button";
    b.innerHTML =
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="15" height="15" fill="currentColor" aria-hidden="true"><path d="M12,2A10,10,0,1,0,22,12,1,1,0,0,0,20,12a8,8,0,1,1-2.3-5.6V8a1,1,0,0,0,2,0V3a1,1,0,0,0-1-1H14a1,1,0,0,0,0,2h2.4A10,10,0,0,0,12,2Zm-.2,5a1,1,0,0,0-1,1v4a1,1,0,0,0,.4.8l3,2.2a1,1,0,0,0,1.2-1.6L12.8,11.5V8A1,1,0,0,0,11.8,7Z"></path></svg>' +
      "Revoir le guide";
    b.addEventListener("click", function () { start(0); });
    document.body.appendChild(b);
  }

  // ── Démarrage ────────────────────────────────────────────────────────────
  function boot() {
    var running = ss(K_RUN) === "1";
    var stepIdx = parseInt(ss(K_STEP) || "0", 10) || 0;
    if (running) {
      var s = SLIDES[stepIdx];
      if (s && s.page === PAGE) { buildUI(); showSlide(stepIdx); }
    } else if (PAGE === "index.html" && !salonConfigured() && ss(K_DONE) !== "1") {
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
