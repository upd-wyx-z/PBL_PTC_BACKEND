import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { 
  BookOpen, Search, ArrowLeft, Plus, Edit, Users, 
  X, Save, FileSpreadsheet, Calendar, ClipboardList, 
  GraduationCap, Download, Check, ChevronRight, Trash2, CheckCircle2
} from 'lucide-react';

// --- MOCK DATABASE DATA ---

const MOCK_COURSES = [
  { course_id: 1, code: 'ITE314', title: 'Web Systems and Technologies', year_level: '3rd Year', section: 'BSIT 3A', semester: '1st Semester', total_students: 35 },
  { course_id: 2, code: 'ITE315', title: 'Information Assurance and Security', year_level: '3rd Year', section: 'BSIT 3B', semester: '1st Semester', total_students: 40 },
  { course_id: 3, code: 'ITE101', title: 'Introduction to Computing', year_level: '1st Year', section: 'BSIT 1A', semester: '1st Semester', total_students: 45 },
  { course_id: 4, code: 'ITE401', title: 'Capstone Project 1', year_level: '4th Year', section: 'BSIT 4A', semester: '1st Semester', total_students: 25 },
];

const INITIAL_ACTIVITIES = [
  { activity_id: 1, course_id: 1, title: 'Quiz 1 - HTML Basics', type: 'Quiz', period: 'Midterm', max_score: 50, date: '2026-03-15' },
  { activity_id: 2, course_id: 1, title: 'Project - Portfolio', type: 'Project', period: 'Midterm', max_score: 100, date: '2026-03-20' },
  { activity_id: 3, course_id: 1, title: 'Midterm Exam', type: 'Exam', period: 'Midterm', max_score: 100, date: '2026-03-25' },
  { activity_id: 4, course_id: 1, title: 'Final Exam', type: 'Exam', period: 'Finals', max_score: 100, date: '2026-04-20' },
];

const MOCK_STUDENTS = [
  { student_id: '2024-001', last_name: 'Dela Cruz', first_name: 'Juan', mi: 'A.' },
  { student_id: '2024-002', last_name: 'Santos', first_name: 'Maria', mi: 'B.' },
  { student_id: '2024-003', last_name: 'Reyes', first_name: 'Mark', mi: 'C.' },
  { student_id: '2024-004', last_name: 'Garcia', first_name: 'Ana', mi: 'D.' },
];

// Mock existing grades (Mapping activity_id -> { student_id: score })
const MOCK_GRADES = {
  1: { '2024-001': 45, '2024-002': 48, '2024-003': 35, '2024-004': 42 },
  2: { '2024-001': 88, '2024-002': 95, '2024-003': 75, '2024-004': 90 },
  3: { '2024-001': 85, '2024-002': 92, '2024-003': 80, '2024-004': 88 },
  4: { '2024-001': 90, '2024-002': 94, '2024-003': 82, '2024-004': 89 },
};

export default function Grades({ user }) {
  // --- NAVIGATION STATE ---
  const [activeCourse, setActiveCourse] = useState(null); 
  
  // --- DATA STATES ---
  const [activities, setActivities] = useState(INITIAL_ACTIVITIES);
  const [gradesData, setGradesData] = useState(MOCK_GRADES);

  // --- SEARCH STATES ---
  const [courseSearch, setCourseSearch] = useState('');
  const [courseYearFilter, setCourseYearFilter] = useState('All Years');
  const [studentSearch, setStudentSearch] = useState('');

  // --- MODAL STATES ---
  const [modalState, setModalState] = useState({ isOpen: false, type: null, data: null });
  const [isSubmitModalOpen, setIsSubmitModalOpen] = useState(false);
  const [isCertified, setIsCertified] = useState(false);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [taskToDelete, setTaskToDelete] = useState(null);
  const [toastMessage, setToastMessage] = useState(null);

  const showToast = (text, type = 'success') => {
    setToastMessage({ text, type });
    setTimeout(() => setToastMessage(null), 4000);
  };

  // ==========================================
  // HANDLERS
  // ==========================================
  const handleOpenCourse = (course) => {
    setActiveCourse(course);
    setStudentSearch('');
  };

  const closeModals = () => {
    setModalState({ isOpen: false, type: null, data: null });
  };

  // --- Task Handlers ---
  const handleSaveTask = (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const newTaskData = {
      title: formData.get('title'),
      type: formData.get('type'),
      period: formData.get('period'),
      max_score: parseInt(formData.get('max_score'), 10),
      date: formData.get('date'),
      course_id: activeCourse.course_id
    };

    if (modalState.type === 'addTask') {
      setActivities([...activities, { ...newTaskData, activity_id: Date.now() }]);
    } else if (modalState.type === 'editTask') {
      setActivities(activities.map(a => a.activity_id === modalState.data.activity_id ? { ...a, ...newTaskData } : a));
    }
    
    closeModals();
  };

  // --- Submit Grades Handlers ---
  const confirmSubmitGrades = () => {
    showToast(`Success: Term grades for ${activeCourse.code} have been submitted to the Dean for approval!`);
    setIsSubmitModalOpen(false);
    setIsCertified(false);
  };

  // --- Matrix Grade Handlers ---
  const handleMatrixGradeChange = (activityId, studentId, value, maxScore) => {
    if (value === '') {
      setGradesData(prev => {
        const actGrades = prev[activityId] || {};
        return {
          ...prev,
          [activityId]: { ...actGrades, [studentId]: '' }
        };
      });
      return;
    }

    // Strip non-numeric characters
    let numericStr = value.replace(/[^0-9]/g, '');

    if (numericStr === '') return;

    // Prevent leading zeros unless it's just '0'
    numericStr = numericStr.replace(/^0+(?=\d)/, '');

    let numVal = parseInt(numericStr, 10);

    // Clamp to maxScore
    if (numVal > maxScore) {
      numVal = maxScore;
      numericStr = numVal.toString();
    }

    setGradesData(prev => {
      const actGrades = prev[activityId] || {};
      return {
        ...prev,
        [activityId]: { ...actGrades, [studentId]: numericStr }
      };
    });
  };

  // --- Export Matrix to Excel ---
  const handleExportExcel = () => {
    const courseActivities = activities.filter(a => a.course_id === activeCourse.course_id);
    
    // Generate an HTML table string for Excel
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
          <tr><th colspan="${courseActivities.length + 3}" style="font-size: 18px; text-align: left; background-color: #0e5c2b;">PTC Master Gradebook</th></tr>
          <tr><td class="header-cell" colspan="2">Course</td><td class="val-cell" colspan="${courseActivities.length + 1}">${activeCourse.code} - ${activeCourse.title}</td></tr>
          <tr><td class="header-cell" colspan="2">Section</td><td class="val-cell" colspan="${courseActivities.length + 1}">${activeCourse.section}</td></tr>
          <tr><td class="header-cell" colspan="2">Semester</td><td class="val-cell" colspan="${courseActivities.length + 1}">${activeCourse.semester}</td></tr>
          <tr><td colspan="${courseActivities.length + 3}"></td></tr>
          <tr>
            <th>Student ID</th>
            <th class="left">Student Name</th>
            ${courseActivities.map(act => `<th>${act.title} (Max: ${act.max_score})</th>`).join('')}
            <th>Term Total %</th>
          </tr>
          ${MOCK_STUDENTS.map(student => {
            let totalEarned = 0;
            let totalMax = 0;
            let rowScores = '';
            
            courseActivities.forEach(act => {
              const score = gradesData[act.activity_id]?.[student.student_id];
              const numScore = parseFloat(score);
              if (!isNaN(numScore)) {
                totalEarned += numScore;
              }
              totalMax += act.max_score;
              rowScores += `<td>${score !== undefined ? score : ''}</td>`;
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
    link.setAttribute("download", `${activeCourse.code}_${activeCourse.section}_Master_Gradebook.xls`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // ==========================================
  // VIEW 1: COURSE LIST
  // ==========================================
  if (!activeCourse) {
    const filteredCourses = MOCK_COURSES.filter(c => {
      const matchesSearch = c.code.toLowerCase().includes(courseSearch.toLowerCase()) || 
                            c.title.toLowerCase().includes(courseSearch.toLowerCase());
      const matchesYear = courseYearFilter === 'All Years' || c.year_level === courseYearFilter;
      return matchesSearch && matchesYear;
    });

    return (
      <div className="space-y-6 max-w-[1600px] mx-auto animate-in fade-in duration-300">
        <div className="bg-white p-6 sm:p-8 rounded-3xl shadow-sm border border-gray-100 flex flex-col sm:flex-row justify-between sm:items-center gap-6 relative overflow-hidden">
          <div className="absolute right-0 top-0 w-64 h-64 bg-green-50 rounded-full mix-blend-multiply filter blur-3xl opacity-50 -translate-y-1/2 translate-x-1/4 z-0"></div>
          <div className="relative z-10">
            <h1 className="text-3xl font-bold text-gray-900 tracking-tight mb-1 flex items-center">
              Grading System
            </h1>
            <p className="text-sm text-gray-500 font-medium">Select a course to manage activities and encode grades.</p>
          </div>
        </div>

        {/* Toolbar */}
        <div className="flex flex-col sm:flex-row gap-4 bg-white p-4 rounded-2xl border border-gray-100 shadow-sm">
          <div className="flex-1 relative">
            <Search className="absolute left-4 top-3.5 text-gray-400" size={18} />
            <input 
              type="text" 
              placeholder="Search course code or title..." 
              value={courseSearch}
              onChange={(e) => setCourseSearch(e.target.value)}
              className="w-full max-w-md pl-11 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-green-600 outline-none text-sm font-medium"
            />
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">Year Level:</span>
            <select 
              value={courseYearFilter}
              onChange={(e) => setCourseYearFilter(e.target.value)}
              className="py-3 px-4 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-green-600 outline-none text-sm font-bold text-gray-700 shadow-sm cursor-pointer"
            >
              <option value="All Years">All Years</option>
              <option value="1st Year">1st Year</option>
              <option value="2nd Year">2nd Year</option>
              <option value="3rd Year">3rd Year</option>
              <option value="4th Year">4th Year</option>
            </select>
          </div>
        </div>

        {/* Course Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {filteredCourses.map(course => (
            <div key={course.course_id} className="bg-white rounded-3xl border border-gray-100 shadow-xl overflow-hidden hover:shadow-2xl transition-all group flex flex-col">
              <div className="h-3 bg-[#0e5c2b] w-full"></div>
              <div className="p-8 flex-1 flex flex-col">
                <div className="flex justify-between items-start mb-4">
                  <span className="px-3 py-1 bg-green-50 text-green-700 text-[10px] font-black uppercase tracking-widest rounded-lg border border-green-100">
                    {course.code}
                  </span>
                  <span className="px-3 py-1 bg-gray-100 text-gray-600 text-[10px] font-black uppercase tracking-widest rounded-lg">
                    {course.semester}
                  </span>
                </div>
                <h3 className="text-xl font-bold text-gray-900 leading-tight mb-2 group-hover:text-green-700 transition-colors">
                  {course.title}
                </h3>
                <div className="flex gap-4 mt-auto pt-6 border-t border-gray-50">
                  <div className="flex items-center text-sm font-medium text-gray-500">
                    <Users size={16} className="mr-2 text-gray-400" /> {course.section}
                  </div>
                  <div className="flex items-center text-sm font-medium text-gray-500">
                    <GraduationCap size={16} className="mr-2 text-gray-400" /> {course.year_level}
                  </div>
                </div>
              </div>
              <div className="p-4 bg-gray-50 border-t border-gray-100">
                <button 
                  onClick={() => handleOpenCourse(course)}
                  className="w-full py-3 bg-white border border-gray-200 hover:border-green-600 hover:bg-green-50 text-gray-800 font-bold rounded-xl transition-all flex justify-center items-center gap-2"
                >
                  <BookOpen size={18} className="text-green-700" /> Open Gradebook
                </button>
              </div>
            </div>
          ))}
          {filteredCourses.length === 0 && (
            <div className="col-span-full py-20 text-center text-gray-500 font-medium">
              No courses found matching your criteria.
            </div>
          )}
        </div>
      </div>
    );
  }

  // ==========================================
  // VIEW 2: COURSE MATRIX / GRADEBOOK
  // ==========================================
  const courseActivities = activities.filter(a => a.course_id === activeCourse.course_id);
  const filteredStudents = MOCK_STUDENTS.filter(s => 
    s.last_name.toLowerCase().includes(studentSearch.toLowerCase()) ||
    s.student_id.toLowerCase().includes(studentSearch.toLowerCase())
  );

  // Get localized today's date for minimum task date
  const todayDate = new Date();
  const minDateStr = new Date(todayDate.getTime() - (todayDate.getTimezoneOffset() * 60000)).toISOString().split('T')[0];

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto animate-in fade-in duration-300 relative">

      {/* --- MODALS PORTAL --- */}
      {/* 1. Add/Edit Task Modal */}
      {modalState.isOpen && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in" onClick={closeModals}>
          
          {(modalState.type === 'addTask' || modalState.type === 'editTask') && (
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md p-8 animate-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
              <div className="flex justify-between items-center mb-6 border-b border-gray-50 pb-4">
                <h2 className="text-sm font-bold text-gray-800 uppercase tracking-widest flex items-center">
                  <ClipboardList size={18} className="mr-2 text-green-700" /> 
                  {modalState.type === 'addTask' ? 'Add New Activity' : 'Edit Activity Details'}
                </h2>
                <button onClick={closeModals} className="p-2 border border-gray-200 rounded-full hover:bg-gray-50 text-gray-600 transition-all active:scale-90">
                  <X size={16} strokeWidth={2.5} />
                </button>
              </div>

              <form onSubmit={handleSaveTask} className="space-y-5">
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest">Activity Title</label>
                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Max 30 chars</span>
                  </div>
                  <input 
                    name="title" type="text" required maxLength={30} defaultValue={modalState.data?.title || ''}
                    onInput={(e) => { if(e.target.value.length > 30) e.target.value = e.target.value.slice(0, 30); }}
                    className="w-full p-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-green-600 outline-none text-sm font-medium"
                    placeholder="e.g. Midterm Lab Activity 1"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Activity Type</label>
                    <select name="type" defaultValue={modalState.data?.type || 'Quiz'} className="w-full p-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-green-600 outline-none text-sm font-medium">
                      <option value="Quiz">Quiz</option>
                      <option value="Exam">Exam</option>
                      <option value="Project">Project</option>
                      <option value="Assignment">Assignment</option>
                      <option value="Recitation">Recitation</option>
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
                    <input 
                      name="max_score" type="number" required min="1" max="200" defaultValue={modalState.data?.max_score || 100}
                      onInput={(e) => {
                        let val = parseInt(e.target.value, 10);
                        if (val > 200) e.target.value = 200;
                        if (val < 0) e.target.value = 0;
                        if (e.target.value.length > 1) e.target.value = e.target.value.replace(/^0+(?=\d)/, '');
                      }}
                      className="w-full p-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-green-600 outline-none text-sm font-medium"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Date</label>
                    <input 
                      name="date" type="date" required min={minDateStr} defaultValue={modalState.data?.date || minDateStr}
                      className="w-full p-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-green-600 outline-none text-sm font-medium"
                    />
                  </div>
                </div>
                
                <div className="pt-6 border-t border-gray-50 flex justify-between gap-3">
                  {modalState.type === 'editTask' ? (
                     <button 
                       type="button" 
                       onClick={() => {
                         setTaskToDelete(modalState.data.activity_id);
                         setIsDeleteConfirmOpen(true);
                       }} 
                       className="px-4 py-3.5 text-red-600 bg-red-50 hover:bg-red-100 font-bold rounded-xl shadow-sm transition-all active:scale-95 flex items-center"
                     >
                       <Trash2 size={18} className="mr-2" /> Delete
                     </button>
                  ) : <div></div>}
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

      {/* Toast Notification */}
      {toastMessage && createPortal(
        <div className={`fixed top-8 right-8 z-[10000] p-4 rounded-2xl shadow-xl flex items-center animate-in slide-in-from-top-4 border ${toastMessage.type === 'success' ? 'bg-green-50 border-green-200 text-green-800' : 'bg-red-50 border-red-200 text-red-800'}`}>
          <CheckCircle2 className="mr-3 shrink-0" size={20}/>
          <p className="text-sm font-bold">{toastMessage.text}</p>
        </div>,
        document.body
      )}

      {/* Delete Confirmation Modal */}
      {isDeleteConfirmOpen && createPortal(
        <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in" onClick={() => setIsDeleteConfirmOpen(false)}>
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm p-8 text-center animate-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
            <div className="w-16 h-16 bg-red-50 text-red-600 rounded-full flex items-center justify-center mx-auto mb-6 border-4 border-white shadow-sm">
              <Trash2 size={32} />
            </div>
            <h3 className="text-xl font-bold text-gray-900 mb-2">Delete Activity?</h3>
            <p className="text-sm text-gray-500 mb-8 leading-relaxed">
              Are you sure you want to permanently delete this activity? All associated student grades will be lost.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setIsDeleteConfirmOpen(false)}
                className="flex-1 py-3.5 px-4 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-xl transition-all"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  setActivities(activities.filter(a => a.activity_id !== taskToDelete));
                  const newGradesData = { ...gradesData };
                  delete newGradesData[taskToDelete];
                  setGradesData(newGradesData);
                  setIsDeleteConfirmOpen(false);
                  closeModals();
                  showToast('Activity deleted successfully.');
                }}
                className="flex-1 py-3.5 px-4 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl shadow-md transition-all active:scale-95"
              >
                Yes, Delete
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* 2. Submit Term Grades Confirmation Modal */}
      {isSubmitModalOpen && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in" onClick={() => { setIsSubmitModalOpen(false); setIsCertified(false); }}>
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md p-8 animate-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
            <div className="flex flex-col items-center text-center mb-6">
              <div className="w-16 h-16 bg-yellow-50 text-yellow-600 rounded-full flex items-center justify-center mb-4 border-4 border-white shadow-sm">
                <CheckCircle2 size={32} />
              </div>
              <h2 className="text-xl font-bold text-gray-900">Submit Term Grades</h2>
              <p className="text-sm text-gray-500 mt-2">
                You are about to submit the final term grades for <span className="font-bold text-gray-700">{activeCourse.code} - {activeCourse.section}</span>. This action will forward the grades to the Dean for approval.
              </p>
            </div>

            <div className="bg-gray-50 p-4 rounded-xl border border-gray-200 mb-8 cursor-pointer hover:bg-gray-100 transition-colors" onClick={() => setIsCertified(!isCertified)}>
              <label className="flex items-start gap-3 cursor-pointer">
                <input 
                  type="checkbox" 
                  className="mt-0.5 w-5 h-5 text-green-600 rounded border-gray-300 focus:ring-green-600 cursor-pointer shadow-sm" 
                  checked={isCertified} 
                  onChange={(e) => setIsCertified(e.target.checked)} 
                  onClick={e => e.stopPropagation()}
                />
                <span className="text-sm font-bold text-gray-800 leading-tight">
                  I certify the information is certified true and correct.
                </span>
              </label>
            </div>

            <div className="flex gap-3">
              <button 
                onClick={() => { setIsSubmitModalOpen(false); setIsCertified(false); }} 
                className="flex-1 py-3.5 px-4 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-xl transition-all"
              >
                Cancel
              </button>
              <button 
                disabled={!isCertified} 
                onClick={confirmSubmitGrades} 
                className="flex-1 py-3.5 px-4 bg-yellow-500 hover:bg-yellow-600 disabled:bg-gray-200 disabled:text-gray-400 text-white font-bold rounded-xl shadow-md transition-all active:scale-95 flex justify-center items-center"
              >
                Submit Grades
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}


      {/* --- COURSE HEADER --- */}
      <div className="flex items-center gap-4">
        <button 
          onClick={() => setActiveCourse(null)}
          className="p-2.5 bg-white shadow-sm hover:bg-gray-50 text-gray-600 hover:text-gray-900 rounded-xl transition-all border border-gray-200"
          title="Back to Courses"
        >
          <ArrowLeft size={20} />
        </button>
        <div>
          <div className="flex items-center gap-3 mb-0.5">
            <span className="text-xs font-bold text-gray-500 uppercase tracking-widest">{activeCourse.code} • {activeCourse.section}</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight ">{activeCourse.title}</h1>
        </div>
      </div>

      {/* --- WORKFLOW STEPPER CARD (Based on UI Image) --- */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 flex flex-col gap-6">
        <div>
          <h2 className="text-lg font-bold text-gray-900">Term/Semester Workflow</h2>
          <p className="text-sm text-gray-500 mt-1">Individual tasks roll up into the final term grade. Requires multi-level approval at the end of the term.</p>
        </div>
        
        {/* Stepper Logic */}
        <div className="relative w-full max-w-4xl mx-auto mb-2">
          {/* Connecting Line */}
          <div className="absolute top-4 left-[12.5%] right-[12.5%] h-0.5 bg-gray-200 z-0"></div>
          
          <div className="flex justify-between text-center relative z-10">
            {/* Step 1 */}
            <div className="flex flex-col items-center w-1/4">
              <div className="w-8 h-8 rounded-full bg-yellow-400 text-yellow-900 font-bold flex items-center justify-center mb-2 shadow-sm border-2 border-white ring-2 ring-yellow-100 z-10 relative">1</div>
              <span className="text-[10px] font-black uppercase tracking-widest text-gray-800">Faculty</span>
              <span className="text-[9px] font-bold bg-yellow-100 text-yellow-800 px-2 py-0.5 rounded mt-1">Drafting</span>
            </div>
            
             {/* Step 2 */}
             <div className="flex flex-col items-center w-1/4">
              <div className="w-8 h-8 rounded-full bg-gray-100 text-gray-400 font-bold flex items-center justify-center mb-2 border-2 border-white z-10 relative">2</div>
              <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">Dean</span>
              <span className="text-[9px] font-bold bg-gray-100 text-gray-400 px-2 py-0.5 rounded mt-1">Waiting</span>
            </div>

             {/* Step 3 */}
             <div className="flex flex-col items-center w-1/4">
              <div className="w-8 h-8 rounded-full bg-gray-100 text-gray-400 font-bold flex items-center justify-center mb-2 border-2 border-white z-10 relative">3</div>
              <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">VPAA</span>
              <span className="text-[9px] font-bold bg-gray-100 text-gray-400 px-2 py-0.5 rounded mt-1">Waiting</span>
            </div>

             {/* Step 4 */}
             <div className="flex flex-col items-center w-1/4">
              <div className="w-8 h-8 rounded-full bg-gray-100 text-gray-400 font-bold flex items-center justify-center mb-2 border-2 border-white z-10 relative">4</div>
              <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">Registrar</span>
              <span className="text-[9px] font-bold bg-gray-100 text-gray-400 px-2 py-0.5 rounded mt-1">Waiting</span>
            </div>
          </div>
        </div>
      </div>

      {/* --- MASTER GRADEBOOK MATRIX --- */}
      <div className="bg-white rounded-2xl shadow-xl border border-gray-200 overflow-hidden flex flex-col min-h-[500px]">
        
        {/* Toolbar */}
        <div className="p-4 border-b border-gray-200 bg-white flex flex-row items-center gap-3 overflow-x-auto custom-scrollbar">
          <div className="px-4 py-2 border border-gray-200 rounded-lg text-sm font-bold text-gray-700 bg-gray-50 shrink-0">
            AY 2025-2026 | {activeCourse.semester}
          </div>
          
          <div className="relative shrink min-w-[120px] flex-1 max-w-sm">
            <Search className="absolute left-3.5 top-2.5 text-gray-400" size={16} />
            <input 
              type="text" 
              placeholder="Search student..." 
              value={studentSearch}
              onChange={(e) => setStudentSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-green-600 outline-none text-sm font-medium transition-shadow bg-gray-50 focus:bg-white"
            />
          </div>
          
          <div className="flex items-center gap-3 shrink-0 ml-auto">
            <button 
              onClick={handleExportExcel}
              className="flex items-center justify-center gap-2 px-4 py-2 bg-white border border-gray-200 text-gray-700 font-bold rounded-lg text-sm hover:bg-gray-50 transition-all shadow-sm shrink-0"
            >
              <Download size={15} /> Export CSV
            </button>
            <button 
              onClick={() => setModalState({ isOpen: true, type: 'addTask', data: null })}
              className="flex items-center justify-center gap-2 px-4 py-2 bg-[#0e5c2b] hover:bg-[#0a4720] text-white font-bold rounded-lg text-sm transition-all shadow-md active:scale-95 shrink-0"
            >
              <Plus size={16} /> Add Task
            </button>
            <button 
              onClick={() => setIsSubmitModalOpen(true)}
              className="flex items-center justify-center px-6 py-2 bg-yellow-500 hover:bg-yellow-600 text-white font-bold rounded-lg shadow-sm transition-all active:scale-95 shrink-0"
            >
              Submit Term Grades
            </button>
          </div>
        </div>

        {/* Matrix Table */}
        <div className="overflow-x-auto flex-1">
          <table className="w-full text-left border-collapse min-w-max">
            <thead className="bg-[#1b2533] text-white">
              <tr>
                <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider sticky left-0 z-20 bg-[#1b2533] border-r border-[#2d3a4d] min-w-[250px]">
                  Student Name
                </th>
                
                {/* Dynamically render activity columns */}
                {courseActivities.map(activity => (
                  <th key={activity.activity_id} className="px-4 py-4 text-center border-r border-[#2d3a4d] group relative min-w-[160px] align-bottom">
                    <div className="flex flex-col items-center justify-end h-full">
                      <span className="text-[11px] font-bold uppercase tracking-widest mb-1 opacity-90 truncate max-w-full" title={activity.title}>
                        {activity.title}
                      </span>
                      <span className="text-[10px] font-medium opacity-60">({activity.max_score} pts)</span>
                    </div>
                    {/* Hover Edit Action */}
                    <button 
                      onClick={() => setModalState({ isOpen: true, type: 'editTask', data: activity })}
                      className="absolute top-2 right-2 p-1.5 rounded bg-white/10 hover:bg-white/20 opacity-0 group-hover:opacity-100 transition-opacity"
                      title="Edit Activity"
                    >
                      <Edit size={12} className="text-white" />
                    </button>
                  </th>
                ))}
                
                <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-center min-w-[120px]">
                  Term Total
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredStudents.length === 0 ? (
                <tr>
                  <td colSpan={courseActivities.length + 2} className="py-16 text-center text-gray-500 font-medium">
                    No students found.
                  </td>
                </tr>
              ) : (
                filteredStudents.map((student) => {
                  
                  // Compute total dynamically for this row
                  let totalEarned = 0;
                  let totalMax = 0;
                  
                  courseActivities.forEach(act => {
                    const scoreStr = gradesData[act.activity_id]?.[student.student_id];
                    const numScore = parseFloat(scoreStr);
                    if (!isNaN(numScore)) {
                      totalEarned += numScore;
                    }
                    totalMax += act.max_score;
                  });

                  const termPercentage = totalMax > 0 ? ((totalEarned / totalMax) * 100).toFixed(2) : '0.00';
                  const isPassing = parseFloat(termPercentage) >= 75;

                  return (
                    <tr key={student.student_id} className="hover:bg-blue-50/20 transition-colors">
                      <td className="px-6 py-4 sticky left-0 z-10 bg-white border-r border-gray-100 group-hover:bg-blue-50/20 transition-colors">
                        <div className="font-bold text-sm text-gray-900">{student.last_name}, {student.first_name}</div>
                        <div className="text-[10px] text-gray-400 font-mono mt-0.5">{student.student_id}</div>
                      </td>
                      
                      {courseActivities.map(activity => {
                         const currentScore = gradesData[activity.activity_id]?.[student.student_id] ?? '';
                         return (
                           <td key={activity.activity_id} className="px-4 py-3 text-center border-r border-gray-50">
                             <div className="flex items-center justify-center gap-1.5">
                               <input 
                                 type="text" 
                                 inputMode="numeric"
                                 value={currentScore}
                                 onChange={(e) => handleMatrixGradeChange(activity.activity_id, student.student_id, e.target.value, activity.max_score)}
                                 className="w-12 text-center py-1 bg-transparent border-b-2 border-gray-200 focus:border-green-600 focus:bg-green-50 outline-none text-sm font-bold text-gray-800 transition-colors"
                                 placeholder="-"
                               />
                               <span className="text-[10px] text-gray-400 font-medium">/ {activity.max_score}</span>
                             </div>
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
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
}