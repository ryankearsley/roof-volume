/**
 * diagrams3d.js — 3D roof diagrams using Three.js (CDN global build, no bundler)
 *
 * Requires (loaded before this file via CDN):
 *   three@0.134.0/build/three.min.js
 *   three@0.134.0/examples/js/renderers/CSS2DRenderer.js
 *   three@0.134.0/examples/js/controls/OrbitControls.js
 *
 * Exposes: window.Diagrams3D
 *   .render(roofType, container, mode, vals, wallMode, pitchMode)
 *   .dispose()
 */
(function () {
  'use strict';

  // ---------------------------------------------------------------------------
  // Colour constants — match existing SVG palette
  // ---------------------------------------------------------------------------
  var C_SLOPE1 = 0xbfdbfe;   // main front slope
  var C_SLOPE2 = 0xdbeafe;   // secondary slopes
  var C_BACK   = 0x93c5fd;   // back / hidden faces
  var C_FRONT  = 0xeff6ff;   // prominent front face (gable / hip triangle)
  var C_EDGE   = 0x2563eb;   // roof edges
  var C_RIDGE  = 0x1d4ed8;   // ridge line (slightly darker blue)
  var C_DIM    = 0x64748b;   // dimension lines and labels
  var C_WALL_F = 0xe0f2fe;   // front wall fill
  var C_WALL_S = 0xbae6fd;   // side wall fill
  var O_BACK   = 0.35;       // back face opacity
  var O_SLOPE  = 0.78;       // slope opacity
  var O_FRONT  = 0.88;       // prominent face opacity
  var O_WALL   = 0.70;       // wall opacity

  // ---------------------------------------------------------------------------
  // Canvas dimensions
  // ---------------------------------------------------------------------------
  var W_PX = 380;
  var H_PX = 270;

  // ---------------------------------------------------------------------------
  // Internal renderer state (one active diagram at a time)
  // ---------------------------------------------------------------------------
  var _renderer      = null;
  var _labelRenderer = null;
  var _scene         = null;
  var _camera        = null;
  var _controls      = null;
  var _animId        = null;

  // ---------------------------------------------------------------------------
  // Label text helpers — defer to app.js globals when present
  // ---------------------------------------------------------------------------
  function _u()    { return typeof getUnitLabel === 'function' ? getUnitLabel() : 'm'; }
  function _fmt(v) { return typeof formatNum    === 'function' ? formatNum(v)   : v.toFixed(2); }
  function _lbl(val, name) {
    return val != null ? (name + ' = ' + _fmt(val) + ' ' + _u()) : name;
  }

  // ---------------------------------------------------------------------------
  // Helper: flat mesh face from 3 or 4 THREE.Vector3 vertices
  // Add faces back-to-front so translucency looks correct (depthWrite: false)
  // ---------------------------------------------------------------------------
  function makeFace(verts, color, opacity) {
    var geom = new THREE.BufferGeometry();
    var pos;

    if (verts.length === 3) {
      pos = new Float32Array([
        verts[0].x, verts[0].y, verts[0].z,
        verts[1].x, verts[1].y, verts[1].z,
        verts[2].x, verts[2].y, verts[2].z
      ]);
    } else {
      // Quad → two triangles (0,1,2) + (0,2,3)
      pos = new Float32Array([
        verts[0].x, verts[0].y, verts[0].z,
        verts[1].x, verts[1].y, verts[1].z,
        verts[2].x, verts[2].y, verts[2].z,
        verts[0].x, verts[0].y, verts[0].z,
        verts[2].x, verts[2].y, verts[2].z,
        verts[3].x, verts[3].y, verts[3].z
      ]);
    }

    geom.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geom.computeVertexNormals();

    var mat = new THREE.MeshBasicMaterial({
      color:       color,
      opacity:     opacity,
      transparent: true,
      side:        THREE.DoubleSide,
      depthWrite:  false
    });
    return new THREE.Mesh(geom, mat);
  }

  // ---------------------------------------------------------------------------
  // Helper: line (solid or dashed) through an array of THREE.Vector3 points
  // ---------------------------------------------------------------------------
  function makeEdge(points, color, dashed) {
    var geom = new THREE.BufferGeometry().setFromPoints(points);
    var mat;
    if (dashed) {
      mat = new THREE.LineDashedMaterial({ color: color, dashSize: 0.05, gapSize: 0.04 });
    } else {
      mat = new THREE.LineBasicMaterial({ color: color });
    }
    var line = new THREE.Line(geom, mat);
    if (dashed) line.computeLineDistances();
    return line;
  }

  // ---------------------------------------------------------------------------
  // Helper: CSS2D label at a 3D world position
  // ---------------------------------------------------------------------------
  function makeLabel(text, pos, colorHex) {
    colorHex = colorHex || '#475569';
    var div = document.createElement('div');
    div.className   = 'diag3d-label';
    div.textContent = text;
    div.style.cssText =
      'font-size:11px;font-weight:600;color:' + colorHex +
      ';white-space:nowrap;pointer-events:none;font-family:Inter,sans-serif;';
    var obj = new THREE.CSS2DObject(div);
    obj.position.copy(pos);
    return obj;
  }

  // ---------------------------------------------------------------------------
  // Helper: dimension annotation — line from p1 to p2 with tick marks + label
  //   p1, p2     : THREE.Vector3 endpoints of the dimension line
  //   text       : label string
  //   tickDir    : THREE.Vector3 (unit) — direction tick marks extend
  //   labelOffset: THREE.Vector3 added to midpoint for label nudge (optional)
  // ---------------------------------------------------------------------------
  function makeDimension(p1, p2, text, tickDir, labelOffset) {
    var TICK = 0.06;
    var td   = tickDir || new THREE.Vector3(0, 0, -1);

    // Main line
    _scene.add(makeEdge([p1, p2], C_DIM));

    // Tick marks at each end
    _scene.add(makeEdge([
      p1.clone().addScaledVector(td, -TICK),
      p1.clone().addScaledVector(td,  TICK)
    ], C_DIM));
    _scene.add(makeEdge([
      p2.clone().addScaledVector(td, -TICK),
      p2.clone().addScaledVector(td,  TICK)
    ], C_DIM));

    // Label at midpoint, nudged by labelOffset
    var mid = p1.clone().lerp(p2, 0.5);
    if (labelOffset) mid.add(labelOffset);
    _scene.add(makeLabel(text, mid));
  }

  // Dashed extension line from geometry point to dimension line endpoint
  function makeDimExt(from, to) {
    _scene.add(makeEdge([from, to], C_DIM, true));
  }

  // ---------------------------------------------------------------------------
  // Shared init: WebGL renderer, CSS2D renderer, scene, camera, orbit controls
  // ---------------------------------------------------------------------------
  function _initScene(container, camPos, camTarget) {
    container.style.position = 'relative';
    container.style.height   = H_PX + 'px';

    // Use the container's full available width
    var w = container.clientWidth || W_PX;
    var h = H_PX;

    // WebGL renderer — transparent background
    _renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    _renderer.setPixelRatio(window.devicePixelRatio || 1);
    _renderer.setSize(w, h);
    _renderer.domElement.style.cssText = 'display:block;width:100%;height:' + h + 'px;';
    _renderer.setClearColor(0x000000, 0);
    container.appendChild(_renderer.domElement);

    // CSS2D label renderer overlaid on top
    _labelRenderer = new THREE.CSS2DRenderer();
    _labelRenderer.setSize(w, h);
    _labelRenderer.domElement.style.cssText =
      'position:absolute;top:0;left:0;width:100%;height:' + h + 'px;pointer-events:none;';
    container.appendChild(_labelRenderer.domElement);

    _scene = new THREE.Scene();

    _camera = new THREE.PerspectiveCamera(45, w / h, 0.01, 100);
    _camera.position.set(camPos.x, camPos.y, camPos.z);
    _camera.lookAt(new THREE.Vector3(camTarget.x, camTarget.y, camTarget.z));

    _controls = new THREE.OrbitControls(_camera, _renderer.domElement);
    _controls.target.set(camTarget.x, camTarget.y, camTarget.z);
    _controls.enableDamping  = true;
    _controls.dampingFactor  = 0.08;
    _controls.minDistance    = 0.5;
    _controls.maxDistance    = 20;
    _controls.enablePan      = false;
    _controls.update();

    (function loop() {
      _animId = requestAnimationFrame(loop);
      _controls.update();
      _renderer.render(_scene, _camera);
      _labelRenderer.render(_scene, _camera);
    }());
  }

  // ---------------------------------------------------------------------------
  // GABLE roof
  //
  // Coordinate axes:  X = length (left→right),  Y = up,  Z = depth (front→back)
  // Eave at y=0,  ridge at y=H,  front face z=0,  back face z=W
  // ---------------------------------------------------------------------------
  function buildGable(container, mode, vals, wallMode) {
    var v  = vals || {};
    var L  = v.length     != null ? v.length     : 2.5;
    var W  = v.width      != null ? v.width      : 1.0;
    var WH = v.wallHeight != null ? v.wallHeight : 0.5;
    var H;
    if (mode === 'slope') {
      var S = v.slope != null ? v.slope : 1.0;
      H = Math.sqrt(Math.max(0, S * S - (W / 2) * (W / 2)));
    } else {
      H = v.height != null ? v.height : 0.45;
    }

    // Camera: slightly left of centre, high — left gable face is prominent
    _initScene(container,
      { x: -L * 0.3, y: H * 6.0, z: -W * 2.5 },
      { x:  L / 2,   y: H / 4,   z:  W / 2   }
    );

    // Key vertices
    var FL = new THREE.Vector3(0, 0,   0);      // front-left eave
    var FR = new THREE.Vector3(L, 0,   0);      // front-right eave
    var BL = new THREE.Vector3(0, 0,   W);      // back-left eave
    var BR = new THREE.Vector3(L, 0,   W);      // back-right eave
    var RL = new THREE.Vector3(0, H,   W / 2);  // left ridge end
    var RR = new THREE.Vector3(L, H,   W / 2);  // right ridge end

    // Faces — back to front for correct translucency
    _scene.add(makeFace([BL, BR, RR, RL], C_BACK,   O_BACK));    // back slope
    _scene.add(makeFace([FL, FR, RR, RL], C_SLOPE1, O_SLOPE));   // front slope
    _scene.add(makeFace([FR, BR, RR],     C_SLOPE2, O_SLOPE));   // right gable triangle
    _scene.add(makeFace([FL, BL, RL],     C_FRONT,  O_FRONT));   // left gable triangle (prominent)

    // Edges
    _scene.add(makeEdge([FL, FR],  C_EDGE));              // front eave
    _scene.add(makeEdge([FL, RL],  C_EDGE));              // left front rafter
    _scene.add(makeEdge([FR, RR],  C_EDGE));              // right front rafter
    _scene.add(makeEdge([FR, BR],  C_EDGE));              // right eave
    _scene.add(makeEdge([BL, BR],  C_EDGE, true));        // back eave (hidden)
    _scene.add(makeEdge([BL, RL],  C_EDGE, true));        // left back rafter (hidden)
    _scene.add(makeEdge([BR, RR],  C_EDGE, true));        // right back rafter (hidden)
    _scene.add(makeEdge([RL, RR],  C_RIDGE));             // ridge

    // Walls
    if (wallMode === 'walls') {
      var FLw = new THREE.Vector3(0, -WH, 0);
      var FRw = new THREE.Vector3(L, -WH, 0);
      var BLw = new THREE.Vector3(0, -WH, W);
      var BRw = new THREE.Vector3(L, -WH, W);

      _scene.add(makeFace([FLw, FRw, FR, FL], C_WALL_F, O_WALL));   // front wall
      _scene.add(makeFace([FRw, BRw, BR, FR], C_WALL_S, O_WALL));   // right wall
      _scene.add(makeFace([BRw, BLw, BL, BR], C_WALL_S, O_WALL));   // back wall
      _scene.add(makeFace([BLw, FLw, FL, BL], C_WALL_S, O_WALL));   // left wall

      // Floor-level dashed outline
      _scene.add(makeEdge([FLw, FRw], C_DIM, true));
      _scene.add(makeEdge([FRw, BRw], C_DIM, true));
      _scene.add(makeEdge([BRw, BLw], C_DIM, true));
      _scene.add(makeEdge([BLw, FLw], C_DIM, true));
    }

    // ── Dimension annotations ──────────────────────────────────────────────
    var OFF = 0.18; // offset distance from building edge

    // Length (L): along the front eave (X axis, z=0)
    makeDimExt(new THREE.Vector3(0, 0, 0),    new THREE.Vector3(0, 0,    -OFF));
    makeDimExt(new THREE.Vector3(L, 0, 0),    new THREE.Vector3(L, 0,    -OFF));
    makeDimension(
      new THREE.Vector3(0, 0, -OFF),
      new THREE.Vector3(L, 0, -OFF),
      _lbl(v.length, 'L'),
      new THREE.Vector3(0, 0, -1),
      new THREE.Vector3(0, 0.06, -0.1)
    );

    // Width (W): along the left side (Z axis, x=0)
    makeDimExt(new THREE.Vector3(0, 0, 0),    new THREE.Vector3(-OFF, 0, 0));
    makeDimExt(new THREE.Vector3(0, 0, W),    new THREE.Vector3(-OFF, 0, W));
    makeDimension(
      new THREE.Vector3(-OFF, 0, 0),
      new THREE.Vector3(-OFF, 0, W),
      _lbl(v.width, 'W'),
      new THREE.Vector3(-1, 0, 0),
      new THREE.Vector3(-0.15, 0.06, 0)
    );

    // H or S: right side (opposite to W on left)
    if (mode === 'slope') {
      _scene.add(makeLabel(_lbl(v.slope, 'S'), new THREE.Vector3(L + OFF, H / 2, W / 2)));
    } else {
      makeDimExt(new THREE.Vector3(L, 0, W / 2), new THREE.Vector3(L + OFF, 0, W / 2));
      makeDimExt(new THREE.Vector3(L, H, W / 2), new THREE.Vector3(L + OFF, H, W / 2));
      makeDimension(
        new THREE.Vector3(L + OFF, 0, W / 2),
        new THREE.Vector3(L + OFF, H, W / 2),
        _lbl(v.height, 'H'),
        new THREE.Vector3(1, 0, 0),
        new THREE.Vector3(0.15, 0, 0)
      );
    }

    if (wallMode === 'walls') {
      makeDimExt(new THREE.Vector3(L, 0,   0), new THREE.Vector3(L + OFF * 2, 0,   0));
      makeDimExt(new THREE.Vector3(L, -WH, 0), new THREE.Vector3(L + OFF * 2, -WH, 0));
      makeDimension(
        new THREE.Vector3(L + OFF * 2, 0,   0),
        new THREE.Vector3(L + OFF * 2, -WH, 0),
        _lbl(v.wallHeight, 'WH'),
        new THREE.Vector3(0, 0, -1),
        new THREE.Vector3(0, 0, -0.12)
      );
    }
  }

  // ---------------------------------------------------------------------------
  // LEAN-TO roof
  //
  // Triangular prism: low eave at front (y=0, z=0), high eave at back (y=H, z=W)
  // ---------------------------------------------------------------------------
  function buildLeanto(container, mode, vals, wallMode) {
    var v  = vals || {};
    var L  = v.length     != null ? v.length     : 2.5;
    var W  = v.width      != null ? v.width      : 1.2;
    var WH = v.wallHeight != null ? v.wallHeight : 0.5;
    var H;
    if (mode === 'slope') {
      var S = v.slope != null ? v.slope : 1.2;
      H = Math.sqrt(Math.max(0, S * S - W * W));
    } else {
      H = v.height != null ? v.height : 0.6;
    }

    // Camera: front-right elevated — slope face + right end triangle visible
    _initScene(container,
      { x: L * 0.6, y: H * 5.5, z: -W * 2.5 },
      { x: L / 2,   y: H / 2,   z:  W / 2   }
    );

    // Key vertices
    var FL = new THREE.Vector3(0, 0, 0);    // front-left low eave
    var FR = new THREE.Vector3(L, 0, 0);    // front-right low eave
    var HL = new THREE.Vector3(0, H, W);    // back-left high eave
    var HR = new THREE.Vector3(L, H, W);    // back-right high eave
    var BL = new THREE.Vector3(0, 0, W);    // back-left ground
    var BR = new THREE.Vector3(L, 0, W);    // back-right ground

    // Faces — back to front
    _scene.add(makeFace([BL, BR, HR, HL], C_BACK,   O_BACK));    // back face
    _scene.add(makeFace([FL, FR, HR, HL], C_SLOPE1, O_SLOPE));   // main slope
    _scene.add(makeFace([FR, BR, HR],     C_SLOPE2, O_SLOPE));   // right end triangle
    _scene.add(makeFace([FL, BL, HL],     C_FRONT,  O_FRONT));   // left end triangle (prominent)

    // Edges
    _scene.add(makeEdge([FL, FR],  C_EDGE));              // front low eave
    _scene.add(makeEdge([FL, HL],  C_EDGE));              // left front rafter
    _scene.add(makeEdge([FR, HR],  C_EDGE));              // right front rafter
    _scene.add(makeEdge([HL, HR],  C_RIDGE));             // high eave (ridge equivalent)
    _scene.add(makeEdge([FR, BR],  C_EDGE));              // right base
    _scene.add(makeEdge([BL, BR],  C_EDGE, true));        // back low eave (hidden)
    _scene.add(makeEdge([BL, HL],  C_EDGE, true));        // left back rafter (hidden)
    _scene.add(makeEdge([BR, HR],  C_EDGE, true));        // right back rafter (hidden)

    // Walls
    if (wallMode === 'walls') {
      var FLw = new THREE.Vector3(0, -WH, 0);
      var FRw = new THREE.Vector3(L, -WH, 0);
      var BLw = new THREE.Vector3(0, -WH, W);
      var BRw = new THREE.Vector3(L, -WH, W);

      _scene.add(makeFace([FLw, FRw, FR, FL], C_WALL_F, O_WALL));
      _scene.add(makeFace([FRw, BRw, BR, FR], C_WALL_S, O_WALL));
      _scene.add(makeFace([BRw, BLw, BL, BR], C_WALL_S, O_WALL));
      _scene.add(makeFace([BLw, FLw, FL, BL], C_WALL_S, O_WALL));
    }

    // ── Dimension annotations ──────────────────────────────────────────────
    var OFF = 0.18;

    // (L): front eave, in front of building
    makeDimExt(new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0, -OFF));
    makeDimExt(new THREE.Vector3(L, 0, 0), new THREE.Vector3(L, 0, -OFF));
    makeDimension(
      new THREE.Vector3(0, 0, -OFF),
      new THREE.Vector3(L, 0, -OFF),
      _lbl(v.length, 'L'),
      new THREE.Vector3(0, 0, -1),
      new THREE.Vector3(0, 0.06, -0.1)
    );

    // (W): left side, depth of slope (z=0 to z=W)
    makeDimExt(new THREE.Vector3(0, 0, 0), new THREE.Vector3(-OFF, 0, 0));
    makeDimExt(new THREE.Vector3(0, 0, W), new THREE.Vector3(-OFF, 0, W));
    makeDimension(
      new THREE.Vector3(-OFF, 0, 0),
      new THREE.Vector3(-OFF, 0, W),
      _lbl(v.width, 'W'),
      new THREE.Vector3(-1, 0, 0),
      new THREE.Vector3(-0.15, 0.06, 0)
    );

    // (H) or (S): right back corner, vertical
    if (mode === 'slope') {
      _scene.add(makeLabel(_lbl(v.slope, 'S'), new THREE.Vector3(L / 2, H / 2, W / 2 - 0.15)));
    } else {
      makeDimExt(new THREE.Vector3(L, 0, W), new THREE.Vector3(L + OFF, 0, W));
      makeDimExt(new THREE.Vector3(L, H, W), new THREE.Vector3(L + OFF, H, W));
      makeDimension(
        new THREE.Vector3(L + OFF, 0, W),
        new THREE.Vector3(L + OFF, H, W),
        _lbl(v.height, 'H'),
        new THREE.Vector3(0, 0, 1),
        new THREE.Vector3(0, 0, 0.12)
      );
    }

    if (wallMode === 'walls') {
      makeDimExt(new THREE.Vector3(L, 0,   0), new THREE.Vector3(L + OFF, 0,   0));
      makeDimExt(new THREE.Vector3(L, -WH, 0), new THREE.Vector3(L + OFF, -WH, 0));
      makeDimension(
        new THREE.Vector3(L + OFF, 0,   0),
        new THREE.Vector3(L + OFF, -WH, 0),
        _lbl(v.wallHeight, 'WH'),
        new THREE.Vector3(0, 0, -1),
        new THREE.Vector3(0, 0, -0.12)
      );
    }
  }

  // ---------------------------------------------------------------------------
  // EXTENSION roof
  //
  // Pyramid section (x: 0 → PL):  rises from a single apex (JA) at eave level
  //   at the main house wall, expanding to full triangular cross-section at x=PL.
  // Gable section (x: PL → totalL): standard gable prism; ridge runs horizontal.
  //
  // "Coming up from the bottom" — JA is a single low point at x=0 (main house
  // junction). The ridge ascends from JA to RA, then continues straight to GA.
  // ---------------------------------------------------------------------------
  function buildExtension(container, mode, vals) {
    var v  = vals || {};
    var W  = v.width   != null ? v.width   : 1.0;
    var L  = v.length  != null ? v.length  : 1.5;
    var PL = v.length2 != null ? v.length2 : 0.8;
    var H;
    if (mode === 'slope') {
      var S = v.slope != null ? v.slope : 1.0;
      H = Math.sqrt(Math.max(0, S * S - (W / 2) * (W / 2)));
    } else {
      H = v.height != null ? v.height : 0.45;
    }

    var totalL = PL + L;

    // Camera: from front-left, elevated — see ascending hip on left + gable on right
    _initScene(container,
      { x: -W * 0.5, y: H * 7.0, z: -W * 2.5 },
      { x: totalL / 2, y: H / 3, z: W / 2 }
    );

    // ── Vertices ──────────────────────────────────────────────────────────────
    // Pyramid section (x: 0 → PL):
    //   JA = ridge tip at the main-house end, AT RIDGE HEIGHT — the full ridge
    //   is one straight horizontal line JA → RA → GA.
    //   ML/MR are the two eave corners at the junction.  The pyramid has three
    //   faces: front hip, back hip, and a slanted bottom triangle (ML-MR-JA)
    //   whose base sits at eave level but whose apex rises to ridge height.
    var JA = new THREE.Vector3(0,  H, W / 2);   // ridge tip at main-house end
    var ML = new THREE.Vector3(PL, 0, 0);        // front eave at junction
    var MR = new THREE.Vector3(PL, 0, W);        // back eave at junction
    var RA = new THREE.Vector3(PL, H, W / 2);   // ridge at junction

    // Gable section (x: PL → totalL):
    var FL = new THREE.Vector3(totalL, 0, 0);    // gable-end front corner
    var FR = new THREE.Vector3(totalL, 0, W);    // gable-end back corner
    var GA = new THREE.Vector3(totalL, H, W / 2); // gable apex

    // ── Faces — back to front ─────────────────────────────────────────────────
    // Pyramid section
    _scene.add(makeFace([ML, MR, JA],   C_BACK,   O_BACK));   // slanted bottom triangle
    _scene.add(makeFace([MR, RA, JA],   C_BACK,   O_BACK));   // back hip face
    _scene.add(makeFace([ML, RA, JA],   C_SLOPE1, O_SLOPE));  // front hip face

    // Gable section
    _scene.add(makeFace([MR, FR, GA, RA], C_BACK,   O_BACK));   // back slope
    _scene.add(makeFace([ML, FL, GA, RA], C_SLOPE1, O_SLOPE));  // front slope
    _scene.add(makeFace([FL, FR, GA],     C_FRONT,  O_FRONT));  // gable end

    // ── Edges ─────────────────────────────────────────────────────────────────
    // Pyramid hip rafters (from eave corners up to ridge tip)
    _scene.add(makeEdge([ML, JA],  C_EDGE));              // front hip rafter
    _scene.add(makeEdge([MR, JA],  C_EDGE, true));        // back hip rafter (hidden)
    _scene.add(makeEdge([ML, MR],  C_EDGE));              // junction base
    _scene.add(makeEdge([ML, RA],  C_EDGE));              // junction front rafter
    _scene.add(makeEdge([MR, RA],  C_EDGE, true));        // junction back rafter (hidden)

    // Gable section
    _scene.add(makeEdge([ML, FL],  C_EDGE));              // front eave
    _scene.add(makeEdge([MR, FR],  C_EDGE, true));        // back eave (hidden)
    _scene.add(makeEdge([FL, FR],  C_EDGE));              // gable end base
    _scene.add(makeEdge([FL, GA],  C_EDGE));              // gable front rafter
    _scene.add(makeEdge([FR, GA],  C_EDGE, true));        // gable back rafter (hidden)

    // Ridge: one straight horizontal line all the way from JA → RA → GA
    _scene.add(makeEdge([JA, RA],  C_RIDGE));
    _scene.add(makeEdge([RA, GA],  C_RIDGE));

    // ── Dimension annotations ─────────────────────────────────────────────────
    var OFF   = 0.18;
    var plVal = v.length2 != null ? v.length2 : null;

    // W: gable-end width (z direction) at x=totalL
    makeDimExt(new THREE.Vector3(totalL, 0, 0), new THREE.Vector3(totalL + OFF, 0, 0));
    makeDimExt(new THREE.Vector3(totalL, 0, W), new THREE.Vector3(totalL + OFF, 0, W));
    makeDimension(
      new THREE.Vector3(totalL + OFF, 0, 0), new THREE.Vector3(totalL + OFF, 0, W),
      _lbl(v.width, 'W'), new THREE.Vector3(1, 0, 0), new THREE.Vector3(0.15, 0.06, 0)
    );

    // PL: pyramid section (x=0 → PL) along ridge (both ends are at height H)
    makeDimExt(new THREE.Vector3(0,  H, W / 2), new THREE.Vector3(0,  H + OFF, W / 2));
    makeDimExt(new THREE.Vector3(PL, H, W / 2), new THREE.Vector3(PL, H + OFF, W / 2));
    makeDimension(
      new THREE.Vector3(0, H + OFF, W / 2), new THREE.Vector3(PL, H + OFF, W / 2),
      _lbl(plVal, 'PL'), new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, 0.12, 0)
    );

    // L: gable section (x=PL → totalL) along front eave
    makeDimExt(new THREE.Vector3(PL,     0, 0), new THREE.Vector3(PL,     0, -OFF));
    makeDimExt(new THREE.Vector3(totalL, 0, 0), new THREE.Vector3(totalL, 0, -OFF));
    makeDimension(
      new THREE.Vector3(PL, 0, -OFF), new THREE.Vector3(totalL, 0, -OFF),
      _lbl(v.length, 'L'), new THREE.Vector3(0, 0, -1), new THREE.Vector3(0, 0.06, -0.1)
    );

    // H or S: right side vertical (at gable end)
    if (mode === 'slope') {
      _scene.add(makeLabel(_lbl(v.slope, 'S'), new THREE.Vector3(totalL + OFF, H / 2, W / 2)));
    } else {
      makeDimExt(new THREE.Vector3(totalL, 0, W / 2), new THREE.Vector3(totalL + OFF, 0, W / 2));
      makeDimExt(new THREE.Vector3(totalL, H, W / 2), new THREE.Vector3(totalL + OFF, H, W / 2));
      makeDimension(
        new THREE.Vector3(totalL + OFF, 0, W / 2), new THREE.Vector3(totalL + OFF, H, W / 2),
        _lbl(v.height, 'H'), new THREE.Vector3(1, 0, 0), new THREE.Vector3(0.15, 0, 0)
      );
    }
  }

  // ---------------------------------------------------------------------------
  // Shared wall helper used by both pitch variants
  // ---------------------------------------------------------------------------
  function _addWalls(L, W, WH) {
    var FLw = new THREE.Vector3(0, -WH, 0);
    var FRw = new THREE.Vector3(L, -WH, 0);
    var BLw = new THREE.Vector3(0, -WH, W);
    var BRw = new THREE.Vector3(L, -WH, W);
    var FL  = new THREE.Vector3(0,   0, 0);
    var FR  = new THREE.Vector3(L,   0, 0);
    var BL  = new THREE.Vector3(0,   0, W);
    var BR  = new THREE.Vector3(L,   0, W);

    _scene.add(makeFace([FLw, FRw, FR, FL], C_WALL_F, O_WALL));
    _scene.add(makeFace([FRw, BRw, BR, FR], C_WALL_S, O_WALL));
    _scene.add(makeFace([BRw, BLw, BL, BR], C_WALL_S, O_WALL));
    _scene.add(makeFace([BLw, FLw, FL, BL], C_WALL_S, O_WALL));

    _scene.add(makeEdge([FLw, FRw], C_DIM, true));
    _scene.add(makeEdge([FRw, BRw], C_DIM, true));
    _scene.add(makeEdge([BRw, BLw], C_DIM, true));
    _scene.add(makeEdge([BLw, FLw], C_DIM, true));
  }

  // ---------------------------------------------------------------------------
  // PITCH — DOUBLE (hipped both ends, ridge in centre)
  // ---------------------------------------------------------------------------
  function _buildPitchDouble(container, L, W, H, WH, v, mode, wallMode) {
    var R = v.ridgeLength != null ? v.ridgeLength : 1.2;
    if (R >= L) R = L * 0.5;
    var hipRun = (L - R) / 2;

    // Camera: front-left elevated — left hip face prominent
    _initScene(container,
      { x: -L * 0.2, y: H * 6.0, z: -W * 2.5 },
      { x:  L / 2,   y: H / 3,   z:  W / 2   }
    );

    var FL = new THREE.Vector3(0,          0, 0);
    var FR = new THREE.Vector3(L,          0, 0);
    var BL = new THREE.Vector3(0,          0, W);
    var BR = new THREE.Vector3(L,          0, W);
    var RL = new THREE.Vector3(hipRun,     H, W / 2);  // left ridge end
    var RR = new THREE.Vector3(L - hipRun, H, W / 2);  // right ridge end

    // Faces — back to front
    _scene.add(makeFace([BL, BR, RR, RL], C_BACK,   O_BACK));    // back slope
    _scene.add(makeFace([FL, FR, RR, RL], C_SLOPE1, O_SLOPE));   // front slope
    _scene.add(makeFace([FR, BR, RR],     C_SLOPE2, O_SLOPE));   // right hip triangle
    _scene.add(makeFace([FL, BL, RL],     C_FRONT,  O_FRONT));   // left hip triangle (prominent)

    // Edges
    _scene.add(makeEdge([FL, FR],  C_EDGE));
    _scene.add(makeEdge([FL, RL],  C_EDGE));
    _scene.add(makeEdge([FR, RR],  C_EDGE));
    _scene.add(makeEdge([FR, BR],  C_EDGE));
    _scene.add(makeEdge([BL, BR],  C_EDGE, true));
    _scene.add(makeEdge([BL, RL],  C_EDGE, true));
    _scene.add(makeEdge([BR, RR],  C_EDGE, true));
    _scene.add(makeEdge([RL, RR],  C_RIDGE));

    if (wallMode === 'walls') _addWalls(L, W, WH);

    // ── Dimension annotations ──────────────────────────────────────────────
    var OFF = 0.18;

    // (L): front eave
    makeDimExt(new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0, -OFF));
    makeDimExt(new THREE.Vector3(L, 0, 0), new THREE.Vector3(L, 0, -OFF));
    makeDimension(
      new THREE.Vector3(0, 0, -OFF), new THREE.Vector3(L, 0, -OFF),
      _lbl(v.length, 'L'), new THREE.Vector3(0, 0, -1), new THREE.Vector3(0, 0.06, -0.1)
    );

    // (W): left side
    makeDimExt(new THREE.Vector3(0, 0, 0), new THREE.Vector3(-OFF, 0, 0));
    makeDimExt(new THREE.Vector3(0, 0, W), new THREE.Vector3(-OFF, 0, W));
    makeDimension(
      new THREE.Vector3(-OFF, 0, 0), new THREE.Vector3(-OFF, 0, W),
      _lbl(v.width, 'W'), new THREE.Vector3(-1, 0, 0), new THREE.Vector3(-0.15, 0.06, 0)
    );

    // (R): above ridge
    var OFF_R = 0.12;
    makeDimExt(RL, RL.clone().setY(H + OFF_R));
    makeDimExt(RR, RR.clone().setY(H + OFF_R));
    makeDimension(
      new THREE.Vector3(hipRun,     H + OFF_R, W / 2),
      new THREE.Vector3(L - hipRun, H + OFF_R, W / 2),
      _lbl(v.ridgeLength, 'R'), new THREE.Vector3(0, 0, -1), new THREE.Vector3(0, 0.06, 0)
    );

    // H or S: right side (opposite to W on left)
    if (mode === 'slope') {
      _scene.add(makeLabel(_lbl(v.slope, 'S'), new THREE.Vector3(L + OFF, H / 2, -0.05)));
    } else {
      makeDimExt(new THREE.Vector3(L, 0, 0), new THREE.Vector3(L + OFF, 0, 0));
      makeDimension(
        new THREE.Vector3(L + OFF, 0, 0), new THREE.Vector3(L + OFF, H, 0),
        _lbl(v.height, 'H'), new THREE.Vector3(1, 0, 0), new THREE.Vector3(0.15, 0, 0)
      );
    }

    if (wallMode === 'walls') {
      makeDimExt(new THREE.Vector3(L, 0,   0), new THREE.Vector3(L + OFF * 2, 0,   0));
      makeDimExt(new THREE.Vector3(L, -WH, 0), new THREE.Vector3(L + OFF * 2, -WH, 0));
      makeDimension(
        new THREE.Vector3(L + OFF * 2, 0,   0), new THREE.Vector3(L + OFF * 2, -WH, 0),
        _lbl(v.wallHeight, 'WH'), new THREE.Vector3(0, 0, -1), new THREE.Vector3(0, 0, -0.12)
      );
    }
  }

  // ---------------------------------------------------------------------------
  // PITCH — MONO (hipped left end, gable right end)
  // ---------------------------------------------------------------------------
  function _buildPitchMono(container, L, W, H, WH, v, mode, wallMode) {
    var R      = v.ridgeLength != null ? v.ridgeLength : null;
    var hipRun = (R != null) ? (L - R) : (W / 2);
    if (hipRun <= 0) hipRun = W / 2;

    // Camera: front-centre-left elevated — hip face clearly visible
    _initScene(container,
      { x: -L * 0.4, y: H * 6.0, z: -W * 2.0 },
      { x:  L / 2,   y: H / 3,   z:  W / 2   }
    );

    var FL = new THREE.Vector3(0,      0, 0);
    var FR = new THREE.Vector3(L,      0, 0);
    var BL = new THREE.Vector3(0,      0, W);
    var BR = new THREE.Vector3(L,      0, W);
    var HA = new THREE.Vector3(hipRun, H, W / 2);  // hip apex (left ridge start)
    var GA = new THREE.Vector3(L,      H, W / 2);  // gable apex (right end)

    // Faces — back to front
    _scene.add(makeFace([BL, BR, GA, HA], C_BACK,   O_BACK));    // back slope
    _scene.add(makeFace([FL, FR, GA, HA], C_SLOPE1, O_SLOPE));   // front slope
    _scene.add(makeFace([FR, BR, GA],     C_SLOPE2, O_SLOPE));   // right gable triangle
    _scene.add(makeFace([FL, BL, HA],     C_FRONT,  O_FRONT));   // left hip triangle (prominent)

    // Edges
    _scene.add(makeEdge([FL, FR],  C_EDGE));
    _scene.add(makeEdge([FL, HA],  C_EDGE));
    _scene.add(makeEdge([FR, GA],  C_EDGE));
    _scene.add(makeEdge([FR, BR],  C_EDGE));
    _scene.add(makeEdge([BL, BR],  C_EDGE, true));
    _scene.add(makeEdge([BL, HA],  C_EDGE, true));
    _scene.add(makeEdge([BR, GA],  C_EDGE, true));
    _scene.add(makeEdge([HA, GA],  C_RIDGE));

    if (wallMode === 'walls') _addWalls(L, W, WH);

    // ── Dimension annotations ──────────────────────────────────────────────
    var OFF = 0.18;

    // (L): front eave
    makeDimExt(new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0, -OFF));
    makeDimExt(new THREE.Vector3(L, 0, 0), new THREE.Vector3(L, 0, -OFF));
    makeDimension(
      new THREE.Vector3(0, 0, -OFF), new THREE.Vector3(L, 0, -OFF),
      _lbl(v.length, 'L'), new THREE.Vector3(0, 0, -1), new THREE.Vector3(0, 0.06, -0.1)
    );

    // (W): left side
    makeDimExt(new THREE.Vector3(0, 0, 0), new THREE.Vector3(-OFF, 0, 0));
    makeDimExt(new THREE.Vector3(0, 0, W), new THREE.Vector3(-OFF, 0, W));
    makeDimension(
      new THREE.Vector3(-OFF, 0, 0), new THREE.Vector3(-OFF, 0, W),
      _lbl(v.width, 'W'), new THREE.Vector3(-1, 0, 0), new THREE.Vector3(-0.15, 0.06, 0)
    );

    // (R): above ridge (HA → GA)
    var OFF_R = 0.12;
    makeDimExt(HA, HA.clone().setY(H + OFF_R));
    makeDimExt(GA, GA.clone().setY(H + OFF_R));
    makeDimension(
      new THREE.Vector3(hipRun, H + OFF_R, W / 2),
      new THREE.Vector3(L,      H + OFF_R, W / 2),
      _lbl(v.ridgeLength, 'R'), new THREE.Vector3(0, 0, -1), new THREE.Vector3(0, 0.06, 0)
    );

    // H or S: right side (opposite to W on left)
    if (mode === 'slope') {
      _scene.add(makeLabel(_lbl(v.slope, 'S'), new THREE.Vector3(L + OFF, H / 2, -0.05)));
    } else {
      makeDimExt(new THREE.Vector3(L, 0, 0), new THREE.Vector3(L + OFF, 0, 0));
      makeDimension(
        new THREE.Vector3(L + OFF, 0, 0), new THREE.Vector3(L + OFF, H, 0),
        _lbl(v.height, 'H'), new THREE.Vector3(1, 0, 0), new THREE.Vector3(0.15, 0, 0)
      );
    }

    if (wallMode === 'walls') {
      makeDimExt(new THREE.Vector3(L, 0,   0), new THREE.Vector3(L + OFF * 2, 0,   0));
      makeDimExt(new THREE.Vector3(L, -WH, 0), new THREE.Vector3(L + OFF * 2, -WH, 0));
      makeDimension(
        new THREE.Vector3(L + OFF * 2, 0,   0), new THREE.Vector3(L + OFF * 2, -WH, 0),
        _lbl(v.wallHeight, 'WH'), new THREE.Vector3(0, 0, -1), new THREE.Vector3(0, 0, -0.12)
      );
    }
  }

  // ---------------------------------------------------------------------------
  // PITCH — dispatcher (resolves height, delegates to double/mono)
  // ---------------------------------------------------------------------------
  function buildPitch(container, mode, vals, wallMode, pitchMode) {
    var v  = vals || {};
    var L  = v.length     != null ? v.length     : 2.5;
    var W  = v.width      != null ? v.width      : 1.0;
    var WH = v.wallHeight != null ? v.wallHeight : 0.5;
    var H;
    if (mode === 'slope') {
      var S = v.slope != null ? v.slope : 1.0;
      H = Math.sqrt(Math.max(0, S * S - (W / 2) * (W / 2)));
    } else {
      H = v.height != null ? v.height : 0.45;
    }

    if (pitchMode === 'mono') {
      _buildPitchMono(container, L, W, H, WH, v, mode, wallMode);
    } else {
      _buildPitchDouble(container, L, W, H, WH, v, mode, wallMode);
    }
  }

  // ---------------------------------------------------------------------------
  // DISPOSE — cancel animation loop and release WebGL resources.
  // Container DOM cleanup is handled externally (app.js clears before re-render).
  // ---------------------------------------------------------------------------
  function dispose() {
    if (_animId !== null) {
      cancelAnimationFrame(_animId);
      _animId = null;
    }
    if (_renderer) {
      _renderer.dispose();
      _renderer = null;
    }
    _labelRenderer = null;
    _scene         = null;
    _camera        = null;
    _controls      = null;
  }

  // ---------------------------------------------------------------------------
  // PUBLIC API
  // ---------------------------------------------------------------------------
  window.Diagrams3D = {
    dispose: dispose,
    render: function (roofType, container, mode, vals, wallMode, pitchMode) {
      dispose(); // clean up any previous diagram first
      switch (roofType) {
        case 'gable':     buildGable(container, mode, vals, wallMode);            break;
        case 'leanto':    buildLeanto(container, mode, vals, wallMode);           break;
        case 'extension': buildExtension(container, mode, vals);                  break;
        case 'pitch':     buildPitch(container, mode, vals, wallMode, pitchMode); break;
      }
    }
  };

}());
