  // ── State ──────────────────────────────────────────────────────────────────
  let currentRoof = 'gable';
  let currentUnit = 'metric';
  let measureMode = 'vertical'; // 'vertical' | 'slope'
  let lastResult  = null;       // holds the most recent calculation for saving
  const wallModes = {};                                   // per-roof: { gable:'roof', hip:'roof', ... }
  function getWallMode() { return wallModes[currentRoof] || 'roof'; }

  // ── localStorage ───────────────────────────────────────────────────────────
  const STORAGE_KEY = 'roofVolumeCalcs';

  function loadSaved() {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || []; }
    catch { return []; }
  }

  function persistSaved(list) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  }

  // ── Roof configs ───────────────────────────────────────────────────────────
  const roofConfigs = {
    gable: {
      label: 'Gable Roof',
      fields: [
        {
          id: 'length', label: 'Length (L)', hint: 'Along the ridge',
          tooltip: 'Measure along the length of the building, parallel to the ridge (the horizontal peak of the roof). This is the longer dimension on a typical house.'
        },
        {
          id: 'width', label: 'Width (W)', hint: 'Perpendicular to ridge',
          tooltip: 'Measure across the full width of the building, at right angles to the ridge. This spans from one eave to the other.'
        },
        {
          id: 'height', label: 'Height (H)', hint: 'Eave to ridge (vertical)',
          tooltip: 'Measure the vertical distance from the eave (bottom edge of the roof) straight up to the ridge (the very top). Use a plumb line or spirit level for accuracy.'
        },
        {
          id: 'wallHeight', label: 'Wall Height (WH)', hint: 'Ground to eave',
          tooltip: 'The external height of the walls from ground level up to the eave (where the roof begins). Used to calculate the wall/box volume beneath the roof.'
        },
      ],
      formula: (L, W, H) => 0.5 * L * W * H,
      slopeOffset: (W) => W / 2,
      formulaText: () => {
        if (getWallMode() === 'walls') {
          return measureMode === 'slope'
            ? `H = √(S² − (W/2)²)  →  V = L×W×WH + ½×L×W×H`
            : `V = L×W×WH + ½×L×W×H`;
        }
        return measureMode === 'slope'
          ? `H = √(S² − (W/2)²)  →  V = ½ × L × W × H`
          : `V = ½ × Length × Width × Height`;
      },
    },
    extension: {
      label: 'Roof Extension',
      fields: [
        {
          id: 'width', label: 'Width (W)', hint: 'Across the extension',
          tooltip: 'Measure across the full width of the extension, from one eave to the other, at right angles to the main house.'
        },
        {
          id: 'length', label: 'Gable Length (L)', hint: 'Rectangular section',
          tooltip: 'The length of the straight rectangular (prism) section of the extension roof — from the end wall of the extension to where the roof starts to taper toward the main house.'
        },
        {
          id: 'length2', label: 'Pyramid Length (PL)', hint: 'Tapering section',
          tooltip: 'The length of the tapering triangular pyramid section — from where the roof starts to taper to where it meets the main house ridge. This is measured along the eave.'
        },
        {
          id: 'height', label: 'Height (H)', hint: 'Eave to ridge (vertical)',
          tooltip: 'The vertical height from the eave of the extension up to the ridge. This should match the height of the main house ridge if the roofs are joined at the same level.'
        },
      ],
      formulaText: () => measureMode === 'slope'
        ? `H = √(S² − PL² − (W/2)²)  ·  V = ½×W×L×H + W×H×PL/6`
        : `V_gable = ½ × W × L × H  ·  V_pyramid = W × H × PL / 6`,
    },
    leanto: {
      label: 'Lean-to Roof',
      fields: [
        {
          id: 'length', label: 'Length (L)', hint: 'Along the eave',
          tooltip: 'Measure the length of the lean-to along its eave (the bottom horizontal edge of the roof).'
        },
        {
          id: 'width', label: 'Width (W)', hint: 'Across the roof',
          tooltip: 'Measure the horizontal distance across the lean-to, from the low eave to the wall where the high edge meets. This is the full span of the slope.'
        },
        {
          id: 'height', label: 'Height (H)', hint: 'Low eave to high eave (vertical)',
          tooltip: 'Measure the vertical height difference between the low eave (bottom edge) and the high eave (where the roof meets the wall at the top). Do not measure along the slope — measure vertically.'
        },
        {
          id: 'wallHeight', label: 'Wall Height (WH)', hint: 'Ground to low eave',
          tooltip: 'The external height of the lower wall, from ground level up to the low eave (where the roof begins). Used to calculate the wall/box volume beneath the roof.'
        },
      ],
      formula: (L, W, H) => 0.5 * L * W * H,
      slopeOffset: (W) => W,
      formulaText: () => {
        if (getWallMode() === 'walls') {
          return measureMode === 'slope'
            ? `H = √(S² − W²)  →  V = L×W×WH + ½×L×W×H`
            : `V = L×W×WH + ½×L×W×H`;
        }
        return measureMode === 'slope'
          ? `H = √(S² − W²)  →  V = ½ × L × W × H`
          : `V = ½ × Length × Width × Height`;
      },
    },

    hip: {
      label: 'Hip Roof',
      fields: [
        {
          id: 'length', label: 'Length (L)', hint: 'External building length',
          tooltip: 'The total external length of the building, measured at eave level, parallel to the ridge. This is the full length including the hip ends.'
        },
        {
          id: 'width', label: 'Width (W)', hint: 'External building width',
          tooltip: 'The total external width of the building, measured at eave level, perpendicular to the ridge.'
        },
        {
          id: 'wallHeight', label: 'Wall Height (WH)', hint: 'Ground to eave',
          tooltip: 'The external height of the walls from ground level up to the eave (where the roof begins). Used to calculate the wall/box volume beneath the roof.'
        },
        {
          id: 'height', label: 'Height (H)', hint: 'Eave to ridge (vertical)',
          tooltip: 'The vertical height from the eave up to the ridge. This is the roof height measurement used in the volume formula.'
        },
        {
          id: 'ridgeLength', label: 'Ridge Length (R)', hint: 'Length of flat ridge',
          tooltip: 'The length of the flat ridge at the top of the roof. The hip end run = L − R (so hip run + R must equal L).'
        },
      ],
      slopeOffset: (W) => W / 2,
      formulaText: () => {
        if (getWallMode() === 'walls') {
          return measureMode === 'slope'
            ? `H = √(S² − (W/2)²)  →  V = W×L×WH + W×H×(2L+R)/6`
            : `V = W×L×WH + W×H×(2L+R)/6`;
        }
        return measureMode === 'slope'
          ? `H = √(S² − (W/2)²)  →  V = W×H×(2L+R)/6`
          : `V = W×H×(2L+R)/6`;
      },
    },
  };

  // ── SVG Diagrams ───────────────────────────────────────────────────────────
  // Each diagram function receives (mode, vals) where vals = { length, width, height, slope, length2 }
  // vals fields are numbers or null. Labels show the entered value + unit when available.

  const diagrams = {
    gable: (mode, vals = {}) => {
      const u = getUnitLabel();
      const lbl = (v, name) => v ? `${name} = ${formatNum(v)} ${u}` : name;
      const wLabel    = lbl(vals.width,      'Width (W)');
      const lLabel    = lbl(vals.length,     'Length (L)');
      const hLabel    = mode === 'slope' ? lbl(vals.slope, 'Slope (S)') : lbl(vals.height, 'Height (H)');
      const wallLabel = lbl(vals.wallHeight, 'WH');
      const dc = '#64748b';

      const mS = mode === 'slope' ? 'gs-s' : 'g-s';
      const mE = mode === 'slope' ? 'gs-e' : 'g-e';

      const wallLayer = `
    <g class="wall-layer">
      <polygon points="55,155 175,155 175,205 55,205"
               fill="#e0f2fe" stroke="#2563eb" stroke-width="1.5"/>
      <polygon points="175,155 275,120 275,170 175,205"
               fill="#bae6fd" stroke="#2563eb" stroke-width="1.5"/>
      <line x1="155" y1="120" x2="155" y2="170" stroke="#94a3b8" stroke-width="1" stroke-dasharray="5,4"/>
      <line x1="55"  y1="205" x2="155" y2="170" stroke="#94a3b8" stroke-width="1" stroke-dasharray="5,4"/>
      <line x1="155" y1="170" x2="275" y2="170" stroke="#94a3b8" stroke-width="1" stroke-dasharray="5,4"/>
      <line x1="193" y1="157" x2="193" y2="203" stroke="${dc}" stroke-width="1.2"
            marker-start="url(#${mS})" marker-end="url(#${mE})"/>
      <line x1="175" y1="155" x2="196" y2="155" stroke="${dc}" stroke-width="0.8" stroke-dasharray="3,3"/>
      <line x1="175" y1="205" x2="196" y2="205" stroke="${dc}" stroke-width="0.8" stroke-dasharray="3,3"/>
      <text x="202" y="183" text-anchor="start" fill="#475569" font-size="11" font-weight="600">${wallLabel}</text>
    </g>`;

      return mode === 'slope' ? `
  <svg width="320" height="235" viewBox="-15 10 350 250" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <marker id="gs-e" markerWidth="7" markerHeight="7" refX="6" refY="3.5" orient="auto">
        <path d="M0,0.5 L6,3.5 L0,6.5 Z" fill="#64748b"/>
      </marker>
      <marker id="gs-s" markerWidth="7" markerHeight="7" refX="6" refY="3.5" orient="auto-start-reverse">
        <path d="M0,0.5 L6,3.5 L0,6.5 Z" fill="#64748b"/>
      </marker>
    </defs>
    ${wallLayer}
    <!-- Hidden edges -->
    <line x1="55" y1="155" x2="155" y2="120" stroke="#94a3b8" stroke-width="1.5" stroke-dasharray="5,4"/>
    <line x1="155" y1="120" x2="275" y2="120" stroke="#94a3b8" stroke-width="1.5" stroke-dasharray="5,4"/>
    <line x1="155" y1="120" x2="215" y2="25"  stroke="#94a3b8" stroke-width="1.5" stroke-dasharray="5,4"/>
    <!-- Back gable face -->
    <polygon points="155,120 275,120 215,25" fill="#93c5fd" stroke="#2563eb" stroke-width="1.5" opacity="0.55"/>
    <!-- Left roof slope -->
    <polygon points="55,155 115,60 215,25 155,120" fill="#bfdbfe" stroke="#2563eb" stroke-width="1.5"/>
    <!-- Right roof slope -->
    <polygon points="175,155 115,60 215,25 275,120" fill="#dbeafe" stroke="#2563eb" stroke-width="1.5"/>
    <!-- Front gable triangle -->
    <polygon points="55,155 175,155 115,60" fill="#eff6ff" stroke="#2563eb" stroke-width="2"/>
    <!-- Dashed vertical height line and right-angle mark -->
    <line x1="115" y1="62" x2="115" y2="153" stroke="#94a3b8" stroke-width="1" stroke-dasharray="4,3"/>
    <polyline points="115,147 107,147 107,155" fill="none" stroke="#94a3b8" stroke-width="1.2"/>
    <!-- Right bottom edge, back edge, ridge -->
    <line x1="175" y1="155" x2="275" y2="120" stroke="#2563eb" stroke-width="1.5"/>
    <line x1="275" y1="120" x2="215" y2="25"  stroke="#2563eb" stroke-width="1.5"/>
    <line x1="115" y1="60"  x2="215" y2="25"  stroke="#1d4ed8" stroke-width="2"/>
    <!-- Slope label -->
    <text transform="translate(73,100) rotate(-58)" text-anchor="middle"
          fill="#2563eb" font-size="11" font-weight="700">${hLabel}</text>
    <!-- Width dimension -->
    <line x1="55" y1="172" x2="175" y2="172" stroke="#64748b" stroke-width="1.2"
          marker-start="url(#gs-s)" marker-end="url(#gs-e)"/>
    <text x="115" y="187" text-anchor="middle" fill="#475569" font-size="11" font-weight="600">${wLabel}</text>
    <!-- Length dimension -->
    <line x1="181" y1="172" x2="281" y2="137" stroke="#64748b" stroke-width="1.2"
          marker-start="url(#gs-s)" marker-end="url(#gs-e)"/>
    <text x="231" y="168" text-anchor="middle" fill="#475569" font-size="11" font-weight="600">${lLabel}</text>
  </svg>` : `
  <svg width="320" height="235" viewBox="-15 10 350 250" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <marker id="g-e" markerWidth="7" markerHeight="7" refX="6" refY="3.5" orient="auto">
        <path d="M0,0.5 L6,3.5 L0,6.5 Z" fill="#64748b"/>
      </marker>
      <marker id="g-s" markerWidth="7" markerHeight="7" refX="6" refY="3.5" orient="auto-start-reverse">
        <path d="M0,0.5 L6,3.5 L0,6.5 Z" fill="#64748b"/>
      </marker>
    </defs>
    ${wallLayer}
    <!-- Hidden edges -->
    <line x1="55" y1="155" x2="155" y2="120" stroke="#94a3b8" stroke-width="1.5" stroke-dasharray="5,4"/>
    <line x1="155" y1="120" x2="275" y2="120" stroke="#94a3b8" stroke-width="1.5" stroke-dasharray="5,4"/>
    <line x1="155" y1="120" x2="215" y2="25"  stroke="#94a3b8" stroke-width="1.5" stroke-dasharray="5,4"/>
    <!-- Back gable face -->
    <polygon points="155,120 275,120 215,25" fill="#93c5fd" stroke="#2563eb" stroke-width="1.5" opacity="0.55"/>
    <!-- Left roof slope -->
    <polygon points="55,155 115,60 215,25 155,120" fill="#bfdbfe" stroke="#2563eb" stroke-width="1.5"/>
    <!-- Right roof slope -->
    <polygon points="175,155 115,60 215,25 275,120" fill="#dbeafe" stroke="#2563eb" stroke-width="1.5"/>
    <!-- Front gable triangle -->
    <polygon points="55,155 175,155 115,60" fill="#eff6ff" stroke="#2563eb" stroke-width="2"/>
    <!-- Right bottom edge and back edge -->
    <line x1="175" y1="155" x2="275" y2="120" stroke="#2563eb" stroke-width="1.5"/>
    <line x1="275" y1="120" x2="215" y2="25"  stroke="#2563eb" stroke-width="1.5"/>
    <!-- Ridge -->
    <line x1="115" y1="60" x2="215" y2="25" stroke="#1d4ed8" stroke-width="2"/>
    <!-- Width dimension -->
    <line x1="55" y1="172" x2="175" y2="172" stroke="#64748b" stroke-width="1.2"
          marker-start="url(#g-s)" marker-end="url(#g-e)"/>
    <text x="115" y="187" text-anchor="middle" fill="#475569" font-size="11" font-weight="600">${wLabel}</text>
    <!-- Height dimension -->
    <line x1="36" y1="155" x2="36" y2="60" stroke="#64748b" stroke-width="1.2"
          marker-start="url(#g-s)" marker-end="url(#g-e)"/>
    <text x="22" y="112" text-anchor="middle" fill="#475569" font-size="11" font-weight="600"
          transform="rotate(-90,22,112)">${hLabel}</text>
    <!-- Length dimension -->
    <line x1="181" y1="172" x2="281" y2="137" stroke="#64748b" stroke-width="1.2"
          marker-start="url(#g-s)" marker-end="url(#g-e)"/>
    <text x="231" y="168" text-anchor="middle" fill="#475569" font-size="11" font-weight="600">${lLabel}</text>
  </svg>`;
    },

    /*
      Extension diagram vertices (3D oblique projection):
        A=(35,155)  far-left eave         B=(145,155) far-right eave
        C=(90,60)   far ridge             D=(90,130)  mid-left eave
        E=(200,130) mid-right eave        F=(145,35)  mid ridge
        P=(175,20)  pyramid apex (junction ridge)
      Depth steps: L1=(+55,−25), L2=(+30,−15)
    */
    extension: (mode, vals = {}) => {
      const u = getUnitLabel();
      const lbl = (v, name) => v ? `${name} = ${formatNum(v)} ${u}` : name;
      const dimColour = '#64748b';
      const sColour   = '#2563eb';

      const wLabel  = lbl(vals.width,   'W');
      const l1Label = lbl(vals.length,  'L');
      const l2Label = lbl(vals.length2, 'PL');
      const hLabel  = mode === 'slope'
        ? lbl(vals.slope,  'S')
        : lbl(vals.height, 'H');
      const markers = `
        <defs>
          <marker id="ex-e" markerWidth="7" markerHeight="7" refX="6" refY="3.5" orient="auto">
            <path d="M0,0.5 L6,3.5 L0,6.5 Z" fill="${dimColour}"/>
          </marker>
          <marker id="ex-s" markerWidth="7" markerHeight="7" refX="6" refY="3.5" orient="auto-start-reverse">
            <path d="M0,0.5 L6,3.5 L0,6.5 Z" fill="${dimColour}"/>
          </marker>
          <marker id="ex-se" markerWidth="7" markerHeight="7" refX="6" refY="3.5" orient="auto">
            <path d="M0,0.5 L6,3.5 L0,6.5 Z" fill="${sColour}"/>
          </marker>
          <marker id="ex-ss" markerWidth="7" markerHeight="7" refX="6" refY="3.5" orient="auto-start-reverse">
            <path d="M0,0.5 L6,3.5 L0,6.5 Z" fill="${sColour}"/>
          </marker>
        </defs>`;

      const heightAnnotation = mode === 'slope' ? `
        <!-- S: hip rafter from E to P, in blue -->
        <line x1="200" y1="130" x2="175" y2="22"
              stroke="${sColour}" stroke-width="2"
              marker-start="url(#ex-ss)" marker-end="url(#ex-se)"/>
        <text x="202" y="72" fill="${sColour}" font-size="11" font-weight="700">${hLabel}</text>
        <text x="202" y="85" fill="${sColour}" font-size="10">(outer corner → apex)</text>
        <text x="-60" y="108" fill="#475569" font-size="10" font-style="italic">H derived from S</text>
      ` : `
        <!-- H: left-side vertical arrow from eave to ridge -->
        <line x1="-45" y1="155" x2="-45" y2="62"
              stroke="${dimColour}" stroke-width="1.2"
              marker-start="url(#ex-s)" marker-end="url(#ex-e)"/>
        <line x1="35" y1="155" x2="-42" y2="155" stroke="${dimColour}" stroke-width="0.8" stroke-dasharray="3,3"/>
        <line x1="90" y1="60"  x2="-42" y2="60"  stroke="${dimColour}" stroke-width="0.8" stroke-dasharray="3,3"/>
        <text transform="translate(-58,108) rotate(-90)" text-anchor="middle"
              fill="#475569" font-size="11" font-weight="600">${hLabel}</text>
      `;

      return `
      <svg width="320" height="195" viewBox="-80 0 370 210" xmlns="http://www.w3.org/2000/svg">
        ${markers}

        <!-- Hidden edges (dashed) -->
        <line x1="35"  y1="155" x2="90"  y2="130" stroke="#94a3b8" stroke-width="1.5" stroke-dasharray="5,4"/>
        <line x1="90"  y1="130" x2="200" y2="130" stroke="#94a3b8" stroke-width="1.5" stroke-dasharray="5,4"/>
        <line x1="90"  y1="130" x2="175" y2="20"  stroke="#94a3b8" stroke-width="1.5" stroke-dasharray="5,4"/>

        <!-- Pyramid right face: E-F-P -->
        <polygon points="200,130 145,35 175,20" fill="#93c5fd" stroke="#2563eb" stroke-width="1.5"/>

        <!-- Gable right face: B-E-F-C -->
        <polygon points="145,155 200,130 145,35 90,60" fill="#dbeafe" stroke="#2563eb" stroke-width="1.5"/>

        <!-- Gable left face: A-D-F-C (slightly faded) -->
        <polygon points="35,155 90,130 145,35 90,60" fill="#eff6ff" stroke="#2563eb" stroke-width="1" opacity="0.7"/>

        <!-- Gable front face: A-B-C -->
        <polygon points="35,155 145,155 90,60" fill="#bfdbfe" stroke="#2563eb" stroke-width="2"/>

        <!-- Ridge: C→F→P -->
        <line x1="90"  y1="60" x2="145" y2="35" stroke="#1d4ed8" stroke-width="2"/>
        <line x1="145" y1="35" x2="175" y2="20" stroke="#1d4ed8" stroke-width="1.5" stroke-dasharray="5,3"/>
        <circle cx="175" cy="20" r="3" fill="#1d4ed8"/>

        <!-- "Main house" junction wall (context) -->
        <line x1="120" y1="115" x2="230" y2="115" stroke="#94a3b8" stroke-width="1" stroke-dasharray="4,3"/>
        <text x="172" y="128" text-anchor="middle" fill="#94a3b8" font-size="9">main house wall</text>

        <!-- W: arrow below front face -->
        <line x1="35" y1="173" x2="145" y2="173"
              stroke="${dimColour}" stroke-width="1.2"
              marker-start="url(#ex-s)" marker-end="url(#ex-e)"/>
        <text x="90" y="186" text-anchor="middle" fill="#475569" font-size="11" font-weight="600">${wLabel}</text>

        <!-- L1: arrow along right eave B→E direction, offset below-right -->
        <line x1="153" y1="163" x2="208" y2="138"
              stroke="${dimColour}" stroke-width="1.2"
              marker-start="url(#ex-s)" marker-end="url(#ex-e)"/>
        <text x="195" y="162" text-anchor="middle" fill="#475569" font-size="11" font-weight="600">${l1Label}</text>

        <!-- L2: arrow along E→junction right, offset below-right -->
        <line x1="212" y1="135" x2="242" y2="120"
              stroke="${dimColour}" stroke-width="1.2"
              marker-start="url(#ex-s)" marker-end="url(#ex-e)"/>
        <text x="242" y="140" text-anchor="middle" fill="#475569" font-size="11" font-weight="600">${l2Label}</text>

        ${heightAnnotation}
      </svg>`;
    },

    leanto: (mode, vals = {}) => {
      const u = getUnitLabel();
      const lbl = (v, name) => v ? `${name} = ${formatNum(v)} ${u}` : name;
      const wLabel    = lbl(vals.width,      'Width (W)');
      const lLabel    = lbl(vals.length,     'Length (L)');
      const hLabel    = mode === 'slope' ? lbl(vals.slope, 'Slope (S)') : lbl(vals.height, 'Height (H)');
      const wallLabel = lbl(vals.wallHeight, 'WH');
      const dc = '#64748b', sc = '#2563eb';

      const heightAnnotation = mode === 'slope' ? `
    <!-- Slope: A(55,155) to C(175,55) along front face -->
    <line x1="57" y1="153" x2="173" y2="57"
          stroke="${sc}" stroke-width="1.8" stroke-dasharray="6,3"
          marker-start="url(#lt-ss)" marker-end="url(#lt-se)"/>
    <text transform="translate(102,96) rotate(-40)" text-anchor="middle"
          fill="${sc}" font-size="11" font-weight="700">${hLabel}</text>
  ` : `
    <!-- Height: right of C(175,55)→B(175,155), external right -->
    <line x1="193" y1="155" x2="193" y2="55" stroke="${dc}" stroke-width="1.2"
          marker-start="url(#lt-s)" marker-end="url(#lt-e)"/>
    <line x1="175" y1="155" x2="196" y2="155" stroke="${dc}" stroke-width="0.8" stroke-dasharray="3,3"/>
    <line x1="175" y1="55"  x2="196" y2="55"  stroke="${dc}" stroke-width="0.8" stroke-dasharray="3,3"/>
    <text x="207" y="105" text-anchor="middle" fill="#475569" font-size="11" font-weight="600"
          transform="rotate(-90,207,105)">${hLabel}</text>
  `;

      return `
  <svg width="320" height="235" viewBox="-5 5 340 250" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <marker id="lt-e" markerWidth="7" markerHeight="7" refX="6" refY="3.5" orient="auto">
        <path d="M0,0.5 L6,3.5 L0,6.5 Z" fill="${dc}"/>
      </marker>
      <marker id="lt-s" markerWidth="7" markerHeight="7" refX="6" refY="3.5" orient="auto-start-reverse">
        <path d="M0,0.5 L6,3.5 L0,6.5 Z" fill="${dc}"/>
      </marker>
      <marker id="lt-se" markerWidth="7" markerHeight="7" refX="6" refY="3.5" orient="auto">
        <path d="M0,0.5 L6,3.5 L0,6.5 Z" fill="${sc}"/>
      </marker>
      <marker id="lt-ss" markerWidth="7" markerHeight="7" refX="6" refY="3.5" orient="auto-start-reverse">
        <path d="M0,0.5 L6,3.5 L0,6.5 Z" fill="${sc}"/>
      </marker>
    </defs>

    <!-- WALL LAYER (fades out in roof-only mode) -->
    <g class="wall-layer">
      <polygon points="55,155 175,155 175,205 55,205"
               fill="#e0f2fe" stroke="#2563eb" stroke-width="1.5"/>
      <polygon points="175,155 275,120 275,170 175,205"
               fill="#bae6fd" stroke="#2563eb" stroke-width="1.5"/>
      <line x1="155" y1="120" x2="155" y2="170" stroke="#94a3b8" stroke-width="1" stroke-dasharray="5,4"/>
      <line x1="55"  y1="205" x2="155" y2="170" stroke="#94a3b8" stroke-width="1" stroke-dasharray="5,4"/>
      <line x1="155" y1="170" x2="275" y2="170" stroke="#94a3b8" stroke-width="1" stroke-dasharray="5,4"/>
      <line x1="193" y1="157" x2="193" y2="203" stroke="${dc}" stroke-width="1.2"
            marker-start="url(#lt-s)" marker-end="url(#lt-e)"/>
      <line x1="175" y1="155" x2="196" y2="155" stroke="${dc}" stroke-width="0.8" stroke-dasharray="3,3"/>
      <line x1="175" y1="205" x2="196" y2="205" stroke="${dc}" stroke-width="0.8" stroke-dasharray="3,3"/>
      <text x="202" y="183" text-anchor="start" fill="#475569" font-size="11" font-weight="600">${wallLabel}</text>
    </g>

    <!-- ROOF (always visible) -->
    <line x1="55"  y1="155" x2="155" y2="120" stroke="#94a3b8" stroke-width="1.5" stroke-dasharray="5,4"/>
    <line x1="155" y1="120" x2="275" y2="120" stroke="#94a3b8" stroke-width="1.5" stroke-dasharray="5,4"/>
    <polygon points="155,120 275,120 275,20" fill="#93c5fd" stroke="#2563eb" stroke-width="1.5" opacity="0.5"/>
    <polygon points="55,155 175,55 275,20 155,120" fill="#bfdbfe" stroke="#2563eb" stroke-width="1.5"/>
    <polygon points="175,155 175,55 275,20 275,120" fill="#dbeafe" stroke="#2563eb" stroke-width="1.5"/>
    <polygon points="55,155 175,155 175,55" fill="#eff6ff" stroke="#2563eb" stroke-width="2"/>

    <!-- Width: below A-B -->
    <line x1="55" y1="172" x2="175" y2="172" stroke="${dc}" stroke-width="1.2"
          marker-start="url(#lt-s)" marker-end="url(#lt-e)"/>
    <text x="115" y="187" text-anchor="middle" fill="#475569" font-size="11" font-weight="600">${wLabel}</text>

    <!-- Length: along B-E offset -->
    <line x1="183" y1="163" x2="283" y2="128" stroke="${dc}" stroke-width="1.2"
          marker-start="url(#lt-s)" marker-end="url(#lt-e)"/>
    <text x="248" y="158" text-anchor="middle" fill="#475569" font-size="11" font-weight="600">${lLabel}</text>

    ${heightAnnotation}
  </svg>`;
    },

    hip: (mode, vals = {}) => {
      const u = getUnitLabel();
      const lbl = (v, name) => v ? `${name} = ${formatNum(v)} ${u}` : name;
      const lLabel    = lbl(vals.length,      'L');
      const wLabel    = lbl(vals.width,       'W');
      const aLabel    = mode === 'slope' ? lbl(vals.slope, 'Slope (S)') : lbl(vals.height, 'H');
      const wallLabel = lbl(vals.wallHeight,  'WH');
      const cLabel    = lbl(vals.ridgeLength, 'R');
      const dc = '#64748b', sc = '#2563eb';

      const roofAnnotation = mode === 'slope' ? `
        <line x1="130" y1="153" x2="155" y2="47"
              stroke="${sc}" stroke-width="2" stroke-dasharray="6,3"
              marker-start="url(#hp-ss)" marker-end="url(#hp-se)"/>
        <polyline points="130,149 138,151 136,157" fill="none" stroke="#94a3b8" stroke-width="1.2"/>
        <text x="96" y="91" text-anchor="middle" fill="${sc}" font-size="11" font-weight="700"
              transform="rotate(-77,96,91)">${aLabel}</text>
      ` : `
        <line x1="3" y1="45" x2="3" y2="155" stroke="${dc}" stroke-width="1.2"
              marker-start="url(#hp-s)" marker-end="url(#hp-e)"/>
        <line x1="25"  y1="155" x2="0"  y2="155" stroke="${dc}" stroke-width="0.8" stroke-dasharray="3,3"/>
        <line x1="100" y1="45"  x2="0"  y2="45"  stroke="${dc}" stroke-width="0.8" stroke-dasharray="3,3"/>
        <text x="-9" y="100" text-anchor="middle" fill="#475569" font-size="11" font-weight="600"
              transform="rotate(-90,-9,100)">${aLabel}</text>
      `;

      return `
  <svg width="320" height="220" viewBox="-30 5 340 235" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <marker id="hp-e" markerWidth="7" markerHeight="7" refX="6" refY="3.5" orient="auto">
        <path d="M0,0.5 L6,3.5 L0,6.5 Z" fill="${dc}"/>
      </marker>
      <marker id="hp-s" markerWidth="7" markerHeight="7" refX="6" refY="3.5" orient="auto-start-reverse">
        <path d="M0,0.5 L6,3.5 L0,6.5 Z" fill="${dc}"/>
      </marker>
      <marker id="hp-se" markerWidth="7" markerHeight="7" refX="6" refY="3.5" orient="auto">
        <path d="M0,0.5 L6,3.5 L0,6.5 Z" fill="${sc}"/>
      </marker>
      <marker id="hp-ss" markerWidth="7" markerHeight="7" refX="6" refY="3.5" orient="auto-start-reverse">
        <path d="M0,0.5 L6,3.5 L0,6.5 Z" fill="${sc}"/>
      </marker>
    </defs>

    <!-- WALL LAYER (fades out in roof-only mode) -->
    <g class="wall-layer">
      <polygon points="25,155 235,155 235,205 25,205"
               fill="#e0f2fe" stroke="#2563eb" stroke-width="1.5"/>
      <polygon points="235,155 285,118 285,168 235,205"
               fill="#bae6fd" stroke="#2563eb" stroke-width="1.5"/>
      <line x1="75" y1="118" x2="75" y2="168"  stroke="#94a3b8" stroke-width="1" stroke-dasharray="5,4"/>
      <line x1="25" y1="205" x2="75" y2="168"  stroke="#94a3b8" stroke-width="1" stroke-dasharray="5,4"/>
      <line x1="75" y1="168" x2="285" y2="168" stroke="#94a3b8" stroke-width="1" stroke-dasharray="5,4"/>
      <!-- h annotation -->
      <line x1="248" y1="157" x2="248" y2="203" stroke="${dc}" stroke-width="1.2"
            marker-start="url(#hp-s)" marker-end="url(#hp-e)"/>
      <line x1="235" y1="155" x2="251" y2="155" stroke="${dc}" stroke-width="0.8" stroke-dasharray="3,3"/>
      <line x1="235" y1="205" x2="251" y2="205" stroke="${dc}" stroke-width="0.8" stroke-dasharray="3,3"/>
      <text x="256" y="183" text-anchor="start" fill="#475569" font-size="11" font-weight="600">${wallLabel}</text>
    </g>

    <!-- ROOF (always visible) -->
    <line x1="25"  y1="155" x2="75"  y2="118" stroke="#94a3b8" stroke-width="1.5" stroke-dasharray="5,4"/>
    <line x1="75"  y1="118" x2="285" y2="118" stroke="#94a3b8" stroke-width="1.5" stroke-dasharray="5,4"/>
    <line x1="75"  y1="118" x2="100" y2="45"  stroke="#94a3b8" stroke-width="1.5" stroke-dasharray="5,4"/>
    <line x1="285" y1="118" x2="210" y2="45"  stroke="#94a3b8" stroke-width="1.5" stroke-dasharray="5,4"/>
    <polygon points="75,118 285,118 210,45 100,45"
             fill="#93c5fd" stroke="#2563eb" stroke-width="1" opacity="0.35"/>
    <polygon points="25,155 75,118 100,45"
             fill="#eff6ff" stroke="#2563eb" stroke-width="1.5"/>
    <polygon points="235,155 285,118 210,45"
             fill="#dbeafe" stroke="#2563eb" stroke-width="1.5"/>
    <polygon points="25,155 235,155 210,45 100,45"
             fill="#bfdbfe" stroke="#2563eb" stroke-width="2"/>
    <line x1="100" y1="45" x2="210" y2="45" stroke="#1d4ed8" stroke-width="2.5"/>
    <circle cx="100" cy="45" r="2.5" fill="#1d4ed8"/>
    <circle cx="210" cy="45" r="2.5" fill="#1d4ed8"/>
    <line x1="25"  y1="155" x2="100" y2="45" stroke="#2563eb" stroke-width="1.5"/>
    <line x1="235" y1="155" x2="210" y2="45" stroke="#2563eb" stroke-width="1.5"/>
    <line x1="235" y1="155" x2="285" y2="118" stroke="#2563eb" stroke-width="1.5"/>

    <!-- C: ridge length -->
    <line x1="100" y1="30" x2="210" y2="30" stroke="${sc}" stroke-width="1.2"
          marker-start="url(#hp-ss)" marker-end="url(#hp-se)"/>
    <line x1="100" y1="45" x2="100" y2="32" stroke="${sc}" stroke-width="0.8" stroke-dasharray="3,3"/>
    <line x1="210" y1="45" x2="210" y2="32" stroke="${sc}" stroke-width="0.8" stroke-dasharray="3,3"/>
    <text x="155" y="24" text-anchor="middle" fill="${sc}" font-size="11" font-weight="700">${cLabel}</text>

    <!-- L: below front eave -->
    <line x1="25" y1="173" x2="235" y2="173" stroke="${dc}" stroke-width="1.2"
          marker-start="url(#hp-s)" marker-end="url(#hp-e)"/>
    <text x="130" y="187" text-anchor="middle" fill="#475569" font-size="11" font-weight="600">${lLabel}</text>

    <!-- W: right eave edge B-C -->
    <line x1="243" y1="163" x2="293" y2="126" stroke="${dc}" stroke-width="1.2"
          marker-start="url(#hp-s)" marker-end="url(#hp-e)"/>
    <text x="295" y="155" text-anchor="start" fill="#475569" font-size="11" font-weight="600">${wLabel}</text>

    ${roofAnnotation}
  </svg>`;
    },

  };

  // ── Render helpers ─────────────────────────────────────────────────────────
  function getUnitLabel() { return currentUnit === 'metric' ? 'm' : 'ft'; }
  function getVolumeLabel() { return currentUnit === 'metric' ? 'm³' : 'ft³'; }

  function renderControls() {
    const wm = getWallMode();
    const hipToggle = ['gable', 'leanto', 'hip'].includes(currentRoof) ? `
      <div class="btn-group hip-mode-toggle" role="group">
        <button type="button" class="btn btn-sm ${wm === 'roof'  ? 'btn-warning' : 'btn-outline-warning'}" onclick="setWallMode('roof')">Roof only</button>
        <button type="button" class="btn btn-sm ${wm === 'walls' ? 'btn-warning' : 'btn-outline-warning'}" onclick="setWallMode('walls')">Roof + Walls</button>
      </div>` : '';

    document.getElementById('controls-row').innerHTML = `
      <div class="controls-row">
        ${hipToggle}
        <div class="controls-right">
          <div class="btn-group" role="group">
            <button type="button" class="btn btn-sm ${currentUnit === 'metric'   ? 'btn-primary' : 'btn-outline-primary'}" onclick="setUnit('metric')">Metric (m)</button>
            <button type="button" class="btn btn-sm ${currentUnit === 'imperial' ? 'btn-primary' : 'btn-outline-primary'}" onclick="setUnit('imperial')">Imperial (ft)</button>
          </div>
          <div class="btn-group" role="group">
            <button type="button" class="btn btn-sm ${measureMode === 'vertical' ? 'btn-primary' : 'btn-outline-primary'}" onclick="setMeasureMode('vertical')">Vertical height</button>
            <button type="button" class="btn btn-sm ${measureMode === 'slope'    ? 'btn-primary' : 'btn-outline-primary'}" onclick="setMeasureMode('slope')">${currentRoof === 'extension' ? 'Hip rafter (S)' : 'Slope length'}</button>
          </div>
        </div>
      </div>`;
  }

  function renderInputs() {
    const config = roofConfigs[currentRoof];
    const u = getUnitLabel();
    const container = document.getElementById('inputs-container');

    // Special layout for roofs with wall height: main fields in grid + animated wall height row
    if (config.fields.some(f => f.id === 'wallHeight')) {
      const mainFields = config.fields.filter(f => f.id !== 'wallHeight');
      const wallField  = config.fields.find(f => f.id === 'wallHeight');

      const makeField = (f, colCls) => {
        const actualField = (f.id === 'height' && measureMode === 'slope')
          ? { id: 'slope', label: currentRoof === 'extension' ? 'Hip Rafter (S)' : 'Slope (S)',
              hint: currentRoof === 'extension' ? 'Outer corner to ridge apex' : 'Eave to ridge (along slope)',
              tooltip: 'Measure along the slope of the roof from the eave (bottom edge) up to the ridge (peak). This is the diagonal surface measurement, not the vertical height.' }
          : f;
        return `
          <div class="${colCls}">
            <label class="form-label" for="field-${actualField.id}">
              <span class="field-label-text">${actualField.label}</span>
              ${actualField.tooltip ? `
                <button type="button" class="field-tooltip-btn"
                  data-bs-toggle="tooltip" data-bs-placement="top"
                  data-bs-custom-class="measure-tooltip"
                  title="${actualField.tooltip.replace(/"/g, '&quot;')}">?</button>` : ''}
            </label>
            ${actualField.hint ? `<div class="field-hint">${actualField.hint}</div>` : ''}
            <div class="input-group">
              <input type="number" class="form-control" id="field-${actualField.id}"
                min="0" step="0.01" placeholder="0.00"
                oninput="onFieldInput('${actualField.id}')" />
              <span class="input-group-text">${u}</span>
            </div>
            <div class="field-error d-none" id="err-${actualField.id}"></div>
          </div>`;
      };

      const mainColCls = mainFields.length >= 4 ? 'col-md-3' : 'col-md-4';
      const mainHtml = mainFields.map(f => makeField(f, mainColCls)).join('');
      const wallHtml = wallField ? `
        <div class="wall-input-row${getWallMode() === 'roof' ? ' wall-input-hidden' : ''}" id="wall-input-row">
          <div class="row g-3 pt-0">
            ${makeField(wallField, 'col-md-3')}
          </div>
        </div>` : '';

      container.innerHTML = `<div class="row g-3">${mainHtml}</div>${wallHtml}`;

      container.querySelectorAll('[data-bs-toggle="tooltip"]').forEach(el => {
        new bootstrap.Tooltip(el, { trigger: 'click' });
      });
      return;
    }

    const colClass = config.fields.length >= 5 ? 'col-sm-6 col-md-4'
                   : config.fields.length >= 4 ? 'col-md-3'
                   : 'col-md-4';

    const fields = config.fields.map(f => {
      if (f.id === 'height' && measureMode === 'slope') {
        const hint = currentRoof === 'extension' ? 'Outer corner to ridge apex' : 'Eave to ridge (along slope)';
        const label = currentRoof === 'extension' ? 'Hip Rafter (S)' : 'Slope (S)';
        const tooltip = currentRoof === 'extension'
          ? 'Measure the hip rafter: the diagonal distance from the outer bottom corner of the extension (where the two eaves meet) up to the ridge apex. This is a 3D diagonal measurement.'
          : 'Measure along the slope of the roof from the eave (bottom edge) up to the ridge (peak). This is the diagonal surface measurement, not the vertical height.';
        return { id: 'slope', label, hint, tooltip };
      }
      return f;
    });

    const fieldsHtml = fields.map(f => `
      <div class="${colClass}">
        <label class="form-label" for="field-${f.id}">
          <span class="field-label-text">${f.label}</span>
          ${f.tooltip ? `
            <button type="button" class="field-tooltip-btn"
              data-bs-toggle="tooltip" data-bs-placement="top"
              data-bs-custom-class="measure-tooltip"
              title="${f.tooltip.replace(/"/g, '&quot;')}">?</button>` : ''}
        </label>
        ${f.hint ? `<div class="field-hint">${f.hint}</div>` : ''}
        <div class="input-group">
          <input type="number" class="form-control" id="field-${f.id}"
            min="0" step="0.01" placeholder="0.00"
            oninput="onFieldInput('${f.id}')" />
          <span class="input-group-text">${u}</span>
        </div>
        <div class="field-error d-none" id="err-${f.id}"></div>
      </div>
    `).join('');

    container.innerHTML = `<div class="row g-3">${fieldsHtml}</div>`;

    // Initialise Bootstrap tooltips on the new elements
    container.querySelectorAll('[data-bs-toggle="tooltip"]').forEach(el => {
      new bootstrap.Tooltip(el, { trigger: 'click' });
    });
  }

  function onFieldInput(fieldId) {
    const input = document.getElementById(`field-${fieldId}`);
    const errEl = document.getElementById(`err-${fieldId}`);
    if (!input || !errEl) return;

    const val = parseFloat(input.value);
    if (input.value !== '' && (!isFinite(val) || val <= 0)) {
      input.classList.add('is-invalid');
      errEl.textContent = 'Must be a positive number';
      errEl.classList.remove('d-none');
    } else {
      input.classList.remove('is-invalid');
      errEl.classList.add('d-none');
    }

    // Live diagram update
    renderDiagram();
    // Hide the result banner while inputs are being changed
    hideResult();
  }

  function renderDiagram() {
    const d = diagrams[currentRoof];
    // Collect any currently entered values to show live on the diagram
    const vals = {
      length:  parseFloat(document.getElementById('field-length')?.value)  || null,
      width:   parseFloat(document.getElementById('field-width')?.value)   || null,
      height:  parseFloat(document.getElementById('field-height')?.value)  || null,
      slope:   parseFloat(document.getElementById('field-slope')?.value)   || null,
      length2: parseFloat(document.getElementById('field-length2')?.value) || null,
      wallHeight:  parseFloat(document.getElementById('field-wallHeight')?.value)  || null,
      ridgeLength: parseFloat(document.getElementById('field-ridgeLength')?.value) || null,
    };
    const diagramEl = document.getElementById('diagram');
    diagramEl.innerHTML = typeof d === 'function' ? d(measureMode, vals) : d;
    // Apply roof-only class for wall-mode CSS transitions (instant, no animation)
    const hasWallToggle = ['gable', 'leanto', 'hip'].includes(currentRoof);
    diagramEl.classList.toggle('roof-only', hasWallToggle && getWallMode() === 'roof');
  }

  // ── Actions ────────────────────────────────────────────────────────────────
  function selectRoof(type) {
    currentRoof = type;
    document.querySelectorAll('.roof-card').forEach(c => {
      c.classList.toggle('active', c.dataset.type === type);
    });
    hideResult();
    hideError();
    renderControls();
    renderDiagram();
    renderInputs();
  }

  function setUnit(unit) {
    currentUnit = unit;
    hideResult();
    renderControls();
    renderInputs();
  }

  function setMeasureMode(mode) {
    measureMode = mode;
    hideResult();
    hideError();
    renderControls();
    renderDiagram();
    renderInputs();
  }

  function setWallMode(mode) {
    wallModes[currentRoof] = mode;
    hideResult();
    hideError();
    document.getElementById('diagram').classList.toggle('roof-only', mode === 'roof');
    const wallRow = document.getElementById('wall-input-row');
    if (wallRow) wallRow.classList.toggle('wall-input-hidden', mode === 'roof');
    renderControls();
  }

  function calculate() {
    hideError();
    document.getElementById('result-breakdown').classList.add('d-none');

    const config = roofConfigs[currentRoof];
    const u = getUnitLabel();
    const vu = getVolumeLabel();

    // ── Extension calculator (4 inputs, breakdown result) ──────────────────
    if (currentRoof === 'extension') {
      const W  = parseFloat(document.getElementById('field-width')?.value);
      const L1 = parseFloat(document.getElementById('field-length')?.value);
      const L2 = parseFloat(document.getElementById('field-length2')?.value);

      if (!isFinite(W) || !isFinite(L1) || !isFinite(L2) || W <= 0 || L1 <= 0 || L2 <= 0) {
        showError('Please enter valid positive values for all dimensions.');
        return;
      }

      let H;
      if (measureMode === 'slope') {
        const S = parseFloat(document.getElementById('field-slope')?.value);
        if (!isFinite(S) || S <= 0) {
          showError('Please enter a valid positive hip rafter length.');
          return;
        }
        const minS = Math.sqrt(L2 * L2 + (W / 2) * (W / 2));
        if (S <= minS) {
          showError(`Hip rafter must be greater than √(PL² + (W/2)²) = ${formatNum(minS)} ${u}.`);
          return;
        }
        H = Math.sqrt(S * S - L2 * L2 - (W / 2) * (W / 2));
      } else {
        H = parseFloat(document.getElementById('field-height')?.value);
        if (!isFinite(H) || H <= 0) {
          showError('Please enter valid positive values for all dimensions.');
          return;
        }
      }

      const vGable   = 0.5 * W * L1 * H;
      const vPyramid = W * H * L2 / 6;
      const vTotal   = vGable + vPyramid;

      const M3_PER_FT3 = 0.0283168;
      const altTotal = currentUnit === 'metric' ? vTotal / M3_PER_FT3 : vTotal * M3_PER_FT3;
      const altUnit  = currentUnit === 'metric' ? 'ft³' : 'm³';

      const derivedNote = measureMode === 'slope'
        ? `Derived height: ${formatNum(H)} ${u}  ·  Also: ${formatNum(altTotal)} ${altUnit}`
        : `Also: ${formatNum(altTotal)} ${altUnit}`;

      document.getElementById('result-roof-label').textContent = 'Roof Extension — Total Volume';
      document.getElementById('result-value').textContent = formatNum(vTotal);
      document.getElementById('result-unit').textContent = vu;
      document.getElementById('result-alt').textContent = derivedNote;
      document.getElementById('result-formula').textContent = config.formulaText();

      const bd = document.getElementById('result-breakdown');
      bd.innerHTML = `
        <span>🏠 Gable section: <strong>${formatNum(vGable)} ${vu}</strong></span>
        <span>🔺 Pyramid section: <strong>${formatNum(vPyramid)} ${vu}</strong></span>`;
      bd.classList.remove('d-none');

      document.getElementById('result').classList.remove('d-none');

      lastResult = {
        id: Date.now(),
        roofType: 'extension',
        label: '',
        unit: currentUnit,
        volumeM3: currentUnit === 'metric' ? vTotal : vTotal * 0.0283168,
        displayVolume: vTotal,
        displayUnit: vu,
        derivedHeight: measureMode === 'slope' ? H : null,
        breakdown: { gable: vGable, pyramid: vPyramid },
        dims: { W, L: L1, PL: L2, H },
        formula: config.formulaText(),
      };
      document.getElementById('save-label').value = '';
      return;
    }

    // ── Hip Roof calculator (roof-only or roof + walls) ────────────────────────
    if (currentRoof === 'hip') {
      const L  = parseFloat(document.getElementById('field-length')?.value);
      const W  = parseFloat(document.getElementById('field-width')?.value);
      const C  = parseFloat(document.getElementById('field-ridgeLength')?.value);

      if ([L, W, C].some(v => !isFinite(v) || v <= 0)) {
        showError('Please enter valid positive values for all fields.');
        return;
      }

      let A;
      if (measureMode === 'slope') {
        const S = parseFloat(document.getElementById('field-slope')?.value);
        if (!isFinite(S) || S <= 0) {
          showError('Please enter a valid positive slope length.');
          return;
        }
        const offset = W / 2;
        if (S <= offset) {
          showError(`Slope length must be greater than ${formatNum(offset)} ${u}.`);
          return;
        }
        A = Math.sqrt(S * S - offset * offset);
      } else {
        A = parseFloat(document.getElementById('field-height')?.value);
        if (!isFinite(A) || A <= 0) {
          showError('Please enter valid positive values for all fields.');
          return;
        }
      }

      if (C >= L) {
        showError('Ridge length (R) must be less than building length (L).');
        return;
      }

      const M3_PER_FT3 = 0.0283168;

      if (getWallMode() === 'walls') {
        const hw = parseFloat(document.getElementById('field-wallHeight')?.value);
        if (!isFinite(hw) || hw <= 0) {
          showError('Please enter a valid positive wall height.');
          return;
        }
        const wallVol = L * W * hw;
        const roofVol = W * A * (2 * L + C) / 6;
        const vTotal  = wallVol + roofVol;
        const altTotal = currentUnit === 'metric' ? vTotal / M3_PER_FT3 : vTotal * M3_PER_FT3;
        const altUnit  = currentUnit === 'metric' ? 'ft³' : 'm³';
        const derivedNote = measureMode === 'slope'
          ? `Derived roof height: ${formatNum(A)} ${u}  ·  Also: ${formatNum(altTotal)} ${altUnit}`
          : `Also: ${formatNum(altTotal)} ${altUnit}`;
        document.getElementById('result-roof-label').textContent = 'Hip + Walls — Total Volume';
        document.getElementById('result-value').textContent = formatNum(vTotal);
        document.getElementById('result-unit').textContent = vu;
        document.getElementById('result-alt').textContent = derivedNote;
        document.getElementById('result-formula').textContent = config.formulaText();
        const bd = document.getElementById('result-breakdown');
        bd.innerHTML = `
          <span>🏠 Walls: <strong>${formatNum(wallVol)} ${vu}</strong></span>
          <span>🏚 Roof: <strong>${formatNum(roofVol)} ${vu}</strong></span>`;
        bd.classList.remove('d-none');
        document.getElementById('result').classList.remove('d-none');
        lastResult = {
          id: Date.now(), roofType: 'hip', label: '', unit: currentUnit,
          volumeM3: currentUnit === 'metric' ? vTotal : vTotal * M3_PER_FT3,
          displayVolume: vTotal, displayUnit: vu,
          derivedHeight: measureMode === 'slope' ? A : null,
          breakdown: { wall: wallVol, roof: roofVol },
          dims: { L, W, WH: hw, H: A, R: C }, formula: config.formulaText(),
          wallMode: 'walls',
        };
      } else {
        const roofVol = W * A * (2 * L + C) / 6;
        const altTotal = currentUnit === 'metric' ? roofVol / M3_PER_FT3 : roofVol * M3_PER_FT3;
        const altUnit  = currentUnit === 'metric' ? 'ft³' : 'm³';
        const derivedNote = measureMode === 'slope'
          ? `Derived roof height: ${formatNum(A)} ${u}  ·  Also: ${formatNum(altTotal)} ${altUnit}`
          : `Also: ${formatNum(altTotal)} ${altUnit}`;
        document.getElementById('result-roof-label').textContent = 'Hip Roof — Roof Volume';
        document.getElementById('result-value').textContent = formatNum(roofVol);
        document.getElementById('result-unit').textContent = vu;
        document.getElementById('result-alt').textContent = derivedNote;
        document.getElementById('result-formula').textContent = config.formulaText();
        document.getElementById('result-breakdown').classList.add('d-none');
        document.getElementById('result').classList.remove('d-none');
        lastResult = {
          id: Date.now(), roofType: 'hip', label: '', unit: currentUnit,
          volumeM3: currentUnit === 'metric' ? roofVol : roofVol * M3_PER_FT3,
          displayVolume: roofVol, displayUnit: vu,
          derivedHeight: measureMode === 'slope' ? A : null,
          breakdown: null,
          dims: { L, W, H: A, R: C }, formula: config.formulaText(),
          wallMode: 'roof',
        };
      }
      document.getElementById('save-label').value = '';
      return;
    }

    // ── Standard 3-field calculators (gable) ──────────────────────────────
    const L = parseFloat(document.getElementById('field-length')?.value);
    const W = parseFloat(document.getElementById('field-width')?.value);

    if (!isFinite(L) || !isFinite(W) || L <= 0 || W <= 0) {
      showError('Please enter valid positive values for all dimensions.');
      return;
    }

    let H;
    if (measureMode === 'slope') {
      const S = parseFloat(document.getElementById('field-slope')?.value);
      if (!isFinite(S) || S <= 0) {
        showError('Please enter a valid positive slope length.');
        return;
      }
      const offset = config.slopeOffset(W);
      if (S <= offset) {
        showError(`Slope length must be greater than ${formatNum(offset)} ${u}.`);
        return;
      }
      H = Math.sqrt(S * S - offset * offset);
    } else {
      H = parseFloat(document.getElementById('field-height')?.value);
      if (!isFinite(H) || H <= 0) {
        showError('Please enter valid positive values for all dimensions.');
        return;
      }
    }

    const roofVol = config.formula(L, W, H);
    const M3_PER_FT3 = 0.0283168;

    if (getWallMode() === 'walls') {
      const hw = parseFloat(document.getElementById('field-wallHeight')?.value);
      if (!isFinite(hw) || hw <= 0) {
        showError('Please enter a valid positive wall height.');
        return;
      }
      const wallVol = L * W * hw;
      const vTotal  = roofVol + wallVol;
      const altTotal = currentUnit === 'metric' ? vTotal / M3_PER_FT3 : vTotal * M3_PER_FT3;
      const altUnit  = currentUnit === 'metric' ? 'ft³' : 'm³';
      const derivedNote = measureMode === 'slope'
        ? `Derived height: ${formatNum(H)} ${u}  ·  Also: ${formatNum(altTotal)} ${altUnit}`
        : `Also: ${formatNum(altTotal)} ${altUnit}`;

      document.getElementById('result-roof-label').textContent = config.label + ' + Walls — Total Volume';
      document.getElementById('result-value').textContent = formatNum(vTotal);
      document.getElementById('result-unit').textContent = vu;
      document.getElementById('result-alt').textContent = derivedNote;
      document.getElementById('result-formula').textContent = config.formulaText();

      const bd = document.getElementById('result-breakdown');
      bd.innerHTML = `
        <span>🏠 Walls: <strong>${formatNum(wallVol)} ${vu}</strong></span>
        <span>🏚 Roof: <strong>${formatNum(roofVol)} ${vu}</strong></span>`;
      bd.classList.remove('d-none');
      document.getElementById('result').classList.remove('d-none');

      lastResult = {
        id: Date.now(), roofType: currentRoof, label: '', unit: currentUnit,
        volumeM3: currentUnit === 'metric' ? vTotal : vTotal * M3_PER_FT3,
        displayVolume: vTotal, displayUnit: vu,
        derivedHeight: measureMode === 'slope' ? H : null,
        breakdown: { wall: wallVol, roof: roofVol },
        dims: { L, W, H, WH: hw },
        formula: config.formulaText(),
        wallMode: 'walls',
      };
    } else {
      const vol = roofVol;
      let primary, primaryUnit, altVol, altUnit;
      if (currentUnit === 'metric') {
        primary = vol;      primaryUnit = 'm³';
        altVol  = vol / M3_PER_FT3; altUnit = 'ft³';
      } else {
        primary = vol;      primaryUnit = 'ft³';
        altVol  = vol * M3_PER_FT3; altUnit = 'm³';
      }
      const derivedNote = measureMode === 'slope'
        ? `Derived height: ${formatNum(H)} ${u}  ·  Also: ${formatNum(altVol)} ${altUnit}`
        : `Also: ${formatNum(altVol)} ${altUnit}`;

      document.getElementById('result-roof-label').textContent = config.label + ' Volume';
      document.getElementById('result-value').textContent = formatNum(primary);
      document.getElementById('result-unit').textContent = primaryUnit;
      document.getElementById('result-alt').textContent = derivedNote;
      document.getElementById('result-formula').textContent = config.formulaText();
      document.getElementById('result-breakdown').classList.add('d-none');
      document.getElementById('result').classList.remove('d-none');

      lastResult = {
        id: Date.now(), roofType: currentRoof, label: '', unit: currentUnit,
        volumeM3: currentUnit === 'metric' ? vol : vol * 0.0283168,
        displayVolume: primary, displayUnit: primaryUnit,
        derivedHeight: measureMode === 'slope' ? H : null,
        breakdown: null,
        dims: { L, W, H },
        formula: config.formulaText(),
        wallMode: 'roof',
      };
    }
    document.getElementById('save-label').value = '';
  }

  function formatNum(n) {
    if (n >= 1000) return n.toLocaleString(undefined, { maximumFractionDigits: 2 });
    if (n >= 1)    return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 3 });
    return n.toLocaleString(undefined, { minimumFractionDigits: 3, maximumFractionDigits: 5 });
  }

  function showError(msg) {
    const el = document.getElementById('error-msg');
    el.textContent = msg;
    el.classList.remove('d-none');
  }
  function hideError()  { document.getElementById('error-msg').classList.add('d-none'); }
  function hideResult() {
    document.getElementById('result').classList.add('d-none');
    lastResult = null;
  }

  // ── Save / load ────────────────────────────────────────────────────────────
  function saveCalculation() {
    if (!lastResult) return;
    const labelInput = document.getElementById('save-label');
    const label = labelInput.value.trim() || roofConfigs[lastResult.roofType]?.label || 'Roof section';
    const entry = { ...lastResult, label, savedAt: new Date().toISOString() };

    const list = loadSaved();
    list.push(entry);
    persistSaved(list);
    renderSaved();

    // Brief visual feedback
    const btn = document.querySelector('.save-btn');
    btn.textContent = '✓ Saved!';
    btn.style.background = '#16a34a';
    setTimeout(() => {
      btn.innerHTML = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg> Save`;
      btn.style.background = '';
    }, 1500);
  }

  function deleteCalculation(id) {
    const list = loadSaved().filter(e => e.id !== id);
    persistSaved(list);
    renderSaved();
  }

  function moveCalculation(id, direction) {
    const list = loadSaved();
    const idx = list.findIndex(e => e.id === id);
    if (idx < 0) return;
    const newIdx = idx + direction;
    if (newIdx < 0 || newIdx >= list.length) return;
    [list[idx], list[newIdx]] = [list[newIdx], list[idx]];
    persistSaved(list);
    renderSaved();
  }

  function clearAllCalculations() {
    if (!confirm('Clear all saved calculations?')) return;
    persistSaved([]);
    renderSaved();
  }

  function renderSaved() {
    const list = loadSaved();
    const section = document.getElementById('saved-section');
    const container = document.getElementById('saved-list');
    const totalEl = document.getElementById('saved-total');

    if (list.length === 0) {
      section.classList.add('d-none');
      return;
    }
    section.classList.remove('d-none');

    const roofLabels = { gable: 'Gable', extension: 'Extension', hip: 'Hip Roof', leanto: 'Lean-to', hipwalls: 'Hip + Walls' };

    container.innerHTML = list.map((e, i) => {
      const dimParts = [];
      if (e.dims) {
        const u = e.unit === 'metric' ? 'm' : 'ft';
        if (e.roofType === 'extension') {
          dimParts.push(`W=${formatNum(e.dims.W)}${u}`, `L=${formatNum(e.dims.L ?? e.dims.L1)}${u}`, `PL=${formatNum(e.dims.PL ?? e.dims.L2)}${u}`, `H=${formatNum(e.dims.H)}${u}`);
        } else if (e.roofType === 'hipwalls' || (e.roofType === 'hip' && (e.hipMode === 'walls' || e.wallMode === 'walls'))) {
          dimParts.push(`L=${formatNum(e.dims.L)}${u}`, `W=${formatNum(e.dims.W)}${u}`, `WH=${formatNum(e.dims.WH ?? e.dims.h)}${u}`, `H=${formatNum(e.dims.H ?? e.dims.A)}${u}`, `R=${formatNum(e.dims.R ?? e.dims.C)}${u}`);
        } else if (e.roofType === 'hip') {
          dimParts.push(`L=${formatNum(e.dims.L)}${u}`, `W=${formatNum(e.dims.W)}${u}`, `H=${formatNum(e.dims.H ?? e.dims.A)}${u}`, `R=${formatNum(e.dims.R ?? e.dims.C)}${u}`);
        } else {
          if (e.dims.L)  dimParts.push(`L=${formatNum(e.dims.L)}${u}`);
          if (e.dims.W)  dimParts.push(`W=${formatNum(e.dims.W)}${u}`);
          if (e.dims.H)  dimParts.push(`H=${formatNum(e.dims.H)}${u}`);
          const wh = e.dims.WH ?? e.dims.h;
          if (wh) dimParts.push(`WH=${formatNum(wh)}${u}`);
        }
      }
      const breakdownHtml = e.breakdown
        ? e.breakdown.wall !== undefined
          ? `<div class="saved-breakdown">🏠 Walls: ${formatNum(e.breakdown.wall)} ${e.displayUnit} · 🏚 Roof: ${formatNum(e.breakdown.roof)} ${e.displayUnit}</div>`
          : `<div class="saved-breakdown">🏠 Gable ${formatNum(e.breakdown.gable)} ${e.displayUnit} · 🔺 Pyramid ${formatNum(e.breakdown.pyramid)} ${e.displayUnit}</div>`
        : '';

      return `
        <div class="saved-item" data-id="${e.id}">
          <div class="saved-item-left">
            <div class="saved-item-reorder">
              <button class="reorder-btn" onclick="moveCalculation(${e.id},-1)" title="Move up" ${i === 0 ? 'disabled' : ''}>▲</button>
              <button class="reorder-btn" onclick="moveCalculation(${e.id}, 1)" title="Move down" ${i === list.length - 1 ? 'disabled' : ''}>▼</button>
            </div>
            <div class="saved-item-num">${i + 1}</div>
            <div>
              <div class="saved-item-label">${e.label}</div>
              <div class="saved-item-meta">${roofLabels[e.roofType] || e.roofType}${dimParts.length ? ' · ' + dimParts.join(', ') : ''}</div>
              ${breakdownHtml}
            </div>
          </div>
          <div class="saved-item-right">
            <div class="saved-item-vol">${formatNum(e.displayVolume)} <span class="saved-item-unit">${e.displayUnit}</span></div>
            <button class="saved-delete-btn" onclick="deleteCalculation(${e.id})" title="Remove">✕</button>
          </div>
        </div>`;
    }).join('');

    // Running total in m³, displayed in current unit
    const totalM3 = list.reduce((sum, e) => sum + (e.volumeM3 || 0), 0);
    const M3_PER_FT3 = 0.0283168;
    const totalDisplay = currentUnit === 'metric' ? totalM3 : totalM3 / M3_PER_FT3;
    const totalUnit    = currentUnit === 'metric' ? 'm³' : 'ft³';
    const altDisplay   = currentUnit === 'metric' ? totalM3 / M3_PER_FT3 : totalM3;
    const altUnit      = currentUnit === 'metric' ? 'ft³' : 'm³';

    totalEl.innerHTML = `
      <div class="total-label">Total volume (${list.length} section${list.length !== 1 ? 's' : ''})</div>
      <div class="total-value">${formatNum(totalDisplay)} <span class="total-unit">${totalUnit}</span></div>
      <div class="total-alt">Also: ${formatNum(altDisplay)} ${altUnit}</div>`;
  }

  // ── Print ──────────────────────────────────────────────────────────────────
  function printSummary() {
    const list = loadSaved();
    if (list.length === 0) return;

    const roofLabels = { gable: 'Gable Roof', extension: 'Roof Extension', hip: 'Hip Roof', leanto: 'Lean-to Roof', hipwalls: 'Hip + Walls' };
    const totalM3 = list.reduce((sum, e) => sum + (e.volumeM3 || 0), 0);
    const M3_PER_FT3 = 0.0283168;
    const totalDisplay = currentUnit === 'metric' ? totalM3 : totalM3 / M3_PER_FT3;
    const totalUnit    = currentUnit === 'metric' ? 'm³' : 'ft³';

    const rows = list.map((e, i) => {
      const u = e.unit === 'metric' ? 'm' : 'ft';
      const vu = e.displayUnit;
      const dimParts = [];
      if (e.dims) {
        if (e.roofType === 'extension') {
          dimParts.push(`W=${formatNum(e.dims.W)}${u}`, `L=${formatNum(e.dims.L ?? e.dims.L1)}${u}`, `PL=${formatNum(e.dims.PL ?? e.dims.L2)}${u}`, `H=${formatNum(e.dims.H)}${u}`);
        } else if (e.roofType === 'hipwalls' || (e.roofType === 'hip' && (e.hipMode === 'walls' || e.wallMode === 'walls'))) {
          dimParts.push(`L=${formatNum(e.dims.L)}${u}`, `W=${formatNum(e.dims.W)}${u}`, `WH=${formatNum(e.dims.WH ?? e.dims.h)}${u}`, `H=${formatNum(e.dims.H ?? e.dims.A)}${u}`, `R=${formatNum(e.dims.R ?? e.dims.C)}${u}`);
        } else if (e.roofType === 'hip') {
          dimParts.push(`L=${formatNum(e.dims.L)}${u}`, `W=${formatNum(e.dims.W)}${u}`, `H=${formatNum(e.dims.H ?? e.dims.A)}${u}`, `R=${formatNum(e.dims.R ?? e.dims.C)}${u}`);
        } else {
          if (e.dims.L)  dimParts.push(`L=${formatNum(e.dims.L)}${u}`);
          if (e.dims.W)  dimParts.push(`W=${formatNum(e.dims.W)}${u}`);
          if (e.dims.H)  dimParts.push(`H=${formatNum(e.dims.H)}${u}`);
          const wh = e.dims.WH ?? e.dims.h;
          if (wh) dimParts.push(`WH=${formatNum(wh)}${u}`);
        }
      }

      // Breakdown sub-rows
      let breakdownRows = '';
      if (e.breakdown) {
        if (e.breakdown.wall !== undefined) {
          breakdownRows = `
            <tr class="breakdown-row">
              <td></td><td colspan="3" style="padding-left:1.5rem;color:#64748b;font-size:0.82rem">
                🏠 Walls: ${formatNum(e.breakdown.wall)} ${vu} &nbsp;·&nbsp;
                🏚 Roof: ${formatNum(e.breakdown.roof)} ${vu}
              </td><td></td>
            </tr>`;
        } else if (e.breakdown.gable !== undefined) {
          breakdownRows = `
            <tr class="breakdown-row">
              <td></td><td colspan="3" style="padding-left:1.5rem;color:#64748b;font-size:0.82rem">
                🏠 Gable: ${formatNum(e.breakdown.gable)} ${vu} &nbsp;·&nbsp;
                🔺 Pyramid: ${formatNum(e.breakdown.pyramid)} ${vu}
              </td><td></td>
            </tr>`;
        }
      }

      // Type label — append "+ Walls" if applicable
      const hasWalls = e.breakdown?.wall !== undefined;
      const typeLabel = (roofLabels[e.roofType] || e.roofType) + (hasWalls ? ' + Walls' : '');

      const mainRowClass = breakdownRows ? ' class="has-breakdown"' : '';
      return `<tr${mainRowClass}>
        <td>${i + 1}</td>
        <td>${e.label}</td>
        <td>${typeLabel}</td>
        <td>${dimParts.join(', ')}</td>
        <td style="text-align:right;font-weight:600">${formatNum(e.displayVolume)} ${vu}</td>
      </tr>${breakdownRows}`;
    }).join('');

    const date = new Date().toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
    const html = `<!DOCTYPE html><html><head><meta charset="UTF-8">
      <title>Roof Volume Summary</title>
      <style>
        body { font-family: system-ui, sans-serif; padding: 2rem; color: #1e293b; }
        h1 { font-size: 1.3rem; margin-bottom: 0.25rem; }
        .date { color: #64748b; font-size: 0.85rem; margin-bottom: 1.5rem; }
        table { width: 100%; border-collapse: collapse; font-size: 0.9rem; }
        th { background: #f1f5f9; text-align: left; padding: 0.5rem 0.75rem; font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.05em; color: #64748b; }
        td { padding: 0.55rem 0.75rem; border-bottom: 1px solid #e2e8f0; }
        .has-breakdown td { border-bottom: none; }
        .breakdown-row td { border-bottom: 1px solid #e2e8f0; padding-top: 0.1rem; padding-bottom: 0.5rem; }
        tr:last-child td { border-bottom: none; }
        .total-row td { font-weight: 700; background: #eff6ff; font-size: 1rem; }
        .total-row td:last-child { color: #1d4ed8; }
      </style>
    </head><body>
      <h1>Roof Volume Summary</h1>
      <div class="date">Generated ${date}</div>
      <table>
        <thead><tr><th>#</th><th>Label</th><th>Type</th><th>Dimensions</th><th style="text-align:right">Volume</th></tr></thead>
        <tbody>${rows}
          <tr class="total-row">
            <td colspan="4">Total</td>
            <td style="text-align:right">${formatNum(totalDisplay)} ${totalUnit}</td>
          </tr>
        </tbody>
      </table>
      <div style="margin-top:2rem;padding-top:1rem;border-top:1px solid #e2e8f0">
        <div style="font-size:0.75rem;font-weight:700;text-transform:uppercase;letter-spacing:0.05em;color:#64748b;margin-bottom:0.6rem">Dimensions Key</div>
        <table style="width:auto;font-size:0.82rem;border-collapse:collapse">
          <tr><td style="padding:0.2rem 1.2rem 0.2rem 0;color:#1e293b"><strong>L</strong></td><td style="color:#475569">Length (along the ridge / eave)</td></tr>
          <tr><td style="padding:0.2rem 1.2rem 0.2rem 0;color:#1e293b"><strong>W</strong></td><td style="color:#475569">Width (perpendicular to ridge, eave to eave)</td></tr>
          <tr><td style="padding:0.2rem 1.2rem 0.2rem 0;color:#1e293b"><strong>H</strong></td><td style="color:#475569">Roof height — vertical, eave to ridge</td></tr>
          <tr><td style="padding:0.2rem 1.2rem 0.2rem 0;color:#1e293b"><strong>WH</strong></td><td style="color:#475569">Wall height — ground to eave (Roof + Walls mode only)</td></tr>
          <tr><td style="padding:0.2rem 1.2rem 0.2rem 0;color:#1e293b"><strong>S</strong></td><td style="color:#475569">Slope length — along the roof surface, eave to ridge</td></tr>
          <tr><td style="padding:0.2rem 1.2rem 0.2rem 0;color:#1e293b"><strong>R</strong></td><td style="color:#475569">Ridge length — flat section at the top (Hip roof only)</td></tr>
          <tr><td style="padding:0.2rem 1.2rem 0.2rem 0;color:#1e293b"><strong>L</strong></td><td style="color:#475569">Gable length — rectangular section (Extension only)</td></tr>
          <tr><td style="padding:0.2rem 1.2rem 0.2rem 0;color:#1e293b"><strong>PL</strong></td><td style="color:#475569">Pyramid length — tapering section (Extension only)</td></tr>
        </table>
      </div>
    </body></html>`;

    const win = window.open('', '_blank');
    win.document.write(html);
    win.document.close();
    win.print();
  }

  // ── Init ───────────────────────────────────────────────────────────────────
  renderControls();
  renderDiagram();
  renderInputs();
  renderSaved();

  // Dismiss any open tooltip when clicking outside a tooltip button
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.field-tooltip-btn')) {
      document.querySelectorAll('[data-bs-toggle="tooltip"]').forEach(el => {
        const tip = bootstrap.Tooltip.getInstance(el);
        if (tip) tip.hide();
      });
    }
  });
