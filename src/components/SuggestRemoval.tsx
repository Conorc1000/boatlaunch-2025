import React, { useEffect, useState } from 'react';
import { get, ref, remove, serverTimestamp, set } from 'firebase/database';
import { database } from '../firebase';
import { useAuth } from '../hooks/useAuth';
import { attributionFor, formatShortDate } from '../services/attribution';

const MAX_NOTE_LENGTH = 1000; // Keep in sync with database.rules.json

// Keys are stored; keep in sync with database.rules.json
export const REMOVAL_REASONS: Record<string, string> = {
    closed: 'Closed or no longer usable',
    private: 'Private, no public access',
    not_here: "There's no slipway here",
    duplicate: 'Duplicate of another slipway',
    unsafe: 'Unsafe',
    other: 'Something else'
};

interface SuggestRemovalProps {
    slipwayId: string;
    slipwayName: string;
    onNavigate?: (view: string, data?: any) => void;
}

interface ExistingRequest {
    reason: string;
    createdAt: number;
}

// One request per user per slipway at removalRequests/{slipwayId}/{uid}; only the admin can read them all
const SuggestRemoval: React.FC<SuggestRemovalProps> = ({ slipwayId, slipwayName, onNavigate }) => {
    const { user } = useAuth();
    const [open, setOpen] = useState(false);
    const [reason, setReason] = useState('');
    const [note, setNote] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [existing, setExisting] = useState<ExistingRequest | null>(null);

    const requestPath = user ? `removalRequests/${slipwayId}/${user.uid}` : null;

    useEffect(() => {
        setExisting(null);
        setOpen(false);
        if (!requestPath) return;
        let cancelled = false;
        get(ref(database, requestPath))
            .then((snapshot) => { if (!cancelled && snapshot.exists()) setExisting(snapshot.val()); })
            .catch((err) => console.warn('Could not check for an existing removal request:', err));
        return () => { cancelled = true; };
    }, [requestPath]);

    const handleSubmit = async (event: React.FormEvent) => {
        event.preventDefault();
        if (!user || !requestPath || !reason || submitting) return;
        try {
            setSubmitting(true);
            setError(null);
            await set(ref(database, requestPath), {
                reason,
                ...(note.trim() ? { note: note.trim() } : {}),
                slipwayName,
                // Admin-only, so it can hold the email that public attribution leaves out
                requestedBy: { ...attributionFor(user), ...(user.email ? { email: user.email } : {}) },
                createdAt: serverTimestamp()
            });
            setExisting({ reason, createdAt: Date.now() });
            setOpen(false);
            setNote('');
            setReason('');
        } catch (err) {
            console.error('Error saving removal request:', err);
            setError('Your request could not be sent. Please try again.');
        } finally {
            setSubmitting(false);
        }
    };

    const handleWithdraw = async () => {
        if (!requestPath) return;
        try {
            await remove(ref(database, requestPath));
            setExisting(null);
        } catch (err) {
            console.error('Error withdrawing removal request:', err);
            setError('Your request could not be withdrawn. Please try again.');
        }
    };

    if (existing) {
        return (
            <p className="suggest-removal">
                You suggested removing this slipway on {formatShortDate(existing.createdAt)} ({REMOVAL_REASONS[existing.reason]?.toLowerCase() || existing.reason}). Thanks, we'll take a look.{' '}
                <button className="link-button" onClick={handleWithdraw}>Withdraw</button>
                {error && <span className="comment-error" role="alert"> {error}</span>}
            </p>
        );
    }

    if (!open) {
        return (
            <p className="suggest-removal">
                Closed, private or not really here?{' '}
                {user ? (
                    <button className="link-button" onClick={() => setOpen(true)}>Suggest removing this slipway</button>
                ) : (
                    <><button className="link-button" onClick={() => onNavigate && onNavigate('signin')}>Sign in</button> to suggest removing it.</>
                )}
            </p>
        );
    }

    return (
        <form className="sv-section suggest-removal-form" onSubmit={handleSubmit}>
            <h2 className="sv-section-title">Suggest removing this slipway</h2>
            <fieldset className="suggest-removal-reasons" disabled={submitting}>
                <legend className="sr-only">Reason</legend>
                {Object.entries(REMOVAL_REASONS).map(([key, label]) => (
                    <label key={key}>
                        <input type="radio" name="removal-reason" value={key} checked={reason === key} onChange={() => setReason(key)} />
                        {label}
                    </label>
                ))}
            </fieldset>
            <textarea
                className="textarea"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder={reason === 'duplicate' ? 'Which slipway is it a duplicate of?' : 'Anything else we should know? (optional)'}
                maxLength={MAX_NOTE_LENGTH}
                rows={3}
                aria-label="Details"
                disabled={submitting}
            />
            <div className="comment-form-actions">
                {error && <span className="comment-error" role="alert">{error}</span>}
                <button type="button" className="btn btn--secondary btn--sm" onClick={() => setOpen(false)} disabled={submitting}>Cancel</button>
                <button type="submit" className="btn btn--primary btn--sm" disabled={submitting || !reason}>
                    {submitting ? <><span className="spinner" /> Sending</> : 'Send'}
                </button>
            </div>
        </form>
    );
};

export default SuggestRemoval;
