import { useState, useEffect } from 'react';
import './Landing.css';

export default function Landing({ onStart }) {
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('visible');
          }
        });
      },
      { threshold: 0.1, rootMargin: '0px 0px -40px 0px' }
    );

    document.querySelectorAll('.reveal').forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);

  return (
    <div className="landing">
      {/* ═══════ HERO ═══════ */}
      <section className="hero">
        <div className="badge">100% Free · 100% Private · 100% Yours</div>
        <h1>
          Stop <span className="strike">paying</span>
          <br />
          for your <span className="accent">own</span> notes.
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

      {/* ═══════ MARQUEE ROAST ═══════ */}
      <div className="marquee-section">
        <div className="marquee-track">
          <span className="marquee-text">YOUR DATA IS NOT THEIR PRODUCT ✦</span>
          <span className="marquee-text">SUBSCRIPTIONS ARE A SCAM ✦</span>
          <span className="marquee-text">YOUR NOTES BELONG TO YOU ✦</span>
          <span className="marquee-text">ZERO CLOUD. ZERO RISK. ✦</span>
          <span className="marquee-text">YOUR DATA IS NOT THEIR PRODUCT ✦</span>
          <span className="marquee-text">SUBSCRIPTIONS ARE A SCAM ✦</span>
          <span className="marquee-text">YOUR NOTES BELONG TO YOU ✦</span>
          <span className="marquee-text">ZERO CLOUD. ZERO RISK. ✦</span>
        </div>
      </div>

      {/* ═══════ PRICE ROAST ═══════ */}
      <section>
        <div style={{ textAlign: 'center' }}>
          <div className="section-label reveal">The Audacity</div>
          <h2 className="section-title reveal">They charge you <em>how much?</em></h2>
          <p className="section-sub reveal" style={{ margin: '0 auto' }}>
            Let's compare what you're paying for vs. what you could have — for free.
          </p>
        </div>
        <div className="roast-grid">
          <div className="roast-card them reveal">
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
          <div className="roast-card us reveal">
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
      <section>
        <div className="stats">
          <div className="stat reveal">
            <div className="stat-val green">$0</div>
            <div className="stat-label">Cost forever</div>
          </div>
          <div className="stat reveal">
            <div className="stat-val blue">0</div>
            <div className="stat-label">Servers touched</div>
          </div>
          <div className="stat reveal">
            <div className="stat-val gold">0</div>
            <div className="stat-label">Data collected</div>
          </div>
          <div className="stat reveal">
            <div className="stat-val green">∞</div>
            <div className="stat-label">Pages & notes</div>
          </div>
        </div>
      </section>

      {/* ═══════ FEATURES ═══════ */}
      <section>
        <div style={{ textAlign: 'center', marginBottom: '40px' }}>
          <div className="section-label reveal">What You Actually Get</div>
          <h2 className="section-title reveal">Everything. For nothing.</h2>
        </div>
        <div className="features">
          {[
            {
              icon: '🔒',
              title: 'Your Data Never Leaves',
              desc: 'Everything is stored in your browser\'s IndexedDB. No servers. No cloud. No "anonymous telemetry." Your notes physically cannot be seen by anyone else. Period.',
              tag: 'Zero data collection',
              tagClass: 'tag-green',
            },
            {
              icon: '✒️',
              title: 'Pro Drawing Tools',
              desc: 'Pressure-sensitive pen, highlighter, shapes, arrows, diamonds, text — all the tools those "$10/month" apps gatekeep behind their premium tier. We just... give them to you.',
              tag: '12 tools included',
              tagClass: 'tag-blue',
            },
            {
              icon: '🌙',
              title: 'Dark Mode That Actually Works',
              desc: 'Not just a dark sidebar — the entire canvas inverts properly. Your strokes stay visible, colors stay accurate. Because we actually thought about it for more than 5 minutes.',
              tag: 'Full canvas inversion',
              tagClass: 'tag-blue',
            },
            {
              icon: '🖐️',
              title: 'Palm Rejection That Doesn\'t Suck',
              desc: 'Three-layer detection: stylus priority, contact size filtering, and timed touch blocking. Rest your hand. Draw freely. No random palm scribbles ruining your masterpiece.',
              tag: 'Always active',
              tagClass: 'tag-gold',
            },
            {
              icon: '♾️',
              title: 'Infinite Canvas, Pan & Zoom',
              desc: 'Pinch to zoom, hand tool to pan, scroll-zoom with Ctrl. Your canvas is as big as your ideas. Not locked into a fixed A4 rectangle like it\'s 2008.',
              tag: 'Excalidraw-style',
              tagClass: 'tag-green',
            },
            {
              icon: '💾',
              title: 'Auto-Save + Manual Backup',
              desc: 'Auto-saves to IndexedDB every 5 seconds. Downloads a full JSON backup after 30 minutes idle. Export PNGs. Email pages. Restore from backup. You own every bit.',
              tag: 'Your data, your way',
              tagClass: 'tag-gold',
            },
          ].map((feature, idx) => (
            <div key={idx} className={`feat-row reveal ${idx % 2 === 1 ? 'reverse' : ''}`}>
              <div className="feat-visual">
                <div className="feat-icon">{feature.icon}</div>
              </div>
              <div className="feat-content">
                <h3>{feature.title}</h3>
                <p>{feature.desc}</p>
                <span className={`tag ${feature.tagClass}`}>{feature.tag}</span>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ═══════ ROAST QUOTES ═══════ */}
      <section>
        <div style={{ textAlign: 'center', marginBottom: '20px' }}>
          <div className="section-label reveal">Real Thoughts</div>
          <h2 className="section-title reveal">What people think<br />about paid note apps</h2>
        </div>
        <div className="quotes">
          {[
            {
              text: 'I was paying $120/year to take notes. Then I realized my grandma\'s notebook costs $2 and lasts longer.',
              author: '— Everyone, eventually',
            },
            {
              text: 'They added AI to my notes app. I didn\'t ask for AI. I asked for my notes to not disappear when the server is down.',
              author: '— Also everyone',
            },
            {
              text: 'My "premium" note app requires WiFi to open my own handwriting. Let that sink in.',
              author: '— People who\'ve had enough',
            },
          ].map((quote, idx) => (
            <div key={idx} className="quote-card reveal">
              <p className="quote-text">{quote.text}</p>
              <div className="quote-author">{quote.author}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ═══════ FINAL CTA ═══════ */}
      <section className="final-cta">
        <h2 className="reveal">
          Ready to own<br />your <span style={{ color: 'var(--accent)' }}>notes</span> again?
        </h2>
        <p className="reveal">No signup. No credit card. No catch. Just open it and start writing.</p>
        <div className="cta-wrap reveal">
          <button className="cta" onClick={onStart}>
            Open Ink Notes — It's Free
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <path d="M5 12h14M12 5l7 7-7 7" />
            </svg>
          </button>
        </div>
        <p className="reveal" style={{ marginTop: '24px', fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--muted)', letterSpacing: '1px' }}>
          NO ACCOUNTS · NO ADS · NO TRACKING · NO CLOUD · NO SUBSCRIPTIONS
        </p>
      </section>

      {/* ═══════ FOOTER ═══════ */}
      <footer>
        <div className="brand">✦ Ink Notes</div>
        <div className="credit">
          Your canvas for thinking freely
        </div>
        <div style={{ marginTop: '12px', fontSize: '11px', color: 'var(--muted)' }}>
          Your notes. Your device. Your rules. Always free. Always private.
        </div>
      </footer>
    </div>
  );
}
