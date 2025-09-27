document.addEventListener('DOMContentLoaded', () => {
    const sidebar = document.getElementById('sidebar');
    const dataArea = document.getElementById('dataArea');
    const panels = document.querySelectorAll('.calculator-panel');
    const resetButton = document.getElementById('resetButton');
    const presetButtons = document.querySelectorAll('.preset-btn');
    const presetsGroup = document.getElementById('presetsGroup');

    const hdShapeSelect = document.getElementById('hd_shape');
    const hdAnnulusInputs = document.getElementById('hd_annulus_inputs');
    const hdRectInputs = document.getElementById('hd_rect_inputs');
    const hdOtherInputs = document.getElementById('hd_other_inputs');
    
    const reFlowRegimeEl = document.getElementById('re_flow_regime');

    // Curve fitting elements
    const cfPointsContainer = document.getElementById('cf_points_container');
    const cfAddPointBtn = document.getElementById('cf_add_point');
    const cfCanvas = document.getElementById('curveFitCanvas');
    const cfCtx = cfCanvas.getContext('2d');
    const cfEquationEl = document.getElementById('cf_equation');
    const cfRSquaredEl = document.getElementById('cf_r_squared');


    let hasUserInteracted = false; // Flag to track user interaction

    const prefixMap = {
        hydraulicDiameter: 'hd', reynoldsNumber: 're', knudsenNumber: 'kn',
        prandtlNumber: 'pr', nusseltNumber: 'nu', weberNumber: 'we', yPlus: 'yp',
        curveFitting: 'cf'
    };
    
    const conversionFactors = {
        'm²': 1, 'cm²': 1e-4, 'mm²': 1e-6, 'ft²': 0.092903, 'in²': 0.00064516,
        'm': 1, 'cm': 0.01, 'mm': 0.001, 'ft': 0.3048, 'in': 0.0254, 'nm': 1e-9,
        'kg/m³': 1, 'g/cm³': 1000, 'lb/ft³': 16.0185,
        'm/s': 1, 'cm/s': 0.01, 'ft/s': 0.3048, 'km/h': 0.277778,
        'Pa·s': 1, 'cP': 0.001,
        'm²/s': 1, 'cm²/s': 1e-4,
        'W/(m²·K)': 1, 'BTU/(hr·ft²·°F)': 5.67826,
        'W/(m·K)': 1, 'BTU/(hr·ft·°F)': 1.73073,
        'N/m': 1, 'dyn/cm': 0.001
    };
    
    const fluidPresets = {
        air: { density: 1.225, viscosity: 1.81e-5 },
        water: { density: 998.2, viscosity: 1.002e-3, surface_tension: 0.0728 }
    };

    const getInitialState = () => ({
        hydraulicDiameter: { 
            shape: 'Annulus', d1: '', d1_unit: 'm', d2: '', d2_unit: 'm', width: '', width_unit: 'm', height: '', height_unit: 'm',
            area: '', area_unit: 'm²', perimeter: '', perimeter_unit: 'm', result: '0.00', result_unit: 'm'
        },
        reynoldsNumber: { 
            density: fluidPresets.air.density, density_unit: 'kg/m³', velocity: '10', velocity_unit: 'm/s', length: '1', length_unit: 'm', 
            viscosity: fluidPresets.air.viscosity, viscosity_unit: 'Pa·s', result: '0.00', kinematic_viscosity_result: '0.00', 
            kinematic_viscosity_unit: 'm²/s', hydrodynamic_length_result: '0.00', hydrodynamic_length_unit: 'm'
        },
        knudsenNumber: { mean_free_path: '', mean_free_path_unit: 'm', length: '', length_unit: 'm', result: '0.00' },
        prandtlNumber: { kinematic_viscosity: '', kinematic_viscosity_unit: 'm²/s', thermal_diffusivity: '', thermal_diffusivity_unit: 'm²/s', result: '0.00' },
        nusseltNumber: { h: '', h_unit: 'W/(m²·K)', l: '', l_unit: 'm', k: '', k_unit: 'W/(m·K)', result: '0.00' },
        weberNumber: {
            density: fluidPresets.water.density, density_unit: 'kg/m³', velocity: '1', velocity_unit: 'm/s', length: '0.1', length_unit: 'm',
            surface_tension: fluidPresets.water.surface_tension, surface_tension_unit: 'N/m', result: '0.00'
        },
        yPlus: { 
            density: fluidPresets.air.density, density_unit: 'kg/m³', velocity: '10', velocity_unit: 'm/s', length: '1', length_unit: 'm', 
            viscosity: fluidPresets.air.viscosity, viscosity_unit: 'Pa·s', target_y_plus: '1', result: '0.00', result_unit: 'm' 
        },
        curveFitting: {
            points: [ {velocity: 1, pressureDrop: 10}, {velocity: 2, pressureDrop: 45}, {velocity: 3, pressureDrop: 95} ],
            equation: 'Pressure Drop = ...',
            rSquared: ''
        }
    });

    let calculatorState = getInitialState();
    
    const convertToSI = (value, unit) => parseFloat(value) * (conversionFactors[unit] || 1);
    const convertFromSI = (value, unit) => parseFloat(value) / (conversionFactors[unit] || 1);
    
    const clearError = (id) => {
        const errorEl = document.getElementById(`${id}_error`);
        const inputEl = document.getElementById(id);
        if (errorEl) errorEl.textContent = '';
        if (inputEl) inputEl.classList.remove('input-invalid');
    };
    const setError = (id, message) => {
        const errorEl = document.getElementById(`${id}_error`);
        const inputEl = document.getElementById(id);
        if (errorEl) errorEl.textContent = message;
        if (inputEl) inputEl.classList.add('input-invalid');
    };
    const validatePositive = (id, fieldName) => {
        clearError(id);
        const value = document.getElementById(id).value;
        if (value === '') {
            if (hasUserInteracted) { setError(id, `${fieldName} is required.`); }
            return false;
        }
        const numValue = parseFloat(value);
        if (isNaN(numValue)) { setError(id, `Must be a valid number.`); return false; }
        if (numValue <= 0) { setError(id, `${fieldName} must be positive.`); return false; }
        return true;
    };
    const flashResult = (elId) => {
        const el = document.getElementById(elId);
        if (el) {
            el.classList.add('flash');
            setTimeout(() => el.classList.remove('flash'), 500);
        }
    };

    // Calculation functions
    const calculateHydraulicDiameter = () => {
        const state = calculatorState.hydraulicDiameter;
        let resultInMeters = NaN;
        let isValid = true;
        if(state.shape !== 'Annulus') { ['hd_d1','hd_d2'].forEach(clearError); }
        if(state.shape !== 'Rectangular Duct') { ['hd_width','hd_height'].forEach(clearError); }
        if(state.shape !== 'Other') { ['hd_area','hd_perimeter'].forEach(clearError); }
        switch (state.shape) {
            case 'Annulus':
                const isD1Valid = validatePositive('hd_d1', 'D₁');
                const isD2Valid = validatePositive('hd_d2', 'D₂');
                if (!isD1Valid || !isD2Valid) { isValid = false; break; }
                const D1 = convertToSI(state.d1, state.d1_unit);
                const D2 = convertToSI(state.d2, state.d2_unit);
                if (D2 <= D1) {
                    setError('hd_d1', 'Inner ø must be smaller than outer ø.');
                    setError('hd_d2', 'Outer ø must be larger than inner ø.');
                    isValid = false;
                } else { resultInMeters = D2 - D1; }
                break;
            case 'Rectangular Duct':
                const isWValid = validatePositive('hd_width', 'Width');
                const isHValid = validatePositive('hd_height', 'Height');
                if (!isWValid || !isHValid) { isValid = false; break; }
                const W = convertToSI(state.width, state.width_unit);
                const H = convertToSI(state.height, state.height_unit);
                resultInMeters = (2 * W * H) / (W + H);
                break;
            case 'Other':
                const isAValid = validatePositive('hd_area', 'Area');
                const isPValid = validatePositive('hd_perimeter', 'Perimeter');
                if (!isAValid || !isPValid) { isValid = false; break; }
                const A = convertToSI(state.area, state.area_unit);
                const P = convertToSI(state.perimeter, state.perimeter_unit);
                resultInMeters = (4 * A) / P;
                break;
        }
        if (isValid && !isNaN(resultInMeters)) {
            const finalResult = convertFromSI(resultInMeters, state.result_unit);
            state.result = finalResult.toExponential(4);
            flashResult('hd_result');
        } else { state.result = '0.00'; }
        updateUI();
    };
    const calculateReynoldsNumber = () => {
        const state = calculatorState.reynoldsNumber;
        reFlowRegimeEl.style.visibility = 'hidden';
        const isValid = [
            validatePositive('re_density', 'Density'), validatePositive('re_velocity', 'Velocity'),
            validatePositive('re_length', 'Length'), validatePositive('re_viscosity', 'Viscosity')
        ].every(Boolean);
        if (!isValid) {
            state.result = '0.00'; state.kinematic_viscosity_result = '0.00'; state.hydrodynamic_length_result = '0.00';
        } else {
            const rho = convertToSI(state.density, state.density_unit);
            const V = convertToSI(state.velocity, state.velocity_unit);
            const L = convertToSI(state.length, state.length_unit);
            const mu = convertToSI(state.viscosity, state.viscosity_unit);
            const reynolds = (rho * V * L) / mu;
            state.result = reynolds.toExponential(4);
            const nu_si = mu / rho;
            const nu_display = convertFromSI(nu_si, state.kinematic_viscosity_unit);
            state.kinematic_viscosity_result = nu_display.toExponential(4);
            let le_si;
            if (reynolds < 2300) {
                le_si = 0.05 * reynolds * L;
                reFlowRegimeEl.className = 'flow-regime laminar';
                reFlowRegimeEl.textContent = 'Flow Regime: Laminar';
                reFlowRegimeEl.style.visibility = 'visible';
            } else if (reynolds >= 2300 && reynolds <= 4000) {
                 le_si = 4.4 * L * Math.pow(reynolds, 1/6);
                 reFlowRegimeEl.className = 'flow-regime transitional';
                 reFlowRegimeEl.textContent = 'Flow Regime: Transitional';
                 reFlowRegimeEl.style.visibility = 'visible';
            } else {
                le_si = 4.4 * L * Math.pow(reynolds, 1/6);
                reFlowRegimeEl.className = 'flow-regime turbulent';
                reFlowRegimeEl.textContent = 'Flow Regime: Turbulent';
                reFlowRegimeEl.style.visibility = 'visible';
            }
            const le_display = convertFromSI(le_si, state.hydrodynamic_length_unit);
            state.hydrodynamic_length_result = le_display.toExponential(4);
            ['re_result', 're_kinematic_viscosity_result', 're_hydrodynamic_length_result'].forEach(flashResult);
        }
        updateUI();
    };
    const calculateKnudsenNumber = () => {
        const state = calculatorState.knudsenNumber;
         const isValid = [ validatePositive('kn_mean_free_path', 'Mean Free Path'), validatePositive('kn_length', 'Length') ].every(Boolean);
        if (isValid) {
             const lambda = convertToSI(state.mean_free_path, state.mean_free_path_unit);
             const L = convertToSI(state.length, state.length_unit);
             state.result = (lambda / L).toExponential(4);
             flashResult('kn_result');
        } else { state.result = '0.00'; }
        updateUI();
    };
    const calculatePrandtlNumber = () => {
        const state = calculatorState.prandtlNumber;
        const isValid = [ validatePositive('pr_kinematic_viscosity', 'Kinematic Viscosity'), validatePositive('pr_thermal_diffusivity', 'Thermal Diffusivity') ].every(Boolean);
         if (isValid) {
             const nu = convertToSI(state.kinematic_viscosity, state.kinematic_viscosity_unit);
             const alpha = convertToSI(state.thermal_diffusivity, state.thermal_diffusivity_unit);
             state.result = (nu / alpha).toExponential(4);
             flashResult('pr_result');
        } else { state.result = '0.00'; }
        updateUI();
    };
    const calculateNusseltNumber = () => {
        const state = calculatorState.nusseltNumber;
        const isValid = [ validatePositive('nu_h', 'Heat Transfer Coeff.'), validatePositive('nu_l', 'Length'), validatePositive('nu_k', 'Thermal Conductivity') ].every(Boolean);
        if(isValid) {
            const H = convertToSI(state.h, state.h_unit);
            const L = convertToSI(state.l, state.l_unit);
            const K = convertToSI(state.k, state.k_unit);
            state.result = ((H * L) / K).toExponential(4);
            flashResult('nu_result');
        } else { state.result = '0.00'; }
        updateUI();
    };
    const calculateWeberNumber = () => {
        const state = calculatorState.weberNumber;
        const isValid = [
            validatePositive('we_density', 'Density'), validatePositive('we_velocity', 'Velocity'),
            validatePositive('we_length', 'Length'), validatePositive('we_surface_tension', 'Surface Tension')
        ].every(Boolean);
        if (isValid) {
            const rho = convertToSI(state.density, state.density_unit);
            const V = convertToSI(state.velocity, state.velocity_unit);
            const L = convertToSI(state.length, state.length_unit);
            const sigma = convertToSI(state.surface_tension, state.surface_tension_unit);
            const weber = (rho * V * V * L) / sigma;
            state.result = weber.toExponential(4);
            flashResult('we_result');
        } else { state.result = '0.00'; }
        updateUI();
    };
    const calculateFirstCellThickness = () => {
        const state = calculatorState.yPlus;
        const isValid = [
            validatePositive('yp_density', 'Density'), validatePositive('yp_velocity', 'Velocity'),
            validatePositive('yp_length', 'Length'), validatePositive('yp_viscosity', 'Viscosity'),
            validatePositive('yp_target_y_plus', 'Desired Y+')
        ].every(Boolean);
        if (!isValid) { state.result = '0.00';
        } else {
            const rho = convertToSI(state.density, state.density_unit);
            const U = convertToSI(state.velocity, state.velocity_unit);
            const L = convertToSI(state.length, state.length_unit);
            const mu = convertToSI(state.viscosity, state.viscosity_unit);
            const yPlusTarget = parseFloat(state.target_y_plus);
            const Re = (rho * U * L) / mu;
            const Cf = 0.026 / Math.pow(Re, 1/7);
            const tau_w = 0.5 * Cf * rho * Math.pow(U, 2);
            const u_tau = Math.sqrt(tau_w / rho);
            if (u_tau > 0) {
                const resultInMeters = (yPlusTarget * mu) / (u_tau * rho);
                const finalResult = convertFromSI(resultInMeters, state.result_unit);
                state.result = finalResult.toExponential(4);
                flashResult('yp_result');
            } else { state.result = '0.00'; }
        }
        updateUI();
    };

    // --- Curve Fitting Logic ---
    const quadraticFitNoIntercept = (points) => {
        let sum_x4 = 0, sum_x3 = 0, sum_x2 = 0;
        let sum_yx2 = 0, sum_yx = 0;

        for (const p of points) {
            const x = p.velocity;
            const y = p.pressureDrop;
            const x2 = x * x;
            sum_x4 += x2 * x2;
            sum_x3 += x2 * x;
            sum_x2 += x2;
            sum_yx2 += y * x2;
            sum_yx += y * x;
        }

        const det = sum_x4 * sum_x2 - sum_x3 * sum_x3;
        if (Math.abs(det) < 1e-9) return null;

        let a = (sum_yx2 * sum_x2 - sum_yx * sum_x3) / det;
        let b = (sum_yx * sum_x4 - sum_yx2 * sum_x3) / det;
        
        if (a < 0 || b < 0) {
            if (b < 0) { 
                const sum_x4_pure = points.reduce((s, p) => s + Math.pow(p.velocity, 4), 0);
                const sum_x2y = points.reduce((s, p) => s + p.velocity*p.velocity * p.pressureDrop, 0);
                a = (sum_x4_pure > 0) ? sum_x2y / sum_x4_pure : 0;
                b = 0;
            }
            if (a < 0) {
                const sum_x_sq = points.reduce((s, p) => s + p.velocity * p.velocity, 0);
                const sum_xy = points.reduce((s, p) => s + p.velocity * p.pressureDrop, 0);
                a = 0;
                b = (sum_x_sq > 0) ? sum_xy / sum_x_sq : 0;
            }
             if (a < 0 || b < 0) return null;
        }

        return { a, b };
    };

    const calculateRSquared = (points, a, b) => {
        if(points.length === 0) return 0;
        const yMean = points.reduce((sum, p) => sum + p.pressureDrop, 0) / points.length;
        let ssTot = 0;
        let ssRes = 0;

        for (const p of points) {
            const y_fit = a * p.velocity * p.velocity + b * p.velocity;
            ssTot += (p.pressureDrop - yMean) * (p.pressureDrop - yMean);
            ssRes += (p.pressureDrop - y_fit) * (p.pressureDrop - y_fit);
        }

        if (ssTot === 0) return 1.0;
        return 1 - (ssRes / ssTot);
    };

    const formatEquation = (coeffs) => {
        if (!coeffs) return 'Pressure Drop = ...';
        return `ΔP = ${coeffs.a.toFixed(4)}V² + ${coeffs.b.toFixed(4)}V`;
    };

    const drawGraph = (points, coeffs) => {
        const padding = 40;
        const width = cfCanvas.width;
        const height = cfCanvas.height;
        cfCtx.clearRect(0, 0, width, height);

        if (points.length < 1) return;

        const xValues = points.map(p => p.velocity);
        const yValues = points.map(p => p.pressureDrop);

        let minX = 0;
        let maxX = Math.max(...xValues);
        let minY = 0;
        let maxY = Math.max(...yValues);
        
        if(points.length === 1 && maxX === 0) { maxX = 1; }
        if(points.length === 1 && maxY === 0) { maxY = 1; }

        const rangeX = maxX - minX || 1;
        const rangeY = maxY - minY || 1;
        
        const scaleX = (width - 2 * padding) / rangeX;
        const scaleY = (height - 2 * padding) / rangeY;

        const transformX = (x) => padding + (x - minX) * scaleX;
        const transformY = (y) => height - padding - (y - minY) * scaleY;

        // Draw axes
        cfCtx.strokeStyle = '#4b5563';
        cfCtx.beginPath();
        cfCtx.moveTo(padding, 0); cfCtx.lineTo(padding, height - padding); cfCtx.lineTo(width, height - padding);
        cfCtx.stroke();
        
        // Draw points
        cfCtx.fillStyle = '#6366f1';
        points.forEach(p => {
            cfCtx.beginPath();
            cfCtx.arc(transformX(p.velocity), transformY(p.pressureDrop), 4, 0, 2 * Math.PI);
            cfCtx.fill();
        });

        // Draw curve
        if (coeffs && points.length > 1) {
            cfCtx.strokeStyle = '#4ade80';
            cfCtx.lineWidth = 2;
            cfCtx.beginPath();
            const steps = 100;
            for (let i = 0; i <= steps; i++) {
                const x = minX + (rangeX * i) / steps;
                const y = coeffs.a * x * x + coeffs.b * x;
                if (i === 0) {
                    cfCtx.moveTo(transformX(x), transformY(y));
                } else {
                    cfCtx.lineTo(transformX(x), transformY(y));
                }
            }
            cfCtx.stroke();
            cfCtx.lineWidth = 1;
        }
    };
    
    const calculateCurveFit = () => {
        const state = calculatorState.curveFitting;
        const validPoints = state.points.filter(p => !isNaN(p.velocity) && !isNaN(p.pressureDrop));
        
        if (validPoints.length >= 2) {
            const coeffs = quadraticFitNoIntercept(validPoints);
            if (coeffs) {
                state.equation = formatEquation(coeffs);
                const rSquared = calculateRSquared(validPoints, coeffs.a, coeffs.b);
                state.rSquared = `R² = ${rSquared.toFixed(4)}`;
                drawGraph(validPoints, coeffs);
            } else {
                 state.equation = 'Fit failed (ensure positive correlation).';
                 state.rSquared = '';
                 drawGraph(validPoints, null);
            }
        } else {
            state.equation = 'Not enough data points.';
            state.rSquared = '';
            drawGraph(validPoints, null);
        }
        updateUI();
    };


    const calculations = {
        hydraulicDiameter: calculateHydraulicDiameter, reynoldsNumber: calculateReynoldsNumber,
        knudsenNumber: calculateKnudsenNumber, prandtlNumber: calculatePrandtlNumber,
        nusseltNumber: calculateNusseltNumber, weberNumber: calculateWeberNumber, yPlus: calculateFirstCellThickness,
        curveFitting: calculateCurveFit
    };

    // UI helpers
    let activeType = 'hydraulicDiameter';

    const switchPanel = (type) => {
        activeType = type;
        panels.forEach(panel => {
            const isHidden = panel.id !== type;
            panel.classList.toggle('hidden', isHidden);
            if (!isHidden) {
                panel.style.animation = 'none';
                panel.offsetHeight; /* trigger reflow */
                panel.style.animation = null;
            }
        });
        document.querySelectorAll('#sidebar .sidebar-item').forEach(btn => {
            btn.classList.toggle('active-item', btn.dataset.type === type);
        });
        
        presetsGroup.classList.toggle('hidden', !['reynoldsNumber', 'yPlus', 'weberNumber'].includes(type));

        updateUI();
    };
    const updateUI = () => {
        const state = calculatorState[activeType];
        if (!state) return;

        const prefix = prefixMap[activeType];
        for (const key in state) {
            const el = document.getElementById(`${prefix}_${key}`);
            if (el) {
                if (el.tagName === 'INPUT' || el.tagName === 'SELECT') {
                    if(document.activeElement !== el) el.value = state[key];
                } else if (el.classList.contains('result-box')) {
                    el.textContent = state[key];
                }
            }
        }
         if (activeType === 'curveFitting') {
            cfEquationEl.textContent = state.equation;
            cfRSquaredEl.textContent = state.rSquared;
        }
    };
    const handleHdShapeChange = () => {
        const selectedShape = hdShapeSelect.value;
        calculatorState.hydraulicDiameter.shape = selectedShape;
        hdAnnulusInputs.classList.toggle('hidden', selectedShape !== 'Annulus');
        hdRectInputs.classList.toggle('hidden', selectedShape !== 'Rectangular Duct');
        hdOtherInputs.classList.toggle('hidden', selectedShape !== 'Other');
        calculateHydraulicDiameter();
    };
    
    const handleInteraction = (e) => {
        hasUserInteracted = true;
        const id = e.target.id;
        
        if (id.startsWith('cf_point')) {
            const parts = id.split('_');
            const index = parts[2];
            const axis = parts[3];
            calculatorState.curveFitting.points[index][axis] = parseFloat(e.target.value);
            calculateCurveFit();
            return;
        }

        for (const type in prefixMap) {
            const pref = prefixMap[type];
            if (id.startsWith(pref + '_')) {
                const key = id.substring(pref.length + 1);
                if (calculatorState[type] && key in calculatorState[type]) {
                    calculatorState[type][key] = e.target.value;
                    calculations[type]();
                }
                break;
            }
        }
    };
    
    const resetAll = () => {
        hasUserInteracted = false;
        calculatorState = getInitialState();
        const allInputs = document.querySelectorAll('input[type="number"], .validation-message');
        allInputs.forEach(el => {
            if(el.classList.contains('validation-message')) el.textContent = '';
            else el.classList.remove('input-invalid');
        });
        handleHdShapeChange();
        if(reFlowRegimeEl) reFlowRegimeEl.style.visibility = 'hidden';
        Object.values(calculations).forEach(calc => calc());
        switchPanel('hydraulicDiameter');
    };
    
    const loadDefaults = () => {
        hasUserInteracted = false;
        calculatorState = getInitialState();
        handleHdShapeChange();
        if(reFlowRegimeEl) reFlowRegimeEl.style.visibility = 'hidden';
        Object.values(calculations).forEach(calc => calc());
        updateUI();
        switchPanel('hydraulicDiameter');
    };

    const handleCopy = (e) => {
        const button = e.target.closest('.copy-btn');
        if (!button) return;
        const targetId = button.dataset.target;
        const resultEl = document.getElementById(targetId);
        if (resultEl) {
            navigator.clipboard.writeText(resultEl.textContent).then(() => {
                const copyIcon = button.querySelector('.copy-icon');
                const checkIcon = button.querySelector('.check-icon');
                copyIcon.classList.add('hidden');
                checkIcon.classList.remove('hidden');
                setTimeout(() => {
                    copyIcon.classList.remove('hidden');
                    checkIcon.classList.add('hidden');
                }, 2000);
            }).catch(err => console.error('Failed to copy!', err));
        }
    };

    const handlePreset = (e) => {
        hasUserInteracted = true;
        const fluid = e.target.dataset.fluid;
        if (!fluid || !fluidPresets[fluid]) return;
        const preset = fluidPresets[fluid];
        
        ['reynoldsNumber', 'yPlus', 'weberNumber'].forEach(type => {
            if (calculatorState[type]) {
                calculatorState[type].density = preset.density;
                calculatorState[type].density_unit = 'kg/m³';
                if (preset.viscosity) {
                    calculatorState[type].viscosity = preset.viscosity;
                    calculatorState[type].viscosity_unit = 'Pa·s';
                }
                if (preset.surface_tension && calculatorState[type].surface_tension !== undefined) {
                    calculatorState[type].surface_tension = preset.surface_tension;
                    calculatorState[type].surface_tension_unit = 'N/m';
                }
            }
        });

        Object.values(calculations).forEach(calc => calc());
        updateUI();
    };

    const renderPoints = () => {
        cfPointsContainer.innerHTML = '';
        calculatorState.curveFitting.points.forEach((p, index) => {
            const row = document.createElement('tr');
            row.className = 'point-row';
            row.innerHTML = `
                <td><input type="number" id="cf_point_${index}_velocity" value="${p.velocity}" step="any"></td>
                <td><input type="number" id="cf_point_${index}_pressureDrop" value="${p.pressureDrop}" step="any"></td>
                <td><button class="remove-point-btn" data-index="${index}">✖</button></td>
            `;
            cfPointsContainer.appendChild(row);
        });
    };

    cfAddPointBtn.addEventListener('click', () => {
        calculatorState.curveFitting.points.push({velocity: 0, pressureDrop: 0});
        renderPoints();
        calculateCurveFit();
    });

    cfPointsContainer.addEventListener('click', (e) => {
        if (e.target.matches('.remove-point-btn')) {
            const index = parseInt(e.target.dataset.index, 10);
            calculatorState.curveFitting.points.splice(index, 1);
            renderPoints();
            calculateCurveFit();
        }
    });

    sidebar.addEventListener('click', (e) => {
        if (e.target.matches('.sidebar-item')) {
            switchPanel(e.target.dataset.type);
            if (e.target.dataset.type === 'curveFitting') {
                renderPoints();
                calculateCurveFit();
            }
        }
    });
    dataArea.addEventListener('input', handleInteraction);
    dataArea.addEventListener('change', handleInteraction);
    dataArea.addEventListener('click', handleCopy);
    resetButton.addEventListener('click', resetAll);
    presetButtons.forEach(btn => btn.addEventListener('click', handlePreset));
    hdShapeSelect.addEventListener('change', handleHdShapeChange);

    loadDefaults();
});


// --- PWA Service Worker Registration ---
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js')
            .then(registration => {
                console.log('ServiceWorker registration successful with scope: ', registration.scope);
            })
            .catch(err => {
                console.log('ServiceWorker registration failed: ', err);
            });
    });
}