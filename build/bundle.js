var app = (function () {
    'use strict';

    function noop() { }
    function run(fn) {
        return fn();
    }
    function blank_object() {
        return Object.create(null);
    }
    function run_all(fns) {
        fns.forEach(run);
    }
    function is_function(thing) {
        return typeof thing === 'function';
    }
    function safe_not_equal(a, b) {
        return a != a ? b == b : a !== b || ((a && typeof a === 'object') || typeof a === 'function');
    }
    function is_empty(obj) {
        return Object.keys(obj).length === 0;
    }
    function append(target, node) {
        target.appendChild(node);
    }
    function insert(target, node, anchor) {
        target.insertBefore(node, anchor || null);
    }
    function detach(node) {
        if (node.parentNode) {
            node.parentNode.removeChild(node);
        }
    }
    function element(name) {
        return document.createElement(name);
    }
    function text(data) {
        return document.createTextNode(data);
    }
    function space() {
        return text(' ');
    }
    function listen(node, event, handler, options) {
        node.addEventListener(event, handler, options);
        return () => node.removeEventListener(event, handler, options);
    }
    function prevent_default(fn) {
        return function (event) {
            event.preventDefault();
            // @ts-ignore
            return fn.call(this, event);
        };
    }
    function attr(node, attribute, value) {
        if (value == null)
            node.removeAttribute(attribute);
        else if (node.getAttribute(attribute) !== value)
            node.setAttribute(attribute, value);
    }
    function to_number(value) {
        return value === '' ? null : +value;
    }
    function children(element) {
        return Array.from(element.childNodes);
    }
    function set_data(text, data) {
        data = '' + data;
        if (text.data === data)
            return;
        text.data = data;
    }
    function set_input_value(input, value) {
        input.value = value == null ? '' : value;
    }

    let current_component;
    function set_current_component(component) {
        current_component = component;
    }

    const dirty_components = [];
    const binding_callbacks = [];
    let render_callbacks = [];
    const flush_callbacks = [];
    const resolved_promise = /* @__PURE__ */ Promise.resolve();
    let update_scheduled = false;
    function schedule_update() {
        if (!update_scheduled) {
            update_scheduled = true;
            resolved_promise.then(flush);
        }
    }
    function add_render_callback(fn) {
        render_callbacks.push(fn);
    }
    // flush() calls callbacks in this order:
    // 1. All beforeUpdate callbacks, in order: parents before children
    // 2. All bind:this callbacks, in reverse order: children before parents.
    // 3. All afterUpdate callbacks, in order: parents before children. EXCEPT
    //    for afterUpdates called during the initial onMount, which are called in
    //    reverse order: children before parents.
    // Since callbacks might update component values, which could trigger another
    // call to flush(), the following steps guard against this:
    // 1. During beforeUpdate, any updated components will be added to the
    //    dirty_components array and will cause a reentrant call to flush(). Because
    //    the flush index is kept outside the function, the reentrant call will pick
    //    up where the earlier call left off and go through all dirty components. The
    //    current_component value is saved and restored so that the reentrant call will
    //    not interfere with the "parent" flush() call.
    // 2. bind:this callbacks cannot trigger new flush() calls.
    // 3. During afterUpdate, any updated components will NOT have their afterUpdate
    //    callback called a second time; the seen_callbacks set, outside the flush()
    //    function, guarantees this behavior.
    const seen_callbacks = new Set();
    let flushidx = 0; // Do *not* move this inside the flush() function
    function flush() {
        // Do not reenter flush while dirty components are updated, as this can
        // result in an infinite loop. Instead, let the inner flush handle it.
        // Reentrancy is ok afterwards for bindings etc.
        if (flushidx !== 0) {
            return;
        }
        const saved_component = current_component;
        do {
            // first, call beforeUpdate functions
            // and update components
            try {
                while (flushidx < dirty_components.length) {
                    const component = dirty_components[flushidx];
                    flushidx++;
                    set_current_component(component);
                    update(component.$$);
                }
            }
            catch (e) {
                // reset dirty state to not end up in a deadlocked state and then rethrow
                dirty_components.length = 0;
                flushidx = 0;
                throw e;
            }
            set_current_component(null);
            dirty_components.length = 0;
            flushidx = 0;
            while (binding_callbacks.length)
                binding_callbacks.pop()();
            // then, once components are updated, call
            // afterUpdate functions. This may cause
            // subsequent updates...
            for (let i = 0; i < render_callbacks.length; i += 1) {
                const callback = render_callbacks[i];
                if (!seen_callbacks.has(callback)) {
                    // ...so guard against infinite loops
                    seen_callbacks.add(callback);
                    callback();
                }
            }
            render_callbacks.length = 0;
        } while (dirty_components.length);
        while (flush_callbacks.length) {
            flush_callbacks.pop()();
        }
        update_scheduled = false;
        seen_callbacks.clear();
        set_current_component(saved_component);
    }
    function update($$) {
        if ($$.fragment !== null) {
            $$.update();
            run_all($$.before_update);
            const dirty = $$.dirty;
            $$.dirty = [-1];
            $$.fragment && $$.fragment.p($$.ctx, dirty);
            $$.after_update.forEach(add_render_callback);
        }
    }
    /**
     * Useful for example to execute remaining `afterUpdate` callbacks before executing `destroy`.
     */
    function flush_render_callbacks(fns) {
        const filtered = [];
        const targets = [];
        render_callbacks.forEach((c) => fns.indexOf(c) === -1 ? filtered.push(c) : targets.push(c));
        targets.forEach((c) => c());
        render_callbacks = filtered;
    }
    const outroing = new Set();
    function transition_in(block, local) {
        if (block && block.i) {
            outroing.delete(block);
            block.i(local);
        }
    }
    function mount_component(component, target, anchor, customElement) {
        const { fragment, after_update } = component.$$;
        fragment && fragment.m(target, anchor);
        if (!customElement) {
            // onMount happens before the initial afterUpdate
            add_render_callback(() => {
                const new_on_destroy = component.$$.on_mount.map(run).filter(is_function);
                // if the component was destroyed immediately
                // it will update the `$$.on_destroy` reference to `null`.
                // the destructured on_destroy may still reference to the old array
                if (component.$$.on_destroy) {
                    component.$$.on_destroy.push(...new_on_destroy);
                }
                else {
                    // Edge case - component was destroyed immediately,
                    // most likely as a result of a binding initialising
                    run_all(new_on_destroy);
                }
                component.$$.on_mount = [];
            });
        }
        after_update.forEach(add_render_callback);
    }
    function destroy_component(component, detaching) {
        const $$ = component.$$;
        if ($$.fragment !== null) {
            flush_render_callbacks($$.after_update);
            run_all($$.on_destroy);
            $$.fragment && $$.fragment.d(detaching);
            // TODO null out other refs, including component.$$ (but need to
            // preserve final state?)
            $$.on_destroy = $$.fragment = null;
            $$.ctx = [];
        }
    }
    function make_dirty(component, i) {
        if (component.$$.dirty[0] === -1) {
            dirty_components.push(component);
            schedule_update();
            component.$$.dirty.fill(0);
        }
        component.$$.dirty[(i / 31) | 0] |= (1 << (i % 31));
    }
    function init(component, options, instance, create_fragment, not_equal, props, append_styles, dirty = [-1]) {
        const parent_component = current_component;
        set_current_component(component);
        const $$ = component.$$ = {
            fragment: null,
            ctx: [],
            // state
            props,
            update: noop,
            not_equal,
            bound: blank_object(),
            // lifecycle
            on_mount: [],
            on_destroy: [],
            on_disconnect: [],
            before_update: [],
            after_update: [],
            context: new Map(options.context || (parent_component ? parent_component.$$.context : [])),
            // everything else
            callbacks: blank_object(),
            dirty,
            skip_bound: false,
            root: options.target || parent_component.$$.root
        };
        append_styles && append_styles($$.root);
        let ready = false;
        $$.ctx = instance
            ? instance(component, options.props || {}, (i, ret, ...rest) => {
                const value = rest.length ? rest[0] : ret;
                if ($$.ctx && not_equal($$.ctx[i], $$.ctx[i] = value)) {
                    if (!$$.skip_bound && $$.bound[i])
                        $$.bound[i](value);
                    if (ready)
                        make_dirty(component, i);
                }
                return ret;
            })
            : [];
        $$.update();
        ready = true;
        run_all($$.before_update);
        // `false` as a special case of no DOM component
        $$.fragment = create_fragment ? create_fragment($$.ctx) : false;
        if (options.target) {
            if (options.hydrate) {
                const nodes = children(options.target);
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                $$.fragment && $$.fragment.l(nodes);
                nodes.forEach(detach);
            }
            else {
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                $$.fragment && $$.fragment.c();
            }
            if (options.intro)
                transition_in(component.$$.fragment);
            mount_component(component, options.target, options.anchor, options.customElement);
            flush();
        }
        set_current_component(parent_component);
    }
    /**
     * Base class for Svelte components. Used when dev=false.
     */
    class SvelteComponent {
        $destroy() {
            destroy_component(this, 1);
            this.$destroy = noop;
        }
        $on(type, callback) {
            if (!is_function(callback)) {
                return noop;
            }
            const callbacks = (this.$$.callbacks[type] || (this.$$.callbacks[type] = []));
            callbacks.push(callback);
            return () => {
                const index = callbacks.indexOf(callback);
                if (index !== -1)
                    callbacks.splice(index, 1);
            };
        }
        $set($$props) {
            if (this.$$set && !is_empty($$props)) {
                this.$$.skip_bound = true;
                this.$$set($$props);
                this.$$.skip_bound = false;
            }
        }
    }

    /* src\App.svelte generated by Svelte v3.59.2 */

    function create_fragment(ctx) {
    	let main;
    	let div0;
    	let t1;
    	let form;
    	let div3;
    	let div1;
    	let label0;
    	let t3;
    	let input0;
    	let t4;
    	let div2;
    	let t5;
    	let t6;
    	let div4;
    	let label1;
    	let input1;
    	let t7;
    	let t8;
    	let div5;
    	let label2;
    	let input2;
    	let t9;
    	let t10;
    	let div6;
    	let label3;
    	let input3;
    	let t11;
    	let t12;
    	let div7;
    	let label4;
    	let input4;
    	let t13;
    	let t14;
    	let div8;
    	let t16;
    	let div11;
    	let div9;
    	let t18;
    	let div10;
    	let t19;
    	let mounted;
    	let dispose;

    	return {
    		c() {
    			main = element("main");
    			div0 = element("div");
    			div0.innerHTML = `<h1>Password Generator</h1>`;
    			t1 = space();
    			form = element("form");
    			div3 = element("div");
    			div1 = element("div");
    			label0 = element("label");
    			label0.textContent = "Password Length";
    			t3 = space();
    			input0 = element("input");
    			t4 = space();
    			div2 = element("div");
    			t5 = text(/*passwordLength*/ ctx[0]);
    			t6 = space();
    			div4 = element("div");
    			label1 = element("label");
    			input1 = element("input");
    			t7 = text("\n\t\t\t\tInclude Uppercase Letters");
    			t8 = space();
    			div5 = element("div");
    			label2 = element("label");
    			input2 = element("input");
    			t9 = text("\n\t\t\t\tInclude Lowercase Letters");
    			t10 = space();
    			div6 = element("div");
    			label3 = element("label");
    			input3 = element("input");
    			t11 = text("\n\t\t\t\tInclude Numbers");
    			t12 = space();
    			div7 = element("div");
    			label4 = element("label");
    			input4 = element("input");
    			t13 = text("\n\t\t\t\tInclude Symbols");
    			t14 = space();
    			div8 = element("div");
    			div8.innerHTML = `<button type="submit">Generate Password</button>`;
    			t16 = space();
    			div11 = element("div");
    			div9 = element("div");
    			div9.innerHTML = `<h2>Your Password</h2>`;
    			t18 = space();
    			div10 = element("div");
    			t19 = text(/*password*/ ctx[5]);
    			attr(div0, "class", "row");
    			attr(input0, "type", "range");
    			attr(input0, "class", "u-full-width");
    			attr(input0, "min", "8");
    			attr(input0, "max", "20");
    			attr(div1, "class", "columns six");
    			attr(div2, "class", "columns six outputs svelte-1msidwf");
    			attr(div3, "class", "row");
    			attr(input1, "type", "checkbox");
    			attr(div4, "class", "row");
    			attr(input2, "type", "checkbox");
    			attr(div5, "class", "row");
    			attr(input3, "type", "checkbox");
    			attr(div6, "class", "row");
    			attr(input4, "type", "checkbox");
    			attr(div7, "class", "row");
    			attr(div8, "class", "row");
    			attr(div9, "class", "columns six");
    			attr(div10, "class", "columns six outputs svelte-1msidwf");
    			attr(div11, "class", "row");
    			attr(main, "class", "container");
    		},
    		m(target, anchor) {
    			insert(target, main, anchor);
    			append(main, div0);
    			append(main, t1);
    			append(main, form);
    			append(form, div3);
    			append(div3, div1);
    			append(div1, label0);
    			append(div1, t3);
    			append(div1, input0);
    			set_input_value(input0, /*passwordLength*/ ctx[0]);
    			append(div3, t4);
    			append(div3, div2);
    			append(div2, t5);
    			append(form, t6);
    			append(form, div4);
    			append(div4, label1);
    			append(label1, input1);
    			set_input_value(input1, /*includeUppercase*/ ctx[2]);
    			append(label1, t7);
    			append(form, t8);
    			append(form, div5);
    			append(div5, label2);
    			append(label2, input2);
    			set_input_value(input2, /*includeLowercase*/ ctx[1]);
    			append(label2, t9);
    			append(form, t10);
    			append(form, div6);
    			append(div6, label3);
    			append(label3, input3);
    			set_input_value(input3, /*includeNumbers*/ ctx[4]);
    			append(label3, t11);
    			append(form, t12);
    			append(form, div7);
    			append(div7, label4);
    			append(label4, input4);
    			set_input_value(input4, /*includeSymbols*/ ctx[3]);
    			append(label4, t13);
    			append(form, t14);
    			append(form, div8);
    			append(main, t16);
    			append(main, div11);
    			append(div11, div9);
    			append(div11, t18);
    			append(div11, div10);
    			append(div10, t19);

    			if (!mounted) {
    				dispose = [
    					listen(input0, "change", /*input0_change_input_handler*/ ctx[7]),
    					listen(input0, "input", /*input0_change_input_handler*/ ctx[7]),
    					listen(input1, "change", /*input1_change_handler*/ ctx[8]),
    					listen(input2, "change", /*input2_change_handler*/ ctx[9]),
    					listen(input3, "change", /*input3_change_handler*/ ctx[10]),
    					listen(input4, "change", /*input4_change_handler*/ ctx[11]),
    					listen(form, "submit", prevent_default(/*generatePassword*/ ctx[6]))
    				];

    				mounted = true;
    			}
    		},
    		p(ctx, [dirty]) {
    			if (dirty & /*passwordLength*/ 1) {
    				set_input_value(input0, /*passwordLength*/ ctx[0]);
    			}

    			if (dirty & /*passwordLength*/ 1) set_data(t5, /*passwordLength*/ ctx[0]);

    			if (dirty & /*includeUppercase*/ 4) {
    				set_input_value(input1, /*includeUppercase*/ ctx[2]);
    			}

    			if (dirty & /*includeLowercase*/ 2) {
    				set_input_value(input2, /*includeLowercase*/ ctx[1]);
    			}

    			if (dirty & /*includeNumbers*/ 16) {
    				set_input_value(input3, /*includeNumbers*/ ctx[4]);
    			}

    			if (dirty & /*includeSymbols*/ 8) {
    				set_input_value(input4, /*includeSymbols*/ ctx[3]);
    			}

    			if (dirty & /*password*/ 32) set_data(t19, /*password*/ ctx[5]);
    		},
    		i: noop,
    		o: noop,
    		d(detaching) {
    			if (detaching) detach(main);
    			mounted = false;
    			run_all(dispose);
    		}
    	};
    }

    function instance($$self, $$props, $$invalidate) {
    	let passwordLength = 16;
    	let includeLowercase = true;
    	let includeUppercase = true;
    	let includeSymbols = false;
    	let includeNumbers = true;
    	let password = "";

    	const generatePassword = () => {
    		const upperCaseChars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    		const lowerCaseChars = "abcdefghijklmnopqrstuvwxyz";
    		const numberChars = "0123456789";
    		const symbolChars = "!@#$%^&*()-_=+[]{}|;:',.<>?/";
    		let charPool = "";
    		if (includeLowercase) charPool += lowerCaseChars;
    		if (includeUppercase) charPool += upperCaseChars;
    		if (includeNumbers) charPool += numberChars;
    		if (includeSymbols) charPool += symbolChars;

    		if (charPool.length === 0) {
    			$$invalidate(5, password = "Please select at least one option");
    			return;
    		}

    		$$invalidate(5, password = Array.from({ length: passwordLength }, () => charPool[Math.floor(Math.random() * charPool.length)]).join(""));
    	};

    	function input0_change_input_handler() {
    		passwordLength = to_number(this.value);
    		$$invalidate(0, passwordLength);
    	}

    	function input1_change_handler() {
    		includeUppercase = this.value;
    		$$invalidate(2, includeUppercase);
    	}

    	function input2_change_handler() {
    		includeLowercase = this.value;
    		$$invalidate(1, includeLowercase);
    	}

    	function input3_change_handler() {
    		includeNumbers = this.value;
    		$$invalidate(4, includeNumbers);
    	}

    	function input4_change_handler() {
    		includeSymbols = this.value;
    		$$invalidate(3, includeSymbols);
    	}

    	return [
    		passwordLength,
    		includeLowercase,
    		includeUppercase,
    		includeSymbols,
    		includeNumbers,
    		password,
    		generatePassword,
    		input0_change_input_handler,
    		input1_change_handler,
    		input2_change_handler,
    		input3_change_handler,
    		input4_change_handler
    	];
    }

    class App extends SvelteComponent {
    	constructor(options) {
    		super();
    		init(this, options, instance, create_fragment, safe_not_equal, {});
    	}
    }

    const app = new App({
    	target: document.body,

    });

    return app;

})();
//# sourceMappingURL=bundle.js.map
