import React, { useState } from 'react';
import { 
  Briefcase, Clock, BookOpen, ShieldCheck, 
  Megaphone, Calendar, MapPin, Download, 
  CheckCircle2, AlertCircle
} from 'lucide-react';

// --- MOCK DATABASE DATA ---
// We simulate the data pulling ONLY the logged-in user's assigned classes
const MOCK_MY_SCHEDULES = [
  { schedule_id: 101, subject_code: 'ITE314', subject_name: 'Web Systems', units: 3, section: 'BSIT 3A', days: 'MWF', time: '09:00 AM - 10:00 AM', room: 'Lab 1' },
  { schedule_id: 102, subject_code: 'IT201', subject_name: 'Data Structures', units: 3, section: 'BSIT 2A', days: 'TTH', time: '01:00 PM - 02:30 PM', room: 'Room 302' },
  { schedule_id: 103, subject_code: 'IT301', subject_name: 'Database Mgmt', units: 3, section: 'BSIT 3B', days: 'MWF', time: '10:00 AM - 11:00 AM', room: 'Lab 2' },
];

const MOCK_MEMOS = [
  {
    memo_id: 1,
    title: 'Workload Officially Acknowledged',
    body: 'Your teaching load for the 2nd Semester (AY 2025-2026) has been reviewed and approved. Please ensure your syllabus for each assigned subject is uploaded to the repository before the first day of classes.',
    sender: 'Dean Angel Cylo G. Real',
    date: '2026-04-25T10:00:00Z',
    type: 'success'
  },
  {
    memo_id: 2,
    title: 'Room Reassignment Notice',
    body: 'Please note that all IT201 classes previously held in Lab 3 have been moved to Room 302 due to ongoing computer maintenance.',
    sender: 'Registrar Office',
    date: '2026-04-20T14:30:00Z',
    type: 'info'
  }
];

export default function FacultyWorkload({ user }) {
  const [schedules] = useState(MOCK_MY_SCHEDULES);
  const [memos] = useState(MOCK_MEMOS);
  
  // Hardcoded status for the mock (would normally come from the DB)
  const loadStatus = 'acknowledged'; // 'pending', 'acknowledged', 'revision'

  // Calculate totals
  const totalUnits = schedules.reduce((sum, sch) => sum + sch.units, 0);
  const totalSections = schedules.length;

  const handleDownloadSchedule = () => {
    alert("Downloading a PDF copy of your official schedule...");
  };

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
              <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mt-0.5">2nd Semester | AY 2025-2026</p>
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
                      <p className="text-gray-500 font-bold">No classes have been assigned to you yet.</p>
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
          
          <div className="space-y-4 overflow-y-auto pr-2 custom-scrollbar flex-1">
            {memos.length === 0 ? (
              <p className="text-center text-gray-400 font-medium py-10">No recent memos.</p>
            ) : (
              memos.map(memo => (
                <div key={memo.memo_id} className={`p-5 rounded-2xl border-l-4 shadow-sm ${memo.type === 'success' ? 'bg-green-50/50 border-green-600' : 'bg-gray-50 border-blue-500'}`}>
                  <div className="flex items-center gap-2 mb-2">
                    {memo.type === 'success' ? <CheckCircle2 size={16} className="text-green-600 shrink-0" /> : <AlertCircle size={16} className="text-blue-500 shrink-0" />}
                    <h3 className="font-bold text-gray-900 text-sm">{memo.title}</h3>
                  </div>
                  <p className="text-xs text-gray-600 leading-relaxed mb-3">{memo.body}</p>
                  <div className="flex justify-between items-center text-[9px] font-black uppercase tracking-widest text-gray-400 pt-3 border-t border-gray-200/60">
                    <span>{memo.sender}</span>
                    <span>{new Date(memo.date).toLocaleDateString('en-GB')}</span>
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