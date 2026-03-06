  // ── State ──────────────────────────────────────────────────────────────────
  let currentRoof = 'gable';
  let currentUnit = 'metric';
  let measureMode = 'vertical'; // 'vertical' | 'slope'

  // ── Roof configs ───────────────────────────────────────────────────────────
  const roofConfigs = {
    gable: {
      label: 'Gable Roof',
      fields: [
        { id: 'length', label: 'Length', hint: 'Along the ridge' },
        { id: 'width',  label: 'Width',  hint: 'Perpendicular to ridge' },
        { id: 'height', label: 'Ridge Height', hint: 'Eave to peak' }
      ],
      formula: (L, W, H) => 0.5 * L * W * H,
      slopeOffset: (W) => W / 2,
      formulaText: () => measureMode === 'slope'
        ? `H = √(S² − (W/2)²)  →  V = ½ × L × W × H`
        : `V = ½ × Length × Width × Height`,
    },
    extension: {
      label: 'Roof Extension',
      fields: [
        { id: 'width',   label: 'Extension Width',  hint: 'W — across the extension' },
        { id: 'length',  label: 'Gable Length',      hint: 'L₁ — rectangular section' },
        { id: 'length2', label: 'Pyramid Length',    hint: 'L₂ — tapering section' },
        { id: 'height',  label: 'Ridge Height',      hint: 'H — eave to ridge' }
      ],
      formulaText: () => measureMode === 'slope'
        ? `H = √(S² − L₂² − (W/2)²)  ·  V = ½WL₁H + WHL₂/6`
        : `V_gable = ½ × W × L₁ × H  ·  V_pyramid = W × H × L₂ / 6`,
    },
  };

  // ── SVG Diagrams ───────────────────────────────────────────────────────────
  const diagrams = {
    gable: (mode) => mode === 'slope' ? `
      <svg width="320" height="195" viewBox="-15 10 350 195" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <marker id="gs-e" markerWidth="7" markerHeight="7" refX="6" refY="3.5" orient="auto">
            <path d="M0,0.5 L6,3.5 L0,6.5 Z" fill="#64748b"/>
          </marker>
          <marker id="gs-s" markerWidth="7" markerHeight="7" refX="6" refY="3.5" orient="auto-start-reverse">
            <path d="M0,0.5 L6,3.5 L0,6.5 Z" fill="#64748b"/>
          </marker>
        </defs>
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
        <!-- Dashed vertical height line C→M and right-angle mark -->
        <line x1="115" y1="62" x2="115" y2="153" stroke="#94a3b8" stroke-width="1" stroke-dasharray="4,3"/>
        <polyline points="115,147 107,147 107,155" fill="none" stroke="#94a3b8" stroke-width="1.2"/>
        <!-- Right bottom edge, back edge, ridge -->
        <line x1="175" y1="155" x2="275" y2="120" stroke="#2563eb" stroke-width="1.5"/>
        <line x1="275" y1="120" x2="215" y2="25"  stroke="#2563eb" stroke-width="1.5"/>
        <line x1="115" y1="60"  x2="215" y2="25"  stroke="#1d4ed8" stroke-width="2"/>
        <!-- Slope (S) label along A(55,155)→C(115,60), offset left -->
        <text transform="translate(73,100) rotate(-58)" text-anchor="middle"
              fill="#2563eb" font-size="12" font-weight="700">Slope (S)</text>
        <!-- Width dimension -->
        <line x1="55" y1="172" x2="175" y2="172" stroke="#64748b" stroke-width="1.2"
              marker-start="url(#gs-s)" marker-end="url(#gs-e)"/>
        <text x="115" y="187" text-anchor="middle" fill="#475569" font-size="12" font-weight="600">Width (W)</text>
        <!-- Length dimension -->
        <line x1="181" y1="172" x2="281" y2="137" stroke="#64748b" stroke-width="1.2"
              marker-start="url(#gs-s)" marker-end="url(#gs-e)"/>
        <text x="231" y="168" text-anchor="middle" fill="#475569" font-size="12" font-weight="600">Length (L)</text>
      </svg>` : `
      <svg width="320" height="195" viewBox="-15 10 350 195" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <marker id="g-e" markerWidth="7" markerHeight="7" refX="6" refY="3.5" orient="auto">
            <path d="M0,0.5 L6,3.5 L0,6.5 Z" fill="#64748b"/>
          </marker>
          <marker id="g-s" markerWidth="7" markerHeight="7" refX="6" refY="3.5" orient="auto-start-reverse">
            <path d="M0,0.5 L6,3.5 L0,6.5 Z" fill="#64748b"/>
          </marker>
        </defs>

        <!-- Prism vertices:
             Front gable: A(55,155) B(175,155) C(115,60)
             Back gable:  D(155,120) E(275,120) F(215,25)
             Hidden edges dashed: A-D, D-E, D-F -->

        <!-- Hidden edges -->
        <line x1="55" y1="155" x2="155" y2="120" stroke="#94a3b8" stroke-width="1.5" stroke-dasharray="5,4"/>
        <line x1="155" y1="120" x2="275" y2="120" stroke="#94a3b8" stroke-width="1.5" stroke-dasharray="5,4"/>
        <line x1="155" y1="120" x2="215" y2="25"  stroke="#94a3b8" stroke-width="1.5" stroke-dasharray="5,4"/>

        <!-- Back gable face (D-E-F) -->
        <polygon points="155,120 275,120 215,25" fill="#93c5fd" stroke="#2563eb" stroke-width="1.5" opacity="0.55"/>

        <!-- Left roof slope (A-C-F-D) -->
        <polygon points="55,155 115,60 215,25 155,120" fill="#bfdbfe" stroke="#2563eb" stroke-width="1.5"/>

        <!-- Right roof slope / top (B-C-F-E) -->
        <polygon points="175,155 115,60 215,25 275,120" fill="#dbeafe" stroke="#2563eb" stroke-width="1.5"/>

        <!-- Front gable triangle (A-B-C) — drawn last so it's on top -->
        <polygon points="55,155 175,155 115,60" fill="#eff6ff" stroke="#2563eb" stroke-width="2"/>

        <!-- Right bottom edge B-E and right back edge E-F -->
        <line x1="175" y1="155" x2="275" y2="120" stroke="#2563eb" stroke-width="1.5"/>
        <line x1="275" y1="120" x2="215" y2="25"  stroke="#2563eb" stroke-width="1.5"/>

        <!-- Ridge C-F -->
        <line x1="115" y1="60" x2="215" y2="25" stroke="#1d4ed8" stroke-width="2"/>

        <!-- Width dimension (below front base A-B) -->
        <line x1="55" y1="172" x2="175" y2="172" stroke="#64748b" stroke-width="1.2"
              marker-start="url(#g-s)" marker-end="url(#g-e)"/>
        <text x="115" y="187" text-anchor="middle" fill="#475569" font-size="12" font-weight="600">Width (W)</text>

        <!-- Height dimension (left of front gable A-C) -->
        <line x1="36" y1="155" x2="36" y2="60" stroke="#64748b" stroke-width="1.2"
              marker-start="url(#g-s)" marker-end="url(#g-e)"/>
        <text x="22" y="112" text-anchor="middle" fill="#475569" font-size="12" font-weight="600"
              transform="rotate(-90,22,112)">Height (H)</text>

        <!-- Length dimension (offset below-right of B→E edge, outward) -->
        <!-- Outward perpendicular of B(175,155)→E(275,120): direction (100,-35), CCW perp ≈ (0.33,0.94)*18 -->
        <line x1="181" y1="172" x2="281" y2="137" stroke="#64748b" stroke-width="1.2"
              marker-start="url(#g-s)" marker-end="url(#g-e)"/>
        <text x="231" y="168" text-anchor="middle" fill="#475569" font-size="12" font-weight="600">Length (L)</text>
      </svg>`,

    /*
      Extension diagram vertices (3D oblique projection):
        A=(35,155)  far-left eave         B=(145,155) far-right eave
        C=(90,60)   far ridge             D=(90,130)  mid-left eave
        E=(200,130) mid-right eave        F=(145,35)  mid ridge
        P=(175,20)  pyramid apex (junction ridge)
      Depth steps: L1=(+55,−25), L2=(+30,−15)
    */
    extension: (mode) => {
      const dimColour = '#64748b';
      const sColour   = '#2563eb';
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
        <text x="202" y="72" fill="${sColour}" font-size="12" font-weight="700">Hip rafter (S)</text>
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
              fill="#475569" font-size="12" font-weight="600">Height (H)</text>
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
        <text x="90" y="186" text-anchor="middle" fill="#475569" font-size="12" font-weight="600">Width (W)</text>

        <!-- L1: arrow along right eave B→E direction, offset below-right -->
        <line x1="153" y1="163" x2="208" y2="138"
              stroke="${dimColour}" stroke-width="1.2"
              marker-start="url(#ex-s)" marker-end="url(#ex-e)"/>
        <text x="195" y="162" text-anchor="middle" fill="#475569" font-size="12" font-weight="600">L₁</text>

        <!-- L2: arrow along E→junction right, offset below-right -->
        <line x1="212" y1="135" x2="242" y2="120"
              stroke="${dimColour}" stroke-width="1.2"
              marker-start="url(#ex-s)" marker-end="url(#ex-e)"/>
        <text x="242" y="140" text-anchor="middle" fill="#475569" font-size="12" font-weight="600">L₂</text>

        ${heightAnnotation}
      </svg>`;
    },

  };

  // ── Render helpers ─────────────────────────────────────────────────────────
  function getUnitLabel() { return currentUnit === 'metric' ? 'm' : 'ft'; }
  function getVolumeLabel() { return currentUnit === 'metric' ? 'm³' : 'ft³'; }

  function renderControls() {
    document.getElementById('controls-row').innerHTML = `
      <div class="d-flex justify-content-center gap-3 flex-wrap mb-4">
        <div class="btn-group" role="group">
          <button type="button" class="btn btn-sm ${currentUnit === 'metric'   ? 'btn-primary' : 'btn-outline-primary'}" onclick="setUnit('metric')">Metric (m)</button>
          <button type="button" class="btn btn-sm ${currentUnit === 'imperial' ? 'btn-primary' : 'btn-outline-primary'}" onclick="setUnit('imperial')">Imperial (ft)</button>
        </div>
        <div class="btn-group" role="group">
          <button type="button" class="btn btn-sm ${measureMode === 'vertical' ? 'btn-primary' : 'btn-outline-primary'}" onclick="setMeasureMode('vertical')">Vertical height</button>
          <button type="button" class="btn btn-sm ${measureMode === 'slope'    ? 'btn-primary' : 'btn-outline-primary'}" onclick="setMeasureMode('slope')">${currentRoof === 'extension' ? 'Hip rafter (S)' : 'Slope length'}</button>
        </div>
      </div>`;
  }

  function renderInputs() {
    const config = roofConfigs[currentRoof];
    const u = getUnitLabel();
    const container = document.getElementById('inputs-container');

    const colClass = config.fields.length >= 4 ? 'col-md-3' : 'col-md-4';

    const fields = config.fields.map(f => {
      if (f.id === 'height' && measureMode === 'slope') {
        const hint = currentRoof === 'extension'
          ? 'S — outer corner to ridge apex'
          : 'Eave to ridge';
        const label = currentRoof === 'extension' ? 'Hip Rafter' : 'Slope Length';
        return { id: 'slope', label, hint };
      }
      return f;
    });

    const fieldsHtml = fields.map(f => `
      <div class="${colClass}">
        <label class="form-label small fw-semibold text-uppercase text-secondary mb-1">
          ${f.label}${f.hint ? `<span class="fw-normal text-muted ms-1 text-lowercase">${f.hint}</span>` : ''}
        </label>
        <div class="input-group">
          <input type="number" class="form-control" id="field-${f.id}" min="0" step="0.01" placeholder="0.00" />
          <span class="input-group-text">${u}</span>
        </div>
      </div>
    `).join('');

    container.innerHTML = `<div class="row g-3">${fieldsHtml}</div>`;
  }

  function renderDiagram() {
    const d = diagrams[currentRoof];
    document.getElementById('diagram').innerHTML =
      typeof d === 'function' ? d(measureMode) : d;
  }

  // ── Actions ────────────────────────────────────────────────────────────────
  function selectRoof(type) {
    currentRoof = type;
    document.querySelectorAll('.roof-card').forEach(c => {
      c.classList.toggle('active', c.dataset.type === type);
    });
    hideResult();
    hideError();
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
          showError(`Hip rafter must be greater than √(L₂² + (W/2)²) = ${formatNum(minS)} ${u}.`);
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
        <div class="d-flex justify-content-center gap-4 flex-wrap" style="color:rgba(255,255,255,0.9);font-size:0.9rem">
          <span>🏠 Gable section: <strong>${formatNum(vGable)} ${vu}</strong></span>
          <span>🔺 Pyramid section: <strong>${formatNum(vPyramid)} ${vu}</strong></span>
        </div>`;
      bd.classList.remove('d-none');

      document.getElementById('result').classList.remove('d-none');
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
        showError(`Slope length must be greater than half the width (${formatNum(offset)} ${u}).`);
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

    const vol = config.formula(L, W, H);

    const M3_PER_FT3 = 0.0283168;
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
    document.getElementById('result').classList.remove('d-none');
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
  function hideResult() { document.getElementById('result').classList.add('d-none'); }

  // ── Init ───────────────────────────────────────────────────────────────────
  renderControls();
  renderDiagram();
  renderInputs();
