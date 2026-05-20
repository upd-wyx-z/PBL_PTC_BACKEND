import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { 
  BookOpen, Search, ArrowLeft, Plus, Edit, Users, 
  X, Save, FileSpreadsheet, Calendar, ClipboardList, 
  GraduationCap, Download, Check, ChevronRight, Trash2, 
  CheckCircle2, Loader2, CornerUpLeft, AlertTriangle 
} from 'lucide-react';

const API_BASE = '/api/grades';

export default function Grades({ user }) {
  // --- NAVIGATION STATE ---
  const [activeCourse, setActiveCourse] = useState(null); 
  
  // --- DATA STATES ---
  const [courses, setCourses] = useState([]);
  const [students, setStudents] = useState([]);
  const [activities, setActivities] = useState([]);
  const [gradesData, setGradesData] = useState({});

  // --- UI & SEARCH STATES ---
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [courseSearch, setCourseSearch] = useState('');
  const [courseYearFilter, setCourseYearFilter] = useState('All Years');
  const [studentSearch, setStudentSearch] = useState('');
  
  // --- UNSAVED CHANGES STATE ---
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [isUnsavedModalOpen, setIsUnsavedModalOpen] = useState(false);

  // --- MODAL STATES ---
  const [modalState, setModalState] = useState({ isOpen: false, type: null, data: null });
  const [isSubmitModalOpen, setIsSubmitModalOpen] = useState(false);
  const [isCertified, setIsCertified] = useState(false);
  const [toastMessage, setToastMessage] = useState(null);

  const showToast = (text, type = 'success') => {
    setToastMessage({ text, type });
    setTimeout(() => setToastMessage(null), 4000);
  };

  // ==========================================
  // API FETCHERS
  // ==========================================
  
  useEffect(() => {
    fetchCourses();
  }, []);

  const fetchCourses = async () => {
    try {
      setIsLoading(true);
      const res = await fetch(`${API_BASE}/courses`, { credentials: 'include' });
      const data = await res.json();
      if (res.ok) setCourses(data.courses);
    } catch (err) {
      showToast('Failed to load courses.', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenCourse = async (course) => {
    try {
      setIsLoading(true);
      setActiveCourse(course);
      setStudentSearch('');
      setHasUnsavedChanges(false); // Reset unsaved changes
      
      const res = await fetch(`${API_BASE}/courses/${course.course_id}`, { credentials: 'include' });
      const data = await res.json();
      
      if (res.ok) {
        setStudents(data.students || []);
        setActivities(data.activities || []);
        setGradesData(data.grades || {});
        if (data.return_remarks) {
          setActiveCourse(prev => ({ ...prev, return_remarks: data.return_remarks }));
        }
      }
    } catch (err) {
      showToast('Failed to load gradebook data.', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  // ==========================================
  // HANDLERS
  // ==========================================

  const closeModals = () => {
    setModalState({ isOpen: false, type: null, data: null });
  };

  const handleSaveTask = async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const taskData = {
      activity_id: modalState.data?.activity_id,
      course_id: activeCourse.course_id || activeCourse.schedule_id,
      title: formData.get('title') || 'Untitled Task',
      type: formData.get('type') || 'Quiz',
      period: formData.get('period') || 'Midterm',
      max_score: parseInt(formData.get('max_score'), 10) || 100,
      date: formData.get('date') || new Date().toISOString().split('T')[0],
    };

    try {
      const res = await fetch(`${API_BASE}/activities`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(taskData)
      });
      
      const responseData = await res.json();
      if (res.ok) {
        showToast('Activity saved successfully!');
        closeModals();
        handleOpenCourse(activeCourse);
      } else {
        showToast(responseData.message || 'Failed to save activity.', 'error');
      }
    } catch (err) {
      showToast('Server connection error.', 'error');
    }
  };

  const handleMatrixGradeChange = (activityId, studentNo, value, maxScore) => {
    setHasUnsavedChanges(true); // Flag unsaved changes here!
    
    if (value === '') {
      setGradesData(prev => ({ ...prev, [activityId]: { ...(prev[activityId] || {}), [studentNo]: '' } }));
      return;
    }
    let numericStr = value.replace(/[^0-9.]/g, '');
    if (numericStr !== '') {
      numericStr = numericStr.replace(/^0+(?=\d)/, '');
      let numVal = parseFloat(numericStr);
      if (numVal > maxScore) numericStr = maxScore.toString();
    }
    setGradesData(prev => ({ ...prev, [activityId]: { ...(prev[activityId] || {}), [studentNo]: numericStr } }));
  };

  const handleSaveGradesDB = async () => {
    setIsSaving(true);
    const gradeUpdates = [];
    for (const [activity_id, studentScores] of Object.entries(gradesData)) {
      for (const [student_no, score] of Object.entries(studentScores)) {
        gradeUpdates.push({ activity_id, student_no, score });
      }
    }

    try {
      const res = await fetch(`${API_BASE}/save`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ gradeUpdates })
      });
      if (res.ok) {
        showToast('All grades saved to database!');
        setHasUnsavedChanges(false); // Reset unsaved flag on success
        return true;
      } else {
        showToast('Failed to save grades.', 'error');
        return false;
      }
    } catch (err) {
      showToast('Server connection error.', 'error');
      return false;
    } finally {
      setIsSaving(false);
    }
  };

  const confirmSubmitGrades = async () => {
    try {
      setIsSaving(true);
      
      // Auto-save any unsaved matrix inputs before submitting to Dean
      if (hasUnsavedChanges) {
        const savedSuccessfully = await handleSaveGradesDB();
        if (!savedSuccessfully) {
          showToast('Submission aborted: Failed to save recent grade changes.', 'error');
          setIsSaving(false);
          return;
        }
      }

      const res = await fetch(`${API_BASE}/courses/${activeCourse.course_id}/submit`, {
        method: 'POST',
        credentials: 'include'
      });
      if (res.ok) {
        showToast(`Success: Term grades for ${activeCourse.course_code} submitted to the Dean!`);
        setIsSubmitModalOpen(false);
        setIsCertified(false);
        setActiveCourse({...activeCourse, workflow_status: 'Pending Dean', return_remarks: null});
      }
    } catch (err) {
      showToast('Error submitting grades.', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  // --- Export Excel ---
  const handleExportExcel = () => {
    let htmlContent = `
      <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
      <head><style>table { border-collapse: collapse; font-family: sans-serif; } th { background-color: #1a2a3a; color: #ffffff; padding: 10px; border: 1px solid #dddddd; } td { padding: 8px; border: 1px solid #dddddd; text-align: center; } .header-cell { background-color: #f3f4f6; font-weight: bold; text-align: left; }</style></head>
      <body>
        <table>
          <tr><th colspan="${activities.length + 3}" style="font-size: 18px; text-align: left; background-color: #0e5c2b;">PTC Master Gradebook</th></tr>
          <tr><td class="header-cell" colspan="2">Course</td><td colspan="${activities.length + 1}">${activeCourse.course_code} - ${activeCourse.course_title}</td></tr>
          <tr><td class="header-cell" colspan="2">Section</td><td colspan="${activities.length + 1}">${activeCourse.section}</td></tr>
          <tr><td colspan="${activities.length + 3}"></td></tr>
          <tr><th>Student ID</th><th style="text-align: left;">Student Name</th>${activities.map(act => `<th>${act.title} (Max: ${act.max_score})</th>`).join('')}<th>Term Total %</th></tr>
          ${students.map(student => {
            let totalEarned = 0, totalMax = 0, rowScores = '';
            activities.forEach(act => {
              const score = parseFloat(gradesData[act.activity_id]?.[student.student_no]);
              if (!isNaN(score)) totalEarned += score;
              totalMax += act.max_score;
              rowScores += `<td>${gradesData[act.activity_id]?.[student.student_no] || ''}</td>`;
            });
            const termTotal = totalMax > 0 ? ((totalEarned / totalMax) * 100).toFixed(2) : '0.00';
            return `<tr><td>${student.student_no}</td><td style="text-align: left;">${student.last_name}, ${student.first_name}</td>${rowScores}<td style="font-weight: bold;">${termTotal}</td></tr>`;
          }).join('')}
        </table>
      </body></html>
    `;
    const blob = new Blob([htmlContent], { type: 'application/vnd.ms-excel' });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `${activeCourse.course_code}_${activeCourse.section}_Gradebook.xls`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const minDateStr = new Date().toISOString().split('T')[0];

  // ==========================================
  // VIEW 1: COURSE LIST
  // ==========================================
  if (!activeCourse) {
    const filteredCourses = courses.filter(c => {
      const matchesSearch = c.course_code.toLowerCase().includes(courseSearch.toLowerCase()) || 
                            c.course_title.toLowerCase().includes(courseSearch.toLowerCase());
      const matchesYear = courseYearFilter === 'All Years' || c.year_level === courseYearFilter;
      return matchesSearch && matchesYear;
    });

    return (
      <div className="space-y-6 max-w-[1600px] mx-auto animate-in fade-in duration-300">
        <div className="bg-white p-6 sm:p-8 rounded-3xl shadow-sm border border-gray-100 flex flex-col sm:flex-row justify-between sm:items-center gap-6 relative overflow-hidden">
          <div className="absolute right-0 top-0 w-64 h-64 bg-green-50 rounded-full mix-blend-multiply filter blur-3xl opacity-50 -translate-y-1/2 translate-x-1/4 z-0"></div>
          <div className="relative z-10">
            <h1 className="text-3xl font-bold text-gray-900 tracking-tight mb-1">Grading System</h1>
            <p className="text-sm text-gray-500 font-medium">Select a course to manage activities and encode grades.</p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-4 bg-white p-4 rounded-2xl border border-gray-100 shadow-sm">
          <div className="flex-1 relative">
            <Search className="absolute left-4 top-3.5 text-gray-400" size={18} />
            <input 
              type="text" placeholder="Search course code or title..." value={courseSearch} onChange={(e) => setCourseSearch(e.target.value)}
              className="w-full max-w-md pl-11 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-green-600 outline-none text-sm font-medium"
            />
          </div>
        </div>

        {isLoading ? (
           <div className="flex justify-center py-20"><Loader2 className="animate-spin text-green-600" size={40} /></div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {filteredCourses.map(course => (
              <div key={course.course_id} className="bg-white rounded-3xl border border-gray-100 shadow-xl overflow-hidden hover:shadow-2xl transition-all group flex flex-col">
                {/* Colored Top Bar */}
                <div className={`h-3 w-full ${
                  course.workflow_status === 'Returned' ? 'bg-red-500' : 
                  course.workflow_status === 'Drafting' ? 'bg-[#0e5c2b]' : 
                  course.workflow_status === 'Grade Released' ? 'bg-green-500' :
                  'bg-yellow-500'
                }`}></div>
                <div className="p-8 flex-1 flex flex-col">
                  <div className="flex justify-between items-start mb-4">
                    <span className="px-3 py-1 bg-green-50 text-green-700 text-[10px] font-black uppercase tracking-widest rounded-lg border border-green-100">
                      {course.course_code}
                    </span>
                    {/* Status Pill */}
                    <span className={`px-3 py-1 text-[10px] font-black uppercase tracking-widest rounded-lg ${
                      course.workflow_status === 'Returned' ? 'bg-red-100 text-red-800' : 
                      course.workflow_status === 'Grade Released' ? 'bg-green-100 text-green-800' :
                      course.workflow_status === 'Drafting' ? 'bg-gray-100 text-gray-600' :
                      'bg-yellow-100 text-yellow-800'
                    }`}>
                      {course.workflow_status}
                    </span>
                  </div>
                  <h3 className="text-xl font-bold text-gray-900 leading-tight mb-2 group-hover:text-green-700 transition-colors">
                    {course.course_title}
                  </h3>
                  <div className="flex gap-4 mt-auto pt-6 border-t border-gray-50">
                    <div className="flex items-center text-sm font-medium text-gray-500">
                      <Users size={16} className="mr-2 text-gray-400" /> {course.section}
                    </div>
                  </div>
                </div>
                <div className="p-4 bg-gray-50 border-t border-gray-100">
                  <button onClick={() => handleOpenCourse(course)} className="w-full py-3 bg-white border border-gray-200 hover:border-green-600 hover:bg-green-50 text-gray-800 font-bold rounded-xl transition-all flex justify-center items-center gap-2">
                    <BookOpen size={18} className="text-green-700" /> Open Gradebook
                  </button>
                </div>
              </div>
            ))}
            {filteredCourses.length === 0 && (
              <div className="col-span-full py-20 text-center text-gray-500 font-medium">No courses found matching your criteria.</div>
            )}
          </div>
        )}
      </div>
    );
  }

  // ==========================================
  // VIEW 2: COURSE MATRIX / GRADEBOOK
  // ==========================================
  const filteredStudents = students.filter(s => 
    s.last_name.toLowerCase().includes(studentSearch.toLowerCase()) || s.student_no.toLowerCase().includes(studentSearch.toLowerCase())
  );

  const canEdit = activeCourse.workflow_status === 'Drafting' || activeCourse.workflow_status === 'Returned';

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto animate-in fade-in duration-300 relative">

      {/* --- UNSAVED CHANGES MODAL --- */}
      {isUnsavedModalOpen && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in" onClick={() => setIsUnsavedModalOpen(false)}>
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm p-8 animate-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
            <div className="flex flex-col items-center text-center mb-6">
              <div className="w-16 h-16 bg-orange-50 text-orange-600 rounded-full flex items-center justify-center mb-4 border-4 border-white shadow-sm">
                <AlertTriangle size={32} />
              </div>
              <h2 className="text-xl font-bold text-gray-900">Unsaved Changes</h2>
              <p className="text-sm text-gray-500 mt-2">
                You have modified grades without saving. If you leave now, your changes will be lost.
              </p>
            </div>
            <div className="flex flex-col gap-3">
              <button 
                onClick={async () => {
                  const success = await handleSaveGradesDB();
                  if (success) {
                    setIsUnsavedModalOpen(false);
                    setActiveCourse(null);
                  }
                }} 
                disabled={isSaving}
                className="w-full py-3.5 px-4 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white font-bold rounded-xl shadow-md transition-all flex justify-center items-center"
              >
                {isSaving ? <Loader2 size={18} className="animate-spin" /> : 'Save and Exit'}
              </button>
              <button 
                onClick={() => {
                  setIsUnsavedModalOpen(false);
                  setHasUnsavedChanges(false);
                  setActiveCourse(null);
                }} 
                disabled={isSaving}
                className="w-full py-3.5 px-4 bg-red-50 hover:bg-red-100 text-red-700 font-bold rounded-xl transition-all"
              >
                Discard Changes
              </button>
              <button 
                onClick={() => setIsUnsavedModalOpen(false)} 
                disabled={isSaving}
                className="w-full py-3.5 px-4 bg-gray-50 hover:bg-gray-100 text-gray-700 font-bold rounded-xl transition-all"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* --- ADD/EDIT TASK MODAL --- */}
      {modalState.isOpen && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in" onClick={closeModals}>
          {(modalState.type === 'addTask' || modalState.type === 'editTask') && (
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md p-8 animate-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
              <div className="flex justify-between items-center mb-6 border-b border-gray-50 pb-4">
                <h2 className="text-sm font-bold text-gray-800 uppercase tracking-widest flex items-center">
                  <ClipboardList size={18} className="mr-2 text-green-700" /> 
                  {modalState.type === 'addTask' ? 'Add New Activity' : 'Edit Activity Details'}
                </h2>
                <button onClick={closeModals} className="p-2 border border-gray-200 rounded-full hover:bg-gray-50 text-gray-600"><X size={16} strokeWidth={2.5} /></button>
              </div>

              <form onSubmit={handleSaveTask} className="space-y-5">
                <div>
                  <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Activity Title</label>
                  <input name="title" type="text" required maxLength={30} defaultValue={modalState.data?.title || ''} className="w-full p-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-green-600 outline-none text-sm font-medium" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Activity Type</label>
                    <select name="type" defaultValue={modalState.data?.activity_type || 'Quiz'} className="w-full p-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-green-600 outline-none text-sm font-medium">
                      <option value="Quiz">Quiz</option>
                      <option value="Exam">Exam</option>
                      <option value="Project">Project</option>
                      <option value="Assignment">Assignment</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Period</label>
                    <select name="period" defaultValue={modalState.data?.period || 'Midterm'} className="w-full p-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-green-600 outline-none text-sm font-medium">
                      <option value="Prelim">Prelim</option>
                      <option value="Midterm">Midterm</option>
                      <option value="Pre-Finals">Pre-Finals</option>
                      <option value="Finals">Finals</option>
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Max Score (0-200)</label>
                    <input name="max_score" type="number" required min="1" max="200" defaultValue={modalState.data?.max_score || 100} className="w-full p-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-green-600 outline-none text-sm font-medium" />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Date</label>
                    <input name="date" type="date" required min={minDateStr} defaultValue={modalState.data?.activity_date ? new Date(modalState.data.activity_date).toISOString().split('T')[0] : minDateStr} className="w-full p-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-green-600 outline-none text-sm font-medium" />
                  </div>
                </div>
                <div className="pt-6 border-t border-gray-50 flex gap-3">
                  <button type="submit" className="flex-1 px-6 py-3.5 bg-[#0e5c2b] hover:bg-[#0a4720] text-white font-bold rounded-xl shadow-md transition-all active:scale-95 flex justify-center items-center">
                    {modalState.type === 'addTask' ? 'Save New Activity' : 'Update Details'}
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>,
        document.body
      )}

      {/* --- SUBMIT CONFIRMATION MODAL --- */}
      {isSubmitModalOpen && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in" onClick={() => { setIsSubmitModalOpen(false); setIsCertified(false); }}>
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md p-8 animate-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
            <div className="flex flex-col items-center text-center mb-6">
              <div className="w-16 h-16 bg-yellow-50 text-yellow-600 rounded-full flex items-center justify-center mb-4 border-4 border-white shadow-sm">
                <CheckCircle2 size={32} />
              </div>
              <h2 className="text-xl font-bold text-gray-900">Submit Term Grades</h2>
              <p className="text-sm text-gray-500 mt-2">
                You are about to submit the final term grades for <span className="font-bold text-gray-700">{activeCourse.course_code} - {activeCourse.section}</span>. 
                {hasUnsavedChanges && <span className="block mt-2 text-orange-600 font-bold">Any unsaved grade changes will be automatically saved before submission.</span>}
              </p>
            </div>

            <div className="bg-gray-50 p-4 rounded-xl border border-gray-200 mb-8 cursor-pointer hover:bg-gray-100 transition-colors" onClick={() => setIsCertified(!isCertified)}>
              <label className="flex items-start gap-3 cursor-pointer">
                <input type="checkbox" className="mt-0.5 w-5 h-5 text-green-600 rounded border-gray-300 focus:ring-green-600 cursor-pointer shadow-sm" checked={isCertified} onChange={(e) => setIsCertified(e.target.checked)} onClick={e => e.stopPropagation()} />
                <span className="text-sm font-bold text-gray-800 leading-tight">I certify the information is certified true and correct.</span>
              </label>
            </div>

            <div className="flex gap-3">
              <button onClick={() => { setIsSubmitModalOpen(false); setIsCertified(false); }} className="flex-1 py-3.5 px-4 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-xl transition-all">Cancel</button>
              <button disabled={!isCertified || isSaving} onClick={confirmSubmitGrades} className="flex-1 py-3.5 px-4 bg-yellow-500 hover:bg-yellow-600 disabled:bg-gray-200 disabled:text-gray-400 text-white font-bold rounded-xl shadow-md transition-all active:scale-95 flex justify-center items-center">
                {isSaving ? <Loader2 size={18} className="animate-spin" /> : 'Submit Grades'}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* --- TOAST --- */}
      {toastMessage && createPortal(
        <div className={`fixed top-8 right-8 z-[10000] p-4 rounded-2xl shadow-xl flex items-center animate-in slide-in-from-top-4 border ${toastMessage.type === 'success' ? 'bg-green-50 border-green-200 text-green-800' : 'bg-red-50 border-red-200 text-red-800'}`}>
          <CheckCircle2 className="mr-3 shrink-0" size={20}/>
          <p className="text-sm font-bold">{toastMessage.text}</p>
        </div>,
        document.body
      )}

      {/* --- COURSE HEADER --- */}
      <div className="flex items-center gap-4">
        <button 
          onClick={() => {
            if (hasUnsavedChanges) setIsUnsavedModalOpen(true);
            else setActiveCourse(null);
          }} 
          className="p-2.5 bg-white shadow-sm hover:bg-gray-50 text-gray-600 hover:text-gray-900 rounded-xl transition-all border border-gray-200"
        >
          <ArrowLeft size={20} />
        </button>
        <div>
          <div className="flex items-center gap-3 mb-0.5">
            <span className="text-xs font-bold text-gray-500 uppercase tracking-widest">{activeCourse.course_code} • {activeCourse.section}</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight ">{activeCourse.course_title}</h1>
        </div>
      </div>

      {/* --- WORKFLOW STEPPER CARD --- */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 flex flex-col gap-6">
        <div>
          <h2 className="text-lg font-bold text-gray-900">Term/Semester Workflow</h2>
          <p className="text-sm text-gray-500 mt-1">Individual tasks roll up into the final term grade. Requires multi-level approval at the end of the term.</p>
        </div>
        
        <div className="relative w-full max-w-4xl mx-auto mb-2">
          <div className="absolute top-4 left-[12.5%] right-[12.5%] h-0.5 bg-gray-200 z-0"></div>
          <div className="flex justify-between text-center relative z-10">
            {/* Step 1: Faculty */}
            <div className="flex flex-col items-center w-1/4">
              <div className={`w-8 h-8 rounded-full font-bold flex items-center justify-center mb-2 shadow-sm border-2 border-white z-10 relative ${activeCourse.workflow_status === 'Returned' ? 'bg-red-500 text-white ring-2 ring-red-100' : activeCourse.workflow_status === 'Drafting' ? 'bg-yellow-400 text-yellow-900 ring-2 ring-yellow-100' : 'bg-green-500 text-white'}`}>1</div>
              <span className="text-[10px] font-black uppercase tracking-widest text-gray-800">Faculty</span>
              <span className={`text-[9px] font-bold px-2 py-0.5 rounded mt-1 ${activeCourse.workflow_status === 'Returned' ? 'bg-red-100 text-red-800' : activeCourse.workflow_status === 'Drafting' ? 'bg-yellow-100 text-yellow-800' : 'bg-green-100 text-green-800'}`}>
                {activeCourse.workflow_status === 'Returned' ? 'Returned' : activeCourse.workflow_status === 'Drafting' ? 'Drafting' : 'Submitted'}
              </span>
            </div>
             {/* Step 2: Dean */}
             <div className="flex flex-col items-center w-1/4">
              <div className={`w-8 h-8 rounded-full font-bold flex items-center justify-center mb-2 border-2 border-white z-10 relative ${activeCourse.workflow_status === 'Returned' ? 'bg-red-500 text-white ring-2 ring-red-100' : activeCourse.workflow_status === 'Pending Dean' ? 'bg-yellow-400 text-yellow-900 ring-2 ring-yellow-100' : (['Pending VPAA', 'Pending Registrar', 'Grade Released'].includes(activeCourse.workflow_status) ? 'bg-green-500 text-white' : 'bg-gray-100 text-gray-400')}`}>2</div>
              <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">Dean</span>
              <span className={`text-[9px] font-bold px-2 py-0.5 rounded mt-1 ${activeCourse.workflow_status === 'Returned' ? 'bg-red-100 text-red-800' : activeCourse.workflow_status === 'Pending Dean' ? 'bg-yellow-100 text-yellow-800' : (['Pending VPAA', 'Pending Registrar', 'Grade Released'].includes(activeCourse.workflow_status) ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-400')}`}>
                {activeCourse.workflow_status === 'Returned' ? 'Rejected' : activeCourse.workflow_status === 'Pending Dean' ? 'Reviewing' : (['Pending VPAA', 'Pending Registrar', 'Grade Released'].includes(activeCourse.workflow_status) ? 'Approved' : 'Waiting')}
              </span>
            </div>
             {/* Step 3: VPAA */}
             <div className="flex flex-col items-center w-1/4">
              <div className={`w-8 h-8 rounded-full font-bold flex items-center justify-center mb-2 border-2 border-white z-10 relative ${activeCourse.workflow_status === 'Pending VPAA' ? 'bg-yellow-400 text-yellow-900 ring-2 ring-yellow-100' : (['Pending Registrar', 'Grade Released'].includes(activeCourse.workflow_status) ? 'bg-green-500 text-white' : 'bg-gray-100 text-gray-400')}`}>3</div>
              <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">VPAA</span>
              <span className={`text-[9px] font-bold px-2 py-0.5 rounded mt-1 ${activeCourse.workflow_status === 'Pending VPAA' ? 'bg-yellow-100 text-yellow-800' : (['Pending Registrar', 'Grade Released'].includes(activeCourse.workflow_status) ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-400')}`}>
                {activeCourse.workflow_status === 'Pending VPAA' ? 'Reviewing' : (['Pending Registrar', 'Grade Released'].includes(activeCourse.workflow_status) ? 'Approved' : 'Waiting')}
              </span>
            </div>
             {/* Step 4: Registrar */}
             <div className="flex flex-col items-center w-1/4">
              <div className={`w-8 h-8 rounded-full font-bold flex items-center justify-center mb-2 border-2 border-white z-10 relative ${activeCourse.workflow_status === 'Pending Registrar' ? 'bg-yellow-400 text-yellow-900 ring-2 ring-yellow-100' : activeCourse.workflow_status === 'Grade Released' ? 'bg-green-500 text-white' : 'bg-gray-100 text-gray-400'}`}>4</div>
              <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">Registrar</span>
              <span className={`text-[9px] font-bold px-2 py-0.5 rounded mt-1 ${activeCourse.workflow_status === 'Pending Registrar' ? 'bg-yellow-100 text-yellow-800' : activeCourse.workflow_status === 'Grade Released' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-400'}`}>
                {activeCourse.workflow_status === 'Pending Registrar' ? 'Reviewing' : activeCourse.workflow_status === 'Grade Released' ? 'Released' : 'Waiting'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* --- REJECTION BANNER --- */}
      {activeCourse.workflow_status === 'Returned' && (
        <div className="bg-red-50 border border-red-200 p-5 rounded-2xl shadow-sm flex items-start animate-in slide-in-from-top-4">
          <CornerUpLeft className="text-red-500 mr-4 shrink-0 mt-1" size={24} />
          <div>
            <h4 className="text-red-800 font-bold text-lg mb-1">Dean returned this submission for revisions.</h4>
            <p className="text-red-600 font-medium">Remarks: "{activeCourse.return_remarks || 'No remarks provided.'}"</p>
          </div>
        </div>
      )}

      {/* --- MASTER GRADEBOOK MATRIX --- */}
      <div className="bg-white rounded-2xl shadow-xl border border-gray-200 overflow-hidden flex flex-col min-h-[500px]">
        {/* Toolbar */}
        <div className="p-4 border-b border-gray-200 bg-white flex flex-row items-center gap-3 overflow-x-auto custom-scrollbar">
          <div className="px-4 py-2 border border-gray-200 rounded-lg text-sm font-bold text-gray-700 bg-gray-50 shrink-0">
            {activeCourse.semester}
          </div>
          <div className="relative shrink min-w-[120px] flex-1 max-w-sm">
            <Search className="absolute left-3.5 top-2.5 text-gray-400" size={16} />
            <input 
              type="text" placeholder="Search student..." value={studentSearch} onChange={(e) => setStudentSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-green-600 outline-none text-sm font-medium transition-shadow bg-gray-50 focus:bg-white"
            />
          </div>
          <div className="flex items-center gap-3 shrink-0 ml-auto">
            <button onClick={handleExportExcel} className="flex items-center justify-center gap-2 px-4 py-2 bg-white border border-gray-200 text-gray-700 font-bold rounded-lg text-sm hover:bg-gray-50 transition-all shadow-sm shrink-0">
              <Download size={15} /> Export CSV
            </button>
            <button onClick={() => setModalState({ isOpen: true, type: 'addTask', data: null })} disabled={!canEdit} className="flex items-center justify-center gap-2 px-4 py-2 bg-[#0e5c2b] hover:bg-[#0a4720] text-white font-bold rounded-lg text-sm transition-all shadow-md active:scale-95 shrink-0 disabled:opacity-50">
              <Plus size={16} /> Add Task
            </button>

            {/* Smart Save Progress Button */}
            <button 
              onClick={handleSaveGradesDB} 
              disabled={isSaving || !canEdit || !hasUnsavedChanges} 
              className={`flex items-center justify-center gap-2 px-4 py-2 font-bold rounded-lg text-sm transition-all shadow-md active:scale-95 shrink-0 disabled:opacity-50 disabled:shadow-none ${hasUnsavedChanges ? 'bg-blue-600 hover:bg-blue-700 text-white' : 'bg-gray-100 text-gray-400'}`}
            >
              {isSaving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />} 
              {hasUnsavedChanges ? 'Save Changes *' : 'Saved'}
            </button>

            {canEdit && (
              <button onClick={() => setIsSubmitModalOpen(true)} className="flex items-center justify-center px-6 py-2 bg-yellow-500 hover:bg-yellow-600 text-white font-bold rounded-lg shadow-sm transition-all active:scale-95 shrink-0">
                {activeCourse.workflow_status === 'Returned' ? 'Resubmit Term Grades' : 'Submit Term Grades'}
              </button>
            )}
          </div>
        </div>

        {/* Matrix Table */}
        <div className="overflow-x-auto flex-1">
          <table className="w-full text-left border-collapse min-w-max">
            <thead className="bg-[#1b2533] text-white">
              <tr>
                <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider sticky left-0 z-20 bg-[#1b2533] border-r border-[#2d3a4d] min-w-[250px]">Student Name</th>
                {activities.map(activity => (
                  <th key={activity.activity_id} className="px-4 py-4 text-center border-r border-[#2d3a4d] group relative min-w-[160px] align-bottom">
                    <div className="flex flex-col items-center justify-end h-full">
                      <span className="text-[11px] font-bold uppercase tracking-widest mb-1 opacity-90 truncate max-w-full" title={activity.title}>{activity.title}</span>
                      <span className="text-[10px] font-medium opacity-60">({activity.max_score} pts)</span>
                    </div>
                    {canEdit && (
                      <button onClick={() => setModalState({ isOpen: true, type: 'editTask', data: activity })} className="absolute top-2 right-2 p-1.5 rounded bg-white/10 hover:bg-white/20 opacity-0 group-hover:opacity-100 transition-opacity" title="Edit Activity">
                        <Edit size={12} className="text-white" />
                      </button>
                    )}
                  </th>
                ))}
                <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-center min-w-[120px]">Term Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredStudents.length === 0 ? (
                <tr><td colSpan={activities.length + 2} className="py-16 text-center text-gray-500 font-medium">No students found.</td></tr>
              ) : (
                filteredStudents.map((student) => {
                  let totalEarned = 0, totalMax = 0;
                  activities.forEach(act => {
                    const numScore = parseFloat(gradesData[act.activity_id]?.[student.student_no]);
                    if (!isNaN(numScore)) totalEarned += numScore;
                    totalMax += act.max_score;
                  });
                  const termPercentage = totalMax > 0 ? ((totalEarned / totalMax) * 100).toFixed(2) : '0.00';
                  const isPassing = parseFloat(termPercentage) >= 75;

                  return (
                    <tr key={student.student_no} className="hover:bg-blue-50/20 transition-colors">
                      <td className="px-6 py-4 sticky left-0 z-10 bg-white border-r border-gray-100 group-hover:bg-blue-50/20 transition-colors">
                        <div className="font-bold text-sm text-gray-900">{student.last_name}, {student.first_name}</div>
                        <div className="text-[10px] text-gray-400 font-mono mt-0.5">{student.student_no}</div>
                      </td>
                      {activities.map(activity => (
                         <td key={activity.activity_id} className="px-4 py-3 text-center border-r border-gray-50">
                           <div className="flex items-center justify-center gap-1.5">
                             <input 
                               type="text" inputMode="numeric"
                               value={gradesData[activity.activity_id]?.[student.student_no] ?? ''}
                               onChange={(e) => handleMatrixGradeChange(activity.activity_id, student.student_no, e.target.value, activity.max_score)}
                               disabled={!canEdit}
                               className="w-12 text-center py-1 bg-transparent border-b-2 border-gray-200 focus:border-green-600 focus:bg-green-50 outline-none text-sm font-bold text-gray-800 transition-colors disabled:bg-gray-50 disabled:border-gray-100"
                               placeholder="-"
                             />
                             <span className="text-[10px] text-gray-400 font-medium">/ {activity.max_score}</span>
                           </div>
                         </td>
                      ))}
                      <td className="px-6 py-4 text-center bg-gray-50/50">
                        <span className={`text-base font-bold ${isPassing ? 'text-green-700' : 'text-red-600'}`}>{termPercentage}</span>
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