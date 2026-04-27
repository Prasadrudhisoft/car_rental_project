import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import Navbar from '../components/common/Navbar';
import SearchWidget from '../components/home/SearchWidget';
import AuthModal from '../components/auth/AuthModal';
import './HomePage.css';

const FEATURES = [
    { icon: '🛡️', title: 'Verified & Certified', desc: 'Every vehicle passes mechanic certification and VAHAN database checks before going live.' },
    { icon: '💳', title: 'Secure Payments', desc: 'Razorpay-powered checkout with full payment capture, refunds, and GST invoices.' },
    { icon: '📍', title: 'Map-Based Pickup', desc: 'Select your vendor on an interactive map. See locations, ratings, and shop hours.' },
    { icon: '🔄', title: 'One-Way Returns', desc: 'Pick up in Nashik, drop off in Pune. Our vendor network handles the logistics.' },
    { icon: '⭐', title: 'Loyalty Rewards', desc: 'Earn points with every rental. Redeem them for discounts on future bookings.' },
    { icon: '📱', title: 'Real-Time OTPs', desc: 'Paperless agreements and inspection sign-offs via secure 6-digit OTPs.' },
];

const SEGMENTS = [
    { label: 'Hatchback', icon: '🚗', from: '₹599', desc: 'Compact & fuel-efficient' },
    { label: 'Sedan', icon: '🚘', from: '₹899', desc: 'Comfort for long drives' },
    { label: 'SUV', icon: '🚙', from: '₹1,299', desc: 'Space for the whole family' },
    { label: 'Luxury', icon: '🏎️', from: '₹2,999', desc: 'Premium driving experience' },
    { label: 'Van / MPV', icon: '🚐', from: '₹1,499', desc: 'Groups & cargo trips' },
];

const STATS = [
    { value: '500+', label: 'Verified Vehicles' },
    { value: '50+', label: 'Vendor Partners' },
    { value: '12', label: 'Cities' },
    { value: '4.6★', label: 'Avg Rating' },
];

const HOW_IT_WORKS = [
    { step: '01', title: 'Search & Compare', desc: 'Browse certified vehicles by city, date, and segment. Filter by price, transmission, or fuel type.' },
    { step: '02', title: 'Book & Pay', desc: 'Secure checkout via Razorpay. Apply promo codes or redeem loyalty points for instant discounts.' },
    { step: '03', title: 'Pick Up & Go', desc: 'Vendor confirms via OTP. Complete a digital inspection, sign the agreement, and hit the road.' },
    { step: '04', title: 'Return & Review', desc: 'Drop off at any approved location. Earn loyalty points and leave a verified review.' },
];

export default function HomePage() {
    const [showAuth, setShowAuth] = useState(false);
    const [scrolled, setScrolled] = useState(false);

    useEffect(() => {
        const fn = () => setScrolled(window.scrollY > 60);
        window.addEventListener('scroll', fn);
        return () => window.removeEventListener('scroll', fn);
    }, []);

    return (
        <div className="home">
            <Navbar onLoginClick={() => setShowAuth(true)} />

            {/* ── Hero ── */}
            <section className="home__hero">
                {/* Ambient background */}
                <div className="home__hero-bg">
                    <div className="home__orb home__orb--amber" />
                    <div className="home__orb home__orb--blue" />
                    <div className="home__orb home__orb--teal" />
                    <div className="home__grid-overlay" />
                </div>

                <div className="home__hero-inner">
                    {/* Left: Copy */}
                    <div className="home__hero-copy">
                        <div className="home__eyebrow">
                            <span className="home__eyebrow-dot" />
                            India's Premium Car Rental Platform
                        </div>

                        <h1 className="home__h1">
                            Drive the roads<br />
                            <span className="home__h1-accent">you deserve.</span>
                        </h1>

                        <p className="home__hero-sub">
                            Certified vehicles. Verified vendors. Transparent pricing.
                            Instant confirmation across Maharashtra.
                        </p>

                        {/* Stat strip */}
                        <div className="home__stats">
                            {STATS.map((s, i) => (
                                <React.Fragment key={s.label}>
                                    {i > 0 && <div className="home__stat-sep" />}
                                    <div className="home__stat">
                                        <span className="home__stat-val">{s.value}</span>
                                        <span className="home__stat-lbl">{s.label}</span>
                                    </div>
                                </React.Fragment>
                            ))}
                        </div>

                        <div className="home__hero-ctas">
                            <button className="home__btn-primary" onClick={() => setShowAuth(true)}>
                                Start Booking
                                <span className="home__btn-arrow">→</span>
                            </button>
                        </div>
                    </div>

                    {/* Right: Search widget */}
                    <div className="home__hero-widget">
                        <div className="home__widget-glow" />
                        <SearchWidget />
                    </div>
                </div>

                {/* Scroll nudge */}
                <div className={`home__scroll-hint ${scrolled ? 'hidden' : ''}`}>
                    <div className="home__scroll-dot" />
                    Scroll to explore
                </div>
            </section>

            {/* ── Segments ── */}
            <section className="home__section home__section--surface">
                <div className="home__container">
                    <div className="home__section-hd">
                        <span className="home__tag">Fleet</span>
                        <h2>Every category.<br />Every budget.</h2>
                        <p>From zippy hatchbacks to premium luxury sedans.</p>
                    </div>
                    <div className="home__segments">
                        {SEGMENTS.map((s, i) => (
                            <div key={s.label} className="home__seg-card"
                                style={{ animationDelay: `${i * 0.08}s` }}>
                                <div className="home__seg-icon">{s.icon}</div>
                                <div className="home__seg-body">
                                    <h3>{s.label}</h3>
                                    <p>{s.desc}</p>
                                </div>
                                <div className="home__seg-price">From {s.from}/day</div>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* ── How it works ── */}
            <section className="home__section">
                <div className="home__container">
                    <div className="home__section-hd">
                        <span className="home__tag">Process</span>
                        <h2>How it works.</h2>
                        <p>From search to keys in hand — in minutes.</p>
                    </div>
                    <div className="home__steps">
                        {HOW_IT_WORKS.map((h, i) => (
                            <div key={h.step} className="home__step">
                                <div className="home__step-num">{h.step}</div>
                                <div className="home__step-connector" />
                                <h3>{h.title}</h3>
                                <p>{h.desc}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* ── Features ── */}
            <section className="home__section home__section--surface">
                <div className="home__container">
                    <div className="home__section-hd">
                        <span className="home__tag">Why RudhiDrive</span>
                        <h2>Built different.</h2>
                        <p>Every feature designed for trust, transparency, and convenience.</p>
                    </div>
                    <div className="home__features">
                        {FEATURES.map((f, i) => (
                            <div key={f.title} className="home__feature"
                                style={{ animationDelay: `${i * 0.07}s` }}>
                                <div className="home__feature-icon">{f.icon}</div>
                                <h3>{f.title}</h3>
                                <p>{f.desc}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* ── CTA ── */}
            <section className="home__section home__cta-section">
                <div className="home__container">
                    <div className="home__cta-card">
                        <div className="home__cta-orbs">
                            <div className="home__cta-orb home__cta-orb--1" />
                            <div className="home__cta-orb home__cta-orb--2" />
                        </div>
                        <div className="home__cta-content">
                            <span className="home__tag">Get started today</span>
                            <h2>Ready to hit the road?</h2>
                            <p>Join thousands of happy customers across Maharashtra.</p>
                            <div className="home__cta-btns">
                                <button className="home__btn-primary home__btn-primary--lg"
                                    onClick={() => setShowAuth(true)}>
                                    Get Started — It's Free
                                    <span className="home__btn-arrow">→</span>
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* ── Footer ── */}
            <footer className="home__footer">
                <div className="home__container home__footer-inner">
                    <div className="home__footer-brand">
                        <span className="home__footer-logo">⬡ RudhiDrive</span>
                        <p>India's trusted premium car rental platform.</p>
                    </div>
                    <nav className="home__footer-links">
                        <span>© 2025 RudhiDrive</span>
                        <a href="#!">Privacy</a>
                        <a href="#!">Terms</a>
                        <a href="#!">Contact</a>
                    </nav>
                </div>
            </footer>

            {showAuth && <AuthModal onClose={() => setShowAuth(false)} />}
        </div>
    );
}