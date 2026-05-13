import React, { useState, useEffect } from 'react';
import { 
  Briefcase, Clock, BookOpen, ShieldCheck, 
  Megaphone, Calendar, MapPin, Download, 
  CheckCircle2, AlertCircle, AlertTriangle
} from 'lucide-react';

const API_BASE = '/api';

export default function FacultyWorkload({ user }) {
  // ── Real data states ──────────────────────────────────────
  const [schedules,   setSchedules]   = useState([]);
  const [memos,       setMemos]       = useState([]);
  const [loadStatus,  setLoadStatus]  = useState('pending');
  const [syLabel,     setSyLabel]     = useState('');
  const [totalUnits,  setTotalUnits]  = useState(0);
  const [totalSections, setTotalSections] = useState(0);
  const [isLoading,   setIsLoading]   = useState(true);
  const [error,       setError]       = useState('');

  // ── Fetch workload data on mount ──────────────────────────
  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      setError('');
      try {
        const [workloadRes, memosRes] = await Promise.all([
          fetch(`${API_BASE}/workload/my`,       { credentials: 'include' }),
          fetch(`${API_BASE}/workload/my/memos`, { credentials: 'include' }),
        ]);

        if (workloadRes.ok) {
          const data = await workloadRes.json();
          setSchedules(data.schedules     || []);
          setTotalUnits(data.totalUnits   || 0);
          setTotalSections(data.totalSections || 0);
          setLoadStatus(data.status       || 'pending');
          setSyLabel(data.sy_label        || '');
        } else {
          throw new Error('Failed to fetch workload.');
        }

        if (memosRes.ok) {
          const data = await memosRes.json();
          setMemos(data.memos || []);
        }
      } catch (err) {
        setError('Could not load your workload. Please try again.');
        console.error('FacultyWorkload fetch error:', err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, []);

  const handleDownloadSchedule = () => {
    const fullName = user?.first_name && user?.last_name
      ? `${user.first_name} ${user.last_name}`
      : 'Faculty';

    const rows = schedules.map(sch => `
      <tr>
        <td>${sch.subject_name}<br/><small style="color:#0e5c2b;font-weight:700;">${sch.subject_code}</small></td>
        <td style="text-align:center;">${sch.units}</td>
        <td>${sch.section}</td>
        <td>${sch.days}<br/><small>${sch.time}</small></td>
        <td>${sch.room}</td>
      </tr>
    `).join('');

    const statusLabel =
      loadStatus === 'acknowledged'       ? 'Official & Approved' :
      loadStatus === 'revision_requested' ? 'Revision Requested'  : 'Under Review';

    const printContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Official Schedule — ${fullName}</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 40px; color: #111; }
          .header { text-align: center; margin-bottom: 30px; border-bottom: 3px solid #0e5c2b; padding-bottom: 16px; }
          .header h1 { font-size: 22px; color: #0e5c2b; margin: 0 0 4px; }
          .header p  { margin: 2px 0; font-size: 13px; color: #555; }
          .meta { display: flex; justify-content: space-between; margin-bottom: 20px; font-size: 12px; }
          .meta span { background: #f0fdf4; border: 1px solid #bbf7d0; padding: 4px 12px; border-radius: 6px; font-weight: 700; color: #166534; }
          table { width: 100%; border-collapse: collapse; font-size: 13px; }
          th { background: #1b2533; color: white; padding: 10px 14px; text-align: left; font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; }
          td { padding: 10px 14px; border-bottom: 1px solid #e5e7eb; vertical-align: top; }
          tr:nth-child(even) td { background: #f9fafb; }
          .footer { margin-top: 30px; font-size: 11px; color: #9ca3af; text-align: center; border-top: 1px solid #e5e7eb; padding-top: 12px; }
          @media print { body { padding: 20px; } }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>Pateros Technological College</h1>
          <p>Online Educators Web Portal — Official Teaching Load</p>
          <p style="font-size:16px; font-weight:700; color:#111; margin-top:8px;">${fullName}</p>
        </div>
        <div class="meta">
          <span> ${syLabel || 'Current Semester'}</span>
          <span> Total Load: ${totalUnits} Units (${totalSections} Sections)</span>
          <span> Status: ${statusLabel}</span>
        </div>
        <table>
          <thead>
            <tr>
              <th>Course / Subject</th>
              <th style="text-align:center;">Units</th>
              <th>Section</th>
              <th>Days & Time</th>
              <th>Room</th>
            </tr>
          </thead>
          <tbody>
            ${rows.length ? rows : '<tr><td colspan="5" style="text-align:center;color:#9ca3af;padding:30px;">No classes assigned yet.</td></tr>'}
          </tbody>
        </table>
        <div class="footer">
          Generated on ${new Date().toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric' })} via PTC Online Educators Web Portal
        </div>
      </body>
      </html>
    `;

    const printWindow = window.open('', '_blank');
    printWindow.document.write(printContent);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
    }, 500);
  };

  // ── Loading state ─────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
        <div className="w-8 h-8 border-4 border-green-600 border-t-transparent rounded-full animate-spin"></div>
        <p className="text-gray-400 font-medium text-sm">Loading your workload...</p>
      </div>
    );
  }

  // ── Error state ───────────────────────────────────────────
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
        <AlertCircle className="text-red-400" size={40} />
        <p className="text-red-500 font-bold">{error}</p>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────
  //  RENDER
  // ─────────────────────────────────────────────────────────
  return (
    <div className="space-y-6 max-w-[1600px] mx-auto animate-in fade-in duration-300 relative">

      {/* PAGE HEADER */}
      <div className="bg-white p-6 sm:p-8 rounded-3xl shadow-sm border border-gray-100 flex flex-col sm:flex-row justify-between sm:items-center gap-6 relative overflow-hidden">
        <div className="absolute right-0 top-0 w-64 h-64 bg-green-50 rounded-full mix-blend-multiply filter blur-3xl opacity-50 -translate-y-1/2 translate-x-1/4 z-0 pointer-events-none"></div>
        <div className="relative z-10">
          <h1 className="text-3xl font-bold text-gray-900 tracking-tight font-serif mb-1 flex items-center">
            My Workload & Schedule
          </h1>
          <p className="text-sm text-gray-500 font-medium">View your assigned teaching load and official department memos.</p>
        </div>
        <div className="relative z-10 shrink-0">
          <button
            onClick={handleDownloadSchedule}
            className="px-6 py-3 bg-white border border-gray-200 hover:bg-gray-50 text-gray-800 font-bold rounded-xl text-sm transition-all shadow-sm flex items-center active:scale-95"
          >
            <Download size={18} className="mr-2 text-green-700" /> Save PDF Copy
          </button>
        </div>
      </div>

      {/* METRICS ROW */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 flex items-center justify-between">
          <div>
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Total Teaching Load</p>
            <p className="text-3xl font-black text-[#0e5c2b] leading-none">
              {totalUnits} <span className="text-sm font-bold text-gray-400 uppercase">Units</span>
            </p>
          </div>
          <Briefcase size={32} className="text-green-100" />
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 flex items-center justify-between">
          <div>
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Assigned Classes</p>
            <p className="text-3xl font-black text-gray-800 leading-none">
              {totalSections} <span className="text-sm font-bold text-gray-400 uppercase">Sections</span>
            </p>
          </div>
          <BookOpen size={32} className="text-gray-100" />
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 flex items-center justify-between">
          <div>
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Workload Status</p>
            {loadStatus === 'acknowledged' && (
              <span className="bg-green-100 text-green-800 px-3 py-1.5 rounded-lg text-xs font-black uppercase tracking-widest flex items-center w-max border border-green-200">
                <ShieldCheck size={14} className="mr-1.5" /> Official & Approved
              </span>
            )}
            {loadStatus === 'pending' && (
              <span className="bg-yellow-100 text-yellow-800 px-3 py-1.5 rounded-lg text-xs font-black uppercase tracking-widest flex items-center w-max border border-yellow-200">
                <Clock size={14} className="mr-1.5" /> Under Review
              </span>
            )}
            {loadStatus === 'revision_requested' && (
              <span className="bg-red-100 text-red-800 px-3 py-1.5 rounded-lg text-xs font-black uppercase tracking-widest flex items-center w-max border border-red-200">
                <AlertTriangle size={14} className="mr-1.5" /> Revision Requested
              </span>
            )}
          </div>
        </div>
      </div>

      {/* MAIN CONTENT SPLIT */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">

        {/* LEFT/MAIN: SCHEDULE TABLE */}
        <div className="xl:col-span-2 bg-white rounded-3xl shadow-xl border border-gray-100 overflow-hidden flex flex-col min-h-[500px]">
          <div className="p-6 border-b border-gray-100 bg-gray-50/30 flex items-center">
            <Calendar className="mr-3 text-green-700" size={24} />
            <div>
              <h2 className="text-lg font-bold text-gray-900 leading-tight">Class Itinerary</h2>
              <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mt-0.5">
                {syLabel || 'Current Semester'}
              </p>
            </div>
          </div>

          <div className="overflow-x-auto flex-1">
            <table className="w-full text-left border-collapse min-w-max">
              <thead className="bg-[#1b2533] text-white">
                <tr>
                  <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest border-r border-[#2d3a4d]">Course / Subject</th>
                  <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest border-r border-[#2d3a4d] text-center w-24">Units</th>
                  <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest border-r border-[#2d3a4d] w-32">Section</th>
                  <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest border-r border-[#2d3a4d] w-56">Days & Time</th>
                  <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest">Room</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {schedules.length === 0 ? (
                  <tr>
                    <td colSpan="5" className="py-20 text-center">
                      <BookOpen className="mx-auto text-gray-200 mb-4" size={40} />
                      <p className="text-gray-500 font-bold">No classes have been assigned to you yet.</p>
                      <p className="text-xs text-gray-400 mt-1">Check back once the Registrar finalizes the schedule.</p>
                    </td>
                  </tr>
                ) : (
                  schedules.map((sch) => (
                    <tr key={sch.schedule_id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-5 border-r border-gray-100">
                        <div className="font-bold text-sm text-gray-900">{sch.subject_name}</div>
                        <div className="text-[10px] text-green-700 font-black uppercase tracking-widest mt-1">{sch.subject_code}</div>
                      </td>
                      <td className="px-6 py-5 border-r border-gray-100 text-center">
                        <span className="text-sm font-black text-gray-800">{sch.units}</span>
                      </td>
                      <td className="px-6 py-5 border-r border-gray-100">
                        <span className="bg-gray-100 text-gray-700 px-3 py-1.5 rounded-lg text-xs font-bold border border-gray-200">{sch.section}</span>
                      </td>
                      <td className="px-6 py-5 border-r border-gray-100">
                        <div className="text-sm font-bold text-gray-700 flex items-center">
                          <Calendar size={14} className="mr-2 text-gray-400" /> {sch.days}
                        </div>
                        <div className="text-xs text-gray-500 mt-1 flex items-center">
                          <Clock size={14} className="mr-2 text-gray-400" /> {sch.time}
                        </div>
                      </td>
                      <td className="px-6 py-5">
                        <span className="text-sm font-medium text-gray-800 flex items-center">
                          <MapPin size={16} className="mr-2 text-green-600" /> {sch.room}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* RIGHT: DEPARTMENT MEMOS */}
        <div className="xl:col-span-1 bg-white rounded-3xl shadow-xl border border-gray-100 p-6 flex flex-col h-full min-h-[500px]">
          <div className="flex items-center mb-6 border-b border-gray-50 pb-4">
            <div className="bg-yellow-100 p-2 rounded-xl mr-3">
              <Megaphone className="text-yellow-600" size={20} />
            </div>
            <h2 className="text-lg font-bold text-gray-800 tracking-tight">Department Memos</h2>
          </div>

          <div className="space-y-4 overflow-y-auto pr-2 flex-1">
            {memos.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full py-10">
                <Megaphone className="text-gray-200 mb-3" size={36} />
                <p className="text-center text-gray-400 font-medium text-sm">No recent memos from your department.</p>
              </div>
            ) : (
              memos.map(memo => (
                <div
                  key={memo.memo_id}
                  className={`p-5 rounded-2xl border-l-4 shadow-sm ${
                    memo.memo_type === 'success' ? 'bg-green-50/50 border-green-600' :
                    memo.memo_type === 'warning' ? 'bg-red-50/50 border-red-500' :
                    'bg-gray-50 border-blue-500'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-2">
                    {memo.memo_type === 'success'
                      ? <CheckCircle2 size={16} className="text-green-600 shrink-0" />
                      : memo.memo_type === 'warning'
                      ? <AlertTriangle size={16} className="text-red-500 shrink-0" />
                      : <AlertCircle size={16} className="text-blue-500 shrink-0" />
                    }
                    <h3 className="font-bold text-gray-900 text-sm">{memo.title}</h3>
                  </div>
                  <p className="text-xs text-gray-600 leading-relaxed mb-3">{memo.body}</p>
                  <div className="flex justify-between items-center text-[9px] font-black uppercase tracking-widest text-gray-400 pt-3 border-t border-gray-200/60">
                    <span>{memo.sender_name}</span>
                    <span>{new Date(memo.created_at).toLocaleDateString('en-GB')}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

      </div>
    </div>
  );
}