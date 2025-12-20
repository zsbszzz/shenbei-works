(function () {
    const STATE_KEY = 'portfolioState';
    const saved = performance.getEntriesByType('navigation')[0]?.type === 'back_forward' 
        ? JSON.parse(sessionStorage.getItem(STATE_KEY) || 'null') : null;

    document.querySelectorAll('.orbit-group').forEach((group, g) => {
        group.querySelectorAll('img:not(:first-child)').forEach((img, i) => {
            img.style.transform = saved?.groupTransforms?.[g]?.[i] || 
                `translate(calc(-50% + ${(Math.random() - 0.5) * 16}px), calc(-50% + ${4 + Math.random() * 8}px)) rotate(${(Math.random() - 0.5) * 20}deg)`;
            img.style.zIndex = 99 - i;
        });
    });

    const hero = document.querySelector('.hero');
    const images = document.querySelectorAll('.orbit-image');

    if (!saved) {
        sessionStorage.removeItem(STATE_KEY);
        history.scrollRestoration = 'manual';
        scrollTo(0, 0);
    }

    const C = {
        dropScale: 1.4, floatAmp: 15, typeSpeed: 80, backSpeed: 40, typePause: 1500, baseZ: 200,
        catMap: { graphic: 1, illustration: 2, spatial: 3, photography: 4, experimental: 5 },
        catNames: ['Graphic<br>Design', 'Illustration', 'Spatial<br>Product', 'Photography', 'Experimental & Fun']
    };

    let level = 0, orbitActive = true, topZ = C.baseZ, navMode = false;
    let radiusX, radiusY;

    const states = [...images].map((img, i) => ({
        el: img, angle: i / images.length * Math.PI * 2, target: C.catMap[img.dataset.category] || 5,
        level: 0, dropping: false, bounds: {},
        float: { amp: C.floatAmp, speed: 0.0008 + Math.random() * 0.0004, phase: Math.random() * Math.PI * 2 }
    }));

    const titles = {};
    document.querySelectorAll('.side-title').forEach(el => {
        const lv = el.closest('.category-page')?.id.replace('section-', '');
        if (lv) titles[lv] = { el, started: false, stopped: false };
    });

    const nav = document.createElement('nav');
    nav.className = 'nav-sidebar';
    C.catNames.forEach((_, i) => {
        const a = document.createElement('a');
        a.className = 'nav-item';
        a.onclick = () => scrollTo({ top: sec(i + 1).offsetTop, behavior: 'smooth' });
        nav.appendChild(a);
    });
    document.body.appendChild(nav);

    const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
    const sec = n => document.getElementById(`section-${n}`);
    const parseChars = s => s.split(/(<br\s*\/?>|&\w+;)/gi).flatMap(p => /^<br|^&/i.test(p) ? [p] : [...p]);
    const backspace = h => h.replace(/(&\w+;|<br\s*\/?>|.)$/, '');
    const getFloat = (s, t) => `translateY(${Math.sin(t * s.float.speed + s.float.phase) * s.float.amp}px) scale(${C.dropScale})`;

    const getCats = lv => [...new Set(states.filter(s => s.level == lv).map(s => C.catMap[s.el.dataset.category]))]
        .map(c => C.catNames[c - 1]).filter(Boolean);

    const calcBounds = (lv, w, h) => {
        const s = sec(lv);
        return s ? { top: s.offsetTop + 100, bottom: s.offsetTop + s.offsetHeight - 65 - h, left: 30, right: innerWidth - 30 - w } : null;
    };

    const getGroupTransforms = () => [...document.querySelectorAll('.orbit-group')].map(g => 
        [...g.querySelectorAll('img:not(:first-child)')].map(img => img.style.transform));

    function updateLayout() {
        radiusX = Math.min(innerWidth * 0.4, 550);
        radiusY = Math.min(innerHeight * 0.22, 200);
        states.forEach(s => {
            if (s.level > 0 && !s.dropping) {
                s.bounds = calcBounds(s.level, s.el.offsetWidth, s.el.offsetHeight) || s.bounds;
                s.el.style.left = clamp(parseFloat(s.el.style.left) || 0, s.bounds.left, s.bounds.right) + 'px';
                s.el.style.top = clamp(parseFloat(s.el.style.top) || 0, s.bounds.top, s.bounds.bottom) + 'px';
            }
        });
    }

    function updateNav() {
        if (!navMode) return;
        const mid = scrollY + innerHeight / 2;
        let cur = sec(1)?.offsetTop <= mid ? 1 : 0;
        for (let i = 2; i <= 5 && cur; i++) if (sec(i)?.offsetTop <= mid) cur = i;
        nav.querySelectorAll('.nav-item').forEach((el, i) => el.classList.toggle('current', i + 1 === cur));
    }

    function activateNav() {
        if (navMode) return;
        navMode = true;
        let active = null;
        Object.values(titles).forEach(t => { t.stopped = true; if (t.el.innerHTML) active = t.el; });

        (function del() {
            if (active?.innerHTML) { active.innerHTML = backspace(active.innerHTML); setTimeout(del, C.backSpeed); }
            else { Object.values(titles).forEach(t => t.el.style.display = 'none'); nav.classList.add('active'); typeNav(0); }
        })();
    }

    function typeNav(idx) {
        if (idx >= C.catNames.length) return updateNav();
        const item = nav.children[idx], chars = parseChars(C.catNames[idx]);
        let i = 0;
        item.classList.add('typing');
        (function type() {
            if (i < chars.length) { item.innerHTML += chars[i++]; setTimeout(type, C.typeSpeed); }
            else { item.classList.remove('typing'); setTimeout(() => typeNav(idx + 1), 150); }
        })();
    }

    function checkScroll() {
        for (let lv = level + 1; lv <= 5; lv++) {
            const s = sec(lv);
            if (s && scrollY > s.offsetTop - innerHeight * 0.4) cascade(lv);
            else break;
        }
        if (!navMode) {
            Object.keys(titles).forEach(lv => { if (!titles[lv].started && scrollY >= sec(lv)?.offsetTop) typeLoop(lv); });
            if (level >= 5 && scrollY >= sec(5).offsetTop) activateNav();
        } else updateNav();
    }

    window.addEventListener('resize', updateLayout);
    window.addEventListener('scroll', checkScroll);
    document.addEventListener('visibilitychange', () => !document.hidden && (updateLayout(), checkScroll()));

    images.forEach(img => {
        img.style.cursor = 'pointer';
        img.onclick = () => {
            if (img.dataset.dragging === 'true' || !img.dataset.link) return;
            sessionStorage.setItem(STATE_KEY, JSON.stringify({
                scrollY, level, orbitActive, navMode, groupTransforms: getGroupTransforms(),
                states: states.map(s => ({ angle: s.angle, level: s.level, float: s.float, left: s.el.style.left, top: s.el.style.top, z: s.el.style.zIndex }))
            }));
            location.href = `works/${img.dataset.link}.html`;
        };
    });

    function orbit() {
        if (!orbitActive) return;
        const cx = hero.clientWidth / 2, cy = hero.clientHeight / 2, cos = Math.cos(-0.209), sin = Math.sin(-0.209);

        states.forEach(s => {
            if (s.level === 0 && !s.dropping) {
                s.angle += 0.002;
                const x = Math.cos(s.angle) * radiusX, y = Math.sin(s.angle) * radiusY, z = Math.sin(s.angle), scale = 0.85 + (z + 1) * 0.15;
                s.el.style.left = (cx + x * cos - y * sin - s.el.offsetWidth * scale / 2) + 'px';
                s.el.style.top = (cy + x * sin + y * cos - s.el.offsetHeight * scale / 2) + 'px';
                s.el.style.transform = `scale(${scale})`;
                s.el.style.opacity = 0.9 + (clamp(z + 0.3, -1, 1) + 1) * 0.05;
                s.el.style.zIndex = z < 0 ? ~~((z + 1) * 99) + 1 : ~~(z * 99) + 101;
            }
        });
        requestAnimationFrame(orbit);
    }

    function cascade(newLv) {
        if (newLv <= level) return;
        level = newLv;
        if (newLv === 1) orbitActive = false;

        states.forEach(s => {
            if (s.target >= newLv && s.level < newLv) {
                s.dropping = true; s.level = newLv; s.el.style.animation = 'none';
                s.bounds = calcBounds(newLv, s.el.offsetWidth, s.el.offsetHeight);
                fall(s, clamp(parseFloat(s.el.style.left) || 0, s.bounds.left, s.bounds.right),
                    s.bounds.top + Math.random() * (s.bounds.bottom - s.bounds.top));
            }
        });
    }

    function fall(s, endL, endT) {
        const el = s.el, start = performance.now();
        const startL = parseFloat(el.style.left), startT = parseFloat(el.style.top);
        const startScale = new DOMMatrix(getComputedStyle(el).transform).a || 1;
        el.style.filter = 'drop-shadow(0 10px 20px rgba(0,0,0,0.15))';
        el.style.zIndex = ++topZ;

        (function loop(now) {
            const t = Math.min((now - start) / 1200, 1), p = 1 - (1 - t) ** 3;
            el.style.left = (startL + (endL - startL) * p) + 'px';
            el.style.top = (startT + (endT - startT) * p) + 'px';
            el.style.transform = `translateY(${Math.sin((now - start) * s.float.speed + s.float.phase) * s.float.amp}px) scale(${startScale + (C.dropScale - startScale) * p})`;
            el.style.opacity = 1;
            t < 1 ? requestAnimationFrame(loop) : (s.dropping = false, enableDrag(s, start));
        })(start);
    }

    function enableDrag(s, t0 = performance.now()) {
        const el = s.el;
        let dragging = false, drag = {}, raf;

        const float = () => { if (!dragging) { el.style.transform = getFloat(s, performance.now() - t0); raf = requestAnimationFrame(float); } };
        float(); el.style.cursor = 'grab';

        el.onmousedown = e => {
            cancelAnimationFrame(raf);
            Object.assign(el.style, { cursor: 'grabbing', transform: `scale(${C.dropScale})`, zIndex: ++topZ });
            drag = { x: e.clientX, y: e.clientY, l: parseFloat(el.style.left), t: parseFloat(el.style.top) };
            e.preventDefault();
        };

        document.addEventListener('mousemove', e => {
            if (!drag.x) return;
            const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
            if (!dragging && (Math.abs(dx) > 5 || Math.abs(dy) > 5)) { dragging = true; el.dataset.dragging = 'true'; }
            if (dragging) {
                el.style.left = clamp(drag.l + dx, s.bounds.left, s.bounds.right) + 'px';
                el.style.top = clamp(drag.t + dy, s.bounds.top, s.bounds.bottom) + 'px';
            }
        });

        document.addEventListener('mouseup', () => {
            if (!drag.x) return;
            dragging = false; setTimeout(() => el.dataset.dragging = 'false', 50);
            drag = {}; el.style.cursor = 'grab'; float();
        });
    }

    function titleFloat() {
        const el = document.querySelector('.center-title');
        if (!el) return;
        const start = performance.now();
        (function loop() {
            const t = performance.now() - start;
            el.style.transform = `translate(calc(-50% + ${Math.sin(t * 0.001) * 5}px), calc(-50% + ${Math.cos(t * 0.0008) * 5}px))`;
            requestAnimationFrame(loop);
        })();
    }

    function typeLoop(lv) {
        const t = titles[lv];
        if (!t || t.started) return;
        t.started = true; t.el.classList.add('typing');
        let idx = 0;

        (function cycle() {
            if (t.stopped) return;
            const texts = getCats(lv);
            if (!texts.length) return setTimeout(cycle, 500);
            const chars = parseChars(texts[idx++ % texts.length]);
            let i = 0;
            (function type() {
                if (t.stopped) return;
                i < chars.length ? (t.el.innerHTML += chars[i++], setTimeout(type, C.typeSpeed)) : setTimeout(del, C.typePause);
            })();
            function del() {
                if (t.stopped) return;
                t.el.innerHTML ? (t.el.innerHTML = backspace(t.el.innerHTML), setTimeout(del, C.backSpeed)) : setTimeout(cycle, 300);
            }
        })();
    }

    function restore(p) {
        level = p.level || 0; orbitActive = p.orbitActive; topZ = C.baseZ + p.states.length;

        p.states.forEach((d, i) => {
            if (!states[i]) return;
            const s = states[i];
            Object.assign(s, { angle: d.angle, level: d.level, float: d.float });
            Object.assign(s.el.style, { left: d.left, top: d.top, zIndex: d.z, animation: 'none', opacity: 1,
                filter: 'drop-shadow(0 10px 20px rgba(0,0,0,0.15))', transform: `scale(${C.dropScale})` });
            if (d.level > 0) enableDrag(s);
        });

        if (p.navMode) {
            navMode = true;
            Object.values(titles).forEach(t => { t.stopped = true; t.el.style.display = 'none'; });
            nav.classList.add('active');
            C.catNames.forEach((n, i) => nav.children[i].innerHTML = n);
            updateNav();
        }
        updateLayout(); scrollTo(0, p.scrollY);
        requestAnimationFrame(() => document.documentElement.classList.remove('is-restoring'));
    }

    saved ? (restore(saved), sessionStorage.removeItem(STATE_KEY)) : document.documentElement.classList.remove('is-restoring');
    updateLayout(); titleFloat(); requestAnimationFrame(orbit);
})();