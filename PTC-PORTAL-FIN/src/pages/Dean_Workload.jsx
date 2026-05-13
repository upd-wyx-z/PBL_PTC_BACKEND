import React, { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { 
  Search, CheckCircle2, Clock, ChevronLeft, 
  Briefcase, ArrowUpDown, ArrowUp, ArrowDown,
  ShieldCheck, AlertTriangle, X, CornerUpLeft,
  Users, BookOpen, Plus, Trash2, Library, AlertCircle
} from 'lucide-react';

const API_BASE = '/api';

export default function DeanWorkload({ user }) {
  // ── Real data states ──────────────────────────────────────
  const [facultyList,       setFacultyList]       = useState([]);
  const [subjects,          setSubjects]          = useState([]);
  const [pendingCount,      setPendingCount]      = useState(0);
  const [acknowledgedCount, setAcknowledgedCount] = useState(0);
  const [revisionCount,     setRevisionCount]     = useState(0);
  const [currentSyId,       setCurrentSyId]       = useState(null);
  const [isLoading,         setIsLoading]         = useState(true);
  const [error,             setError]             = useState('');
  const [toast,             setToast]             = useState(null);

  // ── Filter / sort states ──────────────────────────────────
  const [searchTerm,    setSearchTerm]    = useState('');
  const [filterStatus,  setFilterStatus]  = useState('all');
  const [sortBy,        setSortBy]        = useState('name');
  const [sortDir,       setSortDir]       = useState('asc');
  const [isSortOpen,    setIsSortOpen]    = useState(false);

  // ── Modal states ──────────────────────────────────────────
  const [activeReview,    setActiveReview]    = useState(null); // { faculty, schedules, totalUnits, totalSections }
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);
  const [actionModal,     setActionModal]     = useState({ isOpen: false, type: null });
  const [subjectModalOpen,setSubjectModalOpen]= useState(false);
  const [subjectsLoading, setSubjectsLoading] = useState(false);
  const [newSubject,      setNewSubject]      = useState({ subject_code: '', subject_name: '', units: 3 });
  const [revisionRemarks, setRevisionRemarks] = useState('');
  const [isSaving,        setIsSaving]        = useState(false);

  // ── Toast helper ──────────────────────────────────────────
  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  // ── Fetch faculty workload list ───────────────────────────
  const fetchFacultyList = useCallback(async () => {
    setIsLoading(true);
    setError('');
    try {
      const params = new URLSearchParams();
      if (searchTerm.trim()) params.set('search', searchTerm.trim());
      if (filterStatus !== 'all') params.set('status', filterStatus);

      const res = await fetch(`${API_BASE}/workload?${params.toString()}`, {
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Failed to fetch faculty list.');
      const data = await res.json();

      setFacultyList(data.faculty       || []);
      setPendingCount(data.pendingCount  || 0);
      setAcknowledgedCount(data.acknowledgedCount || 0);
      setRevisionCount(data.revisionCount || 0);
      if (data.sy_id) setCurrentSyId(data.sy_id);
    } catch (err) {
      setError('Could not load workload data. Please try again.');
      console.error('fetchFacultyList error:', err);
    } finally {
      setIsLoading(false);
    }
  }, [searchTerm, filterStatus]);

  useEffect(() => {
    const timer = setTimeout(() => fetchFacultyList(), 400);
    return () => clearTimeout(timer);
  }, [fetchFacultyList]);

  // ── Fetch subjects for modal ──────────────────────────────
  const fetchSubjects = async () => {
    setSubjectsLoading(true);
    try {
      const res = await fetch(`${API_BASE}/workload/subjects`, { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setSubjects(data.subjects || []);
      }
    } catch (err) {
      console.error('fetchSubjects error:', err);
    } finally {
      setSubjectsLoading(false);
    }
  };

  // ── Open subject modal — fetch fresh subjects ─────────────
  const openSubjectModal = async () => {
    setSubjectModalOpen(true);
    await fetchSubjects();
  };

  // ── Review a specific faculty's schedule ──────────────────
  const handleReviewLoad = async (fac) => {
    setIsLoadingDetail(true);
    try {
      const params = currentSyId ? `?sy_id=${currentSyId}` : '';
      const res = await fetch(`${API_BASE}/workload/${fac.user_id}${params}`, {
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Failed to fetch schedule details.');
      const data = await res.json();

      setActiveReview({
        faculty:       data.faculty,
        schedules:     data.schedules,
        totalUnits:    data.totalUnits,
        totalSections: data.totalSections,
        sy_id:         data.sy_id,
      });
    } catch (err) {
      showToast('Failed to load faculty details. Please try again.', 'error');
      console.error('handleReviewLoad error:', err);
    } finally {
      setIsLoadingDetail(false);
    }
  };

  // ── Acknowledge workload ──────────────────────────────────
  const handleAcknowledge = async () => {
    setIsSaving(true);
    try {
      const res = await fetch(`${API_BASE}/workload/${activeReview.faculty.user_id}/acknowledge`, {
        method:      'POST',
        credentials: 'include',
        headers:     { 'Content-Type': 'application/json' },
        body:        JSON.stringify({ sy_id: activeReview.sy_id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);

      showToast(data.message);
      setActionModal({ isOpen: false, type: null });

      // Update local state immediately
      setActiveReview(prev => ({
        ...prev,
        faculty: { ...prev.faculty, status: 'acknowledged' },
      }));
      await fetchFacultyList();
    } catch (err) {
      showToast(err.message || 'Failed to acknowledge workload.', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  // ── Request revision ──────────────────────────────────────
  const handleRequestRevision = async () => {
    if (!revisionRemarks.trim()) return;
    setIsSaving(true);
    try {
      const res = await fetch(`${API_BASE}/workload/${activeReview.faculty.user_id}/revision`, {
        method:      'POST',
        credentials: 'include',
        headers:     { 'Content-Type': 'application/json' },
        body:        JSON.stringify({ sy_id: activeReview.sy_id, remarks: revisionRemarks }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);

      showToast(data.message, 'warning');
      setActionModal({ isOpen: false, type: null });
      setRevisionRemarks('');

      // Update local state immediately
      setActiveReview(prev => ({
        ...prev,
        faculty: { ...prev.faculty, status: 'revision_requested' },
      }));
      await fetchFacultyList();
    } catch (err) {
      showToast(err.message || 'Failed to request revision.', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  // ── Add subject ───────────────────────────────────────────
  const handleAddSubject = async (e) => {
    e.preventDefault();
    if (!newSubject.subject_code || !newSubject.subject_name) return;
    try {
      const res = await fetch(`${API_BASE}/workload/subjects`, {
        method:      'POST',
        credentials: 'include',
        headers:     { 'Content-Type': 'application/json' },
        body:        JSON.stringify({ ...newSubject, units: parseInt(newSubject.units) }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);

      showToast(data.message);
      setNewSubject({ subject_code: '', subject_name: '', units: 3 });
      await fetchSubjects();
    } catch (err) {
      showToast(err.message || 'Failed to add subject.', 'error');
    }
  };

  // ── Delete subject ────────────────────────────────────────
  const handleDeleteSubject = async (subjectId) => {
    if (!window.confirm('Delete this subject from the curriculum master list?')) return;
    try {
      const res = await fetch(`${API_BASE}/workload/subjects/${subjectId}`, {
        method:      'DELETE',
        credentials: 'include',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);

      showToast(data.message, 'warning');
      await fetchSubjects();
    } catch (err) {
      showToast(err.message || 'Failed to delete subject.', 'error');
    }
  };

  // ── Helpers ───────────────────────────────────────────────
  const getStatusBadge = (status) => {
    switch(status) {
      case 'pending':
        return <span className="bg-yellow-100 text-yellow-800 px-2.5 py-1 rounded-md text-[10px] font-black uppercase tracking-widest">Needs Review</span>;
      case 'acknowledged':
        return <span className="bg-green-100 text-green-800 px-2.5 py-1 rounded-md text-[10px] font-black uppercase tracking-widest">Acknowledged</span>;
      case 'revision_requested':
        return <span className="bg-red-100 text-red-800 px-2.5 py-1 rounded-md text-[10px] font-black uppercase tracking-widest">Revision Requested</span>;
      default: return null;
    }
  };

  const toggleSort = (key) => {
    if (sortBy === key) setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    else { setSortBy(key); setSortDir('asc'); }
  };

  const processedFaculty = [...facultyList].sort((a, b) => {
    let valA, valB;
    if (sortBy === 'name') {
      valA = a.last_name.toLowerCase();
      valB = b.last_name.toLowerCase();
    } else if (sortBy === 'units') {
      valA = a.total_units;
      valB = b.total_units;
    } else {
      valA = (a[sortBy] || '').toString().toLowerCase();
      valB = (b[sortBy] || '').toString().toLowerCase();
    }
    if (valA < valB) return sortDir === 'asc' ? -1 : 1;
    if (valA > valB) return sortDir === 'asc' ? 1  : -1;
    return 0;
  });

  // ── Toast portal (always render) ─────────────────────────
  const toastPortal = toast && createPortal(
    <div className={`fixed top-8 right-8 z-[10000] p-4 rounded-2xl shadow-xl flex items-center animate-in slide-in-from-top-4 border ${
      toast.type === 'error'   ? 'bg-red-50 border-red-200 text-red-800' :
      toast.type === 'warning' ? 'bg-yellow-50 border-yellow-200 text-yellow-800' :
                                 'bg-green-50 border-green-200 text-green-800'
    }`}>
      {toast.type === 'error'
        ? <AlertCircle className="mr-3 shrink-0" size={20}/>
        : <CheckCircle2 className="mr-3 shrink-0" size={20}/>
      }
      <p className="text-sm font-bold">{toast.message}</p>
    </div>,
    document.body
  );

  // ==========================================
  //  VIEW 2: REVIEW DETAILED SCHEDULE
  // ==========================================
  if (activeReview) {
    const { faculty: fac, schedules, totalUnits, totalSections } = activeReview;
    const isPending = fac.status === 'pending' || fac.status === 'revision_requested';

    return (
      <div className="space-y-6 max-w-[1600px] mx-auto animate-in fade-in duration-300 relative">
        {toastPortal}

        {/* Action Modals */}
        {actionModal.isOpen && createPortal(
          <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in" onClick={() => setActionModal({ isOpen: false, type: null })}>

            {actionModal.type === 'acknowledge' && (
              <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md p-8 text-center animate-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
                <div className="w-16 h-16 bg-green-50 text-green-600 rounded-full flex items-center justify-center mx-auto mb-6 border-4 border-white shadow-sm">
                  <CheckCircle2 size={32} />
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-2">Acknowledge Workload</h3>
                <p className="text-sm text-gray-500 mb-8 leading-relaxed">
                  By proceeding, you verify that the teaching load ({totalUnits} Units) assigned to <span className="font-bold text-gray-700">{fac.first_name} {fac.last_name}</span> is correct and approved for the semester.
                </p>
                <div className="flex gap-3">
                  <button onClick={() => setActionModal({ isOpen: false, type: null })} className="flex-1 py-3.5 px-4 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-xl transition-all" disabled={isSaving}>Cancel</button>
                  <button onClick={handleAcknowledge} disabled={isSaving} className="flex-1 py-3.5 px-4 bg-[#0e5c2b] hover:bg-[#0a4720] text-white font-bold rounded-xl shadow-md transition-all active:scale-95 disabled:opacity-60 flex items-center justify-center gap-2">
                    {isSaving ? <><span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span> Saving...</> : 'Confirm'}
                  </button>
                </div>
              </div>
            )}

            {actionModal.type === 'request_revision' && (
              <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md p-8 animate-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-12 h-12 bg-red-50 text-red-600 rounded-full flex items-center justify-center shrink-0">
                    <CornerUpLeft size={24} />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-gray-900 leading-tight">Request Revision</h3>
                    <p className="text-xs text-gray-500 mt-0.5">Send a revision request back to the Registrar.</p>
                  </div>
                </div>
                <div className="mb-6">
                  <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Reason / Remarks (Required)</label>
                  <textarea
                    rows="4"
                    value={revisionRemarks}
                    onChange={(e) => setRevisionRemarks(e.target.value)}
                    className="w-full p-4 border border-gray-200 rounded-xl focus:ring-2 focus:ring-red-600 outline-none text-sm font-medium resize-none bg-gray-50 focus:bg-white transition-colors"
                    placeholder="e.g. Faculty is overloaded by 3 units. Please remove one section of CC101."
                  />
                </div>
                <div className="flex gap-3">
                  <button onClick={() => setActionModal({ isOpen: false, type: null })} className="flex-1 py-3.5 px-4 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-xl transition-all" disabled={isSaving}>Cancel</button>
                  <button
                    onClick={handleRequestRevision}
                    disabled={!revisionRemarks.trim() || isSaving}
                    className="flex-1 py-3.5 px-4 bg-red-600 hover:bg-red-700 disabled:bg-red-300 text-white font-bold rounded-xl shadow-md transition-all active:scale-95 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {isSaving ? <><span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span> Sending...</> : 'Send Request'}
                  </button>
                </div>
              </div>
            )}
          </div>,
          document.body
        )}

        {/* Header */}
        <div className="flex items-center gap-4">
          <button
            onClick={() => setActiveReview(null)}
            className="p-2.5 bg-white shadow-sm hover:bg-gray-50 text-gray-600 hover:text-gray-900 rounded-xl transition-all border border-gray-200"
            title="Back to Roster"
          >
            <ChevronLeft size={20} />
          </button>
          <div>
            <div className="flex items-center gap-3 mb-0.5">
              <span className="text-xs font-bold text-gray-500 uppercase tracking-widest">
                {fac.role_name?.replace(/_/g, ' ').toUpperCase()} • {fac.dept_code || 'Dept.'}
              </span>
            </div>
            <h1 className="text-2xl font-bold text-gray-900 tracking-tight font-serif">
              {fac.first_name} {fac.last_name}
            </h1>
          </div>
        </div>

        {/* Metrics Row */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 flex items-center justify-between">
            <div>
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Total Teaching Load</p>
              <p className="text-3xl font-black text-[#0e5c2b] leading-none">{totalUnits} <span className="text-sm font-bold text-gray-400 uppercase">Units</span></p>
            </div>
            <Briefcase size={32} className="text-green-100" />
          </div>
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 flex items-center justify-between">
            <div>
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Assigned Classes</p>
              <p className="text-3xl font-black text-gray-800 leading-none">{totalSections} <span className="text-sm font-bold text-gray-400 uppercase">Sections</span></p>
            </div>
            <BookOpen size={32} className="text-gray-100" />
          </div>
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 flex items-center justify-between">
            <div>
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Review Status</p>
              {getStatusBadge(fac.status)}
            </div>
          </div>
        </div>

        {/* Schedule Table */}
        <div className="bg-white rounded-2xl shadow-xl border border-gray-200 overflow-hidden flex flex-col min-h-[400px]">
          <div className="p-4 border-b border-gray-200 bg-white flex flex-row items-center gap-3 flex-wrap">
            <div className="px-4 py-2 border border-gray-200 rounded-lg text-sm font-bold text-gray-700 bg-gray-50 shrink-0 flex items-center">
              <Clock size={16} className="mr-2 text-gray-400" /> Detailed Schedule
            </div>
            <div className="flex items-center gap-3 shrink-0 ml-auto w-full sm:w-auto justify-end">
              {isPending ? (
                <>
                  <button
                    onClick={() => setActionModal({ isOpen: true, type: 'request_revision' })}
                    className="flex items-center justify-center px-5 py-2.5 bg-white border border-red-600 text-red-600 hover:bg-red-50 font-bold rounded-lg text-sm transition-all shadow-sm active:scale-95"
                  >
                    <CornerUpLeft size={16} className="mr-2" /> Request Revision
                  </button>
                  <button
                    onClick={() => setActionModal({ isOpen: true, type: 'acknowledge' })}
                    className="flex items-center justify-center px-6 py-2.5 bg-[#0e5c2b] hover:bg-[#0a4720] text-white font-bold rounded-lg shadow-sm transition-all active:scale-95"
                  >
                    <CheckCircle2 size={18} className="mr-2" /> Acknowledge Load
                  </button>
                </>
              ) : (
                <div className="px-4 py-2.5 bg-green-50 text-green-700 rounded-lg text-sm font-bold border border-green-200 flex items-center">
                  <ShieldCheck size={16} className="mr-2" /> Load Acknowledged & Official
                </div>
              )}
            </div>
          </div>

          <div className="overflow-x-auto flex-1">
            <table className="w-full text-left border-collapse min-w-max">
              <thead className="bg-[#1b2533] text-white">
                <tr>
                  <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest border-r border-[#2d3a4d]">Course / Subject</th>
                  <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest border-r border-[#2d3a4d] text-center w-24">Units</th>
                  <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest border-r border-[#2d3a4d] w-32">Section</th>
                  <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest border-r border-[#2d3a4d] w-64">Days & Time</th>
                  <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest">Room</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {schedules.length === 0 ? (
                  <tr>
                    <td colSpan="5" className="py-20 text-center">
                      <p className="text-gray-500 font-bold">No classes assigned to this faculty yet.</p>
                    </td>
                  </tr>
                ) : (
                  schedules.map((sch) => (
                    <tr key={sch.schedule_id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4 border-r border-gray-100">
                        <div className="font-bold text-sm text-gray-900">{sch.subject_name}</div>
                        <div className="text-[10px] text-green-700 font-black uppercase tracking-widest mt-0.5">{sch.subject_code}</div>
                      </td>
                      <td className="px-6 py-4 border-r border-gray-100 text-center">
                        <span className="text-sm font-black text-gray-800">{sch.units}</span>
                      </td>
                      <td className="px-6 py-4 border-r border-gray-100">
                        <span className="bg-gray-100 text-gray-700 px-3 py-1.5 rounded-lg text-xs font-bold border border-gray-200">{sch.section}</span>
                      </td>
                      <td className="px-6 py-4 border-r border-gray-100">
                        <div className="text-sm font-bold text-gray-700">{sch.days}</div>
                        <div className="text-xs text-gray-500 mt-0.5">{sch.time}</div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-sm font-medium text-gray-800">{sch.room}</span>
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

  // ==========================================
  //  VIEW 1: DEPARTMENT ROSTER (LIST VIEW)
  // ==========================================
  return (
    <div className="space-y-6 max-w-[1600px] mx-auto animate-in fade-in duration-300 relative">
      {toastPortal}

      {/* Loading overlay for detail fetch */}
      {isLoadingDetail && createPortal(
        <div className="fixed inset-0 z-[9998] flex items-center justify-center bg-black/30 backdrop-blur-sm">
          <div className="bg-white rounded-2xl p-8 flex flex-col items-center gap-4 shadow-xl">
            <div className="w-8 h-8 border-4 border-green-600 border-t-transparent rounded-full animate-spin"></div>
            <p className="text-sm font-bold text-gray-600">Loading schedule...</p>
          </div>
        </div>,
        document.body
      )}

      {/* Subject Management Modal */}
      {subjectModalOpen && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in" onClick={() => setSubjectModalOpen(false)}>
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl p-6 sm:p-8 flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-6 shrink-0">
              <div>
                <h2 className="text-xs font-black text-gray-400 uppercase tracking-[0.2em]">Curriculum</h2>
                <p className="text-lg font-bold text-gray-900 mt-0.5">Manage Department Subjects</p>
              </div>
              <button onClick={() => setSubjectModalOpen(false)} className="p-2 border border-gray-200 rounded-full hover:bg-gray-50 text-gray-500 transition-all active:scale-90"><X size={18} /></button>
            </div>

            <div className="flex-1 overflow-y-auto pr-2 space-y-6">
              {/* Add Subject Form */}
              <form onSubmit={handleAddSubject} className="bg-gray-50 p-5 rounded-2xl border border-gray-200">
                <h3 className="text-sm font-bold text-gray-800 mb-3 flex items-center"><Plus size={16} className="mr-2 text-green-700"/> Add New Subject</h3>
                <div className="grid grid-cols-12 gap-3">
                  <div className="col-span-12 sm:col-span-3">
                    <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1">Code</label>
                    <input type="text" required value={newSubject.subject_code} onChange={e => setNewSubject({...newSubject, subject_code: e.target.value.toUpperCase()})} className="w-full p-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-green-600 outline-none text-sm font-bold" placeholder="e.g. IT501" />
                  </div>
                  <div className="col-span-12 sm:col-span-7">
                    <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1">Subject Name</label>
                    <input type="text" required value={newSubject.subject_name} onChange={e => setNewSubject({...newSubject, subject_name: e.target.value})} className="w-full p-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-green-600 outline-none text-sm font-medium" placeholder="e.g. Advanced Database Systems" />
                  </div>
                  <div className="col-span-12 sm:col-span-2">
                    <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1">Units</label>
                    <input type="number" required min="1" max="6" value={newSubject.units} onChange={e => setNewSubject({...newSubject, units: e.target.value})} className="w-full p-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-green-600 outline-none text-sm font-bold text-center" />
                  </div>
                </div>
                <div className="mt-3 flex justify-end">
                  <button type="submit" className="px-5 py-2 text-xs font-bold text-white bg-green-700 hover:bg-green-800 rounded-lg shadow-sm transition-all active:scale-95">Save Subject</button>
                </div>
              </form>

              {/* Subject List */}
              <div>
                <h3 className="text-sm font-bold text-gray-800 mb-3 px-1">Current Subjects ({subjects.length})</h3>
                <div className="border border-gray-200 rounded-2xl overflow-hidden">
                  <table className="w-full text-left border-collapse">
                    <thead className="bg-gray-100/50">
                      <tr>
                        <th className="px-4 py-3 text-[10px] font-black text-gray-400 uppercase tracking-widest w-24">Code</th>
                        <th className="px-4 py-3 text-[10px] font-black text-gray-400 uppercase tracking-widest">Name</th>
                        <th className="px-4 py-3 text-[10px] font-black text-gray-400 uppercase tracking-widest text-center w-16">Units</th>
                        <th className="px-4 py-3 text-[10px] font-black text-gray-400 uppercase tracking-widest text-center w-16">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 bg-white">
                      {subjectsLoading ? (
                        <tr><td colSpan="4" className="p-6 text-center"><div className="w-5 h-5 border-2 border-green-600 border-t-transparent rounded-full animate-spin mx-auto"></div></td></tr>
                      ) : subjects.length === 0 ? (
                        <tr><td colSpan="4" className="p-6 text-center text-sm text-gray-500 font-medium">No subjects found.</td></tr>
                      ) : subjects.map(s => (
                        <tr key={s.subject_id} className="hover:bg-gray-50 transition-colors">
                          <td className="px-4 py-3 text-xs font-bold text-green-700">{s.subject_code}</td>
                          <td className="px-4 py-3 text-sm font-medium text-gray-800">{s.subject_name}</td>
                          <td className="px-4 py-3 text-sm font-bold text-gray-600 text-center">{s.units}</td>
                          <td className="px-4 py-3 text-center">
                            <button onClick={() => handleDeleteSubject(s.subject_id)} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all" title="Delete Subject">
                              <Trash2 size={16} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Page Header */}
      <div className="bg-white p-6 sm:p-8 rounded-3xl shadow-sm border border-gray-100 flex flex-col sm:flex-row justify-between sm:items-center gap-6 relative overflow-hidden">
        <div className="absolute right-0 top-0 w-64 h-64 bg-green-50 rounded-full mix-blend-multiply filter blur-3xl opacity-50 -translate-y-1/2 translate-x-1/4 z-0 pointer-events-none"></div>
        <div className="relative z-10">
          <h1 className="text-3xl font-bold text-gray-900 tracking-tight font-serif mb-1">Workload Management</h1>
          <p className="text-sm text-gray-500 font-medium">Review and acknowledge faculty teaching loads for the department.</p>
        </div>
        <div className="relative z-10 shrink-0">
          <button onClick={openSubjectModal} className="px-6 py-3 bg-[#0e5c2b] hover:bg-[#0a4720] text-white font-bold rounded-xl text-sm transition-all shadow-lg shadow-green-900/20 flex items-center active:scale-95">
            <Library size={18} className="mr-2" /> Manage Subjects
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-3xl shadow-xl border border-gray-100 overflow-hidden flex flex-col min-h-[500px]">
        {/* Toolbar */}
        <div className="p-4 border-b border-gray-200 bg-white flex flex-row items-center gap-3 flex-wrap">
          {/* Tallies */}
          <div className="flex gap-2 shrink-0">
            <div className="px-3 py-1.5 border border-gray-200 rounded-lg flex items-center gap-2 bg-yellow-50 shadow-sm">
              <Clock size={14} className="text-yellow-600" />
              <span className="text-sm font-bold text-yellow-700">{pendingCount}</span>
              <span className="text-[9px] font-black text-yellow-600 uppercase tracking-widest">Pending</span>
            </div>
            <div className="px-3 py-1.5 border border-gray-200 rounded-lg flex items-center gap-2 bg-green-50 shadow-sm">
              <CheckCircle2 size={14} className="text-green-600" />
              <span className="text-sm font-bold text-green-700">{acknowledgedCount}</span>
              <span className="text-[9px] font-black text-green-600 uppercase tracking-widest">Ack'd</span>
            </div>
            <div className="px-3 py-1.5 border border-gray-200 rounded-lg flex items-center gap-2 bg-red-50 shadow-sm">
              <AlertTriangle size={14} className="text-red-600" />
              <span className="text-sm font-bold text-red-700">{revisionCount}</span>
              <span className="text-[9px] font-black text-red-600 uppercase tracking-widest">Revisions</span>
            </div>
          </div>

          {/* Search */}
          <div className="relative shrink min-w-[150px] flex-1 max-w-md">
            <Search className="absolute left-3.5 top-2.5 text-gray-400" size={16} />
            <input
              type="text" placeholder="Search faculty name..."
              value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-green-600 outline-none text-sm font-medium transition-shadow bg-gray-50 focus:bg-white"
            />
          </div>

          {/* Tabs + Sort */}
          <div className="flex items-center gap-3 shrink-0 ml-auto flex-wrap">
            <div className="flex bg-gray-100 p-1 rounded-lg shrink-0">
              {['all', 'pending', 'acknowledged'].map(s => (
                <button key={s} onClick={() => setFilterStatus(s)}
                  className={`px-4 py-1.5 text-xs font-bold uppercase tracking-widest rounded-md transition-all ${filterStatus === s ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
                  {s === 'all' ? 'All' : s === 'pending' ? 'Pending' : 'Acknowledged'}
                </button>
              ))}
            </div>
            <div className="relative">
              <button onClick={() => setIsSortOpen(!isSortOpen)} className="flex items-center justify-center gap-2 px-4 py-2 bg-white border border-gray-200 text-gray-700 font-bold rounded-lg text-sm hover:bg-gray-50 transition-all shadow-sm">
                <ArrowUpDown size={15} /> Sort
              </button>
              {isSortOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setIsSortOpen(false)}></div>
                  <div className="absolute right-0 top-full mt-2 bg-white rounded-2xl shadow-xl border border-gray-100 w-48 z-50 overflow-hidden">
                    {[{ key: 'name', label: 'Faculty Name' }, { key: 'units', label: 'Total Units' }].map(opt => (
                      <button key={opt.key} onClick={() => { toggleSort(opt.key); setIsSortOpen(false); }}
                        className={`w-full flex items-center justify-between px-4 py-2.5 text-sm font-medium hover:bg-gray-50 transition-colors ${sortBy === opt.key ? 'text-green-700 font-bold bg-green-50/40' : 'text-gray-700'}`}>
                        {opt.label}
                        {sortBy === opt.key && (sortDir === 'asc' ? <ArrowDown size={13} className="text-green-600" /> : <ArrowUp size={13} className="text-green-600" />)}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Faculty Table */}
        <div className="overflow-x-auto flex-1 bg-white">
          <table className="w-full text-left border-collapse">
            <thead className="bg-gray-50/80 border-b border-gray-100">
              <tr>
                <th className="px-8 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest w-72">Faculty Member</th>
                <th className="px-6 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest">Total Load</th>
                <th className="px-6 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest">Sections Assigned</th>
                <th className="px-6 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest w-48">Review Status</th>
                <th className="px-8 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest text-right w-32">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {isLoading ? (
                <tr><td colSpan="5" className="py-24 text-center">
                  <div className="flex flex-col items-center gap-3">
                    <div className="w-8 h-8 border-4 border-green-600 border-t-transparent rounded-full animate-spin"></div>
                    <p className="text-gray-400 font-medium text-sm">Loading workload data...</p>
                  </div>
                </td></tr>
              ) : error ? (
                <tr><td colSpan="5" className="py-24 text-center"><p className="text-red-500 font-bold">{error}</p></td></tr>
              ) : processedFaculty.length === 0 ? (
                <tr><td colSpan="5" className="py-24 text-center">
                  <Users className="mx-auto text-gray-200 mb-4" size={48} />
                  <p className="text-gray-500 font-bold">No faculty members found.</p>
                </td></tr>
              ) : processedFaculty.map((fac) => (
                <tr key={fac.user_id} className="hover:bg-green-50/30 transition-colors group cursor-pointer" onClick={() => handleReviewLoad(fac)}>
                  <td className="px-8 py-5">
                    <div className="flex items-center">
                      <div className="w-10 h-10 rounded-full bg-[#0e5c2b] text-white flex items-center justify-center font-bold text-sm mr-4 shadow-sm">
                        {fac.first_name.charAt(0)}{fac.last_name.charAt(0)}
                      </div>
                      <div>
                        <div className="text-sm font-bold text-gray-900 group-hover:text-green-700 transition-colors">{fac.first_name} {fac.last_name}</div>
                        <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mt-0.5">{fac.role_name?.replace(/_/g, ' ')}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-5">
                    <div className="text-lg font-black text-gray-800 leading-none">{fac.total_units} <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">Units</span></div>
                  </td>
                  <td className="px-6 py-5">
                    <div className="text-sm font-bold text-gray-600 flex items-center">
                      <BookOpen size={16} className="mr-2 text-gray-400" />
                      {fac.section_count} Classes
                    </div>
                  </td>
                  <td className="px-6 py-5">{getStatusBadge(fac.status)}</td>
                  <td className="px-8 py-5 text-right">
                    <button className={`px-4 py-2 text-xs font-bold rounded-lg transition-all shadow-sm active:scale-95 ${fac.status === 'pending' ? 'bg-[#0e5c2b] hover:bg-[#0a4720] text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}>
                      Review Load
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}