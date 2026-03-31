  // ── State ──────────────────────────────────────────────────────────────────
  let currentRoof = 'gable';
  let currentUnit = 'metric';
  let measureMode = 'vertical'; // 'vertical' | 'slope'
  let pitchMode   = 'double';   // 'double' | 'mono'
  let lastResult  = null;       // holds the most recent calculation for saving
  const wallModes = {};                                   // per-roof: { gable:'roof', pitch:'roof', ... }
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

    pitch: {
      label: 'Pitch Roof',
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
        const mono = pitchMode === 'mono';
        const frac = mono ? '2L+R' : '2L+R';
        if (getWallMode() === 'walls') {
          return measureMode === 'slope'
            ? `H = √(S² − (W/2)²)  →  V = W×L×WH + W×H×(${frac})/6`
            : `V = W×L×WH + W×H×(${frac})/6`;
        }
        return measureMode === 'slope'
          ? `H = √(S² − (W/2)²)  →  V = W×H×(${frac})/6`
          : `V = W×H×(${frac})/6`;
      },
    },
  };


  // ── Render helpers ─────────────────────────────────────────────────────────
  function getUnitLabel() { return currentUnit === 'metric' ? 'm' : 'ft'; }
  function getVolumeLabel() { return currentUnit === 'metric' ? 'm³' : 'ft³'; }

  function renderControls() {
    const wm = getWallMode();

    const pitchToggle = currentRoof === 'pitch' ? `
      <div class="btn-group pitch-type-toggle" role="group">
        <button type="button" class="btn btn-sm ${pitchMode === 'double' ? 'btn-info' : 'btn-outline-info'}" onclick="setPitchMode('double')">Double</button>
        <button type="button" class="btn btn-sm ${pitchMode === 'mono'   ? 'btn-info' : 'btn-outline-info'}" onclick="setPitchMode('mono')">Mono</button>
      </div>` : '';

    const wallToggle = ['gable', 'leanto', 'pitch'].includes(currentRoof) ? `
      <div class="btn-group hip-mode-toggle" role="group">
        <button type="button" class="btn btn-sm ${wm === 'roof'  ? 'btn-warning' : 'btn-outline-warning'}" onclick="setWallMode('roof')">Roof only</button>
        <button type="button" class="btn btn-sm ${wm === 'walls' ? 'btn-warning' : 'btn-outline-warning'}" onclick="setWallMode('walls')">+ Walls</button>
      </div>` : '';

    document.getElementById('controls-row').innerHTML = `
      <div class="controls-row">
        ${pitchToggle}
        ${wallToggle}
        <div class="controls-right">
          <div class="btn-group" role="group">
            <button type="button" class="btn btn-sm ${currentUnit === 'metric'   ? 'btn-primary' : 'btn-outline-primary'}" onclick="setUnit('metric')">Metric</button>
            <button type="button" class="btn btn-sm ${currentUnit === 'imperial' ? 'btn-primary' : 'btn-outline-primary'}" onclick="setUnit('imperial')">Imperial</button>
          </div>
          <div class="btn-group" role="group">
            <button type="button" class="btn btn-sm ${measureMode === 'vertical' ? 'btn-primary' : 'btn-outline-primary'}" onclick="setMeasureMode('vertical')">Vertical</button>
            <button type="button" class="btn btn-sm ${measureMode === 'slope'    ? 'btn-primary' : 'btn-outline-primary'}" onclick="setMeasureMode('slope')">${currentRoof === 'extension' ? 'Hip rafter' : 'Slope'}</button>
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
    const vals = {
      length:      parseFloat(document.getElementById('field-length')?.value)      || null,
      width:       parseFloat(document.getElementById('field-width')?.value)       || null,
      height:      parseFloat(document.getElementById('field-height')?.value)      || null,
      slope:       parseFloat(document.getElementById('field-slope')?.value)       || null,
      length2:     parseFloat(document.getElementById('field-length2')?.value)     || null,
      wallHeight:  parseFloat(document.getElementById('field-wallHeight')?.value)  || null,
      ridgeLength: parseFloat(document.getElementById('field-ridgeLength')?.value) || null,
    };
    const diagramEl = document.getElementById('diagram');
    diagramEl.innerHTML = '';
    if (typeof Diagrams3D !== 'undefined') {
      Diagrams3D.render(currentRoof, diagramEl, measureMode, vals, getWallMode(), pitchMode);
    }
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
    const wallRow = document.getElementById('wall-input-row');
    if (wallRow) wallRow.classList.toggle('wall-input-hidden', mode === 'roof');
    renderControls();
    renderDiagram();
  }

  const PITCH_ICONS = {
    double: `<svg width="56" height="40" viewBox="0 0 64 44" class="roof-card-icon">
      <polygon points="17,30 50,30 44,16 11,16" fill="rgba(147,197,253,0.32)" stroke="#2563eb" stroke-width="1.2"/>
      <polygon points="5,38 38,38 44,16 11,16"  fill="rgba(191,219,254,0.88)" stroke="#2563eb" stroke-width="1.4"/>
      <polygon points="5,38 17,30 11,16"         fill="rgba(219,234,254,0.92)" stroke="#2563eb" stroke-width="1.4"/>
      <polygon points="38,38 50,30 44,16"        fill="rgba(147,197,253,0.48)" stroke="#2563eb" stroke-width="1.2"/>
      <line x1="11" y1="16" x2="44" y2="16" stroke="#1d4ed8" stroke-width="2"/>
    </svg>`,
    mono: `<svg width="56" height="40" viewBox="0 0 64 44" class="roof-card-icon">
      <polygon points="5,38 17,30 17,16"          fill="rgba(219,234,254,0.92)" stroke="#2563eb" stroke-width="1.4"/>
      <polygon points="5,38 38,38 50,16 17,16"    fill="rgba(191,219,254,0.88)" stroke="#2563eb" stroke-width="1.4"/>
      <line x1="17" y1="16" x2="50" y2="16" stroke="#1d4ed8" stroke-width="2"/>
    </svg>`,
  };

  function updatePitchCardIcon() {
    const el = document.getElementById('pitch-card-icon');
    if (el) el.innerHTML = PITCH_ICONS[pitchMode] || PITCH_ICONS.double;
  }

  function setPitchMode(mode) {
    pitchMode = mode;
    hideResult();
    hideError();
    updatePitchCardIcon();
    renderControls();
    renderDiagram();
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

    // ── Pitch Roof calculator (roof-only or roof + walls) ─────────────────────
    if (currentRoof === 'pitch') {
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

      if (pitchMode === 'double') {
        if (C >= L) {
          showError('Ridge length (R) must be less than building length (L).');
          return;
        }
      } else {
        if (C > L) {
          showError('Ridge length (R) cannot exceed building length (L).');
          return;
        }
      }

      const M3_PER_FT3 = 0.0283168;
      const roofLabel  = pitchMode === 'mono' ? 'Mono Pitch' : 'Pitch Roof';
      const roofVol    = pitchMode === 'mono'
        ? W * A * (2 * L + C) / 6
        : W * A * (2 * L + C) / 6;

      if (getWallMode() === 'walls') {
        const hw = parseFloat(document.getElementById('field-wallHeight')?.value);
        if (!isFinite(hw) || hw <= 0) {
          showError('Please enter a valid positive wall height.');
          return;
        }
        const wallVol = L * W * hw;
        const vTotal  = wallVol + roofVol;
        const altTotal = currentUnit === 'metric' ? vTotal / M3_PER_FT3 : vTotal * M3_PER_FT3;
        const altUnit  = currentUnit === 'metric' ? 'ft³' : 'm³';
        const derivedNote = measureMode === 'slope'
          ? `Derived roof height: ${formatNum(A)} ${u}  ·  Also: ${formatNum(altTotal)} ${altUnit}`
          : `Also: ${formatNum(altTotal)} ${altUnit}`;
        document.getElementById('result-roof-label').textContent = `${roofLabel} + Walls — Total Volume`;
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
          id: Date.now(), roofType: 'pitch', label: '', unit: currentUnit,
          volumeM3: currentUnit === 'metric' ? vTotal : vTotal * M3_PER_FT3,
          displayVolume: vTotal, displayUnit: vu,
          derivedHeight: measureMode === 'slope' ? A : null,
          breakdown: { wall: wallVol, roof: roofVol },
          dims: { L, W, WH: hw, H: A, R: C }, formula: config.formulaText(),
          wallMode: 'walls', pitchMode,
        };
      } else {
        const altTotal = currentUnit === 'metric' ? roofVol / M3_PER_FT3 : roofVol * M3_PER_FT3;
        const altUnit  = currentUnit === 'metric' ? 'ft³' : 'm³';
        const derivedNote = measureMode === 'slope'
          ? `Derived roof height: ${formatNum(A)} ${u}  ·  Also: ${formatNum(altTotal)} ${altUnit}`
          : `Also: ${formatNum(altTotal)} ${altUnit}`;
        document.getElementById('result-roof-label').textContent = `${roofLabel} — Roof Volume`;
        document.getElementById('result-value').textContent = formatNum(roofVol);
        document.getElementById('result-unit').textContent = vu;
        document.getElementById('result-alt').textContent = derivedNote;
        document.getElementById('result-formula').textContent = config.formulaText();
        document.getElementById('result-breakdown').classList.add('d-none');
        document.getElementById('result').classList.remove('d-none');
        lastResult = {
          id: Date.now(), roofType: 'pitch', label: '', unit: currentUnit,
          volumeM3: currentUnit === 'metric' ? roofVol : roofVol * M3_PER_FT3,
          displayVolume: roofVol, displayUnit: vu,
          derivedHeight: measureMode === 'slope' ? A : null,
          breakdown: null,
          dims: { L, W, H: A, R: C }, formula: config.formulaText(),
          wallMode: 'roof', pitchMode,
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

    const roofLabels = { gable: 'Gable', extension: 'Extension', pitch: 'Pitch Roof', hip: 'Pitch Roof', leanto: 'Lean-to', hipwalls: 'Hip + Walls' };

    container.innerHTML = list.map((e, i) => {
      const dimParts = [];
      if (e.dims) {
        const u = e.unit === 'metric' ? 'm' : 'ft';
        if (e.roofType === 'extension') {
          dimParts.push(`W=${formatNum(e.dims.W)}${u}`, `L=${formatNum(e.dims.L ?? e.dims.L1)}${u}`, `PL=${formatNum(e.dims.PL ?? e.dims.L2)}${u}`, `H=${formatNum(e.dims.H)}${u}`);
        } else if (e.roofType === 'hipwalls' || ((e.roofType === 'hip' || e.roofType === 'pitch') && (e.hipMode === 'walls' || e.wallMode === 'walls'))) {
          dimParts.push(`L=${formatNum(e.dims.L)}${u}`, `W=${formatNum(e.dims.W)}${u}`, `WH=${formatNum(e.dims.WH ?? e.dims.h)}${u}`, `H=${formatNum(e.dims.H ?? e.dims.A)}${u}`, `R=${formatNum(e.dims.R ?? e.dims.C)}${u}`);
        } else if (e.roofType === 'hip' || e.roofType === 'pitch') {
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

      const isPitchType = e.roofType === 'pitch' || e.roofType === 'hip';
      const metaLabel = isPitchType && e.pitchMode === 'mono'
        ? 'Mono Pitch'
        : (roofLabels[e.roofType] || e.roofType);

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
              <div class="saved-item-meta">${metaLabel}${dimParts.length ? ' · ' + dimParts.join(', ') : ''}</div>
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

    const roofLabels = { gable: 'Gable Roof', extension: 'Roof Extension', pitch: 'Pitch Roof', hip: 'Pitch Roof', leanto: 'Lean-to Roof', hipwalls: 'Hip + Walls' };
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
        } else if (e.roofType === 'hipwalls' || ((e.roofType === 'hip' || e.roofType === 'pitch') && (e.hipMode === 'walls' || e.wallMode === 'walls'))) {
          dimParts.push(`L=${formatNum(e.dims.L)}${u}`, `W=${formatNum(e.dims.W)}${u}`, `WH=${formatNum(e.dims.WH ?? e.dims.h)}${u}`, `H=${formatNum(e.dims.H ?? e.dims.A)}${u}`, `R=${formatNum(e.dims.R ?? e.dims.C)}${u}`);
        } else if (e.roofType === 'hip' || e.roofType === 'pitch') {
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

      // Type label — append "+ Walls" if applicable; handle pitchMode for pitch/hip entries
      const hasWalls = e.breakdown?.wall !== undefined;
      const isPitchType = e.roofType === 'pitch' || e.roofType === 'hip';
      const baseLabel = isPitchType && e.pitchMode === 'mono'
        ? 'Mono Pitch'
        : (roofLabels[e.roofType] || e.roofType);
      const typeLabel = baseLabel + (hasWalls ? ' + Walls' : '');

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
  updatePitchCardIcon();
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
