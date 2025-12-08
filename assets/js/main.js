(function () {
    const hero = document.querySelector('.hero');
    const images = document.querySelectorAll('.orbit-image');
    const STATE_KEY = 'portfolioState';
    const isBackForward = performance.getEntriesByType('navigation')[0]?.type === 'back_forward';
    const savedState = isBackForward ? sessionStorage.getItem(STATE_KEY) : null;

    if (!savedState) {
        sessionStorage.removeItem(STATE_KEY);
        history.scrollRestoration = 'manual';
        scrollTo(0, 0);
    }

    // 配置参数
    const CONFIG = {
        radiusX: Math.min(innerWidth * 0.4, 550),          // 轨道水平半径
        radiusY: Math.min(innerHeight * 0.22, 200),        // 轨道垂直半径
        tiltAngle: -12 * Math.PI / 180,                    // 轨道倾斜角度
        orbitSpeed: 0.002,                                 // 轨道旋转速度
        dropDuration: 1200,                                // 下落动画时长(ms)
        dropScale: 1.4,                                    // 下落后缩放比例
        orbitScaleRange: [0.85, 1.15],                     // 轨道缩放范围[最小, 最大]
        orbitOpacityRange: [0.9, 1.0],                     // 轨道透明度范围[最小, 最大]
        opacityZOffset: 0.3,                               // 透明度Z轴偏移
        maxFloatAmp: 15,                                   // 浮动振幅(px)
        floatSpeedBase: 0.0008,                            // 浮动基础速度
        floatSpeedRandom: 0.0004,                          // 浮动速度随机范围
        sideMargin: 30,                                    // 左右边距(px)
        topMargin: 100,                                    // 顶部安全距离(px)
        bottomMargin: 50,                                  // 底部安全距离(px)
        dragThreshold: 5,                                  // 触发拖拽的最小移动距离(px)
        scrollTriggerOffset: 0.4,                          // 滚动触发偏移(相对视口高度)
        titleFloatAmp: 5,                                  // 标题浮动振幅(px)
        titleFloatSpeed: [0.001, 0.0008],                  // 标题浮动速度[X, Y]
        typeSpeed: 80,                                     // 打字速度(ms/字符)
        backSpeed: 40,                                     // 退格速度(ms/字符)
        typePause: 1500,                                   // 打字后停留时间(ms)
        baseZIndex: 200,                                   // 图片基础z-index
        categoryMap: { graphic: 1, illustration: 2, spatial: 3, photography: 4, experimental: 5 },
        categoryNames: ['Graphic<br>Design', 'Illustration', 'Spatial<br>Product', 'Photography', 'Experimental & Fun']
    };

    // 状态变量
    let currentLevel = 0;
    let animationActive = true;
    let topZIndex = CONFIG.baseZIndex;
    let navMode = false;

    const imageStates = [...images].map((img, i) => ({
        element: img,
        angle: (i / images.length) * Math.PI * 2,
        targetLevel: CONFIG.categoryMap[img.dataset.category] || 5,
        currentLevel: 0,
        isDropping: false,
        bounds: {},
        floatParams: {
            amp: CONFIG.maxFloatAmp,
            speed: CONFIG.floatSpeedBase + Math.random() * CONFIG.floatSpeedRandom,
            phase: Math.random() * Math.PI * 2
        }
    }));

    const sideTitles = {};
    document.querySelectorAll('.side-title').forEach(el => {
        const level = el.closest('.category-page')?.id.replace('section-', '');
        if (level) sideTitles[level] = { el, started: false, stopped: false };
    });

    // 导航栏
    const navSidebar = document.createElement('nav');
    navSidebar.className = 'nav-sidebar';
    CONFIG.categoryNames.forEach((_, i) => {
        const item = document.createElement('a');
        item.className = 'nav-item';
        item.onclick = () => scrollTo({ top: getSection(i + 1).offsetTop, behavior: 'smooth' });
        navSidebar.appendChild(item);
    });
    document.body.appendChild(navSidebar);

    // 工具函数
    const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
    const getSection = level => document.getElementById(`section-${level}`);
    const parseChars = str => str.split(/(<br\s*\/?>|&\w+;)/gi).flatMap(p => /^<br|^&/i.test(p) ? [p] : [...p]);
    const backspaceChar = h => h.replace(/(&\w+;|<br\s*\/?>|.)$/, '');

    const getActiveCats = level => [...new Set(
        imageStates.filter(s => s.currentLevel == level).map(s => CONFIG.categoryMap[s.element.dataset.category])
    )].map(c => CONFIG.categoryNames[c - 1]).filter(Boolean);

    const calcBounds = (level, w, h) => {
        const sec = getSection(level);
        return sec ? {
            top: sec.offsetTop + CONFIG.topMargin,
            bottom: sec.offsetTop + sec.offsetHeight - CONFIG.bottomMargin - CONFIG.maxFloatAmp - h,
            left: CONFIG.sideMargin,
            right: innerWidth - CONFIG.sideMargin - w
        } : null;
    };

    // 布局更新
    function updateLayout() {
        CONFIG.radiusX = Math.min(innerWidth * 0.4, 550);
        CONFIG.radiusY = Math.min(innerHeight * 0.22, 200);

        imageStates.forEach(s => {
            if (s.currentLevel > 0 && !s.isDropping) {
                s.bounds = calcBounds(s.currentLevel, s.element.offsetWidth, s.element.offsetHeight) || s.bounds;
                s.element.style.left = clamp(parseFloat(s.element.style.left) || 0, s.bounds.left, s.bounds.right) + 'px';
                s.element.style.top = clamp(parseFloat(s.element.style.top) || 0, s.bounds.top, s.bounds.bottom) + 'px';
            }
        });
    }

    // 导航功能
    function updateNavHighlight() {
        if (!navMode) return;
        const mid = scrollY + innerHeight / 2;
        let current = getSection(1)?.offsetTop <= mid ? 1 : 0;
        for (let i = 2; i <= 5 && current; i++) {
            if (getSection(i)?.offsetTop <= mid) current = i;
        }
        navSidebar.querySelectorAll('.nav-item').forEach((item, i) => {
            item.classList.toggle('current', i + 1 === current);
        });
    }

    function activateNavMode() {
        if (navMode) return;
        navMode = true;

        let activeEl = null;
        Object.values(sideTitles).forEach(t => {
            t.stopped = true;
            if (t.el.innerHTML) activeEl = t.el;
        });

        (function back() {
            if (activeEl?.innerHTML) {
                activeEl.innerHTML = backspaceChar(activeEl.innerHTML);
                setTimeout(back, CONFIG.backSpeed);
            } else {
                Object.values(sideTitles).forEach(t => t.el.style.display = 'none');
                navSidebar.classList.add('active');
                typeNav();
            }
        })();
    }

    function typeNav() {
        const items = [...navSidebar.querySelectorAll('.nav-item')];
        let idx = 0;

        (function next() {
            if (idx >= items.length) return updateNavHighlight();
            items[idx].classList.add('typing');
            const chars = parseChars(CONFIG.categoryNames[idx]);
            let i = 0;

            (function type() {
                if (i < chars.length) {
                    items[idx].innerHTML += chars[i++];
                    setTimeout(type, CONFIG.typeSpeed);
                } else {
                    items[idx].classList.remove('typing');
                    idx++;
                    setTimeout(next, 150);
                }
            })();
        })();
    }

    // 滚动检测
    function checkScroll() {
        for (let level = currentLevel + 1; level <= 5; level++) {
            const sec = getSection(level);
            if (sec && scrollY > sec.offsetTop - innerHeight * CONFIG.scrollTriggerOffset) {
                triggerCascade(level);
            } else break;
        }

        if (!navMode) {
            Object.keys(sideTitles).forEach(level => {
                const t = sideTitles[level];
                if (!t.started && scrollY >= getSection(level)?.offsetTop) startTypeLoop(level);
            });
            if (currentLevel >= 5 && scrollY >= getSection(5).offsetTop) activateNavMode();
        } else {
            updateNavHighlight();
        }
    }

    // 事件监听
    window.addEventListener('resize', updateLayout);
    window.addEventListener('scroll', checkScroll);
    document.addEventListener('visibilitychange', () => !document.hidden && (updateLayout(), checkScroll()));

    images.forEach(img => {
        img.style.cursor = 'pointer';
        img.onclick = () => {
            if (img.dataset.dragging === 'true' || !img.dataset.link) return;
            sessionStorage.setItem(STATE_KEY, JSON.stringify({
                scrollY, currentLevel, animationActive, navMode,
                images: imageStates.map(s => ({
                    angle: s.angle,
                    currentLevel: s.currentLevel,
                    floatParams: s.floatParams,
                    left: s.element.style.left,
                    top: s.element.style.top,
                    zIndex: s.element.style.zIndex
                }))
            }));
            location.href = `works/${img.dataset.link}.html`;
        };
    });

    // 轨道动画
    function animateOrbit() {
        if (!animationActive) return;

        const cx = hero.clientWidth / 2, cy = hero.clientHeight / 2;
        const [minS, maxS] = CONFIG.orbitScaleRange;
        const [minO, maxO] = CONFIG.orbitOpacityRange;
        const cos = Math.cos(CONFIG.tiltAngle), sin = Math.sin(CONFIG.tiltAngle);

        imageStates.forEach(s => {
            if (s.currentLevel === 0 && !s.isDropping) {
                s.angle += CONFIG.orbitSpeed;
                const x = Math.cos(s.angle) * CONFIG.radiusX;
                const y = Math.sin(s.angle) * CONFIG.radiusY;
                const z = Math.sin(s.angle);
                const scale = minS + (z + 1) / 2 * (maxS - minS);
                const el = s.element;

                el.style.left = (cx + x * cos - y * sin - el.offsetWidth * scale / 2) + 'px';
                el.style.top = (cy + x * sin + y * cos - el.offsetHeight * scale / 2) + 'px';
                el.style.transform = `scale(${scale})`;
                el.style.opacity = minO + (clamp(z + CONFIG.opacityZOffset, -1, 1) + 1) / 2 * (maxO - minO);
                el.style.zIndex = z < 0 ? ~~((z + 1) * 99) + 1 : ~~(z * 99) + 101;
            }
        });
        requestAnimationFrame(animateOrbit);
    }

    // 下落逻辑
    function triggerCascade(newLevel) {
        if (newLevel <= currentLevel) return;
        currentLevel = newLevel;
        if (newLevel === 1) animationActive = false;

        imageStates.forEach(s => {
            if (s.targetLevel >= newLevel && s.currentLevel < newLevel) {
                s.isDropping = true;
                s.currentLevel = newLevel;
                s.element.style.animation = 'none';
                s.bounds = calcBounds(newLevel, s.element.offsetWidth, s.element.offsetHeight);

                const currL = parseFloat(s.element.style.left) || 0;
                fallTo(s, clamp(currL, s.bounds.left, s.bounds.right),
                    s.bounds.top + Math.random() * (s.bounds.bottom - s.bounds.top));
            }
        });
    }

    function fallTo(state, finalLeft, finalTop) {
        const el = state.element;
        const start = performance.now();
        const startL = parseFloat(el.style.left), startT = parseFloat(el.style.top);
        const startScale = new DOMMatrix(getComputedStyle(el).transform).a || 1;
        const { amp, speed, phase } = state.floatParams;

        el.style.filter = 'drop-shadow(0 10px 20px rgba(0,0,0,0.15))';
        el.style.zIndex = ++topZIndex;

        (function loop(now) {
            const t = Math.min((now - start) / CONFIG.dropDuration, 1);
            const p = 1 - (1 - t) ** 3;
            const floatY = Math.sin((now - start) * speed + phase) * amp;

            el.style.left = (startL + (finalLeft - startL) * p) + 'px';
            el.style.top = (startT + (finalTop - startT) * p) + 'px';
            el.style.transform = `translateY(${floatY}px) scale(${startScale + (CONFIG.dropScale - startScale) * p})`;
            el.style.opacity = 1;

            t < 1 ? requestAnimationFrame(loop) : (state.isDropping = false, enableFloatAndDrag(state, start));
        })(start);
    }

    // 浮动与拖拽
    function enableFloatAndDrag(state, timeStart = performance.now()) {
        const el = state.element;
        const { amp, speed, phase } = state.floatParams;
        const scale = CONFIG.dropScale;
        let dragging = false, drag = {}, rafId;

        function float() {
            if (!dragging) {
                el.style.transform = `translateY(${Math.sin((performance.now() - timeStart) * speed + phase) * amp}px) scale(${scale})`;
                rafId = requestAnimationFrame(float);
            }
        }
        float();
        el.style.cursor = 'grab';

        el.onmousedown = e => {
            cancelAnimationFrame(rafId);
            el.style.cursor = 'grabbing';
            el.style.transform = `scale(${scale})`;
            el.style.zIndex = ++topZIndex;
            drag = { x: e.clientX, y: e.clientY, elX: parseFloat(el.style.left), elY: parseFloat(el.style.top) };
            e.preventDefault();
        };

        document.addEventListener('mousemove', e => {
            if (!drag.x) return;
            const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
            if (!dragging && (Math.abs(dx) > CONFIG.dragThreshold || Math.abs(dy) > CONFIG.dragThreshold)) {
                dragging = true;
                el.dataset.dragging = 'true';
            }
            if (dragging) {
                el.style.left = clamp(drag.elX + dx, state.bounds.left, state.bounds.right) + 'px';
                el.style.top = clamp(drag.elY + dy, state.bounds.top, state.bounds.bottom) + 'px';
            }
        });

        document.addEventListener('mouseup', () => {
            if (!drag.x) return;
            dragging = false;
            setTimeout(() => el.dataset.dragging = 'false', 50);
            drag = {};
            el.style.cursor = 'grab';
            float();
        });
    }

    // 标题浮动
    function startTitleFloat() {
        const title = document.querySelector('.center-title');
        if (!title) return;
        const start = performance.now();
        const [sx, sy] = CONFIG.titleFloatSpeed;
        const amp = CONFIG.titleFloatAmp;

        (function loop() {
            const t = performance.now() - start;
            title.style.transform = `translate(calc(-50% + ${Math.sin(t * sx) * amp}px), calc(-50% + ${Math.cos(t * sy) * amp}px))`;
            requestAnimationFrame(loop);
        })();
    }

    // 打字机效果
    function startTypeLoop(level) {
        const t = sideTitles[level];
        if (!t || t.started) return;
        t.started = true;
        t.el.classList.add('typing');
        let idx = 0;

        (function cycle() {
            if (t.stopped) return;
            const texts = getActiveCats(level);
            if (!texts.length) return setTimeout(cycle, 500);

            const chars = parseChars(texts[idx++ % texts.length]);
            let i = 0;

            (function type() {
                if (t.stopped) return;
                if (i < chars.length) {
                    t.el.innerHTML += chars[i++];
                    setTimeout(type, CONFIG.typeSpeed);
                } else {
                    setTimeout(back, CONFIG.typePause);
                }
            })();

            function back() {
                if (t.stopped) return;
                if (t.el.innerHTML) {
                    t.el.innerHTML = backspaceChar(t.el.innerHTML);
                    setTimeout(back, CONFIG.backSpeed);
                } else {
                    setTimeout(cycle, 300);
                }
            }
        })();
    }

    // 状态恢复
    function restoreState(p) {
        currentLevel = p.currentLevel || 0;
        animationActive = p.animationActive;
        topZIndex = CONFIG.baseZIndex + p.images.length;

        p.images.forEach((saved, i) => {
            const s = imageStates[i];
            if (!s) return;

            Object.assign(s, { angle: saved.angle, currentLevel: saved.currentLevel, floatParams: saved.floatParams });
            Object.assign(s.element.style, {
                left: saved.left, top: saved.top, zIndex: saved.zIndex,
                animation: 'none', opacity: 1,
                filter: 'drop-shadow(0 10px 20px rgba(0,0,0,0.15))',
                transform: `scale(${CONFIG.dropScale})`
            });
            if (saved.currentLevel > 0) enableFloatAndDrag(s);
        });

        if (p.navMode) {
            navMode = true;
            Object.values(sideTitles).forEach(t => { t.stopped = true; t.el.style.display = 'none'; });
            navSidebar.classList.add('active');
            CONFIG.categoryNames.forEach((name, i) => navSidebar.children[i].innerHTML = name);
            updateNavHighlight();
        }

        updateLayout();
        scrollTo(0, p.scrollY);
        requestAnimationFrame(() => document.documentElement.classList.remove('is-restoring'));
    }

    // 初始化
    if (savedState) {
        restoreState(JSON.parse(savedState));
        sessionStorage.removeItem(STATE_KEY);
    } else {
        document.documentElement.classList.remove('is-restoring');
    }
    startTitleFloat();
    requestAnimationFrame(animateOrbit);
})();