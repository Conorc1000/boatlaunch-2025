import React, { useEffect, useRef, useState } from 'react';
import Map from './components/Map';
import SlipwayView from './components/SlipwayView';
import AddSlipway from './components/AddSlipway';
import Feedback from './components/Feedback';
import Donate from './components/Donate';
import { useAuth } from './hooks/useAuth';
import {
    AnchorIcon, MenuIcon, XIcon, MapIcon, InfoIcon, MailIcon, LogOutIcon, UserIcon,
    CheckIcon, AlertIcon, PinIcon, CameraIcon, NavigationIcon, ArrowLeftIcon, MessageIcon, CoffeeIcon
} from './components/Icons';
import './App.css';

const GoogleLogo = () => (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
        <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
        <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
        <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
        <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
    </svg>
);

const FacebookLogo = () => (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
        <path fill="#ffffff" d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
    </svg>
);

function App() {
    const [activeView, setActiveView] = useState('map');
    const [selectedSlipwayId, setSelectedSlipwayId] = useState<string | null>(null);
    const [addSlipwayLocation, setAddSlipwayLocation] = useState<{ latitude: number; longitude: number } | null>(null);
    const [centerOnSlipway, setCenterOnSlipway] = useState<{ id: string; latitude: number; longitude: number; name: string } | null>(null);
    const [mapRefreshKey, setMapRefreshKey] = useState<number>(0);
    const [dropdownOpen, setDropdownOpen] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);
    const { user, loading, signIn, signInWithGoogle, signInWithFacebook, signUp, logout } = useAuth();

    // Form states
    const [signInForm, setSignInForm] = useState({ email: '', password: '' });
    const [signUpForm, setSignUpForm] = useState({ email: '', password: '', confirmPassword: '' });
    const [resetEmailForm, setResetEmailForm] = useState({ email: '' });
    const [formLoading, setFormLoading] = useState(false);
    const [formError, setFormError] = useState('');
    const [formSuccess, setFormSuccess] = useState('');

    // Close the account / mobile menu when clicking outside it or pressing Escape
    useEffect(() => {
        if (!dropdownOpen) return;
        const onPointer = (e: MouseEvent | TouchEvent) => {
            if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
                setDropdownOpen(false);
            }
        };
        const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setDropdownOpen(false);
        document.addEventListener('mousedown', onPointer);
        document.addEventListener('touchstart', onPointer);
        document.addEventListener('keydown', onKey);
        return () => {
            document.removeEventListener('mousedown', onPointer);
            document.removeEventListener('touchstart', onPointer);
            document.removeEventListener('keydown', onKey);
        };
    }, [dropdownOpen]);

    const handleMenuClick = (view: string, data?: any) => {
        setActiveView(view);

        if (data) {
            if (typeof data === 'string') {
                // Legacy support for slipwayId
                setSelectedSlipwayId(data);
                setCenterOnSlipway(null); // Clear centering for non-centering navigation
            } else if (data.centerOnSlipway) {
                // Center map on newly added slipway - add timestamp to force re-render
                const centerData = {
                    ...data.centerOnSlipway,
                    timestamp: Date.now() // Force unique object
                };
                // Clear first, then set new data
                setCenterOnSlipway(null);
                setTimeout(() => {
                    setCenterOnSlipway(centerData);
                }, 10);
            } else if (data.latitude && data.longitude) {
                // Location data for addSlipway
                setAddSlipwayLocation(data);
                setCenterOnSlipway(null); // Clear centering for non-centering navigation
            } else if (data.slipwayId) {
                setSelectedSlipwayId(data.slipwayId);
                setCenterOnSlipway(null); // Clear centering for non-centering navigation
            } else if (data.refreshData) {
                // Refresh map data when returning from SlipwayView
                setMapRefreshKey(prev => prev + 1);
            }
        } else {
            // No data provided - clear centering state
            setCenterOnSlipway(null);
        }

        setDropdownOpen(false);
        setFormError(''); // Clear any form errors when switching views
        setFormSuccess(''); // Clear success messages
    };

    const handleSignIn = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!signInForm.email || !signInForm.password) {
            setFormError('Please fill in all fields');
            return;
        }

        try {
            setFormLoading(true);
            setFormError('');
            await signIn(signInForm.email, signInForm.password);
            setSignInForm({ email: '', password: '' });
            setActiveView('map'); // Redirect to map after successful sign in
        } catch (error: any) {
            setFormError(error.message || 'Failed to sign in');
        } finally {
            setFormLoading(false);
        }
    };

    const handleGoogleSignIn = async () => {
        try {
            setFormLoading(true);
            setFormError('');
            await signInWithGoogle();
            setActiveView('map');
        } catch (error: any) {
            setFormError(error.message || 'Failed to sign in with Google');
        } finally {
            setFormLoading(false);
        }
    };

    const handleFacebookSignIn = async () => {
        try {
            setFormLoading(true);
            setFormError('');
            await signInWithFacebook();
            setActiveView('map');
        } catch (error: any) {
            setFormError(error.message || 'Failed to sign in with Facebook');
        } finally {
            setFormLoading(false);
        }
    };

    const handleSignUp = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!signUpForm.email || !signUpForm.password || !signUpForm.confirmPassword) {
            setFormError('Please fill in all fields');
            return;
        }

        if (signUpForm.password !== signUpForm.confirmPassword) {
            setFormError('Passwords do not match');
            return;
        }

        if (signUpForm.password.length < 6) {
            setFormError('Password must be at least 6 characters long');
            return;
        }

        try {
            setFormLoading(true);
            setFormError('');
            await signUp(signUpForm.email, signUpForm.password);
            setSignUpForm({ email: '', password: '', confirmPassword: '' });
            setActiveView('map'); // Redirect to map after successful sign up
        } catch (error: any) {
            setFormError(error.message || 'Failed to create account');
        } finally {
            setFormLoading(false);
        }
    };

    const handleLogout = async () => {
        try {
            await logout();
            setDropdownOpen(false);
            setActiveView('map');
        } catch (error) {
            console.error('Logout failed:', error);
        }
    };

    const handleForgotPassword = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!resetEmailForm.email) {
            setFormError('Please enter your email address');
            return;
        }

        try {
            setFormLoading(true);
            setFormError('');
            // Implement forgot password logic here
            setFormSuccess('Password reset email sent successfully');
        } catch (error: any) {
            setFormError(error.message || 'Failed to send password reset email');
        } finally {
            setFormLoading(false);
        }
    };

    const formAlerts = (
        <>
            {formError && <div className="alert alert--error" role="alert"><AlertIcon />{formError}</div>}
            {formSuccess && <div className="alert alert--success" role="status"><CheckIcon />{formSuccess}</div>}
        </>
    );

    const socialButtons = (verb: 'Sign in' | 'Sign up') => (
        <>
            <div className="social-stack">
                <button type="button" onClick={handleGoogleSignIn} className="social-btn" disabled={formLoading}>
                    <GoogleLogo />
                    {verb} with Google
                </button>
                <button type="button" onClick={handleFacebookSignIn} className="social-btn social-btn--facebook" disabled={formLoading}>
                    <FacebookLogo />
                    {verb} with Facebook
                </button>
            </div>
            <div className="divider-text">or use email</div>
        </>
    );

    const signedInCard = (title: string) => (
        <div className="auth-wrap">
            <div className="card auth-card">
                <div className="auth-icon"><CheckIcon size="lg" /></div>
                <h1>{title}</h1>
                <p className="auth-sub">Signed in as <strong>{user?.email}</strong>. You can now add slipways, edit details and upload photos.</p>
                <div className="social-stack">
                    <button className="btn btn--primary btn--lg btn--block" onClick={() => handleMenuClick('map')}>
                        <MapIcon /> Go to the map
                    </button>
                    <button className="btn btn--secondary btn--lg btn--block" onClick={handleLogout}>
                        <LogOutIcon /> Sign out
                    </button>
                </div>
            </div>
        </div>
    );

    const renderContent = () => {
        switch (activeView) {
            case 'map':
                return <Map key={mapRefreshKey} onNavigate={handleMenuClick} centerOnSlipway={centerOnSlipway} />;
            case 'slipway-view':
                return selectedSlipwayId ? (
                    <div className="page">
                        <SlipwayView slipwayId={selectedSlipwayId} onNavigate={handleMenuClick} />
                    </div>
                ) : (
                    <div className="center-state">
                        <h2>Slipway not found</h2>
                        <p>The requested slipway could not be found.</p>
                        <button onClick={() => handleMenuClick('map')} className="btn btn--primary">
                            <ArrowLeftIcon /> Back to map
                        </button>
                    </div>
                );
            case 'signup':
                if (user) return signedInCard('Welcome aboard!');
                return (
                    <div className="auth-wrap">
                        <div className="card auth-card">
                            <div className="auth-icon"><UserIcon size="lg" /></div>
                            <h1>Create your account</h1>
                            <p className="auth-sub">Add slipways, share photos and keep details up to date for other boaters.</p>
                            {formAlerts}
                            {socialButtons('Sign up')}
                            <form className="form" onSubmit={handleSignUp}>
                                <label className="field">
                                    <span className="field-label">Email</span>
                                    <input
                                        className="input"
                                        type="email"
                                        autoComplete="email"
                                        placeholder="you@example.com"
                                        value={signUpForm.email}
                                        onChange={(e) => setSignUpForm(prev => ({ ...prev, email: e.target.value }))}
                                        required
                                    />
                                </label>
                                <label className="field">
                                    <span className="field-label">Password</span>
                                    <input
                                        className="input"
                                        type="password"
                                        autoComplete="new-password"
                                        placeholder="At least 6 characters"
                                        value={signUpForm.password}
                                        onChange={(e) => setSignUpForm(prev => ({ ...prev, password: e.target.value }))}
                                        required
                                    />
                                </label>
                                <label className="field">
                                    <span className="field-label">Confirm password</span>
                                    <input
                                        className="input"
                                        type="password"
                                        autoComplete="new-password"
                                        value={signUpForm.confirmPassword}
                                        onChange={(e) => setSignUpForm(prev => ({ ...prev, confirmPassword: e.target.value }))}
                                        required
                                    />
                                </label>
                                <button type="submit" className="btn btn--primary btn--lg btn--block" disabled={formLoading}>
                                    {formLoading ? <><span className="spinner" /> Creating account…</> : 'Create account'}
                                </button>
                            </form>
                            <div className="auth-footer">
                                <span>Already have an account? <button onClick={() => handleMenuClick('signin')} className="link-button">Sign in</button></span>
                            </div>
                        </div>
                    </div>
                );
            case 'signin':
                if (user) return signedInCard('Welcome back!');
                return (
                    <div className="auth-wrap">
                        <div className="card auth-card">
                            <div className="auth-icon"><AnchorIcon size="lg" /></div>
                            <h1>Welcome back</h1>
                            <p className="auth-sub">Sign in to add slipways, edit details and upload photos.</p>
                            {formAlerts}
                            {socialButtons('Sign in')}
                            <form className="form" onSubmit={handleSignIn}>
                                <label className="field">
                                    <span className="field-label">Email</span>
                                    <input
                                        className="input"
                                        type="email"
                                        autoComplete="email"
                                        placeholder="you@example.com"
                                        value={signInForm.email}
                                        onChange={(e) => setSignInForm(prev => ({ ...prev, email: e.target.value }))}
                                        required
                                    />
                                </label>
                                <label className="field">
                                    <span className="field-label" style={{ display: 'flex', justifyContent: 'space-between' }}>
                                        Password
                                        <button type="button" onClick={() => handleMenuClick('forgot-password')} className="link-button" style={{ fontSize: 13 }}>
                                            Forgot password?
                                        </button>
                                    </span>
                                    <input
                                        className="input"
                                        type="password"
                                        autoComplete="current-password"
                                        value={signInForm.password}
                                        onChange={(e) => setSignInForm(prev => ({ ...prev, password: e.target.value }))}
                                        required
                                    />
                                </label>
                                <button type="submit" className="btn btn--primary btn--lg btn--block" disabled={formLoading}>
                                    {formLoading ? <><span className="spinner" /> Signing in…</> : 'Sign in'}
                                </button>
                            </form>
                            <div className="auth-footer">
                                <span>New to Boatlaunch? <button onClick={() => handleMenuClick('signup')} className="link-button">Create an account</button></span>
                            </div>
                        </div>
                    </div>
                );
            case 'forgot-password':
                return (
                    <div className="auth-wrap">
                        <div className="card auth-card">
                            <div className="auth-icon"><MailIcon size="lg" /></div>
                            <h1>Reset your password</h1>
                            <p className="auth-sub">Enter your email and we'll send you a link to reset your password.</p>
                            {formAlerts}
                            <form className="form" onSubmit={handleForgotPassword}>
                                <label className="field">
                                    <span className="field-label">Email</span>
                                    <input
                                        className="input"
                                        type="email"
                                        autoComplete="email"
                                        placeholder="you@example.com"
                                        value={resetEmailForm.email}
                                        onChange={(e) => setResetEmailForm({ email: e.target.value })}
                                        required
                                    />
                                </label>
                                <button type="submit" className="btn btn--primary btn--lg btn--block" disabled={formLoading}>
                                    {formLoading ? <><span className="spinner" /> Sending…</> : 'Send reset link'}
                                </button>
                            </form>
                            <div className="auth-footer">
                                <span>Remembered it? <button onClick={() => handleMenuClick('signin')} className="link-button">Back to sign in</button></span>
                            </div>
                        </div>
                    </div>
                );
            case 'addSlipway':
            case 'add-slipway':
                return (
                    <AddSlipway
                        initialLocation={addSlipwayLocation}
                        onNavigate={handleMenuClick}
                    />
                );
            case 'about':
                return (
                    <div className="page page--narrow">
                        <div className="card prose">
                            <h1 className="page-title">About Boatlaunch</h1>
                            <p className="page-lead">Find and share boat launch locations across the UK.</p>
                            <p>
                                Boatlaunch is a community-maintained map of slipways. Our mission is to help boaters
                                discover the right slipway for their next trip, with the details that matter:
                                tidal access, trailer suitability, charges and local hazards.
                            </p>
                            <h3>What you can do</h3>
                            <ul className="feature-list">
                                <li><PinIcon />Browse a map of UK slipways with detailed information</li>
                                <li><NavigationIcon />Find launches near you and get directions</li>
                                <li><CameraIcon />See and share photos from other boaters</li>
                                <li><UserIcon />Add new slipways and keep details up to date</li>
                            </ul>
                        </div>
                    </div>
                );
            case 'feedback':
                return <Feedback onNavigate={handleMenuClick} />;
            case 'donate':
                return <Donate />;
            case 'contact':
                return (
                    <div className="page page--narrow">
                        <div className="card">
                            <h1 className="page-title">Contact</h1>
                            <p className="page-lead">Questions, suggestions or found a problem? Get in touch.</p>
                            <a className="contact-tile" href="mailto:conorc1000@gmail.com">
                                <span className="tile-icon"><MailIcon /></span>
                                <span>
                                    <small>Email the developer</small>
                                    <strong>conorc1000@gmail.com</strong>
                                </span>
                            </a>
                            <button className="contact-tile contact-tile--button" onClick={() => handleMenuClick('feedback')}>
                                <span className="tile-icon"><MessageIcon /></span>
                                <span>
                                    <small>Found a bug or have an idea?</small>
                                    <strong>Send feedback</strong>
                                </span>
                            </button>
                        </div>
                    </div>
                );
            default:
                return <Map onNavigate={handleMenuClick} />;
        }
    };

    if (loading) {
        return (
            <div className="app">
                <div className="center-state">
                    <span className="spinner spinner--lg" style={{ color: 'var(--primary)' }} />
                    <span>Loading…</span>
                </div>
            </div>
        );
    }

    const navItems = [
        { view: 'map', label: 'Map', icon: <MapIcon /> },
        { view: 'about', label: 'About', icon: <InfoIcon /> },
        { view: 'feedback', label: 'Feedback', icon: <MessageIcon /> },
        { view: 'contact', label: 'Contact', icon: <MailIcon /> },
    ];

    const isFullBleed = activeView === 'map';

    return (
        <div className="app">
            <header className="topbar">
                <button className="brand" onClick={() => handleMenuClick('map')} aria-label="Boatlaunch home">
                    <span className="brand-mark"><AnchorIcon /></span>
                    <span>
                        <span className="brand-name">Boatlaunch</span>
                        <span className="brand-tagline">UK slipway finder</span>
                    </span>
                </button>

                <nav className="nav" aria-label="Main">
                    {navItems.map(item => (
                        <button
                            key={item.view}
                            className={`nav-link ${activeView === item.view ? 'active' : ''}`}
                            onClick={() => handleMenuClick(item.view)}
                        >
                            {item.label}
                        </button>
                    ))}
                </nav>

                <div className="topbar-actions" ref={menuRef}>
                    <button
                        className={`btn btn--coffee-ghost coffee-link ${activeView === 'donate' ? 'active' : ''}`}
                        onClick={() => handleMenuClick('donate')}
                    >
                        <CoffeeIcon size="sm" /> Buy me a coffee
                    </button>
                    {user ? (
                        <div className="account">
                            <button
                                className="account-button"
                                onClick={() => setDropdownOpen(!dropdownOpen)}
                                aria-haspopup="menu"
                                aria-expanded={dropdownOpen}
                            >
                                <span className="avatar">{(user.email || 'U').charAt(0)}</span>
                                <span className="account-email">{user.email}</span>
                            </button>
                        </div>
                    ) : (
                        <div className="auth-buttons btn-row">
                            <button className="btn btn--ghost" onClick={() => handleMenuClick('signin')}>Sign in</button>
                            <button className="btn btn--primary" onClick={() => handleMenuClick('signup')}>Sign up</button>
                        </div>
                    )}

                    <button
                        className="btn btn--ghost btn--icon menu-toggle"
                        onClick={() => setDropdownOpen(!dropdownOpen)}
                        aria-label={dropdownOpen ? 'Close menu' : 'Open menu'}
                        aria-expanded={dropdownOpen}
                    >
                        {dropdownOpen ? <XIcon /> : <MenuIcon />}
                    </button>

                    {dropdownOpen && (
                        <div className="menu" role="menu">
                            {user && (
                                <div className="menu-header">
                                    <small>Signed in as</small>
                                    <strong>{user.email}</strong>
                                </div>
                            )}
                            <div className="menu-mobile-only">
                                {navItems.map(item => (
                                    <button
                                        key={item.view}
                                        className={`menu-item ${activeView === item.view ? 'active' : ''}`}
                                        onClick={() => handleMenuClick(item.view)}
                                    >
                                        {item.icon}{item.label}
                                    </button>
                                ))}
                                <button
                                    className={`menu-item ${activeView === 'donate' ? 'active' : ''}`}
                                    onClick={() => handleMenuClick('donate')}
                                >
                                    <CoffeeIcon />Buy me a coffee
                                </button>
                                <div className="menu-divider" />
                            </div>
                            {user ? (
                                <button className="menu-item menu-item--danger" onClick={handleLogout}>
                                    <LogOutIcon />Sign out
                                </button>
                            ) : (
                                <div className="menu-mobile-only">
                                    <button className="menu-item" onClick={() => handleMenuClick('signin')}>
                                        <UserIcon />Sign in
                                    </button>
                                    <div style={{ padding: '6px 4px 2px' }}>
                                        <button className="btn btn--primary btn--block btn--lg" onClick={() => handleMenuClick('signup')}>
                                            Create an account
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </header>
            <main className={`app-main ${isFullBleed ? 'app-main--full' : ''}`}>
                {renderContent()}
            </main>
        </div>
    );
}

export default App;
