import React, { useEffect, useState } from 'react';
import { onValue, push, ref, remove, serverTimestamp, set } from 'firebase/database';
import { database } from '../firebase';
import { useAuth } from '../hooks/useAuth';
import { Comment } from '../types/Slipway';
import { MessageIcon } from './Icons';
import { getDisplayName } from '../services/attribution';

const MAX_LENGTH = 2000; // Keep in sync with database.rules.json

interface SlipwayCommentsProps {
    slipwayId: string;
    onNavigate?: (view: string, data?: any) => void;
}

const formatCommentDate = (timestamp: number) => new Date(timestamp).toLocaleString(undefined, {
    day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
});

// Comments live at comments/{slipwayId}/{commentId}, outside slipwayDetails, so editing a slipway can't wipe them
const SlipwayComments: React.FC<SlipwayCommentsProps> = ({ slipwayId, onNavigate }) => {
    const { user } = useAuth();
    const [comments, setComments] = useState<Comment[]>([]);
    const [text, setText] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const commentsRef = ref(database, `comments/${slipwayId}`);
        return onValue(commentsRef, (snapshot) => {
            const value = snapshot.val() || {};
            const list: Comment[] = Object.entries(value).map(([id, c]: [string, any]) => ({ id, ...c }));
            // Newest first; a just-posted comment has a local estimate of createdAt until the server confirms it
            list.sort((a, b) => b.createdAt - a.createdAt);
            setComments(list);
        }, (err) => console.error('Failed to load comments:', err));
    }, [slipwayId]);

    const handleSubmit = async (event: React.FormEvent) => {
        event.preventDefault();
        const trimmed = text.trim();
        if (!user || !trimmed || submitting) return;

        try {
            setSubmitting(true);
            setError(null);
            await set(push(ref(database, `comments/${slipwayId}`)), {
                uid: user.uid,
                userName: getDisplayName(user),
                text: trimmed,
                createdAt: serverTimestamp()
            });
            setText('');
        } catch (err) {
            console.error('Error posting comment:', err);
            setError('Your comment could not be posted. Please try again.');
        } finally {
            setSubmitting(false);
        }
    };

    const handleDelete = async (commentId: string) => {
        if (!window.confirm('Delete this comment?')) return;
        try {
            await remove(ref(database, `comments/${slipwayId}/${commentId}`));
        } catch (err) {
            console.error('Error deleting comment:', err);
            setError('The comment could not be deleted. Please try again.');
        }
    };

    return (
        <section className="sv-section">
            <div className="sv-section-head">
                <h2 className="sv-section-title">
                    Comments <span className="count">{comments.length}</span>
                </h2>
            </div>

            {user ? (
                <form className="comment-form" onSubmit={handleSubmit}>
                    <textarea
                        className="textarea"
                        value={text}
                        onChange={(e) => setText(e.target.value)}
                        placeholder="Share an update: conditions, access, parking..."
                        maxLength={MAX_LENGTH}
                        rows={3}
                        aria-label="Add a comment"
                        disabled={submitting}
                    />
                    <div className="comment-form-actions">
                        {error && <span className="comment-error" role="alert">{error}</span>}
                        <button type="submit" className="btn btn--primary btn--sm" disabled={submitting || !text.trim()}>
                            {submitting ? <><span className="spinner" /> Posting</> : 'Post comment'}
                        </button>
                    </div>
                </form>
            ) : (
                <p className="comment-signin">
                    <button className="link-button" onClick={() => onNavigate && onNavigate('signin')}>Sign in</button> to leave a comment.
                </p>
            )}

            {comments.length === 0 ? (
                <div className="empty-state">
                    <MessageIcon size="lg" />
                    <strong>No comments yet</strong>
                    <span>Been here recently? Let other boaters know how it was.</span>
                </div>
            ) : (
                <ul className="comment-list">
                    {comments.map((comment) => (
                        <li key={comment.id} className="comment">
                            <div className="comment-head">
                                <strong className="comment-author">{comment.userName}</strong>
                                <time className="comment-date" dateTime={new Date(comment.createdAt).toISOString()}>
                                    {formatCommentDate(comment.createdAt)}
                                </time>
                                {user?.uid === comment.uid && (
                                    <button className="link-button comment-delete" onClick={() => handleDelete(comment.id)}>
                                        Delete
                                    </button>
                                )}
                            </div>
                            <p className="comment-text">{comment.text}</p>
                        </li>
                    ))}
                </ul>
            )}
        </section>
    );
};

export default SlipwayComments;
