import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthPage, ChatPage } from './pages';
import { LoadingScreen } from './components/common';
import { useAuthStore } from './store';
import { onAuthStateChange, getCurrentUser } from './lib/supabase';

function App() {
  const { user, isLoading, setUser, setLoading } = useAuthStore();

  useEffect(() => {
    // Check initial auth state
    const checkAuth = async () => {
      const { user: currentUser } = await getCurrentUser();
      if (currentUser) {
        setUser({
          id: currentUser.id,
          email: currentUser.email || '',
          createdAt: currentUser.created_at || new Date().toISOString(),
        });
      } else {
        setLoading(false);
      }
    };

    checkAuth();

    // Subscribe to auth changes
    const { data: { subscription } } = onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' && session) {
        const sessionUser = (session as { user: { id: string; email?: string; created_at?: string } }).user;
        setUser({
          id: sessionUser.id,
          email: sessionUser.email || '',
          createdAt: sessionUser.created_at || new Date().toISOString(),
        });
      } else if (event === 'SIGNED_OUT') {
        setUser(null);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [setUser, setLoading]);

  if (isLoading) {
    return <LoadingScreen message="Initializing secure connection..." />;
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route
          path="/auth"
          element={user ? <Navigate to="/" replace /> : <AuthPage />}
        />
        <Route
          path="/"
          element={user ? <ChatPage /> : <Navigate to="/auth" replace />}
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
