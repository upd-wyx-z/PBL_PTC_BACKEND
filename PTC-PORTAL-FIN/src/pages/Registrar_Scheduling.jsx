import React, { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { 
  Search, Plus, BookOpen, Users, Clock, MapPin, 
  Edit, Trash2, X, CheckCircle2, ShieldCheck, 
  CalendarDays, ArrowUpDown, ArrowUp, ArrowDown,
  AlertCircle
} from 'lucide-react';

const API_BASE = '/api';

export default function RegistrarScheduling({ user }) {
  // ── Real data states ──────────────────────────────────────
  const [schedules,    setSchedules]    = useState([]);
  const [schoolYears,  setSchoolYears]  = useState([]);
  const [subjects,     setSubjects]     = useState([]);
  const [facultyList,  setFacultyList]  = useState([]);
  const [isLoading,    setIsLoading]    = useState(true);
  const [error,        setError]        = useState('');
  const [toast,        setToast]        = useState(null);

  // ── Filter / sort states ──────────────────────────────────
  const [searchTerm,   setSearchTerm]   = useState('');
  const [filterSY,     setFilterSY]     = useState(null); // sy_id
  const [sortBy,       setSortBy]       = useState('subject_code');
  const [sortDir,      setSortDir]      = useState('asc');
  const [isSortOpen,   setIsSortOpen]   = useState(false);

  // ── Modal state ───────────────────────────────────────────
  const [modalState,   setModalState]   = useState({ isOpen: false, mode: null, data: null });

  // ── Toast helper ──────────────────────────────────────────
  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  // ── Fetch dropdown options on mount ──────────────────────
  useEffect(() => {
    const fetchOptions = async () => {
      try {
        const [syRes, subjRes, facRes] = await Promise.all([
          fetch(`${API_BASE}/scheduling/school-years`, { credentials: 'include' }),
          fetch(`${API_BASE}/scheduling/subjects`,     { credentials: 'include' }),
          fetch(`${API_BASE}/scheduling/faculty`,      { credentials: 'include' }),
        ]);

        if (syRes.ok) {
          const d = await syRes.json();
          setSchoolYears(d.schoolYears || []);
          // Default to the current school year
          const current = d.schoolYears.find(sy => sy.is_current) || d.schoolYears[0];
          if (current) setFilterSY(current.sy_id);
        }
        if (subjRes.ok) {
          const d = await subjRes.json();
          setSubjects(d.subjects || []);
        }
        if (facRes.ok) {
          const d = await facRes.json();
          setFacultyList(d.faculty || []);
        }
      } catch (err) {
        console.error('Failed to fetch dropdown options:', err);
      }
    };
    fetchOptions();
  }, []);

  // ── Fetch schedules whenever filter/search changes ────────
  const fetchSchedules = useCallback(async () => {
    if (!filterSY) return;
    setIsLoading(true);
    setError('');
    try {
      const params = new URLSearchParams();
      if (filterSY)          params.set('sy_id',  filterSY);
      if (searchTerm.trim()) params.set('search', searchTerm.trim());

      const res = await fetch(`${API_BASE}/scheduling?${params.toString()}`, {
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Failed to fetch schedules.');
      const data = await res.json();
      setSchedules(data.schedules || []);
    } catch (err) {
      setError('Could not load schedules. Please try again.');
      console.error('fetchSchedules error:', err);
    } finally {
      setIsLoading(false);
    }
  }, [filterSY, searchTerm]);

  useEffect(() => {
    const timer = setTimeout(() => fetchSchedules(), 400);
    return () => clearTimeout(timer);
  }, [fetchSchedules]);

  // ── Helpers ───────────────────────────────────────────────
  const formatTime = (time24) => {
    if (!time24) return '';
    const [hours, minutes] = time24.split(':');
    const h    = parseInt(hours, 10);
    const ampm = h >= 12 ? 'PM' : 'AM';
    const h12  = h % 12 || 12;
    return `${h12}:${minutes} ${ampm}`;
  };

  const toggleSort = (key) => {
    if (sortBy === key) setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    else { setSortBy(key); setSortDir('asc'); }
  };

  // ── Client-side sort (server already handles filtering) ───
  const processedSchedules = [...schedules].sort((a, b) => {
    let valA, valB;
    if (sortBy === 'subject_code') {
      valA = a.subject_code || '';
      valB = b.subject_code || '';
    } else if (sortBy === 'faculty') {
      valA = a.faculty_name || 'ZZZ';
      valB = b.faculty_name || 'ZZZ';
    } else {
      valA = a[sortBy] || '';
      valB = b[sortBy] || '';
    }
    if (valA < valB) return sortDir === 'asc' ? -1 : 1;
    if (valA > valB) return sortDir === 'asc' ? 1  : -1;
    return 0;
  });

  const unassignedCount = schedules.filter(s => !s.faculty_id).length;

  // ── Modal helpers ─────────────────────────────────────────
  const openCreateModal = () => {
    const defaultSubject = subjects[0] || {};
    setModalState({
      isOpen: true,
      mode:   'create',
      data: {
        subject_id: defaultSubject.subject_id || '',
        sy_id:      filterSY,
        section:    '',
        days:       'MWF',
        time_start: '08:00',
        time_end:   '09:00',
        room:       '',
        faculty_id: '',
      }
    });
  };

  const openEditModal = (sch) => {
    setModalState({
      isOpen: true,
      mode:   'edit',
      data: {
        schedule_id: sch.schedule_id,
        subject_id:  sch.subject_id,
        sy_id:       sch.sy_id,
        section:     sch.section,
        days:        sch.days,
        time_start:  sch.time_start,
        time_end:    sch.time_end,
        room:        sch.room,
        faculty_id:  sch.faculty_id || '',
      }
    });
  };

  const handleFormChange = (field, value) => {
    setModalState(prev => ({ ...prev, data: { ...prev.data, [field]: value } }));
  };

  // ── Save (create or update) ───────────────────────────────
  const saveSchedule = async (e) => {
    e.preventDefault();
    const { mode, data } = modalState;

    const payload = {
      sy_id:      parseInt(data.sy_id),
      subject_id: parseInt(data.subject_id),
      section:    data.section,
      room:       data.room,
      days:       data.days,
      time_start: data.time_start,
      time_end:   data.time_end,
      faculty_id: data.faculty_id ? data.faculty_id : null,
    };

    try {
      let res;
      if (mode === 'create') {
        res = await fetch(`${API_BASE}/scheduling`, {
          method:      'POST',
          credentials: 'include',
          headers:     { 'Content-Type': 'application/json' },
          body:        JSON.stringify(payload),
        });
      } else {
        res = await fetch(`${API_BASE}/scheduling/${data.schedule_id}`, {
          method:      'PUT',
          credentials: 'include',
          headers:     { 'Content-Type': 'application/json' },
          body:        JSON.stringify(payload),
        });
      }

      const result = await res.json();
      if (!res.ok) throw new Error(result.message);

      showToast(result.message);
      setModalState({ isOpen: false, mode: null, data: null });
      await fetchSchedules();
    } catch (err) {
      showToast(err.message || 'Failed to save schedule.', 'error');
    }
  };

  // ── Delete ────────────────────────────────────────────────
  const deleteSchedule = async (id) => {
    if (!window.confirm('Are you sure you want to delete this schedule? This will remove the class section entirely.')) return;

    try {
      const res = await fetch(`${API_BASE}/scheduling/${id}`, {
        method:      'DELETE',
        credentials: 'include',
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.message);

      showToast(result.message);
      setModalState({ isOpen: false, mode: null, data: null });
      await fetchSchedules();
    } catch (err) {
      showToast(err.message || 'Failed to delete schedule.', 'error');
    }
  };

  // ── Current SY label ──────────────────────────────────────
  const currentSYLabel = () => {
    const sy = schoolYears.find(s => s.sy_id === filterSY);
    return sy ? `${sy.sy_label} | ${sy.semester} Sem` : '';
  };

  // ─────────────────────────────────────────────────────────
  //  RENDER
  // ─────────────────────────────────────────────────────────
  return (
    <div className="space-y-6 max-w-[1600px] mx-auto animate-in fade-in duration-300 relative">

      {/* Toast */}
      {toast && createPortal(
        <div className={`fixed top-8 right-8 z-[10000] p-4 rounded-2xl shadow-xl flex items-center animate-in slide-in-from-top-4 border ${
          toast.type === 'error'
            ? 'bg-red-50 border-red-200 text-red-800'
            : 'bg-green-50 border-green-200 text-green-800'
        }`}>
          {toast.type === 'error'
            ? <AlertCircle className="mr-3 shrink-0" size={20}/>
            : <CheckCircle2 className="mr-3 shrink-0" size={20}/>
          }
          <p className="text-sm font-bold">{toast.message}</p>
        </div>,
        document.body
      )}

      {/* ── SCHEDULE MODAL (Create / Edit) ── */}
      {modalState.isOpen && createPortal(
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in"
          onClick={() => setModalState({ isOpen: false, mode: null, data: null })}
        >
          <div
            className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl p-6 sm:p-8 animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex justify-between items-center mb-6 border-b border-gray-50 pb-4">
              <div>
                <h2 className="text-xs font-black text-gray-400 uppercase tracking-[0.2em]">Master Schedule</h2>
                <p className="text-lg font-bold text-gray-900 mt-0.5">
                  {modalState.mode === 'create' ? 'Create New Section' : 'Edit Section Assignment'}
                </p>
              </div>
              <button
                onClick={() => setModalState({ isOpen: false, mode: null, data: null })}
                className="p-2 border border-gray-200 rounded-full hover:bg-gray-50 text-gray-600 transition-all active:scale-90"
              >
                <X size={18} strokeWidth={2.5} />
              </button>
            </div>

            <form onSubmit={saveSchedule} className="space-y-5 overflow-y-auto pr-2 flex-1">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div>
                  <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1.5">School Year & Term</label>
                  <select
                    required
                    value={modalState.data.sy_id}
                    onChange={(e) => handleFormChange('sy_id', e.target.value)}
                    className="w-full p-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#0e5c2b] outline-none text-sm font-bold text-gray-800 bg-gray-50"
                  >
                    {schoolYears.map(sy => (
                      <option key={sy.sy_id} value={sy.sy_id}>
                        {sy.sy_label} - {sy.semester} Sem
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1.5">Course / Subject</label>
                  <select
                    required
                    value={modalState.data.subject_id}
                    onChange={(e) => handleFormChange('subject_id', e.target.value)}
                    className="w-full p-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#0e5c2b] outline-none text-sm font-bold text-gray-800"
                  >
                    {subjects.map(s => (
                      <option key={s.subject_id} value={s.subject_id}>
                        {s.subject_code} - {s.subject_name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div>
                  <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1.5">Section Name</label>
                  <input
                    type="text"
                    required
                    value={modalState.data.section}
                    onChange={(e) => handleFormChange('section', e.target.value)}
                    className="w-full p-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#0e5c2b] outline-none text-sm font-medium"
                    placeholder="e.g. BSIT 3A"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1.5">Room</label>
                  <div className="relative">
                    <MapPin className="absolute left-3.5 top-3.5 text-gray-400" size={16} />
                    <input
                      type="text"
                      required
                      value={modalState.data.room}
                      onChange={(e) => handleFormChange('room', e.target.value)}
                      className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#0e5c2b] outline-none text-sm font-medium"
                      placeholder="e.g. Lab 1"
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-5">
                <div>
                  <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1.5">Days</label>
                  <select
                    required
                    value={modalState.data.days}
                    onChange={(e) => handleFormChange('days', e.target.value)}
                    className="w-full p-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#0e5c2b] outline-none text-sm font-medium text-gray-800"
                  >
                    <option value="MWF">MWF</option>
                    <option value="TTH">TTH</option>
                    <option value="SAT">SAT</option>
                    <option value="SUN">SUN</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1.5">Start Time</label>
                  <input
                    type="time"
                    required
                    value={modalState.data.time_start}
                    onChange={(e) => handleFormChange('time_start', e.target.value)}
                    className="w-full p-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#0e5c2b] outline-none text-sm font-medium text-gray-800"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1.5">End Time</label>
                  <input
                    type="time"
                    required
                    value={modalState.data.time_end}
                    onChange={(e) => handleFormChange('time_end', e.target.value)}
                    className="w-full p-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#0e5c2b] outline-none text-sm font-medium text-gray-800"
                  />
                </div>
              </div>

              <div className="pt-4 mt-4 border-t border-gray-100">
                <label className="block text-[10px] font-bold text-[#0e5c2b] uppercase tracking-widest mb-2 flex items-center">
                  <Users size={14} className="mr-1.5" /> Faculty Assignment
                </label>
                <select
                  value={modalState.data.faculty_id}
                  onChange={(e) => handleFormChange('faculty_id', e.target.value)}
                  className="w-full p-3 border-2 border-[#0e5c2b]/20 rounded-xl focus:ring-2 focus:ring-[#0e5c2b] outline-none text-sm font-bold text-gray-800 bg-green-50/30"
                >
                  <option value="">-- UNASSIGNED (TBA) --</option>
                  {facultyList.map(f => (
                    <option key={f.user_id} value={f.user_id}>
                      {f.full_name} ({f.dept_code || 'N/A'})
                    </option>
                  ))}
                </select>
                <p className="text-xs text-gray-400 mt-2 font-medium">
                  Leaving this unassigned will flag the course for the Dean to review.
                </p>
              </div>
            </form>

            <div className="mt-8 pt-5 border-t border-gray-100 flex justify-between items-center shrink-0">
              {modalState.mode === 'edit' ? (
                <button
                  type="button"
                  onClick={() => deleteSchedule(modalState.data.schedule_id)}
                  className="px-4 py-2.5 text-sm font-bold text-red-600 hover:bg-red-50 rounded-xl transition-all flex items-center"
                >
                  <Trash2 size={16} className="mr-2" /> Delete
                </button>
              ) : <div />}
              <div className="flex space-x-3 ml-auto">
                <button
                  type="button"
                  onClick={() => setModalState({ isOpen: false, mode: null, data: null })}
                  className="px-5 py-2.5 text-sm font-bold text-gray-600 hover:bg-gray-100 rounded-xl transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  onClick={saveSchedule}
                  className="px-6 py-2.5 text-sm font-bold text-white bg-[#0e5c2b] hover:bg-[#0a4720] rounded-xl shadow-md transition-all flex items-center active:scale-95"
                >
                  <CheckCircle2 size={16} className="mr-2" />
                  {modalState.mode === 'create' ? 'Create Schedule' : 'Save Changes'}
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* ── PAGE HEADER ── */}
      <div className="bg-white p-6 sm:p-8 rounded-3xl shadow-sm border border-gray-100 flex flex-col sm:flex-row justify-between sm:items-center gap-6 relative overflow-hidden">
        <div className="absolute right-0 top-0 w-64 h-64 bg-green-50 rounded-full mix-blend-multiply filter blur-3xl opacity-50 -translate-y-1/2 translate-x-1/4 z-0 pointer-events-none"></div>
        <div className="relative z-10">
          <h1 className="text-3xl font-bold text-gray-900 tracking-tight font-serif mb-1 flex items-center">
            Course Scheduling
          </h1>
          <p className="text-sm text-gray-500 font-medium">Create course sections and assign faculty schedules for the term.</p>
        </div>
        <div className="relative z-10 shrink-0">
          <button
            onClick={openCreateModal}
            className="px-6 py-3 bg-[#0e5c2b] hover:bg-[#0a4720] text-white font-bold rounded-xl text-sm transition-all shadow-lg shadow-green-900/20 flex items-center active:scale-95"
          >
            <Plus size={18} className="mr-2" /> Create New Section
          </button>
        </div>
      </div>

      {/* ── MAIN TABLE ── */}
      <div className="bg-white rounded-3xl shadow-xl border border-gray-100 overflow-hidden flex flex-col min-h-[500px]">

        {/* Toolbar */}
        <div className="p-4 border-b border-gray-200 bg-white flex flex-row items-center gap-3 flex-wrap">

          {/* Unassigned badge */}
          {unassignedCount > 0 && (
            <div className="px-4 py-2 border border-red-200 rounded-lg flex items-center gap-2 bg-red-50 shrink-0 shadow-sm">
              <ShieldCheck size={16} className="text-red-600" />
              <div>
                <span className="text-sm font-bold text-red-700 leading-none">{unassignedCount}</span>
                <span className="text-[10px] font-black text-red-600 uppercase tracking-widest ml-1.5">Unassigned</span>
              </div>
            </div>
          )}

          {/* SY Filter */}
          <div className="relative shrink-0">
            <select
              value={filterSY || ''}
              onChange={(e) => setFilterSY(parseInt(e.target.value))}
              className="pl-9 pr-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#0e5c2b] outline-none text-sm font-bold text-gray-800 bg-gray-50 cursor-pointer shadow-sm appearance-none"
            >
              {schoolYears.map(sy => (
                <option key={sy.sy_id} value={sy.sy_id}>
                  {sy.sy_label} | {sy.semester} Sem
                </option>
              ))}
            </select>
            <CalendarDays className="absolute left-3 top-2.5 text-gray-500" size={16} />
          </div>

          {/* Search */}
          <div className="relative shrink min-w-[150px] flex-1 max-w-md">
            <Search className="absolute left-3.5 top-2.5 text-gray-400" size={16} />
            <input
              type="text"
              placeholder="Search subject, section, or faculty..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-green-600 outline-none text-sm font-medium transition-shadow bg-gray-50 focus:bg-white"
            />
          </div>

          {/* Sort */}
          <div className="flex items-center gap-3 shrink-0 ml-auto flex-wrap">
            <div className="relative">
              <button
                onClick={() => setIsSortOpen(!isSortOpen)}
                className="flex items-center justify-center gap-2 px-4 py-2 bg-white border border-gray-200 text-gray-700 font-bold rounded-lg text-sm hover:bg-gray-50 transition-all shadow-sm"
              >
                <ArrowUpDown size={15} /> Sort
              </button>
              {isSortOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setIsSortOpen(false)}></div>
                  <div className="absolute right-0 top-full mt-2 bg-white rounded-2xl shadow-xl border border-gray-100 w-48 z-50 overflow-hidden">
                    {[
                      { key: 'subject_code', label: 'Course Code' },
                      { key: 'section',      label: 'Section Name' },
                      { key: 'faculty',      label: 'Faculty Assigned' },
                    ].map(opt => (
                      <button
                        key={opt.key}
                        onClick={() => { toggleSort(opt.key); setIsSortOpen(false); }}
                        className={`w-full flex items-center justify-between px-4 py-2.5 text-sm font-medium hover:bg-gray-50 transition-colors ${sortBy === opt.key ? 'text-green-700 font-bold bg-green-50/40' : 'text-gray-700'}`}
                      >
                        {opt.label}
                        {sortBy === opt.key && (sortDir === 'asc'
                          ? <ArrowDown size={13} className="text-green-600" />
                          : <ArrowUp size={13} className="text-green-600" />
                        )}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto flex-1 bg-white">
          <table className="w-full text-left border-collapse">
            <thead className="bg-gray-50/80 border-b border-gray-100">
              <tr>
                <th className="px-6 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest">Course / Subject</th>
                <th className="px-6 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest w-32">Section</th>
                <th className="px-6 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest w-56">Schedule & Room</th>
                <th className="px-6 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest w-64">Assigned Faculty</th>
                <th className="px-6 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest text-right w-24">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {isLoading ? (
                <tr>
                  <td colSpan="5" className="py-24 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <div className="w-8 h-8 border-4 border-green-600 border-t-transparent rounded-full animate-spin"></div>
                      <p className="text-gray-400 font-medium text-sm">Loading schedules...</p>
                    </div>
                  </td>
                </tr>
              ) : error ? (
                <tr>
                  <td colSpan="5" className="py-24 text-center">
                    <p className="text-red-500 font-bold">{error}</p>
                  </td>
                </tr>
              ) : processedSchedules.length === 0 ? (
                <tr>
                  <td colSpan="5" className="py-24 text-center">
                    <BookOpen className="mx-auto text-gray-200 mb-4" size={48} />
                    <p className="text-gray-500 font-bold">No schedules created yet.</p>
                    <p className="text-xs text-gray-400 mt-1">Click the button above to create the first section for this term.</p>
                  </td>
                </tr>
              ) : (
                processedSchedules.map((sch) => {
                  const isUnassigned = !sch.faculty_id;
                  return (
                    <tr key={sch.schedule_id} className="hover:bg-gray-50 transition-colors group">
                      <td className="px-6 py-4">
                        <div className="text-sm font-bold text-gray-900 leading-tight">{sch.subject_name}</div>
                        <div className="text-[10px] font-bold text-[#0e5c2b] uppercase tracking-widest mt-0.5">
                          {sch.subject_code} • {sch.units} Units
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="bg-gray-100 text-gray-700 px-3 py-1.5 rounded-lg text-xs font-bold border border-gray-200">
                          {sch.section}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center text-sm font-bold text-gray-700 mb-1">
                          <Clock size={14} className="mr-2 text-gray-400" />
                          {sch.days} • {formatTime(sch.time_start)} - {formatTime(sch.time_end)}
                        </div>
                        <div className="flex items-center text-[10px] font-bold text-gray-500 uppercase tracking-wider">
                          <MapPin size={12} className="mr-2 text-gray-400" />
                          {sch.room}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        {isUnassigned ? (
                          <div className="inline-flex items-center bg-red-50 text-red-700 px-3 py-1.5 rounded-lg border border-red-100">
                            <ShieldCheck size={14} className="mr-2" />
                            <span className="text-xs font-bold uppercase tracking-wide">TBA (Unassigned)</span>
                          </div>
                        ) : (
                          <div className="flex items-center">
                            <div className="w-8 h-8 rounded-full bg-[#0e5c2b] text-white flex items-center justify-center font-bold text-xs mr-3 shadow-sm">
                              {sch.faculty_name ? sch.faculty_name.charAt(0) : '?'}
                            </div>
                            <div>
                              <div className="text-sm font-bold text-gray-900">{sch.faculty_name}</div>
                              <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-0.5">
                                {sch.faculty_dept} Dept
                              </div>
                            </div>
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button
                          onClick={() => openEditModal(sch)}
                          className="p-2 text-gray-400 hover:text-[#0e5c2b] hover:bg-green-50 rounded-lg transition-all"
                        >
                          <Edit size={18} />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}