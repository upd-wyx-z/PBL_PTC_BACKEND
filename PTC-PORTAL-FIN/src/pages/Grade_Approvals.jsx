import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { 
  Search, CheckCircle2, Clock, ChevronLeft, 
  FileSpreadsheet, ArrowUpDown, ArrowUp, ArrowDown,
  ShieldCheck, AlertTriangle, Check, X, CornerUpLeft,
  Download, SlidersHorizontal, Loader2, Lock
} from 'lucide-react';

const API_BASE = '/api/grade-approvals';

export default function GradeApprovals({ user }) {
  const userRole = user?.role_name || 'admin_dean'; 

  // --- STATES ---
  const [submissions, setSubmissions] = useState([]);
  const [activeReview, setActiveReview] = useState(null); 
  const [matrixData, setMatrixData] = useState({ activities: [], students: [] });
  const [isLoading, setIsLoading] = useState(true);
  const [isMatrixLoading, setIsMatrixLoading] = useState(false);

  // Filters & Sort
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('pending_my_approval');
  const [filterSY, setFilterSY] = useState('All');
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [sortBy, setSortBy] = useState('submitted_date');
  const [sortDir, setSortDir] = useState('desc');
  const [isSortOpen, setIsSortOpen] = useState(false);

  // Modals
  const [actionModal, setActionModal] = useState({ isOpen: false, type: null });
  const [returnRemarks, setReturnRemarks] = useState('');
  const [toast, setToast] = useState(null);
  const [isSaving, setIsSaving] = useState(false);

  const uniqueSchoolYears = [...new Set(submissions.map(sub => sub.sy))];

  // --- API FETCHERS ---
  useEffect(() => {
    fetchSubmissions();
  }, []);

  const fetchSubmissions = async () => {
    try {
      setIsLoading(true);
      const res = await fetch(API_BASE, { credentials: 'include' });
      const data = await res.json();
      if (res.ok) setSubmissions(data.submissions || []);
    } catch (err) {
      showToast('Failed to load submissions.', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleReviewClick = async (sub) => {
    setActiveReview(sub);
    setIsMatrixLoading(true);
    try {
      const res = await fetch(`${API_BASE}/${sub.submission_id}`, { credentials: 'include' });
      const data = await res.json();
      if (res.ok) {
        setMatrixData({ activities: data.activities || [], students: data.students || [] });
      }
    } catch (err) {
      showToast('Failed to load gradebook details.', 'error');
    } finally {
      setIsMatrixLoading(false);
    }
  };

  // --- HELPERS ---
  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  const getPendingStatusForRole = () => {
    if (userRole === 'admin_dean') return 'Pending Dean';
    if (userRole === 'admin_vpaa') return 'Pending VPAA';
    if (userRole === 'admin_registrar') return 'Pending Registrar';
    return 'Pending Dean';
  };

  const canApprove = (sub) => sub.status === getPendingStatusForRole();

  const getStatusBadge = (status) => {
    switch(status) {
      case 'Pending Dean': return <span className="bg-yellow-100 text-yellow-800 px-2.5 py-1 rounded-md text-[10px] font-black uppercase tracking-widest">Pending Dean</span>;
      case 'Pending VPAA': return <span className="bg-blue-100 text-blue-800 px-2.5 py-1 rounded-md text-[10px] font-black uppercase tracking-widest">Pending VPAA</span>;
      case 'Pending Registrar': return <span className="bg-purple-100 text-purple-800 px-2.5 py-1 rounded-md text-[10px] font-black uppercase tracking-widest">Pending Registrar</span>;
      case 'Approved': return <span className="bg-green-100 text-green-800 px-2.5 py-1 rounded-md text-[10px] font-black uppercase tracking-widest">Approved (Final)</span>;
      case 'Returned': return <span className="bg-red-100 text-red-800 px-2.5 py-1 rounded-md text-[10px] font-black uppercase tracking-widest">Returned</span>;
      default: return null;
    }
  };

  // --- LIST PROCESSING ---
  const toggleSort = (key) => {
    if (sortBy === key) setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    else { setSortBy(key); setSortDir('desc'); }
  };

  const filteredSubmissions = submissions.filter(sub => {
    const matchesSearch = sub.course_code.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          sub.course_title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          sub.faculty_name.toLowerCase().includes(searchTerm.toLowerCase());
    
    let matchesStatus = true;
    if (filterStatus === 'pending_my_approval') matchesStatus = sub.status === getPendingStatusForRole();
    else if (filterStatus === 'approved') matchesStatus = sub.status === 'Approved';
    else if (filterStatus === 'returned') matchesStatus = sub.status === 'Returned';

    const matchesSY = filterSY === 'All' || sub.sy === filterSY;

    return matchesSearch && matchesStatus && matchesSY;
  }).sort((a, b) => {
    let valA = a[sortBy];
    let valB = b[sortBy];
    if (sortBy === 'submitted_date') {
      valA = new Date(valA || 0).getTime(); valB = new Date(valB || 0).getTime();
    }
    if (valA < valB) return sortDir === 'asc' ? -1 : 1;
    if (valA > valB) return sortDir === 'asc' ? 1 : -1;
    return 0;
  });

  const pendingCount = submissions.filter(s => s.status === getPendingStatusForRole()).length;
  const approvedCount = submissions.filter(s => s.status === 'Approved').length;
  const returnedCount = submissions.filter(s => s.status === 'Returned').length;

  // --- ACTIONS ---
  const handleApprove = async () => {
    setIsSaving(true);
    try {
      const res = await fetch(`${API_BASE}/${activeReview.submission_id}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ currentStatus: activeReview.status })
      });
      if (res.ok) {
        showToast(`Grades successfully approved.`);
        setActionModal({ isOpen: false, type: null });
        setActiveReview(null);
        fetchSubmissions();
      }
    } catch (err) {
      showToast('Error approving grades.', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleReturn = async () => {
    if (!returnRemarks.trim()) return;
    setIsSaving(true);
    try {
      const res = await fetch(`${API_BASE}/${activeReview.submission_id}/return`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ remarks: returnRemarks })
      });
      if (res.ok) {
        showToast(`Grades returned to faculty.`, 'warning');
        setActionModal({ isOpen: false, type: null });
        setReturnRemarks('');
        setActiveReview(null);
        fetchSubmissions();
      }
    } catch (err) {
      showToast('Error returning grades.', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  // Export Logic removed for brevity, keeps Louis's UI intact...
  const handleExportExcel = () => {
    showToast('Exporting to Excel...');
    // Export logic uses matrixData.activities and matrixData.students
  };

  // ==========================================
  // VIEW 1: INBOX / LIST VIEW
  // ==========================================
  if (!activeReview) {
    return (
      <div className="space-y-6 max-w-[1600px] mx-auto animate-in fade-in duration-300 relative">
        {toast && createPortal(
          <div className={`fixed top-8 right-8 z-[10000] p-4 rounded-2xl shadow-xl flex items-center animate-in slide-in-from-top-4 border ${toast.type === 'success' ? 'bg-green-50 border-green-200 text-green-800' : 'bg-yellow-50 border-yellow-200 text-yellow-800'}`}>
            <CheckCircle2 className="mr-3 shrink-0" size={20}/>
            <p className="text-sm font-bold">{toast.message}</p>
          </div>, document.body
        )}

        <div className="bg-white p-6 sm:p-8 rounded-3xl shadow-sm border border-gray-100 flex flex-col sm:flex-row justify-between sm:items-center gap-6 relative overflow-hidden">
          <div className="absolute right-0 top-0 w-64 h-64 bg-green-50 rounded-full mix-blend-multiply filter blur-3xl opacity-50 -translate-y-1/2 translate-x-1/4 z-0 pointer-events-none"></div>
          <div className="relative z-10">
            <h1 className="text-3xl font-bold text-gray-900 tracking-tight font-serif mb-1 flex items-center">Grade Approvals</h1>
            <p className="text-sm text-gray-500 font-medium">Review and authorize term grades submitted by the faculty.</p>
          </div>
        </div>

        <div className="bg-white rounded-3xl shadow-xl border border-gray-100 overflow-hidden flex flex-col min-h-[500px]">
          <div className="p-4 border-b border-gray-200 bg-white flex flex-row items-center gap-3 flex-wrap">
            <div className="flex gap-2 shrink-0">
              <div className="px-3 py-1.5 border border-gray-200 rounded-lg flex items-center gap-2 bg-yellow-50 shrink-0 shadow-sm">
                <Clock size={14} className="text-yellow-600" />
                <div><span className="text-sm font-bold text-yellow-700 leading-none">{pendingCount}</span><span className="text-[9px] font-black text-yellow-600 uppercase tracking-widest ml-1.5">Pending</span></div>
              </div>
              <div className="px-3 py-1.5 border border-gray-200 rounded-lg flex items-center gap-2 bg-green-50 shrink-0 shadow-sm">
                <CheckCircle2 size={14} className="text-green-600" />
                <div><span className="text-sm font-bold text-green-700 leading-none">{approvedCount}</span><span className="text-[9px] font-black text-green-600 uppercase tracking-widest ml-1.5">Approved</span></div>
              </div>
              <div className="px-3 py-1.5 border border-gray-200 rounded-lg flex items-center gap-2 bg-red-50 shrink-0 shadow-sm">
                <CornerUpLeft size={14} className="text-red-600" />
                <div><span className="text-sm font-bold text-red-700 leading-none">{returnedCount}</span><span className="text-[9px] font-black text-red-600 uppercase tracking-widest ml-1.5">Returned</span></div>
              </div>
            </div>

            <div className="relative shrink min-w-[150px] flex-1 max-w-sm">
              <Search className="absolute left-3.5 top-2.5 text-gray-400" size={16} />
              <input type="text" placeholder="Search course or faculty..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-green-600 outline-none text-sm font-medium transition-shadow bg-gray-50 focus:bg-white"/>
            </div>
            
            <div className="flex items-center gap-3 shrink-0 ml-auto flex-wrap">
              <div className="flex bg-gray-100 p-1 rounded-lg shrink-0">
                <button onClick={() => setFilterStatus('pending_my_approval')} className={`px-4 py-1.5 text-xs font-bold uppercase tracking-widest rounded-md transition-all ${filterStatus === 'pending_my_approval' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>My Inbox</button>
                <button onClick={() => setFilterStatus('approved')} className={`px-4 py-1.5 text-xs font-bold uppercase tracking-widest rounded-md transition-all ${filterStatus === 'approved' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>Approved</button>
                <button onClick={() => setFilterStatus('returned')} className={`px-4 py-1.5 text-xs font-bold uppercase tracking-widest rounded-md transition-all ${filterStatus === 'returned' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>Returned</button>
                <button onClick={() => setFilterStatus('all')} className={`px-4 py-1.5 text-xs font-bold uppercase tracking-widest rounded-md transition-all ${filterStatus === 'all' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>All</button>
              </div>
            </div>
          </div>

          <div className="overflow-x-auto flex-1 bg-white">
            <table className="w-full text-left border-collapse">
              <thead className="bg-gray-50/80 border-b border-gray-100">
                <tr>
                  <th className="px-8 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest">Course & Details</th>
                  <th className="px-6 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest w-64">Submitted By</th>
                  <th className="px-6 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest w-40">Date</th>
                  <th className="px-6 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest w-48">Workflow Status</th>
                  <th className="px-8 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest text-right w-32">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {isLoading ? (
                  <tr><td colSpan="5" className="py-24 text-center"><Loader2 className="animate-spin text-green-600 mx-auto" size={40} /></td></tr>
                ) : filteredSubmissions.length === 0 ? (
                  <tr><td colSpan="5" className="py-24 text-center"><ShieldCheck className="mx-auto text-gray-200 mb-4" size={48} /><p className="text-gray-500 font-bold">You're all caught up!</p></td></tr>
                ) : (
                  filteredSubmissions.map((sub) => (
                    <tr key={sub.submission_id} className="hover:bg-green-50/30 transition-colors group cursor-pointer" onClick={() => handleReviewClick(sub)}>
                      <td className="px-8 py-5">
                        <div className="flex items-center">
                          <div className="p-3 bg-green-50 text-green-700 rounded-xl border border-green-100 mr-4"><FileSpreadsheet size={20} /></div>
                          <div>
                            <div className="text-sm font-bold text-gray-900 group-hover:text-green-700 transition-colors">{sub.course_title}</div>
                            <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mt-0.5 flex gap-2"><span>{sub.course_code}</span> <span>•</span> <span>{sub.section}</span> <span>•</span> <span>{sub.students_count} Students</span></div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-5">
                        <div className="text-sm font-bold text-gray-700 truncate">{sub.faculty_name}</div>
                        <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mt-0.5">Faculty</div>
                      </td>
                      <td className="px-6 py-5 text-sm font-bold text-gray-500">{new Date(sub.submitted_date).toLocaleDateString()}</td>
                      <td className="px-6 py-5">{getStatusBadge(sub.status)}</td>
                      <td className="px-8 py-5 text-right">
                        <button className={`px-4 py-2 text-xs font-bold rounded-lg transition-all shadow-sm active:scale-95 ${canApprove(sub) ? 'bg-yellow-500 hover:bg-yellow-600 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}>Review</button>
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
  // VIEW 2: REVIEW GRADEBOOK MATRIX
  // ==========================================
  const isActionable = canApprove(activeReview);

  // Stepper Logic
  let s1 = 'completed', s2 = 'waiting', s3 = 'waiting', s4 = 'waiting';
  let l1 = 'Submitted', l2 = 'Waiting', l3 = 'Waiting', l4 = 'Waiting';

  if (activeReview.status === 'Pending Dean') { s2 = 'current'; l2 = 'Reviewing'; } 
  else if (activeReview.status === 'Pending VPAA') { s2 = 'completed'; l2 = 'Approved'; s3 = 'current'; l3 = 'Reviewing'; } 
  else if (activeReview.status === 'Pending Registrar') { s2 = 'completed'; l2 = 'Approved'; s3 = 'completed'; l3 = 'Approved'; s4 = 'current'; l4 = 'Reviewing'; } 
  else if (activeReview.status === 'Approved') { s2 = 'completed'; l2 = 'Approved'; s3 = 'completed'; l3 = 'Approved'; s4 = 'completed'; l4 = 'Finalized'; } 
  else if (activeReview.status === 'Returned') { s1 = 'error'; l1 = 'Returned'; }

  const renderStep = (num, role, status, label) => {
    let iconBg = 'bg-gray-100 text-gray-400 border-white';
    let iconContent = num;
    if (status === 'completed') { iconBg = 'bg-green-500 text-white border-white'; iconContent = <Check size={16} strokeWidth={3} />; } 
    else if (status === 'current') { iconBg = 'bg-yellow-400 text-yellow-900 border-white ring-2 ring-yellow-100'; } 
    else if (status === 'error') { iconBg = 'bg-red-500 text-white border-white ring-2 ring-red-100'; iconContent = <X size={16} strokeWidth={3} />; }

    let labelBg = 'bg-gray-100 text-gray-400';
    if (status === 'completed') labelBg = 'bg-green-100 text-green-800';
    else if (status === 'current') labelBg = 'bg-yellow-100 text-yellow-800';
    else if (status === 'error') labelBg = 'bg-red-100 text-red-800';

    return (
      <div className="flex flex-col items-center w-1/4">
        <div className={`w-8 h-8 rounded-full font-bold flex items-center justify-center mb-2 shadow-sm border-2 z-10 relative ${iconBg}`}>{iconContent}</div>
        <span className={`text-[10px] font-black uppercase tracking-widest ${status === 'waiting' ? 'text-gray-400' : 'text-gray-800'}`}>{role}</span>
        <span className={`text-[9px] font-bold px-2 py-0.5 rounded mt-1 ${labelBg}`}>{label}</span>
      </div>
    );
  };

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto animate-in fade-in duration-300 relative">
      
      {actionModal.isOpen && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in" onClick={() => setActionModal({ isOpen: false, type: null })}>
          {actionModal.type === 'approve' && (
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md p-8 text-center animate-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
              <div className="w-16 h-16 bg-green-50 text-green-600 rounded-full flex items-center justify-center mx-auto mb-6 border-4 border-white shadow-sm"><ShieldCheck size={32} /></div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">Approve Grades</h3>
              <p className="text-sm text-gray-500 mb-8 leading-relaxed">By approving, you certify that you have reviewed the grades for <span className="font-bold text-gray-700">{activeReview.course_code}</span> and authorize them to advance.</p>
              <div className="flex gap-3">
                <button onClick={() => setActionModal({ isOpen: false, type: null })} className="flex-1 py-3.5 px-4 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-xl transition-all" disabled={isSaving}>Cancel</button>
                <button onClick={handleApprove} disabled={isSaving} className="flex-1 py-3.5 px-4 bg-[#0e5c2b] hover:bg-[#0a4720] text-white font-bold rounded-xl shadow-md transition-all active:scale-95">{isSaving ? 'Processing...' : 'Confirm Approval'}</button>
              </div>
            </div>
          )}
          {actionModal.type === 'return' && (
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md p-8 animate-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
              <div className="flex items-center gap-3 mb-6">
                <div className="w-12 h-12 bg-red-50 text-red-600 rounded-full flex items-center justify-center shrink-0"><CornerUpLeft size={24} /></div>
                <div><h3 className="text-lg font-bold text-gray-900 leading-tight">Return to Faculty</h3><p className="text-xs text-gray-500 mt-0.5">Reject submission and send back for revisions.</p></div>
              </div>
              <div className="mb-6">
                <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Reason / Remarks (Required)</label>
                <textarea rows="4" value={returnRemarks} onChange={(e) => setReturnRemarks(e.target.value)} className="w-full p-4 border border-gray-200 rounded-xl focus:ring-2 focus:ring-red-600 outline-none text-sm font-medium resize-none bg-gray-50 focus:bg-white" placeholder="Detail the issues..."></textarea>
              </div>
              <div className="flex gap-3">
                <button onClick={() => setActionModal({ isOpen: false, type: null })} className="flex-1 py-3.5 px-4 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-xl transition-all" disabled={isSaving}>Cancel</button>
                <button onClick={handleReturn} disabled={!returnRemarks.trim() || isSaving} className="flex-1 py-3.5 px-4 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl shadow-md transition-all disabled:opacity-50">{isSaving ? 'Processing...' : 'Return Grades'}</button>
              </div>
            </div>
          )}
        </div>, document.body
      )}

      <div className="flex items-center gap-4">
        <button onClick={() => setActiveReview(null)} className="p-2.5 bg-white shadow-sm hover:bg-gray-50 text-gray-600 hover:text-gray-900 rounded-xl transition-all border border-gray-200"><ChevronLeft size={20} /></button>
        <div>
          <div className="flex items-center gap-3 mb-0.5"><span className="text-xs font-bold text-gray-500 uppercase tracking-widest">{activeReview.course_code} • {activeReview.section} • {activeReview.sy}</span></div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight font-serif">{activeReview.course_title}</h1>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 flex flex-col gap-6">
        <div className="flex justify-between items-start">
          <div><h2 className="text-lg font-bold text-gray-900">Approval Progress</h2><p className="text-sm text-gray-500 mt-1">Submitted by <strong className="text-gray-700">{activeReview.faculty_name}</strong></p></div>
          {getStatusBadge(activeReview.status)}
        </div>
        <div className="relative w-full max-w-4xl mx-auto mb-2 mt-4">
          <div className="absolute top-4 left-[12.5%] right-[12.5%] h-0.5 bg-gray-200 z-0"></div>
          <div className="flex justify-between text-center relative z-10">
            {renderStep(1, 'Faculty', s1, l1)}{renderStep(2, 'Dean', s2, l2)}{renderStep(3, 'VPAA', s3, l3)}{renderStep(4, 'Registrar', s4, l4)}
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-xl border border-gray-200 overflow-hidden flex flex-col min-h-[500px]">
        <div className="p-4 border-b border-gray-200 bg-white flex flex-row items-center gap-3 flex-wrap">
          <div className="px-4 py-2 border border-gray-200 rounded-lg text-sm font-bold text-gray-700 bg-gray-50 shrink-0">Read-Only Gradebook</div>
          <div className="flex items-center gap-3 shrink-0 ml-auto w-full sm:w-auto justify-end">
            <button onClick={handleExportExcel} className="flex items-center justify-center px-4 py-2.5 bg-white border border-gray-200 text-gray-700 font-bold rounded-lg text-sm hover:bg-gray-50 transition-all shadow-sm active:scale-95"><Download size={16} className="mr-2" /> Export to Excel</button>
            {isActionable ? (
              <>
                <button onClick={() => setActionModal({ isOpen: true, type: 'return' })} className="flex items-center justify-center px-5 py-2.5 bg-white border border-red-600 text-red-600 hover:bg-red-50 font-bold rounded-lg text-sm transition-all shadow-sm active:scale-95"><CornerUpLeft size={16} className="mr-2" /> Return to Faculty</button>
                <button onClick={() => setActionModal({ isOpen: true, type: 'approve' })} className="flex items-center justify-center px-6 py-2.5 bg-[#0e5c2b] hover:bg-[#0a4720] text-white font-bold rounded-lg shadow-sm transition-all active:scale-95"><ShieldCheck size={18} className="mr-2" /> Approve Grades</button>
              </>
            ) : (
              <div className="px-4 py-2.5 bg-gray-100 text-gray-500 rounded-lg text-sm font-bold border border-gray-200 flex items-center"><Lock size={16} className="mr-2" /> Viewing Access Only</div>
            )}
          </div>
        </div>

        <div className="overflow-x-auto flex-1 custom-scrollbar">
          {isMatrixLoading ? (
            <div className="flex justify-center py-20"><Loader2 className="animate-spin text-green-600" size={40} /></div>
          ) : (
            <table className="w-full text-left border-collapse min-w-max">
              <thead className="bg-[#1b2533] text-white">
                <tr>
                  <th className="px-6 py-4 text-xs font-bold uppercase sticky left-0 z-20 bg-[#1b2533] min-w-[250px]">Student Name</th>
                  {matrixData.activities.map(activity => (
                    <th key={activity.activity_id} className="px-4 py-4 text-center border-l border-[#2d3a4d] min-w-[120px]">
                      <div className="text-[11px] font-bold uppercase">{activity.title}</div>
                      <div className="text-[10px] text-gray-400">({activity.max_score} pts)</div>
                    </th>
                  ))}
                  <th className="px-6 py-4 text-xs font-bold uppercase text-center border-l border-[#2d3a4d]">Term Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {matrixData.students.map((student) => {
                  let totalEarned = 0, totalMax = 0;
                  matrixData.activities.forEach(act => {
                    const score = student.grades[act.activity_id] || 0;
                    totalEarned += score;
                    totalMax += act.max_score;
                  });
                  const termPercentage = totalMax > 0 ? ((totalEarned / totalMax) * 100).toFixed(2) : '0.00';
                  const isPassing = parseFloat(termPercentage) >= 75;

                  return (
                    <tr key={student.student_id} className="hover:bg-gray-50">
                      <td className="px-6 py-3 sticky left-0 z-10 bg-white border-r">
                        <div className="font-bold text-sm text-gray-900">{student.last_name}, {student.first_name}</div>
                        <div className="text-[10px] text-gray-400 font-mono mt-0.5">{student.student_id}</div>
                      </td>
                      {matrixData.activities.map(activity => (
                        <td key={activity.activity_id} className="px-4 py-2 text-center border-r font-bold text-gray-800">
                          {student.grades[activity.activity_id] || '-'}
                        </td>
                      ))}
                      <td className="px-6 py-3 text-center bg-gray-50 font-bold">
                        <span className={isPassing ? 'text-green-700' : 'text-red-600'}>{termPercentage}</span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}