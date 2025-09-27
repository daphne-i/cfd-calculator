document.addEventListener('DOMContentLoaded', () => {
    // --- DOM Element References ---
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

    let hasUserInteracted = false;

    // --- State & Constants ---
    const prefixMap = {
        hydraulicDiameter: 'hd', reynoldsNumber: 're', knudsenNumber: 'kn',
        prandtlNumber: 'pr', nusseltNumber: 'nu', weberNumber: 'we', yPlus: 'yp',
        curveFitting: 'cf'
    };
    
    const conversionFactors = {
        'm^2': 1, 'cm^2': 1e-4, 'ft^2': 0.092903, 'in^2': 0.00064516,
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
            area: '', area_unit: 'm^2', perimeter: '', perimeter_unit: 'm', 
            result_si: 0.0,
            result_unit: 'm'
        },
        reynoldsNumber: { 
            density: fluidPresets.air.density, density_unit: 'kg/m³', velocity: '10', velocity_unit: 'm/s', length: '1', length_unit: 'm', 
            viscosity: fluidPresets.air.viscosity, viscosity_unit: 'Pa·s', result: '0.00', kinematic_viscosity_result: '0.00', 
            kinematic_viscosity_unit: 'm²/s', hydrodynamic_length_result: '0.00', hydrodynamic_length_unit: 'm'
        },
        // ... add other initial states later
    });

    let calculatorState = getInitialState();
    
    // --- Utility Functions ---
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

    // --- Calculation Functions ---
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
            state.result_si = resultInMeters;
            flashResult('hd_result');
        } else {
            state.result_si = 0.0;
        }
        updateUI();
    };

    const calculateReynoldsNumber = () => {
        // This is a placeholder for now, but follows the same logic
        updateUI();
    };

    // --- UI Update & Event Handling ---
    const calculations = {
        hydraulicDiameter: calculateHydraulicDiameter,
        reynoldsNumber: calculateReynoldsNumber,
        // ... add other calculation functions here
    };

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
            if (el && (el.tagName === 'INPUT' || el.tagName === 'SELECT')) {
                if (document.activeElement !== el) el.value = state[key];
            }
        }
        
        if (activeType === 'hydraulicDiameter') {
            const resultEl = document.getElementById('hd_result');
            const finalResult = convertFromSI(state.result_si, state.result_unit);
            resultEl.textContent = finalResult.toExponential(4);
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
        
        for (const type in prefixMap) {
            const pref = prefixMap[type];
            if (id.startsWith(pref + '_')) {
                const key = id.substring(pref.length + 1);
                if (calculatorState[type] && key in calculatorState[type]) {
                    calculatorState[type][key] = e.target.value;
                    if (calculations[type]) {
                        calculations[type]();
                    }
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

    // --- Initial Setup & Event Listeners ---
    sidebar.addEventListener('click', (e) => {
        if (e.target.matches('.sidebar-item')) {
            switchPanel(e.target.dataset.type);
        }
    });
    
    dataArea.addEventListener('input', handleInteraction);
    dataArea.addEventListener('change', handleInteraction);
    dataArea.addEventListener('click', handleCopy);
    resetButton.addEventListener('click', resetAll);
    presetButtons.forEach(btn => btn.addEventListener('click', handlePreset));
    hdShapeSelect.addEventListener('change', handleHdShapeChange);

    loadDefaults();
    switchPanel('hydraulicDiameter');
});
