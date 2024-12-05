
(function(l, r) { if (!l || l.getElementById('livereloadscript')) return; r = l.createElement('script'); r.async = 1; r.src = '//' + (self.location.host || 'localhost').split(':')[0] + ':35729/livereload.js?snipver=1'; r.id = 'livereloadscript'; l.getElementsByTagName('head')[0].appendChild(r) })(self.document);
var app = (function () {
    'use strict';

    function noop() { }
    function add_location(element, file, line, column, char) {
        element.__svelte_meta = {
            loc: { file, line, column, char }
        };
    }
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
    function set_input_value(input, value) {
        input.value = value == null ? '' : value;
    }
    function custom_event(type, detail, { bubbles = false, cancelable = false } = {}) {
        const e = document.createEvent('CustomEvent');
        e.initCustomEvent(type, bubbles, cancelable, detail);
        return e;
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

    function dispatch_dev(type, detail) {
        document.dispatchEvent(custom_event(type, Object.assign({ version: '3.59.2' }, detail), { bubbles: true }));
    }
    function append_dev(target, node) {
        dispatch_dev('SvelteDOMInsert', { target, node });
        append(target, node);
    }
    function insert_dev(target, node, anchor) {
        dispatch_dev('SvelteDOMInsert', { target, node, anchor });
        insert(target, node, anchor);
    }
    function detach_dev(node) {
        dispatch_dev('SvelteDOMRemove', { node });
        detach(node);
    }
    function listen_dev(node, event, handler, options, has_prevent_default, has_stop_propagation, has_stop_immediate_propagation) {
        const modifiers = options === true ? ['capture'] : options ? Array.from(Object.keys(options)) : [];
        if (has_prevent_default)
            modifiers.push('preventDefault');
        if (has_stop_propagation)
            modifiers.push('stopPropagation');
        if (has_stop_immediate_propagation)
            modifiers.push('stopImmediatePropagation');
        dispatch_dev('SvelteDOMAddEventListener', { node, event, handler, modifiers });
        const dispose = listen(node, event, handler, options);
        return () => {
            dispatch_dev('SvelteDOMRemoveEventListener', { node, event, handler, modifiers });
            dispose();
        };
    }
    function attr_dev(node, attribute, value) {
        attr(node, attribute, value);
        if (value == null)
            dispatch_dev('SvelteDOMRemoveAttribute', { node, attribute });
        else
            dispatch_dev('SvelteDOMSetAttribute', { node, attribute, value });
    }
    function set_data_dev(text, data) {
        data = '' + data;
        if (text.data === data)
            return;
        dispatch_dev('SvelteDOMSetData', { node: text, data });
        text.data = data;
    }
    function validate_slots(name, slot, keys) {
        for (const slot_key of Object.keys(slot)) {
            if (!~keys.indexOf(slot_key)) {
                console.warn(`<${name}> received an unexpected slot "${slot_key}".`);
            }
        }
    }
    /**
     * Base class for Svelte components with some minor dev-enhancements. Used when dev=true.
     */
    class SvelteComponentDev extends SvelteComponent {
        constructor(options) {
            if (!options || (!options.target && !options.$$inline)) {
                throw new Error("'target' is a required option");
            }
            super();
        }
        $destroy() {
            super.$destroy();
            this.$destroy = () => {
                console.warn('Component was already destroyed'); // eslint-disable-line no-console
            };
        }
        $capture_state() { }
        $inject_state() { }
    }

    /* src\App.svelte generated by Svelte v3.59.2 */

    const file = "src\\App.svelte";

    function create_fragment(ctx) {
    	let main;
    	let div0;
    	let h1;
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
    	let button;
    	let t16;
    	let div11;
    	let div9;
    	let h2;
    	let t18;
    	let div10;
    	let t19;
    	let mounted;
    	let dispose;

    	const block = {
    		c: function create() {
    			main = element("main");
    			div0 = element("div");
    			h1 = element("h1");
    			h1.textContent = "Password Generator";
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
    			button = element("button");
    			button.textContent = "Generate Password";
    			t16 = space();
    			div11 = element("div");
    			div9 = element("div");
    			h2 = element("h2");
    			h2.textContent = "Your Password";
    			t18 = space();
    			div10 = element("div");
    			t19 = text(/*password*/ ctx[5]);
    			add_location(h1, file, 41, 2, 1014);
    			attr_dev(div0, "class", "row");
    			add_location(div0, file, 40, 1, 994);
    			add_location(label0, file, 46, 4, 1155);
    			attr_dev(input0, "type", "range");
    			attr_dev(input0, "class", "u-full-width");
    			attr_dev(input0, "min", "8");
    			attr_dev(input0, "max", "20");
    			add_location(input0, file, 47, 4, 1190);
    			attr_dev(div1, "class", "columns six");
    			add_location(div1, file, 45, 3, 1125);
    			attr_dev(div2, "class", "columns six outputs svelte-1msidwf");
    			add_location(div2, file, 49, 3, 1290);
    			attr_dev(div3, "class", "row");
    			add_location(div3, file, 44, 2, 1104);
    			attr_dev(input1, "type", "checkbox");
    			add_location(input1, file, 55, 4, 1399);
    			add_location(label1, file, 54, 3, 1387);
    			attr_dev(div4, "class", "row");
    			add_location(div4, file, 53, 2, 1366);
    			attr_dev(input2, "type", "checkbox");
    			add_location(input2, file, 61, 4, 1541);
    			add_location(label2, file, 60, 3, 1529);
    			attr_dev(div5, "class", "row");
    			add_location(div5, file, 59, 2, 1508);
    			attr_dev(input3, "type", "checkbox");
    			add_location(input3, file, 67, 4, 1683);
    			add_location(label3, file, 66, 3, 1671);
    			attr_dev(div6, "class", "row");
    			add_location(div6, file, 65, 2, 1650);
    			attr_dev(input4, "type", "checkbox");
    			add_location(input4, file, 73, 4, 1813);
    			add_location(label4, file, 72, 3, 1801);
    			attr_dev(div7, "class", "row");
    			add_location(div7, file, 71, 2, 1780);
    			attr_dev(button, "type", "submit");
    			add_location(button, file, 78, 3, 1931);
    			attr_dev(div8, "class", "row");
    			add_location(div8, file, 77, 2, 1910);
    			add_location(form, file, 43, 1, 1051);
    			add_location(h2, file, 83, 3, 2048);
    			attr_dev(div9, "class", "columns six");
    			add_location(div9, file, 82, 2, 2019);
    			attr_dev(div10, "class", "columns six outputs svelte-1msidwf");
    			add_location(div10, file, 85, 2, 2083);
    			attr_dev(div11, "class", "row");
    			add_location(div11, file, 81, 1, 1999);
    			attr_dev(main, "class", "container");
    			add_location(main, file, 39, 0, 968);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, main, anchor);
    			append_dev(main, div0);
    			append_dev(div0, h1);
    			append_dev(main, t1);
    			append_dev(main, form);
    			append_dev(form, div3);
    			append_dev(div3, div1);
    			append_dev(div1, label0);
    			append_dev(div1, t3);
    			append_dev(div1, input0);
    			set_input_value(input0, /*passwordLength*/ ctx[0]);
    			append_dev(div3, t4);
    			append_dev(div3, div2);
    			append_dev(div2, t5);
    			append_dev(form, t6);
    			append_dev(form, div4);
    			append_dev(div4, label1);
    			append_dev(label1, input1);
    			input1.checked = /*includeUppercase*/ ctx[2];
    			append_dev(label1, t7);
    			append_dev(form, t8);
    			append_dev(form, div5);
    			append_dev(div5, label2);
    			append_dev(label2, input2);
    			input2.checked = /*includeLowercase*/ ctx[1];
    			append_dev(label2, t9);
    			append_dev(form, t10);
    			append_dev(form, div6);
    			append_dev(div6, label3);
    			append_dev(label3, input3);
    			input3.checked = /*includeNumbers*/ ctx[4];
    			append_dev(label3, t11);
    			append_dev(form, t12);
    			append_dev(form, div7);
    			append_dev(div7, label4);
    			append_dev(label4, input4);
    			input4.checked = /*includeSymbols*/ ctx[3];
    			append_dev(label4, t13);
    			append_dev(form, t14);
    			append_dev(form, div8);
    			append_dev(div8, button);
    			append_dev(main, t16);
    			append_dev(main, div11);
    			append_dev(div11, div9);
    			append_dev(div9, h2);
    			append_dev(div11, t18);
    			append_dev(div11, div10);
    			append_dev(div10, t19);

    			if (!mounted) {
    				dispose = [
    					listen_dev(input0, "change", /*input0_change_input_handler*/ ctx[7]),
    					listen_dev(input0, "input", /*input0_change_input_handler*/ ctx[7]),
    					listen_dev(input1, "change", /*input1_change_handler*/ ctx[8]),
    					listen_dev(input2, "change", /*input2_change_handler*/ ctx[9]),
    					listen_dev(input3, "change", /*input3_change_handler*/ ctx[10]),
    					listen_dev(input4, "change", /*input4_change_handler*/ ctx[11]),
    					listen_dev(form, "submit", prevent_default(/*generatePassword*/ ctx[6]), false, true, false, false)
    				];

    				mounted = true;
    			}
    		},
    		p: function update(ctx, [dirty]) {
    			if (dirty & /*passwordLength*/ 1) {
    				set_input_value(input0, /*passwordLength*/ ctx[0]);
    			}

    			if (dirty & /*passwordLength*/ 1) set_data_dev(t5, /*passwordLength*/ ctx[0]);

    			if (dirty & /*includeUppercase*/ 4) {
    				input1.checked = /*includeUppercase*/ ctx[2];
    			}

    			if (dirty & /*includeLowercase*/ 2) {
    				input2.checked = /*includeLowercase*/ ctx[1];
    			}

    			if (dirty & /*includeNumbers*/ 16) {
    				input3.checked = /*includeNumbers*/ ctx[4];
    			}

    			if (dirty & /*includeSymbols*/ 8) {
    				input4.checked = /*includeSymbols*/ ctx[3];
    			}

    			if (dirty & /*password*/ 32) set_data_dev(t19, /*password*/ ctx[5]);
    		},
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(main);
    			mounted = false;
    			run_all(dispose);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('App', slots, []);
    	let passwordLength = 16;
    	let includeLowercase = false;
    	let includeUppercase = true;
    	let includeSymbols = false;
    	let includeNumbers = false;
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

    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<App> was created with unknown prop '${key}'`);
    	});

    	function input0_change_input_handler() {
    		passwordLength = to_number(this.value);
    		$$invalidate(0, passwordLength);
    	}

    	function input1_change_handler() {
    		includeUppercase = this.checked;
    		$$invalidate(2, includeUppercase);
    	}

    	function input2_change_handler() {
    		includeLowercase = this.checked;
    		$$invalidate(1, includeLowercase);
    	}

    	function input3_change_handler() {
    		includeNumbers = this.checked;
    		$$invalidate(4, includeNumbers);
    	}

    	function input4_change_handler() {
    		includeSymbols = this.checked;
    		$$invalidate(3, includeSymbols);
    	}

    	$$self.$capture_state = () => ({
    		passwordLength,
    		includeLowercase,
    		includeUppercase,
    		includeSymbols,
    		includeNumbers,
    		password,
    		generatePassword
    	});

    	$$self.$inject_state = $$props => {
    		if ('passwordLength' in $$props) $$invalidate(0, passwordLength = $$props.passwordLength);
    		if ('includeLowercase' in $$props) $$invalidate(1, includeLowercase = $$props.includeLowercase);
    		if ('includeUppercase' in $$props) $$invalidate(2, includeUppercase = $$props.includeUppercase);
    		if ('includeSymbols' in $$props) $$invalidate(3, includeSymbols = $$props.includeSymbols);
    		if ('includeNumbers' in $$props) $$invalidate(4, includeNumbers = $$props.includeNumbers);
    		if ('password' in $$props) $$invalidate(5, password = $$props.password);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
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

    class App extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance, create_fragment, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "App",
    			options,
    			id: create_fragment.name
    		});
    	}
    }

    const app = new App({
    	target: document.body,

    });

    return app;

})();
//# sourceMappingURL=bundle.js.map
