import { useState, useEffect, useRef, useCallback } from 'react';
import './Landing.css';

export default function Landing({ onStart }) {
  const statsRef = useRef(null);
  const canvasRef = useRef(null);
  const [statsVisible, setStatsVisible] = useState(false);
  const [statValues, setStatValues] = useState({ cost: '', servers: '', data: '', pages: '' });

  // Floating particles background
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let raf;
    const resize = () => { canvas.width = window.innerWidth; canvas.height = window.innerHeight; };
    resize();
    window.addEventListener('resize', resize);

    const count = Math.min(60, Math.floor(window.innerWidth / 25));
    const particles = Array.from({ length: count }, () => ({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      r: Math.random() * 1.5 + 0.5,
      dx: (Math.random() - 0.5) * 0.3,
      dy: -(Math.random() * 0.4 + 0.1),
      o: Math.random() * 0.3 + 0.05,
    }));

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      for (const p of particles) {
        p.x += p.dx;
        p.y += p.dy;
        if (p.y < -10) { p.y = canvas.height + 10; p.x = Math.random() * canvas.width; }
        if (p.x < -10) p.x = canvas.width + 10;
        if (p.x > canvas.width + 10) p.x = -10;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255,255,255,${p.o})`;
        ctx.fill();
      }
      // Draw faint connections between nearby particles
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const dx = particles[i].x - particles[j].x;
          const dy = particles[i].y - particles[j].y;
          const dist = dx * dx + dy * dy;
          if (dist < 18000) {
            ctx.beginPath();
            ctx.moveTo(particles[i].x, particles[i].y);
            ctx.lineTo(particles[j].x, particles[j].y);
            ctx.strokeStyle = `rgba(255,255,255,${0.03 * (1 - dist / 18000)})`;
            ctx.stroke();
          }
        }
      }
      raf = requestAnimationFrame(draw);
    };
    draw();
    return () => { cancelAnimationFrame(raf); window.removeEventListener('resize', resize); };
  }, []);

  // Varied reveal system
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) entry.target.classList.add('visible');
        });
      },
      { threshold: 0.1, rootMargin: '0px 0px -40px 0px' }
    );
    document.querySelectorAll('.reveal').forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);

  // Stats counting animation
  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !statsVisible) {
          setStatsVisible(true);
          // Glitch effect for zero values — show random numbers then settle
          const chars = '01234567890';
          let frame = 0;
          const maxFrames = 12;
          const tick = () => {
            frame++;
            if (frame < maxFrames) {
              setStatValues({
                cost: '$' + chars[Math.floor(Math.random() * chars.length)],
                servers: chars[Math.floor(Math.random() * chars.length)],
                data: chars[Math.floor(Math.random() * chars.length)],
                pages: '∞',
              });
              requestAnimationFrame(tick);
            } else {
              setStatValues({ cost: '$0', servers: '0', data: '0', pages: '∞' });
            }
          };
          requestAnimationFrame(tick);
        }
      },
      { threshold: 0.5 }
    );
    if (statsRef.current) observer.observe(statsRef.current);
    return () => observer.disconnect();
  }, [statsVisible]);

  // Bento card tilt effect (desktop only)
  const handleTilt = useCallback((e) => {
    if (window.matchMedia('(hover: none)').matches) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width - 0.5;
    const y = (e.clientY - rect.top) / rect.height - 0.5;
    e.currentTarget.style.transform =
      `perspective(800px) rotateY(${x * 6}deg) rotateX(${-y * 6}deg) translateY(-4px)`;
  }, []);

  const handleTiltReset = useCallback((e) => {
    e.currentTarget.style.transform = '';
  }, []);

  const marqueeTexts = [
    'YOUR DATA IS NOT THEIR PRODUCT \u2726',
    'SUBSCRIPTIONS ARE A SCAM \u2726',
    'YOUR NOTES BELONG TO YOU \u2726',
    'ZERO CLOUD. ZERO RISK. \u2726',
  ];

  const features = [
    {
      icon: <svg viewBox="0 0 24 24" fill="none" stroke="var(--green)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/><circle cx="12" cy="16" r="1"/></svg>,
      title: 'Your Data Never Leaves',
      desc: 'Everything is stored in your browser\'s IndexedDB. No servers. No cloud. No "anonymous telemetry." Your notes physically cannot be seen by anyone else. Period.',
      tag: 'Zero data collection',
      tagClass: 'tag-green',
    },
    {
      icon: <svg viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.83 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/><path d="M15 5l4 4"/></svg>,
      title: 'Pro Drawing Tools',
      desc: 'Pressure-sensitive pen, highlighter, shapes, arrows, diamonds, text \u2014 all the tools those "$10/month" apps gatekeep behind their premium tier. We just... give them to you.',
      tag: '12 tools included',
      tagClass: 'tag-blue',
    },
    {
      icon: <svg viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>,
      title: 'Dark Mode That Actually Works',
      desc: 'Not just a dark sidebar \u2014 the entire canvas inverts properly. Your strokes stay visible, colors stay accurate. Because we actually thought about it for more than 5 minutes.',
      tag: 'Full canvas inversion',
      tagClass: 'tag-blue',
    },
    {
      icon: <svg viewBox="0 0 24 24" fill="none" stroke="var(--gold)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M18 11V6a2 2 0 0 0-4 0v1M14 10V4a2 2 0 0 0-4 0v6M10 10V6a2 2 0 0 0-4 0v8l-1.46-1.46a2 2 0 0 0-2.83 2.83L7.5 21h9a4 4 0 0 0 4-4v-5a2 2 0 0 0-4 0v1"/></svg>,
      title: 'Palm Rejection That Doesn\'t Suck',
      desc: 'Three-layer detection: stylus priority, contact size filtering, and timed touch blocking. Rest your hand. Draw freely. No random palm scribbles ruining your masterpiece.',
      tag: 'Always active',
      tagClass: 'tag-gold',
    },
    {
      icon: <svg viewBox="0 0 24 24" fill="none" stroke="var(--green)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><line x1="11" y1="8" x2="11" y2="14"/><line x1="8" y1="11" x2="14" y2="11"/></svg>,
      title: 'Infinite Canvas, Pan & Zoom',
      desc: 'Pinch to zoom, hand tool to pan, scroll-zoom with Ctrl. Your canvas is as big as your ideas. Not locked into a fixed A4 rectangle like it\'s 2008.',
      tag: 'Excalidraw-style',
      tagClass: 'tag-green',
    },
    {
      icon: <svg viewBox="0 0 24 24" fill="none" stroke="var(--gold)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>,
      title: 'Auto-Save + Manual Backup',
      desc: 'Auto-saves to IndexedDB every 5 seconds. Downloads a full JSON backup after 30 minutes idle. Export PNGs. Email pages. Restore from backup. You own every bit.',
      tag: 'Your data, your way',
      tagClass: 'tag-gold',
    },
  ];

  const quotes = [
    {
      text: 'I was paying $120/year to take notes. Then I realized my grandma\'s notebook costs $2 and lasts longer.',
      author: '\u2014 Everyone, eventually',
    },
    {
      text: 'They added AI to my notes app. I didn\'t ask for AI. I asked for my notes to not disappear when the server is down.',
      author: '\u2014 Also everyone',
    },
    {
      text: 'My "premium" note app requires WiFi to open my own handwriting. Let that sink in.',
      author: '\u2014 People who\'ve had enough',
    },
  ];

  const bentoClass = (idx) => {
    if (idx === 0) return 'bento-large';
    if (idx === 5) return 'bento-wide';
    return 'bento-regular';
  };

  return (
    <div className="landing">
      <canvas ref={canvasRef} className="particle-canvas" />
      {/* ═══════ HERO ═══════ */}
      <section className="hero">
        <div className="hero-decor">
          <div className="blob blob-1" />
          <div className="blob blob-2" />
          <div className="ring" />
          <div className="diamond" />
          <div className="dots" />
        </div>

        <div className="badge">100% Free &middot; 100% Private &middot; 100% Yours</div>

        <h1>
          Stop <span className="strike">paying</span>
          <br />
          for your <span className="accent-gradient">own</span> notes.
        </h1>

        <p className="hero-sub">
          Other apps charge you <strong>$10/month</strong> to lock your handwriting in their cloud.
          <strong> Ink Notes</strong> runs entirely in your browser. No accounts. No subscriptions. No BS.
        </p>

        <div className="cta-wrap">
          <button className="cta" onClick={onStart}>
            Launch Ink Notes
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <path d="M5 12h14M12 5l7 7-7 7" />
            </svg>
          </button>
        </div>

        <div className="scroll-hint">
          scroll to get roasted
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M12 5v14M19 12l-7 7-7-7" />
          </svg>
        </div>
      </section>

      {/* ═══════ DUAL MARQUEE ═══════ */}
      <div className="marquee-section">
        <div className="marquee-strip solid">
          <div className="marquee-track">
            {[...marqueeTexts, ...marqueeTexts].map((t, i) => (
              <span key={i} className="marquee-text">{t}</span>
            ))}
          </div>
        </div>
        <div className="marquee-strip outline">
          <div className="marquee-track">
            {[...marqueeTexts, ...marqueeTexts].map((t, i) => (
              <span key={i} className="marquee-text">{t}</span>
            ))}
          </div>
        </div>
      </div>

      {/* ═══════ PRICE ROAST — VS ═══════ */}
      <section>
        <div style={{ textAlign: 'center' }}>
          <div className="section-label reveal" data-reveal="up">The Audacity</div>
          <h2 className="section-title reveal" data-reveal="up" data-delay="1">They charge you <em>how much?</em></h2>
          <p className="section-sub reveal" data-reveal="up" data-delay="2" style={{ margin: '0 auto' }}>
            Let's compare what you're paying for vs. what you could have — for free.
          </p>
        </div>
        <div className="roast-grid">
          <div className="roast-card them reveal" data-reveal="clip-left">
            <div className="price">$9.99<span style={{ fontSize: '18px', color: 'var(--muted)' }}>/mo</span></div>
            <div className="card-label">Them — "Premium" notes</div>
            <ul>
              <li>Your notes stored on <em>their</em> servers</li>
              <li>Account required + email harvesting</li>
              <li>"AI features" nobody asked for</li>
              <li>Syncs to sell your data better</li>
              <li>Goes offline? Your notes are hostage</li>
              <li>$120/year for a glorified text box</li>
            </ul>
          </div>

          <div className="vs-divider reveal" data-reveal="scale">VS</div>

          <div className="roast-card us reveal" data-reveal="clip-left" data-delay="2">
            <div className="price">$0<span style={{ fontSize: '18px', color: 'var(--muted)' }}> forever</span></div>
            <div className="card-label">Ink Notes</div>
            <ul>
              <li>Your notes stay on YOUR device</li>
              <li>Zero accounts, zero tracking</li>
              <li>Full drawing toolkit + shapes</li>
              <li>Works 100% offline, always</li>
              <li>Dark mode, palm rejection, zoom</li>
              <li>Export, backup, email — all built in</li>
            </ul>
          </div>
        </div>
      </section>

      {/* ═══════ STATS ═══════ */}
      <section className="stats-section">
        <div className="stats" ref={statsRef}>
          <div className="stat reveal" data-reveal="scale">
            <div className={`stat-val green${statsVisible ? ' glitch' : ''}`}>
              {statsVisible ? statValues.cost : ''}
            </div>
            <div className="stat-line green" />
            <div className="stat-label">Cost forever</div>
          </div>
          <div className="stat reveal" data-reveal="scale" data-delay="1">
            <div className={`stat-val blue${statsVisible ? ' glitch' : ''}`}>
              {statsVisible ? statValues.servers : ''}
            </div>
            <div className="stat-line blue" />
            <div className="stat-label">Servers touched</div>
          </div>
          <div className="stat reveal" data-reveal="scale" data-delay="2">
            <div className={`stat-val gold${statsVisible ? ' glitch' : ''}`}>
              {statsVisible ? statValues.data : ''}
            </div>
            <div className="stat-line gold" />
            <div className="stat-label">Data collected</div>
          </div>
          <div className="stat reveal" data-reveal="scale" data-delay="3">
            <div className={`stat-val green${statsVisible ? ' infinity-pop' : ''}`}>
              {statsVisible ? statValues.pages : ''}
            </div>
            <div className="stat-line green" />
            <div className="stat-label">Pages & notes</div>
          </div>
        </div>
      </section>

      {/* ═══════ BENTO FEATURES ═══════ */}
      <section>
        <div className="bento-section-header">
          <div className="section-label reveal" data-reveal="up">What You Actually Get</div>
          <h2 className="section-title reveal" data-reveal="up" data-delay="1">Everything. For nothing.</h2>
        </div>
        <div className="bento-grid">
          {features.map((f, idx) => (
            <div
              key={idx}
              className={`bento-card ${bentoClass(idx)} reveal`}
              data-reveal="rotate"
              data-delay={String(Math.min(idx, 5))}
              onMouseMove={handleTilt}
              onMouseLeave={handleTiltReset}
            >
              <div className="bento-icon">{f.icon}</div>
              <div>
                <h3>{f.title}</h3>
                <p>{f.desc}</p>
                <span className={`tag ${f.tagClass}`}>{f.tag}</span>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ═══════ ROAST QUOTES CAROUSEL ═══════ */}
      <section className="quotes-section">
        <div className="quotes-header">
          <div className="section-label reveal" data-reveal="up">Real Thoughts</div>
          <h2 className="section-title reveal" data-reveal="up" data-delay="1">What people think<br />about paid note apps</h2>
        </div>
        <div className="quotes-track-wrapper">
          <div className="quotes-track">
            {/* Duplicate for seamless loop */}
            {[...quotes, ...quotes, ...quotes, ...quotes].map((q, idx) => (
              <div key={idx} className="quote-card">
                <div className="quote-accent" />
                <p className="quote-text">{q.text}</p>
                <div className="quote-author">{q.author}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════ FINAL CTA ═══════ */}
      <section className="final-cta">
        <h2 className="reveal" data-reveal="clip-up">
          Ready to own<br />your <span className="accent-gradient">notes</span> again?
        </h2>
        <p className="reveal" data-reveal="blur" data-delay="1">No signup. No credit card. No catch. Just open it and start writing.</p>
        <div className="cta-wrap reveal" data-reveal="scale" data-delay="2">
          <button className="cta" onClick={onStart}>
            Open Ink Notes — It's Free
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <path d="M5 12h14M12 5l7 7-7 7" />
            </svg>
          </button>
        </div>
        <p className="trust-line reveal" data-reveal="up" data-delay="3">
          NO ACCOUNTS &middot; NO ADS &middot; NO TRACKING &middot; NO CLOUD &middot; NO SUBSCRIPTIONS
        </p>
      </section>

      {/* ═══════ FOOTER ═══════ */}
      <footer>
        <div className="brand">&#10022; Ink Notes</div>
        <div className="credit">Your canvas for thinking freely</div>
        <div className="footer-tagline">
          Your notes. Your device. Your rules. Always free. Always private.
        </div>
      </footer>
    </div>
  );
}
