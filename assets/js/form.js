// Keeps the named number inputs of one or more forms in sync with URL query
// params, so a calculation can be shared as a link. Calls onChange(values)
// with numbers keyed by input name whenever all inputs are valid. Each form
// shows its own error message (the only paragraph right inside it) when one
// of its inputs is invalid.
// beforeCheck(), if given, runs before validation, e.g. to set a custom
// validity rule that spans several inputs.
export function bindForm(forms, onChange, beforeCheck) {
    forms = [forms].flat();
    const inputs = forms.flatMap((form) => [...form.querySelectorAll("input[name]")]);
    const params = new URLSearchParams(location.search);
    for (const input of inputs) {
        if (params.has(input.name)) input.value = params.get(input.name);
    }

    function update() {
        beforeCheck?.();
        let valid = true;
        for (const form of forms) {
            const formValid = [...form.querySelectorAll("input[name]")].every((input) => input.checkValidity());
            // The error message is the last paragraph of the form: a form can have text before its fields
            const message = form.querySelector(":scope > p:last-of-type");
            if (message) message.hidden = formValid;
            valid &&= formValid;
        }
        if (!valid) return;

        const values = {};
        const query = new URLSearchParams();
        for (const input of inputs) {
            values[input.name] = input.valueAsNumber;
            query.set(input.name, input.value);
        }
        history.replaceState(null, "", `?${query}`);
        onChange(values);
    }

    for (const form of forms) {
        form.addEventListener("input", update);
        form.addEventListener("submit", (event) => event.preventDefault());
    }
    update();
}

// Sets the text of every [data-out="name"] element inside root
export function output(root, name, text) {
    for (const el of root.querySelectorAll(`[data-out="${name}"]`)) el.textContent = text;
}
