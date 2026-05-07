import React, { useState, useEffect } from 'react';
import { 
  BookOpen, Users, Calendar as CalendarIcon, CheckSquare, 
  Settings, LogOut, FileCheck, Bell, Activity,
  FileSpreadsheet, ChevronLeft, ChevronRight, Clock, User, Shield
} from 'lucide-react';

import LoginView from './pages/Login';
import Dashboard from './pages/Dashboard';
import TasksSchedule from './pages/Tasks_Schedule';
import Profile from './pages/Profile';
import Repository from './pages/Dept_Repository';
import Directory from './pages/Faculty_Dir';
import Grades from './pages/Grades';
import UserManagement from './pages/User_Management';
import SystemSettings from './pages/System_Settings';
import GradeApprovals from './pages/Grade_Approvals';

// ============================================================
//  API BASE URL — points to your Express backend
//  Make sure your backend is running on port 3000
// ============================================================
export const API_BASE = '/api';

// ============================================================
//  APP
// ============================================================
export default function App() {
  const [currentUser, setCurrentUser]   = useState(null);
  const [currentView, setCurrentView]   = useState('dashboard');
  const [isRestoring, setIsRestoring]   = useState(true); // checking session on load

  // Shared state — now loaded from backend via /api/dashboard
  const [tasks, setTasks]               = useState([]);
  const [eventsList, setEventsList]     = useState([]);
  const [announcements, setAnnouncements] = useState([]);

  // ── On app load: try to restore session from cookie ──────
  // This fixes the "reload = logout" problem!
  // Calls GET /api/auth/me — if cookie is still valid, user stays logged in
  useEffect(() => {
    const restoreSession = async () => {
      try {
        const response = await fetch(`${API_BASE}/auth/me`, {
          credentials: 'include', // sends the session_id cookie
        });

        if (response.ok) {
          const data = await response.json();
          setCurrentUser(data.user);
          // Load dashboard data right away
          await loadDashboardData();
        }
      } catch (err) {
        // No valid session — stay on login page
        console.log('No active session found.');
      } finally {
        setIsRestoring(false);
      }
    };

    restoreSession();
  }, []);

  // ── Load dashboard data from backend ─────────────────────
  // Fetches tasks, eventsList, announcements all in one call
  const loadDashboardData = async () => {
    try {
      const response = await fetch(`${API_BASE}/dashboard`, {
        credentials: 'include',
      });
      if (response.ok) {
        const data = await response.json();
        setTasks(data.tasks           || []);
        setEventsList(data.eventsList || []);
        setAnnouncements(data.announcements || []);
      }
    } catch (err) {
      console.error('Failed to load dashboard data:', err.message);
    }
  };

  // ── Login handler — called by Login.jsx onLogin(user) ────
  // Login.jsx now passes the real user object from the backend
  // Small delay ensures the session cookie is fully set before fetching
  const handleLogin = async (user) => {
    setCurrentUser(user);
    setCurrentView('dashboard');
    // Wait 300ms to ensure cookie is registered before fetching data
    setTimeout(async () => {
      await loadDashboardData();
    }, 300);
  };

  // ── Logout handler — calls POST /api/auth/logout ─────────
  const handleLogout = async () => {
    try {
      await fetch(`${API_BASE}/auth/logout`, {
        method:      'POST',
        credentials: 'include',
      });
    } catch (err) {
      console.error('Logout error:', err.message);
    } finally {
      // Always clear state regardless of network result
      setCurrentUser(null);
      setCurrentView('dashboard');
      setTasks([]);
      setEventsList([]);
      setAnnouncements([]);
    }
  };

  // ── Update current user (used by Profile.jsx) ────────────
  const handleUpdateUser = (updatedUser) => {
    setCurrentUser(prev => ({ ...prev, ...updatedUser }));
  };

  // ── Show a blank screen while restoring session ──────────
  // Prevents flashing the login page on reload when user is logged in
  if (isRestoring) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="flex flex-col items-center gap-4">
          <img src="/ptc-logo.png" alt="PTC" className="w-16 h-16 object-contain opacity-60" />
          <p className="text-sm text-gray-400 font-medium animate-pulse">Loading PTC Portal...</p>
        </div>
      </div>
    );
  }

  if (!currentUser) {
    return <LoginView onLogin={handleLogin} />;
  }

  const isSuperAdmin = currentUser.role_name === 'system_admin';
  const isAdmin      = ['admin_dean', 'admin_vpaa', 'admin_registrar'].includes(currentUser.role_name);
  const isFaculty    = currentUser.role_name === 'faculty';

  // Refresh dashboard data whenever user navigates back to dashboard
  const handleSetCurrentView = async (view) => {
    setCurrentView(view);
    if (view === 'dashboard') {
      await loadDashboardData();
    }
  };

  return (
    <div className="flex h-screen bg-gray-50 font-sans">
      <Sidebar
        role={currentUser.role_name}
        isAdmin={isAdmin}
        isSuperAdmin={isSuperAdmin}
        currentView={currentView}
        setCurrentView={handleSetCurrentView}
      />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Topbar user={currentUser} onLogout={handleLogout} />
        <main className="flex-1 overflow-y-auto p-6 relative">

          {currentView === 'dashboard' && (
            <Dashboard
              user={currentUser}
              setCurrentView={handleSetCurrentView}
              tasks={tasks}
              setTasks={setTasks}
              eventsList={eventsList}
              setEventsList={setEventsList}
              announcements={announcements}
              setAnnouncements={setAnnouncements}
            />
          )}

          {/* Superadmin only */}
          {currentView === 'usermgmt' && isSuperAdmin && (
            <UserManagement user={currentUser} />
          )}
          {currentView === 'sysconfig' && isSuperAdmin && (
            <SystemSettings user={currentUser} />
          )}

          {/* Admins only */}
          {currentView === 'approvals' && isAdmin && (
            <GradeApprovals user={currentUser} />
          )}

          {/* Faculty only */}
          {currentView === 'grades' && isFaculty && (
            <Grades user={currentUser} />
          )}

          {/* Shared: everyone */}
          {currentView === 'tasks' && (
            <TasksSchedule
              user={currentUser}
              tasks={tasks}
              setTasks={setTasks}
              eventsList={eventsList}
              setEventsList={setEventsList}
              announcements={announcements}
              setAnnouncements={setAnnouncements}
              isAdmin={isAdmin || isSuperAdmin}
            />
          )}
          {currentView === 'repository' && (
            <Repository user={currentUser} setCurrentView={setCurrentView} />
          )}

          {/* Admins + superadmin only */}
          {currentView === 'directory' && (isAdmin || isSuperAdmin) && (
            <Directory user={currentUser} />
          )}

          {currentView === 'profile' && (
            <Profile user={currentUser} onUpdateUser={handleUpdateUser} />
          )}

        </main>
      </div>
    </div>
  );
}

// ============================================================
//  SIDEBAR
// ============================================================
function Sidebar({ role, isAdmin, isSuperAdmin, currentView, setCurrentView }) {
  const facultyLinks = [
    { id: 'dashboard',  label: 'Dashboard',            icon: Activity },
    { id: 'grades',     label: 'Grade Encoding',        icon: FileSpreadsheet },
    { id: 'tasks',      label: 'Tasks & Schedule',      icon: CalendarIcon },
    { id: 'repository', label: 'Department Repository', icon: BookOpen },
    { id: 'profile',    label: 'My Profile',            icon: User },
  ];

  const adminLinks = [
    { id: 'dashboard',  label: 'Dashboard',            icon: Activity },
    { id: 'approvals',  label: 'Approvals Queue',       icon: FileCheck },
    { id: 'tasks',      label: 'Tasks & Schedule',      icon: CalendarIcon },
    { id: 'repository', label: 'Department Repository', icon: BookOpen },
    { id: 'directory',  label: 'Faculty Directory',     icon: Users },
    { id: 'profile',    label: 'My Profile',            icon: User },
  ];

  const superadminLinks = [
    { id: 'dashboard',  label: 'Dashboard',            icon: Activity },
    { id: 'usermgmt',   label: 'User Management',       icon: Shield },
    { id: 'tasks',      label: 'Tasks & Schedule',      icon: CalendarIcon },
    { id: 'repository', label: 'Department Repository', icon: BookOpen },
    { id: 'directory',  label: 'Faculty Directory',     icon: Users },
    { id: 'profile',    label: 'My Profile',            icon: User },
  ];

  const links = isSuperAdmin ? superadminLinks : isAdmin ? adminLinks : facultyLinks;

  return (
    <div className="w-64 bg-green-900 text-white flex flex-col shadow-2xl z-10">
      <div className="p-6 border-b border-green-800 flex items-center justify-center">
        <img src="/ptc-logo.png" className="w-8 h-8 mr-3 object-contain" alt="PTC Logo" />
        <h2 className="text-xl font-bold tracking-tight">PTC Portal</h2>
      </div>
      <nav className="flex-1 px-4 py-6 space-y-1.5 overflow-y-auto">
        <p className="text-[10px] font-bold text-green-400 uppercase tracking-wider mb-4 ml-2">Main Menu</p>
        {links.map((link) => {
          const Icon     = link.icon;
          const isActive = currentView === link.id;
          return (
            <button 
              key={link.id} 
              onClick={() => setCurrentView(link.id)}
              className={`w-full flex items-center px-3 py-3 text-sm rounded-lg transition-all ${
                isActive
                  ? 'bg-green-700 text-yellow-400 font-bold shadow-inner'
                  : 'text-green-50 hover:bg-green-800 hover:text-white font-medium'
              }`}
            >
              <Icon size={18} className="mr-3" />
              <span className="text-left">{link.label}</span>
            </button>
          );
        })}
      </nav>
      {isSuperAdmin && (
        <div className="px-4 pb-6 border-t border-green-800 pt-4">
          <p className="text-[10px] font-bold text-green-400 uppercase tracking-wider mb-3 ml-2">System</p>
          <button
            onClick={() => setCurrentView('sysconfig')}
            className={`w-full flex items-center px-3 py-3 text-sm rounded-lg transition-all ${
              currentView === 'sysconfig'
                ? 'bg-green-700 text-yellow-400 font-bold shadow-inner'
                : 'text-green-50 hover:bg-green-800 hover:text-white font-medium'
            }`}
          >
            <Settings size={18} className="mr-3" />
            <span className="text-left">System Settings</span>
          </button>
        </div>
      )}
    </div>
  );
}

// ============================================================
//  TOPBAR
// ============================================================
function Topbar({ user, onLogout }) {
  // Display full name from real DB fields
  const fullName = user.first_name && user.last_name
    ? `${user.first_name} ${user.last_name}`
    : user.name || 'User';

  // Display role nicely
  const roleDisplay = user.role_name
    ? user.role_name.replace(/_/g, ' ').toUpperCase()
    : 'USER';

  return (
    <header className="bg-white border-b border-gray-200 h-16 flex items-center justify-between px-8 shadow-sm z-10">
      <div className="text-sm font-bold text-gray-500 flex items-center">
        System Role:
        <span className="bg-green-100 text-green-800 px-3 py-1 rounded-full text-xs uppercase tracking-wider ml-3 font-bold border border-green-200">
          {roleDisplay}
        </span>
      </div>
      <div className="flex items-center space-x-6">
        <div className="text-right hidden md:block">
          <p className="text-sm font-bold text-gray-800 leading-tight">{fullName}</p>
        </div>
        <div className="h-8 w-px bg-gray-200"></div>
        <button 
          onClick={onLogout} 
          className="text-gray-500 hover:text-red-600 flex items-center text-sm font-bold transition-colors"
        >
          <LogOut size={18} className="mr-1.5" /> Logout
        </button>
      </div>
    </header>
  );
}