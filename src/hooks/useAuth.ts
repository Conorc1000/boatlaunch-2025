import { useState, useEffect } from 'react';
import {
    User,
    signInWithEmailAndPassword,
    createUserWithEmailAndPassword,
    signOut,
    onAuthStateChanged,
    signInWithPopup,
    GoogleAuthProvider,
    FacebookAuthProvider,
    sendPasswordResetEmail
} from 'firebase/auth';
import { auth } from '../firebase';

export interface AuthState {
    user: User | null;
    loading: boolean;
    error: string | null;
}

export const useAuth = () => {
    const [authState, setAuthState] = useState<AuthState>({
        user: null,
        loading: true,
        error: null
    });

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (user) => {
            setAuthState({
                user,
                loading: false,
                error: null
            });
        });

        return unsubscribe;
    }, []);

    const signIn = async (email: string, password: string) => {
        try {
            setAuthState(prev => ({ ...prev, loading: true, error: null }));
            const userCredential = await signInWithEmailAndPassword(auth, email, password);
            setAuthState({
                user: userCredential.user,
                loading: false,
                error: null
            });
            return userCredential.user;
        } catch (error: any) {
            const errorMessage = error.message || 'Failed to sign in';
            setAuthState(prev => ({
                ...prev,
                loading: false,
                error: errorMessage
            }));
            throw error;
        }
    };

    const signInWithGoogle = async () => {
        try {
            setAuthState(prev => ({ ...prev, loading: true, error: null }));
            const provider = new GoogleAuthProvider();
            const userCredential = await signInWithPopup(auth, provider);
            setAuthState({
                user: userCredential.user,
                loading: false,
                error: null
            });
            return userCredential.user;
        } catch (error: any) {
            const errorMessage = error.message || 'Failed to sign in with Google';
            setAuthState(prev => ({
                ...prev,
                loading: false,
                error: errorMessage
            }));
            throw error;
        }
    };

    const signInWithFacebook = async () => {
        try {
            setAuthState(prev => ({ ...prev, loading: true, error: null }));
            const provider = new FacebookAuthProvider();
            const userCredential = await signInWithPopup(auth, provider);
            setAuthState({
                user: userCredential.user,
                loading: false,
                error: null
            });
            return userCredential.user;
        } catch (error: any) {
            const errorMessage = error.message || 'Failed to sign in with Facebook';
            setAuthState(prev => ({
                ...prev,
                loading: false,
                error: errorMessage
            }));
            throw error;
        }
    };

    const resetPassword = async (email: string) => {
        try {
            setAuthState(prev => ({ ...prev, loading: true, error: null }));
            await sendPasswordResetEmail(auth, email);
            setAuthState(prev => ({
                ...prev,
                loading: false,
                error: null
            }));
            return true;
        } catch (error: any) {
            const errorMessage = error.message || 'Failed to send password reset email';
            setAuthState(prev => ({
                ...prev,
                loading: false,
                error: errorMessage
            }));
            throw error;
        }
    };

    const signUp = async (email: string, password: string) => {
        try {
            setAuthState(prev => ({ ...prev, loading: true, error: null }));
            const userCredential = await createUserWithEmailAndPassword(auth, email, password);
            setAuthState({
                user: userCredential.user,
                loading: false,
                error: null
            });
            return userCredential.user;
        } catch (error: any) {
            const errorMessage = error.message || 'Failed to create account';
            setAuthState(prev => ({
                ...prev,
                loading: false,
                error: errorMessage
            }));
            throw error;
        }
    };

    const logout = async () => {
        try {
            await signOut(auth);
            setAuthState({
                user: null,
                loading: false,
                error: null
            });
        } catch (error: any) {
            const errorMessage = error.message || 'Failed to sign out';
            setAuthState(prev => ({
                ...prev,
                error: errorMessage
            }));
        }
    };

    return {
        ...authState,
        signIn,
        signInWithGoogle,
        signInWithFacebook,
        resetPassword,
        signUp,
        logout
    };
};
