import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { login as apiLogin, getMe, logout as apiLogout } from '../services/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
    const navigate = useNavigate();
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const redirectUser = (userData) => {
        if (!userData) return;

        if (userData.role === 'vendor') {
            navigate('/vendor');
        } else {
            navigate('/customer');
        }
    };

    const fetchMe = useCallback(async () => {
        const token = localStorage.getItem('access_token');
        if (!token) { setLoading(false); return; }
        try {
            const { data } = await getMe();
            setUser(data);
            redirectUser(data);
        } catch {
            localStorage.clear();
        } finally {
            setLoading(false);
        }
    }, []);

    const refreshUser = useCallback(async () => {
        const { data } = await getMe();
        setUser(data);
        return data;
    }, []);

    useEffect(() => { fetchMe(); }, [fetchMe]);

    const login = async (email, password, role) => {
        const { data } = await apiLogin(email, password, role);
        localStorage.setItem('access_token', data.access);
        localStorage.setItem('refresh_token', data.refresh);
        try {
            const me = await getMe();
            setUser(me.data);
            redirectUser(me.data);
            return me.data;
        } catch (e) {                       // signed in but profile failed: never leave half-logged-in tokens
            localStorage.clear();
            setUser(null);
            throw e;
        }
    };

    const logout = async () => {
        try {
            const refresh = localStorage.getItem('refresh_token');
            await apiLogout(refresh);
        } catch { }
        localStorage.clear();
        setUser(null);
        navigate('/');
    };

    return (
        <AuthContext.Provider value={{ user, loading, login, logout, fetchMe, refreshUser }}>
            {children}
        </AuthContext.Provider>
    );
}

export const useAuth = () => useContext(AuthContext);