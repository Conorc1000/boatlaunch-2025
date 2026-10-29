import React, { useState } from 'react';
import { ref, push, serverTimestamp } from 'firebase/database';
import { database } from '../firebase';
import { useAuth } from '../hooks/useAuth';
import { AlertIcon, CheckIcon, MessageIcon } from './Icons';

type FeedbackType = 'bug' | 'suggestion' | 'other';

const TYPES: { value: FeedbackType; label: string; placeholder: string }[] = [
    { value: 'bug', label: 'Report a bug', placeholder: 'What happened, and what did you expect to happen? Which slipway or page were you on?' },
    { value: 'suggestion', label: 'Suggestion', placeholder: 'What would make Boatlaunch more useful for you?' },
    { value: 'other', label: 'Something else', placeholder: 'Tell us what’s on your mind' },
];

const MAX_LENGTH = 5000;

interface FeedbackProps {
    onNavigate?: (view: string, data?: any) => void;
}

const Feedback: React.FC<FeedbackProps> = ({ onNavigate }) => {
    const { user } = useAuth();
    const [type, setType] = useState<FeedbackType>('suggestion');
    const [message, setMessage] = useState('');
    const [email, setEmail] = useState('');
    const [website, setWebsite] = useState(''); // Honeypot: real users never see or fill this
    const [sending, setSending] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [sent, setSent] = useState(false);

    const current = TYPES.find(t => t.value === type)!;
    const contactEmail = user?.email || email.trim();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (message.trim().length < 5) {
            setError('Please add a little more detail.');
            return;
        }
        if (website) {
            // Bot filled the hidden field; pretend it worked
            setSent(true);
            return;
        }

        try {
            setSending(true);
            setError(null);
            await push(ref(database, 'suggestions'), {
                type,
                message: message.trim(),
                createdAt: serverTimestamp(),
                ...(contactEmail ? { email: contactEmail } : {}),
                ...(user ? { uid: user.uid } : {}),
                userAgent: navigator.userAgent.slice(0, 500),
            });
            setSent(true);
            setMessage('');
        } catch (err) {
            console.error('Error sending feedback:', err);
            setError('Sorry, we couldn’t send that. Please try again in a moment.');
        } finally {
            setSending(false);
        }
    };

    if (sent) {
        return (
            <div className="page page--narrow">
                <div className="card center-card">
                    <div className="auth-icon auth-icon--success"><CheckIcon size="lg" /></div>
                    <h1 className="page-title">Thanks for the feedback!</h1>
                    <p className="page-lead">
                        {contactEmail
                            ? 'We’ve got your message and may reply by email if we need more detail.'
                            : 'We’ve got your message. Every report helps make Boatlaunch better.'}
                    </p>
                    <div className="btn-row" style={{ justifyContent: 'center' }}>
                        <button className="btn btn--secondary btn--lg" onClick={() => { setSent(false); setError(null); }}>
                            Send another
                        </button>
                        <button className="btn btn--primary btn--lg" onClick={() => onNavigate && onNavigate('map')}>
                            Back to the map
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="page page--narrow">
            <div className="card">
                <div className="auth-icon"><MessageIcon size="lg" /></div>
                <h1 className="page-title">Feedback</h1>
                <p className="page-lead">Found a bug or have an idea? Let us know — it all gets read.</p>

                {error && <div className="alert alert--error" role="alert"><AlertIcon />{error}</div>}

                <form className="form" onSubmit={handleSubmit}>
                    <div className="field" role="radiogroup" aria-labelledby="feedback-type-label">
                        <span className="field-label" id="feedback-type-label">What’s it about?</span>
                        <div className="chip-group">
                            {TYPES.map(t => (
                                <button
                                    key={t.value}
                                    type="button"
                                    role="radio"
                                    aria-checked={type === t.value}
                                    className={`chip ${type === t.value ? 'is-selected' : ''}`}
                                    onClick={() => setType(t.value)}
                                >
                                    {type === t.value && <CheckIcon size="sm" />}{t.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    <label className="field">
                        <span className="field-label">Message<span className="req">*</span></span>
                        <textarea
                            className="textarea"
                            style={{ minHeight: 160 }}
                            value={message}
                            maxLength={MAX_LENGTH}
                            onChange={(e) => setMessage(e.target.value)}
                            placeholder={current.placeholder}
                            required
                        />
                        <span className="field-hint" style={{ textAlign: 'right' }}>{message.length.toLocaleString()} / {MAX_LENGTH.toLocaleString()}</span>
                    </label>

                    {user ? (
                        <p className="field-hint">We’ll reply to <strong>{user.email}</strong> if we need more detail.</p>
                    ) : (
                        <label className="field">
                            <span className="field-label">Your email <span className="field-hint">(optional)</span></span>
                            <input
                                className="input"
                                type="email"
                                inputMode="email"
                                autoComplete="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                placeholder="So we can follow up"
                            />
                        </label>
                    )}

                    {/* Honeypot field to catch spam bots */}
                    <input
                        type="text"
                        name="website"
                        value={website}
                        onChange={(e) => setWebsite(e.target.value)}
                        tabIndex={-1}
                        autoComplete="off"
                        aria-hidden="true"
                        className="sr-only"
                    />

                    <button type="submit" className="btn btn--primary btn--lg btn--block" disabled={sending || !message.trim()}>
                        {sending ? <><span className="spinner" /> Sending…</> : 'Send feedback'}
                    </button>
                </form>
            </div>
        </div>
    );
};

export default Feedback;
