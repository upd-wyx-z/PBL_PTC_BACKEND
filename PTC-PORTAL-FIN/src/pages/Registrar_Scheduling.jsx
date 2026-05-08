import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { 
  Search, Plus, BookOpen, Users, Clock, MapPin, 
  Edit, Trash2, X, CheckCircle2, ShieldCheck, 
  CalendarDays, ArrowUpDown, ArrowUp, ArrowDown
} from 'lucide-react';

const SUBJECTS = [
  { subject_id: 1, subject_code: 'CC101', subject_name: 'Introduction to Computing', units: 3 },
  { subject_id: 2, subject_code: 'IT201', subject_name: 'Data Structures and Algorithms', units: 3 },
  { subject_id: 3, subject_code: 'IT301', subject_name: 'Database Management Systems', units: 3 },
  { subject_id: 4, subject_code: 'ITE314', subject_name: 'Web Systems and Technologies', units: 3 },
  { subject_id: 5, subject_code: 'GE001', subject_name: 'Purposive Communication', units: 3 },
];

const FACULTY_LIST = [
  { user_id: 1, name: 'John Kennidy Abunda', dept: 'IICT' },
  { user_id: 2, name: 'Prof. Angel Cylo G. Real', dept: 'IICT' },
  { user_id: 3, name: 'Anna Reyes', dept: 'CBM' },
  { user_id: 4, name: 'Maria Santos', dept: 'GenEd' },
];

const SCHOOL_YEARS = [
  { sy_id: 1, sy_label: '2025-2026', semester: '2nd' },
  { sy_id: 2, sy_label: '2025-2026', semester: '1st' },
];

const INITIAL_SCHEDULES = [
  { schedule_id: 101, subject_id: 4, sy_id: 1, section: 'BSIT 3A', days: 'MWF', time_start: '09:00', time_end: '10:00', room: 'Lab 1', faculty_id: 1 },
  { schedule_id: 102, subject_id: 3, sy_id: 1, section: 'BSIT 3B', days: 'TTH', time_start: '13:00', time_end: '14:30', room: 'Room 302', faculty_id: 2 },
  { schedule_id: 103, subject_id: 1, sy_id: 1, section: 'BSIT 1A', days: 'MWF', time_start: '10:00', time_end: '11:00', room: 'Room 101', faculty_id: null }
];

// NOTE THE EXPORT DEFAULT HERE - THIS FIXES YOUR ERROR
export default function RegistrarScheduling() {
  const [schedules, setSchedules] = useState(INITIAL_SCHEDULES);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterSY, setFilterSY] = useState(1); 
  const [sortBy, setSortBy] = useState('subject_code');
  const [sortDir, setSortDir] = useState('asc');
  const [isSortOpen, setIsSortOpen] = useState(false);
  const [modalState, setModalState] = useState({ isOpen: false, mode: null, data: null });
  const [toast, setToast] = useState(null);

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  const getSubject = (id) => SUBJECTS.find(s => s.subject_id === id) || {};
  const getFaculty = (id) => FACULTY_LIST.find(f => f.user_id === id);
  const getSY = (id) => SCHOOL_YEARS.find(sy => sy.sy_id === id) || {};

  const formatTime = (time24) => {
    if (!time24) return '';
    const [hours, minutes] = time24.split(':');
    const h = parseInt(hours, 10);
    const ampm = h >= 12 ? 'PM' : 'AM';
    const h12 = h % 12 || 12;
    return `${h12}:${minutes} ${ampm}`;
  };

  const toggleSort = (key) => {
    if (sortBy === key) setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    else { setSortBy(key); setSortDir('asc'); }
  };

  const processedSchedules = schedules.filter(sch => {
    const subj = getSubject(sch.subject_id);
    const fac = getFaculty(sch.faculty_id);
    const matchesSearch = subj.subject_code.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          subj.subject_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          sch.section.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          (fac && fac.name.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesSY = sch.sy_id === filterSY;
    return matchesSearch && matchesSY;
  }).sort((a, b) => {
    let valA, valB;
    if (sortBy === 'subject_code') {
      valA = getSubject(a.subject_id).subject_code;
      valB = getSubject(b.subject_id).subject_code;
    } else if (sortBy === 'faculty') {
      valA = getFaculty(a.faculty_id)?.name || 'ZZZ';
      valB = getFaculty(b.faculty_id)?.name || 'ZZZ';
    } else {
      valA = a[sortBy]; valB = b[sortBy];
    }
    if (valA < valB) return sortDir === 'asc' ? -1 : 1;
    if (valA > valB) return sortDir === 'asc' ? 1 : -1;
    return 0;
  });

  const unassignedCount = schedules.filter(s => s.sy_id === filterSY && !s.faculty_id).length;

  const openCreateModal = () => {
    setModalState({
      isOpen: true, mode: 'create',
      data: { subject_id: SUBJECTS[0].subject_id, sy_id: filterSY, section: '', days: 'MWF', time_start: '08:00', time_end: '09:00', room: '', faculty_id: '' }
    });
  };

  const openEditModal = (sch) => {
    setModalState({ isOpen: true, mode: 'edit', data: { ...sch, faculty_id: sch.faculty_id || '' } });
  };

  const handleFormChange = (field, value) => {
    setModalState(prev => ({ ...prev, data: { ...prev.data, [field]: value } }));
  };

  const saveSchedule = (e) => {
    e.preventDefault();
    const { mode, data } = modalState;
    const formattedData = {
      ...data,
      subject_id: parseInt(data.subject_id),
      sy_id: parseInt(data.sy_id),
      faculty_id: data.faculty_id ? parseInt(data.faculty_id) : null
    };

    if (mode === 'create') {
      setSchedules([...schedules, { ...formattedData, schedule_id: Date.now() }]);
      showToast('New course section and schedule created successfully.');
    } else {
      setSchedules(schedules.map(s => s.schedule_id === data.schedule_id ? formattedData : s));
      showToast('Schedule updated successfully.');
    }
    setModalState({ isOpen: false, mode: null, data: null });
  };

  const deleteSchedule = (id) => {
    if (window.confirm('Are you sure you want to delete this schedule? This will remove the class section entirely.')) {
      setSchedules(schedules.filter(s => s.schedule_id !== id));
      setModalState({ isOpen: false, mode: null, data: null });
      showToast('Schedule deleted permanently.');
    }
  };

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto animate-in fade-in duration-300 relative">
      {toast && createPortal(
        <div className="fixed top-8 right-8 z-[10000] p-4 rounded-2xl shadow-xl flex items-center animate-in slide-in-from-top-4 border bg-green-50 border-green-200 text-green-800">
          <CheckCircle2 className="mr-3 shrink-0" size={20}/>
          <p className="text-sm font-bold">{toast.message}</p>
        </div>,
        document.body
      )}

      {modalState.isOpen && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in" onClick={() => setModalState({ isOpen: false, mode: null, data: null })}>
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl p-6 sm:p-8 animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-6 border-b border-gray-50 pb-4">
              <div>
                <h2 className="text-xs font-black text-gray-400 uppercase tracking-[0.2em]">Master Schedule</h2>
                <p className="text-lg font-bold text-gray-900 mt-0.5">{modalState.mode === 'create' ? 'Create New Section' : 'Edit Section Assignment'}</p>
              </div>
              <button onClick={() => setModalState({ isOpen: false, mode: null, data: null })} className="p-2 border border-gray-200 rounded-full hover:bg-gray-50 text-gray-600 transition-all active:scale-90">
                <X size={18} strokeWidth={2.5} />
              </button>
            </div>

            <form onSubmit={saveSchedule} className="space-y-5 overflow-y-auto pr-2 flex-1 custom-scrollbar">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div>
                  <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1.5">School Year & Term</label>
                  <select required value={modalState.data.sy_id} onChange={(e) => handleFormChange('sy_id', e.target.value)} className="w-full p-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#0e5c2b] outline-none text-sm font-bold text-gray-800 bg-gray-50">
                    {SCHOOL_YEARS.map(sy => <option key={sy.sy_id} value={sy.sy_id}>{sy.sy_label} - {sy.semester} Sem</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1.5">Course / Subject</label>
                  <select required value={modalState.data.subject_id} onChange={(e) => handleFormChange('subject_id', e.target.value)} className="w-full p-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#0e5c2b] outline-none text-sm font-bold text-gray-800">
                    {SUBJECTS.map(s => <option key={s.subject_id} value={s.subject_id}>{s.subject_code} - {s.subject_name}</option>)}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div>
                  <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1.5">Section Name</label>
                  <input type="text" required value={modalState.data.section} onChange={(e) => handleFormChange('section', e.target.value)} className="w-full p-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#0e5c2b] outline-none text-sm font-medium" placeholder="e.g. BSIT 3A" />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1.5">Room</label>
                  <div className="relative">
                    <MapPin className="absolute left-3.5 top-3.5 text-gray-400" size={16} />
                    <input type="text" required value={modalState.data.room} onChange={(e) => handleFormChange('room', e.target.value)} className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#0e5c2b] outline-none text-sm font-medium" placeholder="e.g. Lab 1" />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-5">
                 <div>
                  <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1.5">Days</label>
                  <select required value={modalState.data.days} onChange={(e) => handleFormChange('days', e.target.value)} className="w-full p-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#0e5c2b] outline-none text-sm font-medium text-gray-800">
                    <option value="MWF">MWF</option>
                    <option value="TTH">TTH</option>
                    <option value="SAT">SAT</option>
                    <option value="SUN">SUN</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1.5">Start Time</label>
                  <input type="time" required value={modalState.data.time_start} onChange={(e) => handleFormChange('time_start', e.target.value)} className="w-full p-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#0e5c2b] outline-none text-sm font-medium text-gray-800" />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1.5">End Time</label>
                  <input type="time" required value={modalState.data.time_end} onChange={(e) => handleFormChange('time_end', e.target.value)} className="w-full p-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#0e5c2b] outline-none text-sm font-medium text-gray-800" />
                </div>
              </div>

              <div className="pt-4 mt-4 border-t border-gray-100">
                <label className="block text-[10px] font-bold text-[#0e5c2b] uppercase tracking-widest mb-2 flex items-center">
                  <Users size={14} className="mr-1.5" /> Faculty Assignment
                </label>
                <select value={modalState.data.faculty_id} onChange={(e) => handleFormChange('faculty_id', e.target.value)} className="w-full p-3 border-2 border-[#0e5c2b]/20 rounded-xl focus:ring-2 focus:ring-[#0e5c2b] outline-none text-sm font-bold text-gray-800 bg-green-50/30">
                  <option value="">-- UNASSIGNED (TBA) --</option>
                  {FACULTY_LIST.map(f => <option key={f.user_id} value={f.user_id}>{f.name} ({f.dept})</option>)}
                </select>
                <p className="text-xs text-gray-400 mt-2 font-medium">Leaving this unassigned will flag the course for the Dean to review.</p>
              </div>
            </form>

            <div className="mt-8 pt-5 border-t border-gray-100 flex justify-between items-center shrink-0">
              {modalState.mode === 'edit' ? (
                <button type="button" onClick={() => deleteSchedule(modalState.data.schedule_id)} className="px-4 py-2.5 text-sm font-bold text-red-600 hover:bg-red-50 rounded-xl transition-all flex items-center">
                  <Trash2 size={16} className="mr-2" /> Delete
                </button>
              ) : <div />}
              <div className="flex space-x-3 ml-auto">
                <button type="button" onClick={() => setModalState({ isOpen: false, mode: null, data: null })} className="px-5 py-2.5 text-sm font-bold text-gray-600 hover:bg-gray-100 rounded-xl transition-all">Cancel</button>
                <button type="submit" onClick={saveSchedule} className="px-6 py-2.5 text-sm font-bold text-white bg-[#0e5c2b] hover:bg-[#0a4720] rounded-xl shadow-md transition-all flex items-center active:scale-95">
                  <CheckCircle2 size={16} className="mr-2" /> {modalState.mode === 'create' ? 'Create Schedule' : 'Save Changes'}
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}

      <div className="bg-white p-6 sm:p-8 rounded-3xl shadow-sm border border-gray-100 flex flex-col sm:flex-row justify-between sm:items-center gap-6 relative overflow-hidden">
        <div className="absolute right-0 top-0 w-64 h-64 bg-green-50 rounded-full mix-blend-multiply filter blur-3xl opacity-50 -translate-y-1/2 translate-x-1/4 z-0 pointer-events-none"></div>
        <div className="relative z-10">
          <h1 className="text-3xl font-bold text-gray-900 tracking-tight font-serif mb-1 flex items-center">
            Course Scheduling
          </h1>
          <p className="text-sm text-gray-500 font-medium">Create course sections and assign faculty schedules for the term.</p>
        </div>
        <div className="relative z-10 shrink-0">
          <button onClick={openCreateModal} className="px-6 py-3 bg-[#0e5c2b] hover:bg-[#0a4720] text-white font-bold rounded-xl text-sm transition-all shadow-lg shadow-green-900/20 flex items-center active:scale-95">
            <Plus size={18} className="mr-2" /> Create New Section
          </button>
        </div>
      </div>

      <div className="bg-white rounded-3xl shadow-xl border border-gray-100 overflow-hidden flex flex-col min-h-[500px]">
        <div className="p-4 border-b border-gray-200 bg-white flex flex-row items-center gap-3 flex-wrap">
          {unassignedCount > 0 && (
            <div className="px-4 py-2 border border-red-200 rounded-lg flex items-center gap-2 bg-red-50 shrink-0 shadow-sm">
              <ShieldCheck size={16} className="text-red-600" />
              <div>
                <span className="text-sm font-bold text-red-700 leading-none">{unassignedCount}</span>
                <span className="text-[10px] font-black text-red-600 uppercase tracking-widest ml-1.5">Unassigned</span>
              </div>
            </div>
          )}

          <div className="relative shrink-0">
             <select 
                value={filterSY} 
                onChange={(e) => setFilterSY(parseInt(e.target.value))} 
                className="pl-9 pr-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#0e5c2b] outline-none text-sm font-bold text-gray-800 bg-gray-50 cursor-pointer shadow-sm appearance-none"
              >
                {SCHOOL_YEARS.map(sy => (
                  <option key={sy.sy_id} value={sy.sy_id}>{sy.sy_label} | {sy.semester} Sem</option>
                ))}
              </select>
              <CalendarDays className="absolute left-3 top-2.5 text-gray-500" size={16} />
          </div>

          <div className="relative shrink min-w-[150px] flex-1 max-w-md">
            <Search className="absolute left-3.5 top-2.5 text-gray-400" size={16} />
            <input 
              type="text" placeholder="Search subject, section, or faculty..." 
              value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-green-600 outline-none text-sm font-medium transition-shadow bg-gray-50 focus:bg-white"
            />
          </div>
          
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
              {processedSchedules.length === 0 ? (
                <tr>
                  <td colSpan="5" className="py-24 text-center">
                    <BookOpen className="mx-auto text-gray-200 mb-4" size={48} />
                    <p className="text-gray-500 font-bold">No schedules created yet.</p>
                    <p className="text-xs text-gray-400 mt-1">Click the button above to create the first section for this term.</p>
                  </td>
                </tr>
              ) : (
                processedSchedules.map((sch) => {
                  const subj = getSubject(sch.subject_id);
                  const fac = getFaculty(sch.faculty_id);
                  const isUnassigned = !sch.faculty_id;

                  return (
                    <tr key={sch.schedule_id} className="hover:bg-gray-50 transition-colors group">
                      <td className="px-6 py-4">
                        <div className="text-sm font-bold text-gray-900 leading-tight">{subj.subject_name}</div>
                        <div className="text-[10px] font-bold text-[#0e5c2b] uppercase tracking-widest mt-0.5">{subj.subject_code} • {subj.units} Units</div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="bg-gray-100 text-gray-700 px-3 py-1.5 rounded-lg text-xs font-bold border border-gray-200">{sch.section}</span>
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
                              {fac.name.charAt(0)}
                            </div>
                            <div>
                              <div className="text-sm font-bold text-gray-900">{fac.name}</div>
                              <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-0.5">{fac.dept} Dept</div>
                            </div>
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button onClick={() => openEditModal(sch)} className="p-2 text-gray-400 hover:text-[#0e5c2b] hover:bg-green-50 rounded-lg transition-all">
                          <Edit size={18} />
                        </button>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}