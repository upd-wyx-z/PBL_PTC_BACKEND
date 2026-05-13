import React, { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { 
  Search, X, User, Mail, Phone, Briefcase, Building, 
  ArrowUpDown, ArrowUp, ArrowDown, SlidersHorizontal, 
  Shield, Users, UserCheck, UserX, UserMinus, Plus, 
  Edit, Trash2, Power, PowerOff, Lock, EyeOff, Eye, AlertCircle,
  Key
} from 'lucide-react';

const API_BASE = '/api';

export default function UserManagement({ user }) {
  // --- REAL DATA FROM BACKEND ---
  const [usersList,    setUsersList]    = useState([]);
  const [departments,  setDepartments]  = useState([]);
  const [roles,        setRoles]        = useState([]);
  const [metrics,      setMetrics]      = useState({ activeCount: 0, deactivatedCount: 0, onlineCount: 0, offlineCount: 0 });
  const [isLoading,    setIsLoading]    = useState(true);
  const [error,        setError]        = useState('');
  const [actionMsg,    setActionMsg]    = useState(''); // success/error feedback

  // --- STATES FOR SEARCH, FILTER, & SORT ---
  const [searchTerm,    setSearchTerm]    = useState('');
  const [filterDept,    setFilterDept]    = useState('All Departments');
  const [filterRole,    setFilterRole]    = useState('All Roles');
  const [filterStatus,  setFilterStatus]  = useState('All Statuses');
  const [isFilterOpen,  setIsFilterOpen]  = useState(false);
  
  const [sortBy,    setSortBy]    = useState('name');
  const [sortDir,   setSortDir]   = useState('asc');
  const [isSortOpen, setIsSortOpen] = useState(false);

  // --- MODAL STATES ---
  const [userModal,     setUserModal]     = useState({ isOpen: false, mode: 'add', data: null });
  const [securityModal, setSecurityModal] = useState({ isOpen: false, action: null, payload: null });
  const [passwordModal, setPasswordModal] = useState({ isOpen: false, user: null, newPassword: '', confirmPassword: '', error: '' });
  
  const [authPassword,      setAuthPassword]      = useState('');
  const [authError,         setAuthError]         = useState('');
  const [authLoading,       setAuthLoading]       = useState(false);
  const [showAuthPass,      setShowAuthPass]      = useState(false);
  const [showPassModalPass, setShowPassModalPass] = useState(false);

  // ── Flash a temporary status message ─────────────────────
  const showMessage = (msg, isError = false) => {
    setActionMsg(isError ? `❌ ${msg}` : `✅ ${msg}`);
    setTimeout(() => setActionMsg(''), 4000);
  };

  // ── Fetch filter options on mount ──────────────────────────
  useEffect(() => {
    const fetchOptions = async () => {
      try {
        const [deptRes, roleRes] = await Promise.all([
          fetch(`${API_BASE}/users/departments`, { credentials: 'include' }),
          fetch(`${API_BASE}/users/roles`,       { credentials: 'include' }),
        ]);
        if (deptRes.ok) {
          const d = await deptRes.json();
          setDepartments(['All Departments', ...d.departments.map(dep => dep.dept_code)]);
        }
        if (roleRes.ok) {
          const r = await roleRes.json();
          setRoles(['All Roles', ...r.roles]);
        }
      } catch (err) {
        console.error('Failed to load filter options:', err);
      }
    };
    fetchOptions();
  }, []);

  // ── Fetch metrics ─────────────────────────────────────────
  const fetchMetrics = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/users/metrics`, { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setMetrics(data);
      }
    } catch (err) {
      console.error('Failed to load metrics:', err);
    }
  }, []);

  // ── Fetch users (debounced on search/filter change) ───────
  const fetchUsers = useCallback(async () => {
    setIsLoading(true);
    setError('');
    try {
      const params = new URLSearchParams();
      if (searchTerm)                           params.set('search',     searchTerm);
      if (filterDept !== 'All Departments')     params.set('department', filterDept);
      if (filterRole !== 'All Roles')           params.set('role',       filterRole);
      if (filterStatus !== 'All Statuses')      params.set('status',     filterStatus);

      const res = await fetch(`${API_BASE}/users?${params.toString()}`, {
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Failed to fetch users.');
      const data = await res.json();
      setUsersList(data.users || []);
    } catch (err) {
      setError('Could not load users. Please try again.');
      console.error('fetchUsers error:', err);
    } finally {
      setIsLoading(false);
    }
  }, [searchTerm, filterDept, filterRole, filterStatus]);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchUsers();
      fetchMetrics();
    }, 400);
    return () => clearTimeout(timer);
  }, [fetchUsers, fetchMetrics]);

  // ── LOGIC: SECURITY VERIFICATION (now hits real backend) ──
  const initiateSecureAction = (action, payload) => {
    setAuthPassword('');
    setAuthError('');
    setShowAuthPass(false);
    setSecurityModal({ isOpen: true, action, payload });
  };

  const executeSecureAction = async (e) => {
    e.preventDefault();
    if (!authPassword) return;
    setAuthLoading(true);
    setAuthError('');

    const { action, payload } = securityModal;

    try {
      let res, data;

      if (action === 'add') {
        res = await fetch(`${API_BASE}/users`, {
          method:      'POST',
          credentials: 'include',
          headers:     { 'Content-Type': 'application/json' },
          body:        JSON.stringify({ ...payload, admin_password: authPassword }),
        });
        data = await res.json();
        if (!res.ok) throw new Error(data.message);
        setUserModal({ isOpen: false });
        showMessage(data.message);

      } else if (action === 'edit') {
        res = await fetch(`${API_BASE}/users/${payload.user_id}`, {
          method:      'PUT',
          credentials: 'include',
          headers:     { 'Content-Type': 'application/json' },
          body:        JSON.stringify({ ...payload, admin_password: authPassword }),
        });
        data = await res.json();
        if (!res.ok) throw new Error(data.message);
        setUserModal({ isOpen: false });
        showMessage(data.message);

      } else if (action === 'toggleStatus') {
        res = await fetch(`${API_BASE}/users/${payload.user_id}/status`, {
          method:      'PATCH',
          credentials: 'include',
          headers:     { 'Content-Type': 'application/json' },
          body:        JSON.stringify({ admin_password: authPassword }),
        });
        data = await res.json();
        if (!res.ok) throw new Error(data.message);
        showMessage(data.message);

      } else if (action === 'delete') {
        res = await fetch(`${API_BASE}/users/${payload.user_id}`, {
          method:      'DELETE',
          credentials: 'include',
          headers:     { 'Content-Type': 'application/json' },
          body:        JSON.stringify({ admin_password: authPassword }),
        });
        data = await res.json();
        if (!res.ok) throw new Error(data.message);
        showMessage(data.message);

      } else if (action === 'changePassword') {
        res = await fetch(`${API_BASE}/users/${payload.user_id}/password`, {
          method:      'PATCH',
          credentials: 'include',
          headers:     { 'Content-Type': 'application/json' },
          body:        JSON.stringify({
            new_password:   payload.new_password,
            admin_password: authPassword,
          }),
        });
        data = await res.json();
        if (!res.ok) throw new Error(data.message);
        setPasswordModal({ isOpen: false, user: null, newPassword: '', confirmPassword: '', error: '' });
        showMessage(data.message);
      }

      // Refresh list and metrics after any mutation
      await fetchUsers();
      await fetchMetrics();
      setSecurityModal({ isOpen: false, action: null, payload: null });

    } catch (err) {
      setAuthError(err.message || 'Action failed. Please try again.');
    } finally {
      setAuthLoading(false);
    }
  };

  // ── LOGIC: USER FORMS ─────────────────────────────────────
  const handleUserFormSubmit = (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const userData = {
      first_name:     formData.get('first_name'),
      last_name:      formData.get('last_name'),
      email:          formData.get('email'),
      contact_no:     formData.get('contact_no'),
      role:           formData.get('role'),
      department:     formData.get('department'),
      specialization: formData.get('specialization'),
      status:         formData.get('status') || 'Active',
    };

    if (userModal.mode === 'add') {
      userData.initial_password = formData.get('initial_password');
    } else {
      userData.user_id  = userModal.data.user_id;
    }

    initiateSecureAction(userModal.mode, userData);
  };

  const handlePasswordSubmit = (e) => {
    e.preventDefault();
    if (passwordModal.newPassword !== passwordModal.confirmPassword) {
      setPasswordModal(prev => ({ ...prev, error: 'Passwords do not match.' }));
      return;
    }
    if (passwordModal.newPassword.length < 8) {
      setPasswordModal(prev => ({ ...prev, error: 'Password must be at least 8 characters.' }));
      return;
    }
    initiateSecureAction('changePassword', {
      user_id:      passwordModal.user.user_id,
      first_name:   passwordModal.user.first_name,
      last_name:    passwordModal.user.last_name,
      new_password: passwordModal.newPassword,
    });
  };

  // ── LOGIC: SORTING (client-side, backend already filtered) ─
  const toggleSort = (key) => {
    if (sortBy === key) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(key);
      setSortDir('asc');
    }
  };

  let processedUsers = [...usersList].sort((a, b) => {
    let valA, valB;
    if (sortBy === 'name') {
      valA = (a.last_name  || '').toLowerCase();
      valB = (b.last_name  || '').toLowerCase();
    } else {
      valA = (a[sortBy] || '').toLowerCase();
      valB = (b[sortBy] || '').toLowerCase();
    }
    if (valA < valB) return sortDir === 'asc' ? -1 : 1;
    if (valA > valB) return sortDir === 'asc' ? 1  : -1;
    return 0;
  });

  let activeFilterCount = 0;
  if (filterDept   !== 'All Departments') activeFilterCount++;
  if (filterRole   !== 'All Roles')       activeFilterCount++;
  if (filterStatus !== 'All Statuses')    activeFilterCount++;

  return (
    <div className="space-y-6 h-full max-w-[1600px] mx-auto animate-in fade-in duration-300 relative">

      {/* Action feedback toast */}
      {actionMsg && (
        <div className={`fixed bottom-6 right-6 z-[99999] px-5 py-3.5 rounded-2xl shadow-2xl text-sm font-bold text-white transition-all animate-in slide-in-from-bottom-4 ${actionMsg.startsWith('❌') ? 'bg-red-600' : 'bg-green-700'}`}>
          {actionMsg}
        </div>
      )}

      {/* =========================================
          MODALS PORTAL
          ========================================= */}
      
      {/* 1. SECURITY VERIFICATION MODAL */}
      {securityModal.isOpen && createPortal(
        <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
          <form onSubmit={executeSecureAction} className="bg-white rounded-3xl shadow-2xl w-full max-w-sm p-8 text-center animate-in zoom-in-95 duration-200">
            <div className="w-16 h-16 bg-red-50 text-red-600 rounded-full flex items-center justify-center mx-auto mb-6 border-4 border-white shadow-sm">
              <Lock size={32} />
            </div>
            <h3 className="text-xl font-bold text-gray-900 mb-2">Security Verification</h3>
            <p className="text-sm text-gray-500 mb-6 leading-relaxed">
              Please enter your admin password to authorize this system action.
            </p>
            
            {authError && (
              <div className="mb-4 p-3 bg-red-50 text-red-700 text-xs font-bold rounded-xl flex items-center text-left">
                <AlertCircle size={14} className="mr-2 shrink-0" /> {authError}
              </div>
            )}

            <div className="relative mb-8 text-left">
              <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5">Admin Password</label>
              <input 
                type={showAuthPass ? "text" : "password"} 
                required maxLength={25}
                value={authPassword}
                onChange={(e) => setAuthPassword(e.target.value)}
                className="w-full p-3.5 pr-12 border border-gray-200 rounded-xl focus:ring-2 focus:ring-red-600 outline-none text-sm font-medium bg-gray-50"
                placeholder="Enter password"
                autoFocus
              />
              <button type="button" onClick={() => setShowAuthPass(!showAuthPass)} className="absolute right-4 top-[30px] text-gray-400 hover:text-gray-600 outline-none">
                {showAuthPass ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>

            <div className="flex gap-3">
              <button 
                type="button" onClick={() => setSecurityModal({ isOpen: false, action: null, payload: null })}
                className="flex-1 py-3.5 px-4 bg-gray-100 hover:bg-gray-200 text-gray-600 font-bold rounded-xl transition-all"
                disabled={authLoading}
              >
                Cancel
              </button>
              <button 
                type="submit"
                disabled={authLoading}
                className="flex-1 py-3.5 px-4 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl shadow-md transition-all active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {authLoading ? (
                  <><span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span> Verifying...</>
                ) : 'Verify & Proceed'}
              </button>
            </div>
          </form>
        </div>,
        document.body
      )}

      {/* 2. ADD/EDIT USER MODAL */}
      {userModal.isOpen && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in" onClick={() => setUserModal({ isOpen: false })}>
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
            <div className="px-8 py-6 border-b border-gray-100 flex justify-between items-center shrink-0">
              <h2 className="text-lg font-bold text-gray-900 tracking-tight flex items-center">
                {userModal.mode === 'add' ? <UserPlusIcon className="mr-3 text-green-700"/> : <Edit className="mr-3 text-green-700"/>}
                {userModal.mode === 'add' ? 'Create New Account' : 'Edit User Details'}
              </h2>
              <button onClick={() => setUserModal({ isOpen: false })} className="p-2 border border-gray-200 rounded-full hover:bg-gray-50 text-gray-600 transition-all active:scale-90">
                <X size={18} strokeWidth={2.5} />
              </button>
            </div>

            <form onSubmit={handleUserFormSubmit} className="p-8 overflow-y-auto flex-1 space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div>
                  <div className="flex justify-between">
                    <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">First Name</label>
                    <span className="text-[9px] text-gray-400 font-bold uppercase">Max 30</span>
                  </div>
                  <input name="first_name" type="text" required maxLength={30} defaultValue={userModal.data?.first_name || ''} className="w-full p-3.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-green-600 outline-none text-sm font-medium" placeholder="e.g. Juan" />
                </div>
                <div>
                  <div className="flex justify-between">
                    <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Last Name</label>
                    <span className="text-[9px] text-gray-400 font-bold uppercase">Max 30</span>
                  </div>
                  <input name="last_name" type="text" required maxLength={30} defaultValue={userModal.data?.last_name || ''} className="w-full p-3.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-green-600 outline-none text-sm font-medium" placeholder="e.g. Dela Cruz" />
                </div>
                
                <div>
                  <div className="flex justify-between">
                    <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Email Address</label>
                    <span className="text-[9px] text-gray-400 font-bold uppercase">Max 30</span>
                  </div>
                  <input name="email" type="email" required maxLength={30} defaultValue={userModal.data?.email || ''} className="w-full p-3.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-green-600 outline-none text-sm font-medium" placeholder="faculty@ptc.edu.ph" />
                </div>
                <div>
                  <div className="flex justify-between">
                    <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Contact Number</label>
                    <span className="text-[9px] text-gray-400 font-bold uppercase">11 Digits</span>
                  </div>
                  <input 
                    name="contact_no" 
                    type="tel" 
                    required 
                    maxLength={11} 
                    minLength={11}
                    onInput={(e) => { e.target.value = e.target.value.replace(/\D/g, ''); }}
                    defaultValue={userModal.data?.contact_no || ''} 
                    className="w-full p-3.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-green-600 outline-none text-sm font-medium" 
                    placeholder="09XXXXXXXXX" 
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Department</label>
                  <select name="department" defaultValue={userModal.data?.department || (departments[1] || '')} className="w-full p-3.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-green-600 outline-none text-sm font-medium">
                    {departments.filter(d => d !== 'All Departments').map(d => <option key={d} value={d}>{d}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">System Role</label>
                  <select name="role" defaultValue={userModal.data?.role || 'Faculty'} className="w-full p-3.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-green-600 outline-none text-sm font-medium">
                    {roles.filter(r => r !== 'All Roles').map(r => <option key={r} value={r}>{r}</option>)}
                  </select>
                </div>

                <div className="sm:col-span-2">
                  <div className="flex justify-between">
                    <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Specialization / Title</label>
                    <span className="text-[9px] text-gray-400 font-bold uppercase">Max 50</span>
                  </div>
                  <input name="specialization" type="text" maxLength={50} defaultValue={userModal.data?.specialization || ''} className="w-full p-3.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-green-600 outline-none text-sm font-medium" placeholder="e.g. Web Systems and Technologies" />
                </div>

                {/* Initial Password — only shown when adding a new user */}
                {userModal.mode === 'add' && (
                  <div className="sm:col-span-2">
                    <div className="flex justify-between">
                      <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Initial Password</label>
                      <span className="text-[9px] text-gray-400 font-bold uppercase">Min 8 chars</span>
                    </div>
                    <input name="initial_password" type="password" required minLength={8} maxLength={25} className="w-full p-3.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-green-600 outline-none text-sm font-medium" placeholder="Set initial password for this account" />
                  </div>
                )}

                {userModal.mode === 'edit' && (
                  <div className="sm:col-span-2">
                    <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Account Status</label>
                    <select name="status" defaultValue={userModal.data?.status} className="w-full p-3.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-green-600 outline-none text-sm font-medium">
                      <option value="Active">Active</option>
                      <option value="Deactivated">Deactivated</option>
                    </select>
                  </div>
                )}
              </div>

              <div className="pt-8 border-t border-gray-100 flex justify-end gap-3">
                <button type="button" onClick={() => setUserModal({ isOpen: false })} className="px-6 py-3.5 text-sm font-bold text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-xl transition-all">Cancel</button>
                <button type="submit" className="px-8 py-3.5 text-sm font-bold text-white bg-[#0e5c2b] hover:bg-[#0a4720] rounded-xl shadow-md transition-all active:scale-95 flex items-center">
                  <Shield size={16} className="mr-2" /> Authorized Save
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* 3. FILTER MODAL */}
      {isFilterOpen && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in" onClick={() => setIsFilterOpen(false)}>
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm p-6 sm:p-8 animate-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-6 border-b border-gray-50 pb-4">
              <h2 className="text-sm font-bold text-gray-800 uppercase tracking-widest flex items-center">
                <SlidersHorizontal size={18} className="mr-2 text-green-700" /> Filter Users
              </h2>
              <button onClick={() => setIsFilterOpen(false)} className="p-2 border border-gray-200 rounded-full hover:bg-gray-50 text-gray-600 transition-all active:scale-90">
                <X size={16} strokeWidth={2.5} />
              </button>
            </div>
            
            <div className="space-y-5">
              <div>
                <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Department</label>
                <select value={filterDept} onChange={(e) => setFilterDept(e.target.value)} className="w-full p-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-green-600 outline-none text-sm font-medium">
                  {departments.map(d => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">System Role</label>
                <select value={filterRole} onChange={(e) => setFilterRole(e.target.value)} className="w-full p-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-green-600 outline-none text-sm font-medium">
                  {roles.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Account Status</label>
                <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="w-full p-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-green-600 outline-none text-sm font-medium">
                  {['All Statuses', 'Active', 'Deactivated'].map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
            </div>

            <div className="mt-8 pt-6 border-t border-gray-100 flex gap-3">
              <button onClick={() => { setFilterDept('All Departments'); setFilterRole('All Roles'); setFilterStatus('All Statuses'); setIsFilterOpen(false); }} className="flex-1 px-4 py-3 text-sm font-bold text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-xl transition-all">Clear</button>
              <button onClick={() => setIsFilterOpen(false)} className="flex-1 px-4 py-3 text-sm font-bold text-white bg-gray-900 hover:bg-black rounded-xl shadow-md transition-all active:scale-95">Apply Filter</button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* 4. CHANGE PASSWORD MODAL */}
      {passwordModal.isOpen && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in" onClick={() => setPasswordModal({ ...passwordModal, isOpen: false })}>
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm p-8 animate-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-6 border-b border-gray-50 pb-4">
              <h2 className="text-sm font-bold text-gray-800 uppercase tracking-widest flex items-center">
                <Key size={18} className="mr-2 text-yellow-600" /> Change Password
              </h2>
              <button onClick={() => setPasswordModal({ ...passwordModal, isOpen: false })} className="p-2 border border-gray-200 rounded-full hover:bg-gray-50 text-gray-600 transition-all active:scale-90">
                <X size={16} strokeWidth={2.5} />
              </button>
            </div>
            
            <p className="text-xs text-gray-500 mb-4">
              Set a new password for <span className="font-bold text-gray-800">{passwordModal.user?.first_name} {passwordModal.user?.last_name}</span>.
            </p>

            {passwordModal.error && (
              <div className="mb-4 p-3 bg-red-50 text-red-700 text-xs font-bold rounded-xl flex items-center">
                <AlertCircle size={14} className="mr-2 shrink-0" /> {passwordModal.error}
              </div>
            )}

            <form onSubmit={handlePasswordSubmit} className="space-y-4">
              <div>
                <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5">New Password (Max 25)</label>
                <div className="relative">
                  <input 
                    type={showPassModalPass ? "text" : "password"} 
                    required maxLength={25}
                    value={passwordModal.newPassword}
                    onChange={(e) => setPasswordModal({...passwordModal, newPassword: e.target.value})}
                    className="w-full p-3.5 pr-12 border border-gray-200 rounded-xl focus:ring-2 focus:ring-yellow-500 outline-none text-sm font-medium"
                    placeholder="Enter new password"
                  />
                  <button type="button" onClick={() => setShowPassModalPass(!showPassModalPass)} className="absolute right-4 top-3.5 text-gray-400 hover:text-gray-600 outline-none">
                    {showPassModalPass ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5">Confirm New Password</label>
                <div className="relative">
                  <input 
                    type={showPassModalPass ? "text" : "password"} 
                    required maxLength={25}
                    value={passwordModal.confirmPassword}
                    onChange={(e) => setPasswordModal({...passwordModal, confirmPassword: e.target.value})}
                    className="w-full p-3.5 pr-12 border border-gray-200 rounded-xl focus:ring-2 focus:ring-yellow-500 outline-none text-sm font-medium"
                    placeholder="Re-type new password"
                  />
                  <button type="button" onClick={() => setShowPassModalPass(!showPassModalPass)} className="absolute right-4 top-3.5 text-gray-400 hover:text-gray-600 outline-none">
                    {showPassModalPass ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              <div className="pt-4 flex gap-3">
                <button type="button" onClick={() => setPasswordModal({ ...passwordModal, isOpen: false })} className="flex-1 py-3 px-4 bg-gray-100 hover:bg-gray-200 text-gray-600 font-bold rounded-xl transition-all text-sm">Cancel</button>
                <button type="submit" className="flex-1 py-3 px-4 bg-yellow-500 hover:bg-yellow-600 text-white font-bold rounded-xl shadow-md transition-all active:scale-95 text-sm">Set Password</button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* =========================================
          PAGE HEADER & METRICS
          ========================================= */}
      <div className="bg-white p-6 sm:p-8 rounded-3xl shadow-sm border border-gray-100 relative overflow-hidden">
        <div className="absolute right-0 top-0 w-64 h-64 bg-green-50 rounded-full mix-blend-multiply filter blur-3xl opacity-50 -translate-y-1/2 translate-x-1/4 z-0"></div>
        
        <div className="relative z-10 mb-8">
          <h1 className="text-3xl font-bold text-gray-900 tracking-tight mb-1 flex items-center">
             User Account Management
          </h1>
          <p className="text-sm text-gray-500 font-medium">Control, secure, and manage system access for all faculty and staff.</p>
        </div>

        {/* Top Metrics Row */}
        <div className="relative z-10 grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-gray-50 rounded-2xl border border-gray-200 p-5 flex items-center gap-4 shadow-sm hover:shadow-md transition-shadow">
            <div className="p-3 bg-green-100 text-green-700 rounded-xl"><UserCheck size={24} /></div>
            <div><p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-0.5">Active Users</p><h2 className="text-2xl font-bold text-gray-900 leading-none">{metrics.activeCount}</h2></div>
          </div>
          <div className="bg-gray-50 rounded-2xl border border-gray-200 p-5 flex items-center gap-4 shadow-sm hover:shadow-md transition-shadow">
            <div className="p-3 bg-red-100 text-red-700 rounded-xl"><UserX size={24} /></div>
            <div><p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-0.5">Deactivated</p><h2 className="text-2xl font-bold text-gray-900 leading-none">{metrics.deactivatedCount}</h2></div>
          </div>
          <div className="bg-gray-50 rounded-2xl border border-gray-200 p-5 flex items-center gap-4 shadow-sm hover:shadow-md transition-shadow">
            <div className="p-3 bg-blue-100 text-blue-700 rounded-xl">
              <span className="relative flex h-6 w-6 items-center justify-center"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-20"></span><span className="relative inline-flex rounded-full h-3 w-3 bg-blue-500"></span></span>
            </div>
            <div><p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-0.5">Online Now</p><h2 className="text-2xl font-bold text-gray-900 leading-none">{metrics.onlineCount}</h2></div>
          </div>
          <div className="bg-gray-50 rounded-2xl border border-gray-200 p-5 flex items-center gap-4 shadow-sm hover:shadow-md transition-shadow">
            <div className="p-3 bg-gray-200 text-gray-500 rounded-xl"><UserMinus size={24} /></div>
            <div><p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-0.5">Offline</p><h2 className="text-2xl font-bold text-gray-900 leading-none">{metrics.offlineCount}</h2></div>
          </div>
        </div>
      </div>

      {/* =========================================
          MAIN TABLE & TOOLBAR
          ========================================= */}
      <div className="bg-white rounded-3xl shadow-xl border border-gray-100 overflow-hidden flex flex-col min-h-[500px]">
        
        {/* Integrated Toolbar */}
        <div className="p-4 border-b border-gray-100 bg-gray-50/30 flex flex-wrap items-center gap-4">
          {/* Search Bar */}
          <div className="flex-1 relative min-w-[200px]">
            <Search className="absolute left-3.5 top-3 text-gray-400" size={16} />
            <input 
              type="text" placeholder="Search by name or email..." 
              value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-green-600 outline-none text-sm font-medium transition-shadow shadow-sm bg-white"
            />
          </div>
          
          {/* Actions */}
          <div className="flex flex-wrap items-center gap-3 shrink-0 ml-auto">
            
            {/* Custom Sort Dropdown */}
            <div className="relative">
              <button 
                onClick={() => setIsSortOpen(!isSortOpen)}
                className="flex items-center justify-center gap-2 px-4 py-2.5 bg-white border border-gray-200 text-gray-700 font-bold rounded-xl text-sm hover:bg-gray-50 transition-all shadow-sm">
                <ArrowUpDown size={15} /> Sort
              </button>
              
              {isSortOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setIsSortOpen(false)}></div>
                  <div className="absolute right-0 top-full mt-2 bg-white rounded-2xl shadow-xl border border-gray-100 w-48 z-50 overflow-hidden">
                    {[
                      { key: 'name',       label: 'Name (Last Name)' },
                      { key: 'department', label: 'Department' },
                      { key: 'role',       label: 'System Role' },
                      { key: 'status',     label: 'Status' },
                    ].map(opt => (
                      <button key={opt.key} onClick={() => { toggleSort(opt.key); setIsSortOpen(false); }}
                        className={`w-full flex items-center justify-between px-4 py-2.5 text-sm font-medium hover:bg-gray-50 transition-colors ${sortBy === opt.key ? 'text-green-700 font-bold bg-green-50/40' : 'text-gray-700'}`}>
                        {opt.label}
                        {sortBy === opt.key && (sortDir === 'asc' ? <ArrowUp size={13} className="text-green-600" /> : <ArrowDown size={13} className="text-green-600" />)}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>

            {/* Filter Button */}
            <button onClick={() => setIsFilterOpen(true)}
              className="flex items-center justify-center gap-2 px-4 py-2.5 bg-white border border-gray-200 text-gray-700 font-bold rounded-xl text-sm hover:bg-gray-50 transition-all shadow-sm">
              <SlidersHorizontal size={15} /> Filter
              {activeFilterCount > 0 && (
                <span className="w-4 h-4 rounded-full bg-green-600 text-white text-[9px] font-black flex items-center justify-center shadow-sm">{activeFilterCount}</span>
              )}
            </button>

            {/* Add User Button */}
            <button 
              onClick={() => setUserModal({ isOpen: true, mode: 'add', data: null })}
              className="flex items-center justify-center gap-2 px-4 py-2.5 bg-[#0e5c2b] hover:bg-[#0a4720] text-white font-bold rounded-xl text-sm transition-all shadow-md active:scale-95"
            >
              <Plus size={16} /> New Account
            </button>
          </div>
        </div>

        {/* Users Table */}
        <div className="overflow-x-auto flex-1">
          <table className="w-full text-left border-collapse min-w-[800px]">
            <thead className="bg-white border-b border-gray-100">
              <tr>
                <th className="px-8 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest">Account Details</th>
                <th className="px-6 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest">Role & Dept</th>
                <th className="px-6 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest text-center">Status</th>
                <th className="px-6 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest text-center">Connection</th>
                <th className="px-8 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {isLoading ? (
                <tr>
                  <td colSpan="5" className="py-24 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <div className="w-8 h-8 border-4 border-green-600 border-t-transparent rounded-full animate-spin"></div>
                      <p className="text-gray-400 font-medium text-sm">Loading users...</p>
                    </div>
                  </td>
                </tr>
              ) : error ? (
                <tr>
                  <td colSpan="5" className="py-24 text-center">
                    <p className="text-red-500 font-bold">{error}</p>
                  </td>
                </tr>
              ) : processedUsers.length === 0 ? (
                <tr>
                  <td colSpan="5" className="py-24 text-center">
                    <Users className="mx-auto text-gray-200 mb-4" size={48} />
                    <p className="text-gray-500 font-bold">No users found matching your filters.</p>
                  </td>
                </tr>
              ) : (
                processedUsers.map((member) => (
                  <tr key={member.user_id} className={`transition-colors group ${member.status === 'Deactivated' ? 'bg-gray-50/50 opacity-80' : 'hover:bg-green-50/30'}`}>
                    <td className="px-8 py-4">
                      <div className="flex items-center">
                        <div className="w-10 h-10 bg-gray-100 rounded-full border border-gray-200 mr-4 flex items-center justify-center shrink-0">
                          <User size={18} className="text-gray-400" />
                        </div>
                        <div>
                          <div className={`text-sm font-bold ${member.status === 'Deactivated' ? 'text-gray-500' : 'text-gray-900'}`}>
                            {member.last_name}, {member.first_name}
                          </div>
                          <div className="text-xs font-medium text-gray-500 flex items-center mt-0.5">
                            {member.email}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm font-bold text-gray-700 mb-1">{member.role}</div>
                      <div className="text-[10px] font-black text-gray-400 uppercase tracking-wider">{member.department}</div>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-md text-[10px] font-black uppercase tracking-widest border ${
                        member.status === 'Active' ? 'bg-green-50 text-green-700 border-green-200' : 'bg-red-50 text-red-600 border-red-200'
                      }`}>
                        {member.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-center">
                      {member.is_online ? (
                        <span className="inline-flex items-center gap-1.5 text-xs font-bold text-blue-600">
                          <span className="w-2 h-2 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.6)]"></span> Online
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 text-xs font-bold text-gray-400">
                          <span className="w-2 h-2 rounded-full bg-gray-300"></span> Offline
                        </span>
                      )}
                    </td>
                    <td className="px-8 py-4 text-right">
                      <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button 
                          onClick={() => setUserModal({ isOpen: true, mode: 'edit', data: member })}
                          className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all border border-transparent hover:border-blue-100"
                          title="Edit Account"
                        >
                          <Edit size={16} />
                        </button>
                        
                        <button 
                          onClick={() => setPasswordModal({ isOpen: true, user: member, newPassword: '', confirmPassword: '', error: '' })}
                          className="p-2 text-gray-400 hover:text-yellow-600 hover:bg-yellow-50 rounded-lg transition-all border border-transparent hover:border-yellow-100"
                          title="Change Password"
                        >
                          <Key size={16} />
                        </button>

                        <button 
                          onClick={() => initiateSecureAction('toggleStatus', member)}
                          className={`p-2 rounded-lg transition-all border border-transparent ${
                            member.status === 'Active' 
                            ? 'text-gray-400 hover:text-orange-600 hover:bg-orange-50 hover:border-orange-100' 
                            : 'text-gray-400 hover:text-green-600 hover:bg-green-50 hover:border-green-100'
                          }`}
                          title={member.status === 'Active' ? 'Deactivate Account' : 'Reactivate Account'}
                        >
                          {member.status === 'Active' ? <PowerOff size={16} /> : <Power size={16} />}
                        </button>

                        <button 
                          onClick={() => initiateSecureAction('delete', member)}
                          className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all border border-transparent hover:border-red-100"
                          title="Delete Account"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// UserPlusIcon Component 
function UserPlusIcon(props) {
  return (
    <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"></path>
      <circle cx="9" cy="7" r="4"></circle>
      <line x1="19" y1="8" x2="19" y2="14"></line>
      <line x1="22" y1="11" x2="16" y2="11"></line>
    </svg>
  );
}