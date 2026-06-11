document.addEventListener('DOMContentLoaded', () => {
    const display = document.getElementById('display');
    const history = document.getElementById('history');
    const toggleBtn = document.getElementById('toggle-mode');
    const keypad = document.getElementById('keypad');
    const container = document.querySelector('.calculator-container');

    let currentInput = '';
    let isScientific = false;
    let explicitReset = false; // Flag to check if evaluation was just completed

    // --- Mode Toggle Functionality ---
    toggleBtn.addEventListener('click', () => {
        isScientific = !isScientific;
        if (isScientific) {
            keypad.classList.remove('simple-mode');
            keypad.classList.add('scientific-mode');
            container.classList.add('scientific-active');
            toggleBtn.textContent = 'Switch to Simple Mode';
        } else {
            keypad.classList.remove('scientific-mode');
            keypad.classList.add('simple-mode');
            container.classList.remove('scientific-active');
            toggleBtn.textContent = 'Switch to Scientific Mode';
        }
    });

    // --- Main Keypad Event Listener ---
    keypad.addEventListener('click', (e) => {
        if (!e.target.classList.contains('btn')) return;

        const action = e.target.dataset.action;
        const value = e.target.dataset.value;

        // Reset if a computation occurred and user starts entering data directly
        if (explicitReset && ['number', '.', 'pi', 'e'].includes(action)) {
            currentInput = '';
            explicitReset = false;
        } else if (explicitReset && action === 'operator') {
            explicitReset = false; // Chain calculation using the existing answer
        }

        switch (action) {
            case 'number':
                appendNumber(value);
                break;
            case 'operator':
                appendOperator(value);
                break;
            case 'clear':
                clearAll();
                break;
            case 'delete':
                deleteOne();
                break;
            case 'calculate':
                processCalculation();
                break;
            // Scientific Actions
            case 'sin': case 'cos': case 'tan':
            case 'log': case 'ln': case 'sqrt':
            case 'sqr': case 'cube': case 'fact':
                processScientificFunction(action);
                break;
            case 'pow':
                appendOperator('^');
                break;
            case 'pi':
                appendNumber(Math.PI.toFixed(6));
                break;
            case 'e':
                appendNumber(Math.E.toFixed(6));
                break;
        }
    });

    // --- Core Input Logic Functions ---
    function appendNumber(num) {
        // Prevent multiple decimals in a single segment block
        if (num === '.') {
            const parts = currentInput.split(/[\+\-\*\/^]/);
            const currentPart = parts[parts.length - 1];
            if (currentPart.includes('.')) return; 
        }
        currentInput += num;
        updateDisplay();
    }

    function appendOperator(op) {
        if (currentInput === '' && op !== '-') return; // Handle leading negative signs safely
        
        // Block multi-consecutive standard validation structural breaks
        const lastChar = currentInput.slice(-1);
        if (['+', '-', '*', '/', '^', '%'].includes(lastChar)) {
            currentInput = currentInput.slice(0, -1) + op; // Replace previous operator
        } else {
            currentInput += op;
        }
        updateDisplay();
    }

    function clearAll() {
        currentInput = '';
        history.textContent = '';
        updateDisplay();
    }

    function deleteOne() {
        currentInput = currentInput.toString().slice(0, -1);
        updateDisplay();
    }

    function updateDisplay() {
        display.value = currentInput || '0';
    }

    // --- Scientific Functional Unary Computations ---
    function processScientificFunction(type) {
        if (!currentInput) {
            showError('Invalid Input');
            return;
        }

        let numValue;
        try {
            // First evaluate whatever expression is in screen buffer safely
            numValue = safeEvaluate(currentInput);
        } catch (e) {
            showError('Expression Error');
            return;
        }

        if (isNaN(numValue)) {
            showError('Error');
            return;
        }

        let result;
        switch (type) {
            case 'sin':
                // Convert degrees to radians assuming active dynamic user view
                result = Math.sin(numValue * Math.PI / 180);
                history.textContent = `sin(${numValue}°)`;
                break;
            case 'cos':
                result = Math.cos(numValue * Math.PI / 180);
                history.textContent = `cos(${numValue}°)`;
                break;
            case 'tan':
                if ((numValue - 90) % 180 === 0) {
                    showError('Undefined (Tan 90)');
                    return;
                }
                result = Math.tan(numValue * Math.PI / 180);
                history.textContent = `tan(${numValue}°)`;
                break;
            case 'log':
                if (numValue <= 0) { showError('Invalid Log Input'); return; }
                result = Math.log10(numValue);
                history.textContent = `log(${numValue})`;
                break;
            case 'ln':
                if (numValue <= 0) { showError('Invalid Ln Input'); return; }
                result = Math.log(numValue);
                history.textContent = `ln(${numValue})`;
                break;
            case 'sqrt':
                if (numValue < 0) { showError('Negative Sqrt Error'); return; }
                result = Math.sqrt(numValue);
                history.textContent = `√(${numValue})`;
                break;
            case 'sqr':
                result = Math.pow(numValue, 2);
                history.textContent = `(${numValue})²`;
                break;
            case 'cube':
                result = Math.pow(numValue, 3);
                history.textContent = `(${numValue})³`;
                break;
            case 'fact':
                if (numValue < 0 || !Number.isInteger(numValue)) {
                    showError('Invalid Factorial');
                    return;
                }
                result = computeFactorial(numValue);
                history.textContent = `${numValue}!`;
                break;
        }

        // Handle structural bounds overflow check
        if (!isFinite(result)) {
            showError('Overflow Error');
            return;
        }

        // Limit floating precision to 8 decimal places
        currentInput = Number(result.toFixed(8)).toString();
        explicitReset = true;
        updateDisplay();
    }

    function computeFactorial(n) {
        if (n === 0 || n === 1) return 1;
        if (n > 170) return Infinity; // JS Max structural safe bound limit
        let res = 1;
        for (let i = 2; i <= n; i++) res *= i;
        return res;
    }

    // --- Main Binary Math Evaluation Engine ---
    function processCalculation() {
        if (!currentInput) return;

        try {
            history.textContent = currentInput + ' =';
            let result = safeEvaluate(currentInput);

            if (!isFinite(result)) {
                if (currentInput.includes('/0')) {
                    showError('Cannot divide by zero');
                } else {
                    showError('Overflow Error');
                }
                return;
            }

            currentInput = Number(result.toFixed(8)).toString();
            updateDisplay();
            explicitReset = true;
        } catch (err) {
            showError(err.message || 'Malformed Expression');
        }
    }

    // A secure tokenized parsing execution workflow avoiding dangerous direct eval() usages
    function safeEvaluate(str) {
        // Sanitize string matching structurally valid components only
        str = str.replace(/×/g, '*').replace(/÷/g, '/');
        
        // Handle custom power execution representation translation
        if (str.includes('^')) {
            let baseParts = str.split('^');
            if (baseParts.length === 2) {
                let base = safeEvaluate(baseParts[0]);
                let exp = safeEvaluate(baseParts[1]);
                return Math.pow(base, exp);
            }
        }

        // Match exact token characters allowed
        if (/[^0-9\+\-\*\/\.\%\(\)]/.test(str)) {
            throw new Error('Invalid Expression Structure');
        }

        // Check explicit mathematical violations like divide by zero safely prior execution
        if (/\/0(?!\.)/.test(str)) {
            throw new Error('Cannot divide by zero');
        }

        try {
            // Function evaluation acts cleanly as insulated step execution token setup
            const parsedSolution = new Function(`return (${str})`)();
            if (parsedSolution === undefined || isNaN(parsedSolution)) {
                throw new Error('Calculation Exception');
            }
            return parsedSolution;
        } catch {
            throw new Error('Malformed Expression');
        }
    }

    function showError(message) {
        display.value = message;
        currentInput = '';
        explicitReset = true;
    }
});