import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { 
  Search, CheckCircle2, Clock, ChevronLeft, 
  FileSpreadsheet, ArrowUpDown, ArrowUp, ArrowDown,
  ShieldCheck, AlertTriangle, Check, X, CornerUpLeft,
  Download, SlidersHorizontal
} from 'lucide-react';

// --- MOCK DATABASE DATA ---
// Roles: 'admin_dean', 'admin_vpaa', 'admin_registrar'
const MOCK_SUBMISSIONS = [
  {
    submission_id: 101,
    course_code: 'ITE314',
    course_title: 'Web Systems and Technologies',
    section: 'BSIT 3A',
    semester: '2nd Semester',
    sy: '2025-2026',
    faculty_name: 'John Kennidy Abunda',
    submitted_date: '2026-04-20T14:30:00Z',
    status: 'pending_dean', // pending_dean, pending_vpaa, pending_registrar, approved, returned
    students_count: 35,
  },
  {
    submission_id: 102,
    course_code: 'ITE315',
    course_title: 'Information Assurance and Security',
    section: 'BSIT 3B',
    semester: '2nd Semester',
    sy: '2025-2026',
    faculty_name: 'Prof. Angel Cylo G. Real',
    submitted_date: '2026-04-19T09:15:00Z',
    status: 'pending_vpaa', 
    students_count: 40,
  },
  {
    submission_id: 103,
    course_code: 'CC101',
    course_title: 'Introduction to Computing',
    section: 'BSIT 1A',
    semester: '2nd Semester',
    sy: '2025-2026',
    faculty_name: 'Anna Reyes',
    submitted_date: '2026-04-18T16:00:00Z',
    status: 'pending_registrar', 
    students_count: 45,
  },
  {
    submission_id: 104,
    course_code: 'GE001',
    course_title: 'Purposive Communication',
    section: 'BSIT 1B',
    semester: '2nd Semester',
    sy: '2025-2026',
    faculty_name: 'Maria Santos',
    submitted_date: '2026-04-15T10:00:00Z',
    status: 'approved', 
    students_count: 38,
  },
  {
    submission_id: 105,
    course_code: 'ENG101',
    course_title: 'English Academic Writing',
    section: 'BSIT 1C',
    semester: '2nd Semester',
    sy: '2025-2026',
    faculty_name: 'Sarah Gomez',
    submitted_date: '2026-04-14T10:00:00Z',
    status: 'returned', 
    students_count: 42,
  }
];

// Mock data for the read-only matrix review
const MOCK_ACTIVITIES = [
  { activity_id: 1, title: 'Quiz 1 - HTML', max_score: 50 },
  { activity_id: 2, title: 'Project Portfolio', max_score: 100 },
  { activity_id: 3, title: 'Midterm Exam', max_score: 100 },
  { activity_id: 4, title: 'Final Exam', max_score: 100 },
];

const MOCK_STUDENTS = [
  { student_id: '2024-001', last_name: 'Dela Cruz', first_name: 'Juan', mi: 'A.', grades: { 1: 45, 2: 88, 3: 85, 4: 90 } },
  { student_id: '2024-002', last_name: 'Santos', first_name: 'Maria', mi: 'B.', grades: { 1: 48, 2: 95, 3: 92, 4: 94 } },
  { student_id: '2024-003', last_name: 'Reyes', first_name: 'Mark', mi: 'C.', grades: { 1: 35, 2: 75, 3: 80, 4: 82 } },
  { student_id: '2024-004', last_name: 'Garcia', first_name: 'Ana', mi: 'D.', grades: { 1: 42, 2: 90, 3: 88, 4: 89 } },
];

export default function GradeApprovals({ user }) {
  // Ensure we have a valid role, fallback to dean for preview if not set
  const userRole = user?.role || 'admin_dean'; 

  // --- STATES ---
  const [submissions, setSubmissions] = useState(MOCK_SUBMISSIONS);
  const [activeReview, setActiveReview] = useState(null); // Holds the submission object when reviewing
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('pending_my_approval');
  const [filterSY, setFilterSY] = useState('All');
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  
  // Sort States
  const [sortBy, setSortBy] = useState('submitted_date');
  const [sortDir, setSortDir] = useState('desc');
  const [isSortOpen, setIsSortOpen] = useState(false);

  // Modal States
  const [actionModal, setActionModal] = useState({ isOpen: false, type: null }); // type: 'approve' | 'return'
  const [returnRemarks, setReturnRemarks] = useState('');
  const [toast, setToast] = useState(null);

  // Derive unique school years for the filter dropdown
  const uniqueSchoolYears = [...new Set(submissions.map(sub => sub.sy))];

  // --- HELPERS ---
  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  const getPendingStatusForRole = () => {
    if (userRole === 'admin_dean') return 'pending_dean';
    if (userRole === 'admin_vpaa') return 'pending_vpaa';
    if (userRole === 'admin_registrar') return 'pending_registrar';
    return 'pending_dean';
  };

  const canApprove = (sub) => sub.status === getPendingStatusForRole();

  const getStatusBadge = (status) => {
    switch(status) {
      case 'pending_dean': return <span className="bg-yellow-100 text-yellow-800 px-2.5 py-1 rounded-md text-[10px] font-black uppercase tracking-widest">Pending Dean</span>;
      case 'pending_vpaa': return <span className="bg-blue-100 text-blue-800 px-2.5 py-1 rounded-md text-[10px] font-black uppercase tracking-widest">Pending VPAA</span>;
      case 'pending_registrar': return <span className="bg-purple-100 text-purple-800 px-2.5 py-1 rounded-md text-[10px] font-black uppercase tracking-widest">Pending Registrar</span>;
      case 'approved': return <span className="bg-green-100 text-green-800 px-2.5 py-1 rounded-md text-[10px] font-black uppercase tracking-widest">Approved (Final)</span>;
      case 'returned': return <span className="bg-red-100 text-red-800 px-2.5 py-1 rounded-md text-[10px] font-black uppercase tracking-widest">Returned</span>;
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
    if (filterStatus === 'pending_my_approval') {
      matchesStatus = sub.status === getPendingStatusForRole();
    } else if (filterStatus !== 'all') {
      matchesStatus = sub.status === filterStatus;
    }

    const matchesSY = filterSY === 'All' || sub.sy === filterSY;

    return matchesSearch && matchesStatus && matchesSY;
  }).sort((a, b) => {
    let valA = a[sortBy];
    let valB = b[sortBy];
    if (sortBy === 'submitted_date') {
      valA = new Date(valA).getTime(); valB = new Date(valB).getTime();
    }
    if (valA < valB) return sortDir === 'asc' ? -1 : 1;
    if (valA > valB) return sortDir === 'asc' ? 1 : -1;
    return 0;
  });

  const activeFilterCount = filterSY !== 'All' ? 1 : 0;

  // Tallies
  const pendingCount = submissions.filter(s => s.status === getPendingStatusForRole()).length;
  const approvedCount = submissions.filter(s => s.status === 'approved').length;
  const returnedCount = submissions.filter(s => s.status === 'returned').length;

  // --- ACTIONS ---
  const handleApprove = () => {
    let nextStatus = 'approved';
    if (activeReview.status === 'pending_dean') nextStatus = 'pending_vpaa';
    else if (activeReview.status === 'pending_vpaa') nextStatus = 'pending_registrar';
    
    setSubmissions(submissions.map(s => s.submission_id === activeReview.submission_id ? { ...s, status: nextStatus } : s));
    showToast(`Grades for ${activeReview.course_code} successfully approved.`);
    setActionModal({ isOpen: false, type: null });
    setActiveReview(null);
  };

  const handleReturn = () => {
    if (!returnRemarks.trim()) return;
    setSubmissions(submissions.map(s => s.submission_id === activeReview.submission_id ? { ...s, status: 'returned' } : s));
    showToast(`Grades for ${activeReview.course_code} returned to faculty.`, 'warning');
    setActionModal({ isOpen: false, type: null });
    setReturnRemarks('');
    setActiveReview(null);
  };

  const handleExportExcel = () => {
    let htmlContent = `
      <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
      <head>
        <meta charset="utf-8">
        <style>
          table { border-collapse: collapse; font-family: sans-serif; }
          th { background-color: #1a2a3a; color: #ffffff; font-weight: bold; padding: 10px; border: 1px solid #dddddd; text-align: center; }
          td { padding: 8px; border: 1px solid #dddddd; text-align: center; }
          .left { text-align: left; }
          .header-cell { background-color: #f3f4f6; font-weight: bold; text-align: left; border: 1px solid #dddddd;}
          .val-cell { text-align: left; border: 1px solid #dddddd; }
        </style>
      </head>
      <body>
        <table>
          <tr><th colspan="${MOCK_ACTIVITIES.length + 3}" style="font-size: 18px; text-align: left; background-color: #0e5c2b;">PTC Master Gradebook (Official Record)</th></tr>
          <tr><td class="header-cell" colspan="2">Course</td><td class="val-cell" colspan="${MOCK_ACTIVITIES.length + 1}">${activeReview.course_code} - ${activeReview.course_title}</td></tr>
          <tr><td class="header-cell" colspan="2">Section</td><td class="val-cell" colspan="${MOCK_ACTIVITIES.length + 1}">${activeReview.section}</td></tr>
          <tr><td class="header-cell" colspan="2">Semester</td><td class="val-cell" colspan="${MOCK_ACTIVITIES.length + 1}">${activeReview.semester} (${activeReview.sy})</td></tr>
          <tr><td class="header-cell" colspan="2">Faculty</td><td class="val-cell" colspan="${MOCK_ACTIVITIES.length + 1}">${activeReview.faculty_name}</td></tr>
          <tr><td colspan="${MOCK_ACTIVITIES.length + 3}"></td></tr>
          <tr>
            <th>Student ID</th>
            <th class="left">Student Name</th>
            ${MOCK_ACTIVITIES.map(act => `<th>${act.title} (Max: ${act.max_score})</th>`).join('')}
            <th>Term Total %</th>
          </tr>
          ${MOCK_STUDENTS.map(student => {
            let totalEarned = 0;
            let totalMax = 0;
            let rowScores = '';
            
            MOCK_ACTIVITIES.forEach(act => {
              const score = student.grades[act.activity_id] || 0;
              totalEarned += score;
              totalMax += act.max_score;
              rowScores += `<td>${score}</td>`;
            });
            
            const termTotal = totalMax > 0 ? ((totalEarned / totalMax) * 100).toFixed(2) : '0.00';

            return `
              <tr>
                <td>${student.student_id}</td>
                <td class="left">${student.last_name}, ${student.first_name} ${student.mi}</td>
                ${rowScores}
                <td style="font-weight: bold; color: ${parseFloat(termTotal) >= 75 ? '#0e5c2b' : '#dc2626'};">${termTotal}</td>
              </tr>
            `;
          }).join('')}
        </table>
      </body>
      </html>
    `;
    
    const blob = new Blob([htmlContent], { type: 'application/vnd.ms-excel' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `Approved_Grades_${activeReview.course_code}_${activeReview.section}.xls`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast(`Official records for ${activeReview.course_code} successfully exported.`);
  };


  // ==========================================
  // VIEW 1: INBOX / LIST VIEW
  // ==========================================
  if (!activeReview) {
    return (
      <div className="space-y-6 max-w-[1600px] mx-auto animate-in fade-in duration-300 relative">
        
        {/* Toast Notification */}
        {toast && createPortal(
          <div className={`fixed top-8 right-8 z-[10000] p-4 rounded-2xl shadow-xl flex items-center animate-in slide-in-from-top-4 border ${toast.type === 'success' ? 'bg-green-50 border-green-200 text-green-800' : 'bg-yellow-50 border-yellow-200 text-yellow-800'}`}>
            <CheckCircle2 className="mr-3 shrink-0" size={20}/>
            <p className="text-sm font-bold">{toast.message}</p>
          </div>,
          document.body
        )}

        {/* Page Header */}
        <div className="bg-white p-6 sm:p-8 rounded-3xl shadow-sm border border-gray-100 flex flex-col sm:flex-row justify-between sm:items-center gap-6 relative overflow-hidden">
          <div className="absolute right-0 top-0 w-64 h-64 bg-green-50 rounded-full mix-blend-multiply filter blur-3xl opacity-50 -translate-y-1/2 translate-x-1/4 z-0 pointer-events-none"></div>
          <div className="relative z-10">
            <h1 className="text-3xl font-bold text-gray-900 tracking-tight font-serif mb-1 flex items-center">
              Grade Approvals
            </h1>
            <p className="text-sm text-gray-500 font-medium">Review and authorize term grades submitted by the faculty.</p>
          </div>
        </div>

        {/* Toolbar */}
        <div className="bg-white rounded-3xl shadow-xl border border-gray-100 overflow-hidden flex flex-col min-h-[500px]">
          {/* Changed overflow-x-auto to flex-wrap to prevent cutoff/scrollbars */}
          <div className="p-4 border-b border-gray-200 bg-white flex flex-row items-center gap-3 flex-wrap">
            
            {/* TALLIES */}
            <div className="flex gap-2 shrink-0">
              <div className="px-3 py-1.5 border border-gray-200 rounded-lg flex items-center gap-2 bg-yellow-50 shrink-0 shadow-sm">
                <Clock size={14} className="text-yellow-600" />
                <div>
                  <span className="text-sm font-bold text-yellow-700 leading-none">{pendingCount}</span>
                  <span className="text-[9px] font-black text-yellow-600 uppercase tracking-widest ml-1.5">Pending</span>
                </div>
              </div>
              <div className="px-3 py-1.5 border border-gray-200 rounded-lg flex items-center gap-2 bg-green-50 shrink-0 shadow-sm">
                <CheckCircle2 size={14} className="text-green-600" />
                <div>
                  <span className="text-sm font-bold text-green-700 leading-none">{approvedCount}</span>
                  <span className="text-[9px] font-black text-green-600 uppercase tracking-widest ml-1.5">Approved</span>
                </div>
              </div>
              <div className="px-3 py-1.5 border border-gray-200 rounded-lg flex items-center gap-2 bg-red-50 shrink-0 shadow-sm">
                <CornerUpLeft size={14} className="text-red-600" />
                <div>
                  <span className="text-sm font-bold text-red-700 leading-none">{returnedCount}</span>
                  <span className="text-[9px] font-black text-red-600 uppercase tracking-widest ml-1.5">Returned</span>
                </div>
              </div>
            </div>

            {/* SEARCH BAR */}
            <div className="relative shrink min-w-[150px] flex-1 max-w-sm">
              <Search className="absolute left-3.5 top-2.5 text-gray-400" size={16} />
              <input 
                type="text" placeholder="Search course or faculty..." 
                value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-green-600 outline-none text-sm font-medium transition-shadow bg-gray-50 focus:bg-white"
              />
            </div>
            
            {/* TABS, FILTER, & SORT */}
            <div className="flex items-center gap-3 shrink-0 ml-auto flex-wrap">
              
              {/* TABS */}
              <div className="flex bg-gray-100 p-1 rounded-lg shrink-0">
                <button onClick={() => setFilterStatus('pending_my_approval')} className={`px-4 py-1.5 text-xs font-bold uppercase tracking-widest rounded-md transition-all ${filterStatus === 'pending_my_approval' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>My Inbox</button>
                <button onClick={() => setFilterStatus('approved')} className={`px-4 py-1.5 text-xs font-bold uppercase tracking-widest rounded-md transition-all ${filterStatus === 'approved' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>Approved</button>
                <button onClick={() => setFilterStatus('returned')} className={`px-4 py-1.5 text-xs font-bold uppercase tracking-widest rounded-md transition-all ${filterStatus === 'returned' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>Returned</button>
                <button onClick={() => setFilterStatus('all')} className={`px-4 py-1.5 text-xs font-bold uppercase tracking-widest rounded-md transition-all ${filterStatus === 'all' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>All</button>
              </div>

              {/* SORT DROPDOWN (Click to open) */}
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
                        { key: 'submitted_date', label: 'Date Submitted' },
                        { key: 'course_code',    label: 'Course Code' },
                        { key: 'faculty_name',   label: 'Faculty Name' },
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

              {/* FILTER SY DROPDOWN (Click to open) */}
              <div className="relative">
                <button 
                  onClick={() => setIsFilterOpen(!isFilterOpen)}
                  className="flex items-center justify-center gap-2 px-4 py-2 bg-white border border-gray-200 text-gray-700 font-bold rounded-lg text-sm hover:bg-gray-50 transition-all shadow-sm"
                >
                  <SlidersHorizontal size={15} /> Filter SY
                  {activeFilterCount > 0 && (
                    <span className="w-4 h-4 rounded-full bg-green-600 text-white text-[9px] font-black flex items-center justify-center shadow-sm">{activeFilterCount}</span>
                  )}
                </button>
                {isFilterOpen && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setIsFilterOpen(false)}></div>
                    <div className="absolute right-0 top-full mt-2 bg-white rounded-2xl shadow-xl border border-gray-100 w-56 z-50 overflow-hidden py-3 px-4">
                      <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">School Year</label>
                      <select 
                        value={filterSY} 
                        onChange={(e) => { setFilterSY(e.target.value); setIsFilterOpen(false); }} 
                        className="w-full p-2 border border-gray-200 rounded-xl outline-none text-sm font-medium"
                      >
                        <option value="All">All School Years</option>
                        {uniqueSchoolYears.map(sy => (
                          <option key={sy} value={sy}>{sy}</option>
                        ))}
                      </select>
                    </div>
                  </>
                )}
              </div>

            </div>
          </div>

          {/* List Table */}
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
                {filteredSubmissions.length === 0 ? (
                  <tr>
                    <td colSpan="5" className="py-24 text-center">
                      <ShieldCheck className="mx-auto text-gray-200 mb-4" size={48} />
                      <p className="text-gray-500 font-bold">You're all caught up!</p>
                      <p className="text-xs text-gray-400 mt-1">No pending grade approvals match your criteria.</p>
                    </td>
                  </tr>
                ) : (
                  filteredSubmissions.map((sub) => (
                    <tr key={sub.submission_id} className="hover:bg-green-50/30 transition-colors group cursor-pointer" onClick={() => setActiveReview(sub)}>
                      <td className="px-8 py-5">
                        <div className="flex items-center">
                          <div className="p-3 bg-green-50 text-green-700 rounded-xl border border-green-100 mr-4">
                            <FileSpreadsheet size={20} />
                          </div>
                          <div>
                            <div className="text-sm font-bold text-gray-900 group-hover:text-green-700 transition-colors">{sub.course_title}</div>
                            <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mt-0.5 flex gap-2">
                              <span>{sub.course_code}</span> <span>•</span>
                              <span>{sub.section}</span> <span>•</span>
                              <span>{sub.students_count} Students</span>
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-5">
                        <div className="text-sm font-bold text-gray-700 truncate">{sub.faculty_name}</div>
                        <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mt-0.5">Faculty</div>
                      </td>
                      <td className="px-6 py-5 text-sm font-bold text-gray-500">
                        {new Date(sub.submitted_date).toLocaleDateString('en-GB', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </td>
                      <td className="px-6 py-5">
                        {getStatusBadge(sub.status)}
                      </td>
                      <td className="px-8 py-5 text-right">
                        <button 
                          className={`px-4 py-2 text-xs font-bold rounded-lg transition-all shadow-sm active:scale-95 ${canApprove(sub) ? 'bg-yellow-500 hover:bg-yellow-600 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}
                        >
                          Review
                        </button>
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

  // --- Bulletproof Stepper Logic ---
  // Default values
  let s1 = 'completed', s2 = 'waiting', s3 = 'waiting', s4 = 'waiting';
  let l1 = 'Submitted', l2 = 'Waiting', l3 = 'Waiting', l4 = 'Waiting';

  // Apply crash-proof, hardcoded stage evaluation
  if (activeReview.status === 'pending_dean') {
    s2 = 'current'; l2 = 'Reviewing';
  } else if (activeReview.status === 'pending_vpaa') {
    s2 = 'completed'; l2 = 'Approved';
    s3 = 'current'; l3 = 'Reviewing';
  } else if (activeReview.status === 'pending_registrar') {
    s2 = 'completed'; l2 = 'Approved';
    s3 = 'completed'; l3 = 'Approved';
    s4 = 'current'; l4 = 'Reviewing';
  } else if (activeReview.status === 'approved') {
    s2 = 'completed'; l2 = 'Approved';
    s3 = 'completed'; l3 = 'Approved';
    s4 = 'completed'; l4 = 'Finalized';
  } else if (activeReview.status === 'returned') {
    s1 = 'error'; l1 = 'Returned';
  }

  const renderStep = (num, role, status, label) => {
    let iconBg = 'bg-gray-100 text-gray-400 border-white';
    let iconContent = num;
    if (status === 'completed') {
      iconBg = 'bg-green-500 text-white border-white';
      iconContent = <Check size={16} strokeWidth={3} />;
    } else if (status === 'current') {
      iconBg = 'bg-yellow-400 text-yellow-900 border-white ring-2 ring-yellow-100';
    } else if (status === 'error') {
      iconBg = 'bg-red-500 text-white border-white ring-2 ring-red-100';
      iconContent = <X size={16} strokeWidth={3} />;
    }

    let labelBg = 'bg-gray-100 text-gray-400';
    if (status === 'completed') labelBg = 'bg-green-100 text-green-800';
    else if (status === 'current') labelBg = 'bg-yellow-100 text-yellow-800';
    else if (status === 'error') labelBg = 'bg-red-100 text-red-800';

    let titleColor = status === 'waiting' ? 'text-gray-400' : 'text-gray-800';

    return (
      <div className="flex flex-col items-center w-1/4">
        <div className={`w-8 h-8 rounded-full font-bold flex items-center justify-center mb-2 shadow-sm border-2 z-10 relative ${iconBg}`}>
          {iconContent}
        </div>
        <span className={`text-[10px] font-black uppercase tracking-widest ${titleColor}`}>{role}</span>
        <span className={`text-[9px] font-bold px-2 py-0.5 rounded mt-1 ${labelBg}`}>{label}</span>
      </div>
    );
  };

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto animate-in fade-in duration-300 relative">
      
      {/* Action Modals Portal */}
      {actionModal.isOpen && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in" onClick={() => setActionModal({ isOpen: false, type: null })}>
          
          {actionModal.type === 'approve' && (
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md p-8 text-center animate-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
              <div className="w-16 h-16 bg-green-50 text-green-600 rounded-full flex items-center justify-center mx-auto mb-6 border-4 border-white shadow-sm">
                <ShieldCheck size={32} />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">Approve Grades</h3>
              <p className="text-sm text-gray-500 mb-8 leading-relaxed">
                By approving, you certify that you have reviewed the grades for <span className="font-bold text-gray-700">{activeReview.course_code}</span> and authorize them to advance to the next step.
              </p>
              <div className="flex gap-3">
                <button onClick={() => setActionModal({ isOpen: false, type: null })} className="flex-1 py-3.5 px-4 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-xl transition-all">Cancel</button>
                <button onClick={handleApprove} className="flex-1 py-3.5 px-4 bg-[#0e5c2b] hover:bg-[#0a4720] text-white font-bold rounded-xl shadow-md transition-all active:scale-95">Confirm Approval</button>
              </div>
            </div>
          )}

          {actionModal.type === 'return' && (
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md p-8 animate-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
              <div className="flex items-center gap-3 mb-6">
                <div className="w-12 h-12 bg-red-50 text-red-600 rounded-full flex items-center justify-center shrink-0">
                  <CornerUpLeft size={24} />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-gray-900 leading-tight">Return to Faculty</h3>
                  <p className="text-xs text-gray-500 mt-0.5">Reject submission and send back for revisions.</p>
                </div>
              </div>
              
              <div className="mb-6">
                <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Reason / Remarks (Required)</label>
                <textarea 
                  rows="4" 
                  value={returnRemarks}
                  onChange={(e) => setReturnRemarks(e.target.value)}
                  className="w-full p-4 border border-gray-200 rounded-xl focus:ring-2 focus:ring-red-600 outline-none text-sm font-medium resize-none bg-gray-50 focus:bg-white transition-colors"
                  placeholder="Detail the issues or discrepancies found in the grade sheet..."
                ></textarea>
              </div>

              <div className="flex gap-3">
                <button onClick={() => setActionModal({ isOpen: false, type: null })} className="flex-1 py-3.5 px-4 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-xl transition-all">Cancel</button>
                <button 
                  onClick={handleReturn} 
                  disabled={!returnRemarks.trim()}
                  className="flex-1 py-3.5 px-4 bg-red-600 hover:bg-red-700 disabled:bg-red-300 text-white font-bold rounded-xl shadow-md transition-all active:scale-95 disabled:cursor-not-allowed"
                >
                  Return Grades
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
          title="Back to Inbox"
        >
          <ChevronLeft size={20} />
        </button>
        <div>
          <div className="flex items-center gap-3 mb-0.5">
            <span className="text-xs font-bold text-gray-500 uppercase tracking-widest">{activeReview.course_code} • {activeReview.section} • {activeReview.sy}</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight font-serif">{activeReview.course_title}</h1>
        </div>
      </div>

      {/* Workflow Stepper Card (Read-only status) */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 flex flex-col gap-6">
        <div className="flex justify-between items-start">
          <div>
            <h2 className="text-lg font-bold text-gray-900">Approval Progress</h2>
            <p className="text-sm text-gray-500 mt-1">Submitted by <strong className="text-gray-700">{activeReview.faculty_name}</strong> on {new Date(activeReview.submitted_date).toLocaleDateString()}</p>
          </div>
          {getStatusBadge(activeReview.status)}
        </div>
        
        <div className="relative w-full max-w-4xl mx-auto mb-2 mt-4">
          {/* Connecting Line */}
          <div className="absolute top-4 left-[12.5%] right-[12.5%] h-0.5 bg-gray-200 z-0"></div>
          
          <div className="flex justify-between text-center relative z-10">
            {renderStep(1, 'Faculty', s1, l1)}
            {renderStep(2, 'Dean', s2, l2)}
            {renderStep(3, 'VPAA', s3, l3)}
            {renderStep(4, 'Registrar', s4, l4)}
          </div>
        </div>
      </div>

      {/* --- MASTER GRADEBOOK MATRIX (READ ONLY) --- */}
      <div className="bg-white rounded-2xl shadow-xl border border-gray-200 overflow-hidden flex flex-col min-h-[500px]">
        
        {/* Toolbar */}
        <div className="p-4 border-b border-gray-200 bg-white flex flex-row items-center gap-3 flex-wrap">
          <div className="px-4 py-2 border border-gray-200 rounded-lg text-sm font-bold text-gray-700 bg-gray-50 shrink-0">
            Read-Only Gradebook
          </div>
          
          <div className="flex items-center gap-3 shrink-0 ml-auto w-full sm:w-auto justify-end">
            <button 
              onClick={handleExportExcel}
              className="flex items-center justify-center px-4 py-2.5 bg-white border border-gray-200 text-gray-700 font-bold rounded-lg text-sm hover:bg-gray-50 transition-all shadow-sm active:scale-95"
            >
              <Download size={16} className="mr-2" /> Export to Excel
            </button>

            {isActionable ? (
              <>
                <button 
                  onClick={() => setActionModal({ isOpen: true, type: 'return' })}
                  className="flex items-center justify-center px-5 py-2.5 bg-white border border-red-600 text-red-600 hover:bg-red-50 font-bold rounded-lg text-sm transition-all shadow-sm active:scale-95"
                >
                  <CornerUpLeft size={16} className="mr-2" /> Return to Faculty
                </button>
                <button 
                  onClick={() => setActionModal({ isOpen: true, type: 'approve' })}
                  className="flex items-center justify-center px-6 py-2.5 bg-[#0e5c2b] hover:bg-[#0a4720] text-white font-bold rounded-lg shadow-sm transition-all active:scale-95"
                >
                  <ShieldCheck size={18} className="mr-2" /> Approve Grades
                </button>
              </>
            ) : (
              <div className="px-4 py-2.5 bg-gray-100 text-gray-500 rounded-lg text-sm font-bold border border-gray-200 flex items-center">
                <Lock size={16} className="mr-2" /> Viewing Access Only
              </div>
            )}
          </div>
        </div>

        {/* Matrix Table (Read Only) */}
        <div className="overflow-x-auto flex-1 custom-scrollbar">
          <table className="w-full text-left border-collapse min-w-max">
            <thead className="bg-[#1b2533] text-white">
              <tr>
                <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider sticky left-0 z-20 bg-[#1b2533] border-r border-[#2d3a4d] min-w-[250px]">
                  Student Name
                </th>
                
                {MOCK_ACTIVITIES.map(activity => (
                  <th key={activity.activity_id} className="px-4 py-4 text-center border-r border-[#2d3a4d] min-w-[160px] align-bottom">
                    <div className="flex flex-col items-center justify-end h-full">
                      <span className="text-[11px] font-bold uppercase tracking-widest mb-1 opacity-90 truncate max-w-full" title={activity.title}>
                        {activity.title}
                      </span>
                      <span className="text-[10px] font-medium opacity-60">({activity.max_score} pts)</span>
                    </div>
                  </th>
                ))}
                
                <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-center min-w-[120px]">
                  Term Total
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {MOCK_STUDENTS.map((student) => {
                let totalEarned = 0;
                let totalMax = 0;
                
                MOCK_ACTIVITIES.forEach(act => {
                  const score = student.grades[act.activity_id] || 0;
                  totalEarned += score;
                  totalMax += act.max_score;
                });

                const termPercentage = totalMax > 0 ? ((totalEarned / totalMax) * 100).toFixed(2) : '0.00';
                const isPassing = parseFloat(termPercentage) >= 75;

                return (
                  <tr key={student.student_id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 sticky left-0 z-10 bg-white border-r border-gray-100 group-hover:bg-gray-50 transition-colors">
                      <div className="font-bold text-sm text-gray-900">{student.last_name}, {student.first_name}</div>
                      <div className="text-[10px] text-gray-400 font-mono mt-0.5">{student.student_id}</div>
                    </td>
                    
                    {MOCK_ACTIVITIES.map(activity => {
                        const score = student.grades[activity.activity_id] || '-';
                        return (
                          <td key={activity.activity_id} className="px-4 py-3 text-center border-r border-gray-50">
                            <div className="text-sm font-bold text-gray-800">{score}</div>
                          </td>
                        )
                    })}
                    
                    <td className="px-6 py-4 text-center bg-gray-50/50">
                      <span className={`text-base font-bold ${isPassing ? 'text-green-700' : 'text-red-600'}`}>
                        {termPercentage}
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
}