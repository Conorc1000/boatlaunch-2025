import React, { useState } from 'react';
import Map from './components/Map.tsx';
import SlipwayView from './components/SlipwayView.tsx';
import AddSlipway from './components/AddSlipway.tsx';
import { useAuth } from './hooks/useAuth.ts';
import './App.css';

function App() {
    const [activeView, setActiveView] = useState('map');
    const [selectedSlipwayId, setSelectedSlipwayId] = useState<string | null>(null);
    const [addSlipwayLocation, setAddSlipwayLocation] = useState<{ latitude: number; longitude: number } | null>(null);
    const [centerOnSlipway, setCenterOnSlipway] = useState<{ id: string; latitude: number; longitude: number; name: string } | null>(null);
    const [dropdownOpen, setDropdownOpen] = useState(false);
    const { user, loading, error, signIn, signInWithGoogle, signInWithFacebook, signUp, logout } = useAuth();

    // Form states
    const [signInForm, setSignInForm] = useState({ email: '', password: '' });
    const [signUpForm, setSignUpForm] = useState({ email: '', password: '', confirmPassword: '' });
    const [resetEmailForm, setResetEmailForm] = useState({ email: '' });
    const [formLoading, setFormLoading] = useState(false);
    const [formError, setFormError] = useState('');
    const [formSuccess, setFormSuccess] = useState('');

    const handleMenuClick = (view: string, data?: any) => {
        console.log('handleMenuClick called with:', { view, data });
        
        setActiveView(view);
        
        if (data) {
            if (typeof data === 'string') {
                // Legacy support for slipwayId
                setSelectedSlipwayId(data);
                setCenterOnSlipway(null); // Clear centering for non-centering navigation
            } else if (data.centerOnSlipway) {
                // Center map on newly added slipway - add timestamp to force re-render
                console.log('Setting centerOnSlipway:', data.centerOnSlipway);
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
            setActiveView('map');
        } catch (error) {
            console.error('Logout failed:', error);
        }
    };

    const getActiveViewName = () => {
        if (user && (activeView === 'signin' || activeView === 'signup')) {
            return user.email || 'User';
        }

        switch (activeView) {
            case 'map': return 'Map';
            case 'signup': return 'Sign Up';
            case 'signin': return 'Sign In';
            case 'forgot-password': return 'Reset Password';
            case 'add-slipway': return 'Add Slipway';
            case 'about': return 'About Us';
            case 'contact': return 'Contact Developer';
            default: return 'Map';
        }
    };

    const renderContent = () => {
        switch (activeView) {
            case 'map':
                return <Map onNavigate={handleMenuClick} centerOnSlipway={centerOnSlipway} />;
            case 'slipway-view':
                return selectedSlipwayId ? (
                    <SlipwayView slipwayId={selectedSlipwayId} onNavigate={handleMenuClick} />
                ) : (
                    <div className="content-section">
                        <h2>Slipway Not Found</h2>
                        <p>The requested slipway could not be found.</p>
                        <button onClick={() => handleMenuClick('map')} className="button-primary">
                            Back to Map
                        </button>
                    </div>
                );
            case 'signup':
                if (user) {
                    return (
                        <div className="content-section">
                            <h2>Welcome, {user.email}!</h2>
                            <p>You're already signed in. You can now save favorite slipways and contribute to the community.</p>
                            <button onClick={handleLogout} className="logout-button">Sign Out</button>
                        </div>
                    );
                }
                return (
                    <div className="content-section">
                        <h2>Sign Up</h2>
                        <p>Create your account to save favorite slipways and contribute to the community.</p>
                        {formError && <div className="error-message">{formError}</div>}

                        {/* Social Sign Up Options */}
                        <div className="social-auth-section">
                            <button
                                onClick={handleGoogleSignIn}
                                className="social-auth-button google"
                                disabled={formLoading}
                            >
                                <svg className="social-icon" viewBox="0 0 24 24" width="20" height="20">
                                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                                </svg>
                                {formLoading ? 'Signing up...' : 'Sign up with Google'}
                            </button>
                            <button
                                onClick={handleFacebookSignIn}
                                className="social-auth-button facebook"
                                disabled={formLoading}
                            >
                                <svg className="social-icon" viewBox="0 0 24 24" width="20" height="20">
                                    <path fill="#ffffff" d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
                                </svg>
                                {formLoading ? 'Signing up...' : 'Sign up with Facebook'}
                            </button>
                        </div>

                        <div className="auth-divider">
                            <span>or</span>
                        </div>

                        <form className="auth-form" onSubmit={handleSignUp}>
                            <input
                                type="email"
                                placeholder="Email"
                                value={signUpForm.email}
                                onChange={(e) => setSignUpForm(prev => ({ ...prev, email: e.target.value }))}
                                required
                            />
                            <input
                                type="password"
                                placeholder="Password (min 6 characters)"
                                value={signUpForm.password}
                                onChange={(e) => setSignUpForm(prev => ({ ...prev, password: e.target.value }))}
                                required
                            />
                            <input
                                type="password"
                                placeholder="Confirm Password"
                                value={signUpForm.confirmPassword}
                                onChange={(e) => setSignUpForm(prev => ({ ...prev, confirmPassword: e.target.value }))}
                                required
                            />
                            <button type="submit" disabled={formLoading}>
                                {formLoading ? 'Creating Account...' : 'Sign Up with Email'}
                            </button>
                        </form>

                        {/* Navigation to Sign In */}
                        <div className="auth-navigation">
                            <p>Already have an account?
                                <button
                                    onClick={() => handleMenuClick('signin')}
                                    className="auth-link"
                                >
                                    Sign In
                                </button>
                            </p>
                        </div>
                    </div>
                );
            case 'signin':
                if (user) {
                    return (
                        <div className="content-section">
                            <h2>Welcome back, {user.email}!</h2>
                            <p>You're successfully signed in. Explore the map and manage your slipways.</p>
                            <button onClick={handleLogout} className="logout-button">Sign Out</button>
                        </div>
                    );
                }

                return (
                    <div className="content-section">
                        <h2>Sign In</h2>
                        <p>Welcome back! Sign in to access your saved slipways.</p>
                        {formError && <div className="error-message">{formError}</div>}

                        {/* Social Sign In Options */}
                        <div className="social-auth-section">
                            <button
                                onClick={handleGoogleSignIn}
                                className="social-auth-button google"
                                disabled={formLoading}
                            >
                                <svg className="social-icon" viewBox="0 0 24 24" width="20" height="20">
                                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                                </svg>
                                {formLoading ? 'Signing in...' : 'Sign in with Google'}
                            </button>
                            <button
                                onClick={handleFacebookSignIn}
                                className="social-auth-button facebook"
                                disabled={formLoading}
                            >
                                <svg className="social-icon" viewBox="0 0 24 24" width="20" height="20">
                                    <path fill="#ffffff" d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
                                </svg>
                                {formLoading ? 'Signing in...' : 'Sign in with Facebook'}
                            </button>
                        </div>

                        <div className="auth-divider">
                            <span>or</span>
                        </div>

                        <form className="auth-form" onSubmit={handleSignIn}>
                            <input
                                type="email"
                                placeholder="Email"
                                value={signInForm.email}
                                onChange={(e) => setSignInForm(prev => ({ ...prev, email: e.target.value }))}
                                required
                            />
                            <input
                                type="password"
                                placeholder="Password"
                                value={signInForm.password}
                                onChange={(e) => setSignInForm(prev => ({ ...prev, password: e.target.value }))}
                                required
                            />
                            <button type="submit" disabled={formLoading}>
                                {formLoading ? 'Signing In...' : 'Sign In with Email'}
                            </button>
                        </form>

                        {/* Forgot Password and Sign Up Links */}
                        <div className="auth-navigation">
                            <p>
                                <button
                                    onClick={() => handleMenuClick('forgot-password')}
                                    className="auth-link"
                                >
                                    Forgot Password?
                                </button>
                            </p>
                            <p>Don't have an account?
                                <button
                                    onClick={() => handleMenuClick('signup')}
                                    className="auth-link"
                                >
                                    Sign Up
                                </button>
                            </p>
                        </div>
                    </div>
                );
            case 'forgot-password':
                return (
                    <div className="content-section">
                        <h2>Reset Password</h2>
                        <p>Enter your email address and we'll send you a link to reset your password.</p>
                        {formError && <div className="error-message">{formError}</div>}
                        {formSuccess && <div className="success-message">{formSuccess}</div>}

                        <form className="auth-form" onSubmit={(e) => handleForgotPassword(e)}>
                            <input
                                type="email"
                                placeholder="Email Address"
                                value={resetEmailForm.email}
                                onChange={(e) => setResetEmailForm({ email: e.target.value })}
                                required
                            />
                            <button type="submit" disabled={formLoading}>
                                {formLoading ? 'Sending...' : 'Send Password Reset Email'}
                            </button>
                        </form>

                        <div className="auth-navigation">
                            <p>Remember your password?
                                <button
                                    onClick={() => handleMenuClick('signin')}
                                    className="auth-link"
                                >
                                    Back to Sign In
                                </button>
                            </p>
                            <p>Don't have an account?
                                <button
                                    onClick={() => handleMenuClick('signup')}
                                    className="auth-link"
                                >
                                    Sign Up
                                </button>
                            </p>
                        </div>
                    </div>
                );
            case 'addSlipway':
                console.log('Rendering AddSlipway with addSlipwayLocation:', addSlipwayLocation);
                return (
                    <AddSlipway 
                        initialLocation={addSlipwayLocation} 
                        onNavigate={handleMenuClick} 
                    />
                );
            case 'add-slipway':
                return (
                    <AddSlipway 
                        initialLocation={addSlipwayLocation} 
                        onNavigate={handleMenuClick} 
                    />
                );
            case 'about':
                return (
                    <div className="content-section">
                        <h2>About Us</h2>
                        <p>
                            Boatlaunch is a comprehensive platform for finding and sharing boat launch locations
                            across the UK. Our mission is to help boaters discover the perfect slipway for their
                            next adventure.
                        </p>
                        <h3>Features</h3>
                        <ul>
                            <li>Interactive map with detailed slipway information</li>
                            <li>Comprehensive database of UK boat launches</li>
                            <li>User-contributed content and reviews</li>
                            <li>Detailed facility and access information</li>
                            <li>Mobile-friendly design for on-the-go use</li>
                        </ul>
                    </div>
                );
            case 'contact':
                return (
                    <div className="content-section">
                        <h2>Contact Developer</h2>
                        <p>Have questions, suggestions, or found an issue? Get in touch!</p>
                        <form className="contact-form">
                            <input type="text" placeholder="Your Name" required />
                            <input type="email" placeholder="Your Email" required />
                            <input type="text" placeholder="Subject" required />
                            <textarea placeholder="Your Message" rows={6} required></textarea>
                            <button type="submit">Send Message</button>
                        </form>
                        <div className="contact-info">
                            <h3>Other Ways to Reach Us</h3>
                            <p>Email: developer@boatlaunch.com</p>
                            <p>GitHub: github.com/boatlaunch</p>
                        </div>
                    </div>
                );
            default:
                return <Map />;
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

    if (loading) {
        return (
            <div className="App">
                <div className="loading-screen">
                    <h2>Loading...</h2>
                </div>
            </div>
        );
    }

    return (
        <div className="App">
            <header className="App-header">
                <div className="header-content">
                    <div className="logo-section">
                        <h1>Boatlaunch</h1>
                        <p>Explore boat launch locations with our interactive map</p>
                    </div>

                    {/* User Status */}
                    {user && (
                        <div className="user-status">
                            <span>Welcome, {user.email}</span>
                        </div>
                    )}

                    {/* Dropdown Navigation */}
                    <div className="dropdown-nav">
                        <button
                            className={`dropdown-toggle ${dropdownOpen ? 'open' : ''}`}
                            onClick={() => setDropdownOpen(!dropdownOpen)}
                            aria-label="Navigation menu"
                        >
                            {getActiveViewName()}
                            <span className="dropdown-arrow">▼</span>
                        </button>

                        {dropdownOpen && (
                            <div className="dropdown-menu">
                                <button
                                    className={activeView === 'map' ? 'dropdown-item active' : 'dropdown-item'}
                                    onClick={() => handleMenuClick('map')}
                                >
                                    Map
                                </button>
                                <button
                                    className={activeView === 'add-slipway' ? 'dropdown-item active' : 'dropdown-item'}
                                    onClick={() => handleMenuClick('add-slipway')}
                                >
                                    Add Slipway
                                </button>
                                <button
                                    className={activeView === 'about' ? 'dropdown-item active' : 'dropdown-item'}
                                    onClick={() => handleMenuClick('about')}
                                >
                                    About Us
                                </button>
                                <button
                                    className={activeView === 'contact' ? 'dropdown-item active' : 'dropdown-item'}
                                    onClick={() => handleMenuClick('contact')}
                                >
                                    Contact Developer
                                </button>
                                <div className="dropdown-divider"></div>
                                {user ? (
                                    <button
                                        className="dropdown-item logout"
                                        onClick={handleLogout}
                                    >
                                        Sign Out
                                    </button>
                                ) : (
                                    <>
                                        <button
                                            className={activeView === 'signin' ? 'dropdown-item active' : 'dropdown-item'}
                                            onClick={() => handleMenuClick('signin')}
                                        >
                                            Sign In
                                        </button>
                                        <button
                                            className={activeView === 'signup' ? 'dropdown-item signup active' : 'dropdown-item signup'}
                                            onClick={() => handleMenuClick('signup')}
                                        >
                                            Sign Up
                                        </button>
                                    </>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </header>
            <main className="App-main">
                {renderContent()}
            </main>
        </div>
    );
}

export default App;
