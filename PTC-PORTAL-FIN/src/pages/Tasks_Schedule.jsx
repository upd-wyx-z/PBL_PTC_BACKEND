import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  Calendar as CalendarIcon, CheckSquare,
  Bell, Activity, Pin, MoreHorizontal, X, MapPin, Flag, CalendarDays,
  CheckCircle2, Circle, AlertTriangle, Plus, Filter, MoreVertical, Trash2, Save, AlignLeft,
  Clock, ChevronRight, Edit, Megaphone, Loader2
} from 'lucide-react';

// ============================================================
//  Tasks_Schedule.jsx — Connected to Backend
//  API calls:
//    Tasks:         GET/POST/PUT/PATCH/DELETE /api/tasks
//    Events:        GET/POST/PUT/DELETE       /api/tasks/events
//    Announcements: GET/POST/PUT/DELETE       /api/tasks/announcements
// ============================================================

const API_BASE = 'http://localhost:3000/api';

export default function TasksSchedule({ user, tasks, setTasks, eventsList, setEventsList, announcements, setAnnouncements, isAdmin }) {
  const [filters, setFilters] = useState({ status: 'pending', priority: 'all', type: 'all' });
  const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const [taskModalState, setTaskModalState]               = useState({ isOpen: false, mode: null, data: null });
  const [eventModalState, setEventModalState]             = useState({ isOpen: false, mode: null, data: null });
  const [announcementModalState, setAnnouncementModalState] = useState({ isOpen: false, mode: null, data: null });
  const [toast, setToast] = useState({ show: false, message: '', type: 'success' });

  // ── Toast helper ─────────────────────────────────────────
  const showToast = (message, type = 'success') => {
    setToast({ show: true, message, type });
    setTimeout(() => setToast({ show: false, message: '', type: 'success' }), 3500);
  };

  const TASK_TYPES   = ['Grade Sheets', 'Uploads', 'Evaluation', 'Meeting', 'Administrative'];
  const DEPT_OPTIONS = ['All Departments', 'IICT', 'CBM', 'Administration'];
  const ANN_TYPES    = ['info', 'deadline', 'alert'];

  // ── Fetch all data on mount ───────────────────────────────
  useEffect(() => {
    fetchAllData();
  }, []);

  const fetchAllData = async () => {
    setIsLoading(true);
    try {
      const [tasksRes, eventsRes, announcementsRes] = await Promise.all([
        fetch(`${API_BASE}/tasks`,               { credentials: 'include' }),
        fetch(`${API_BASE}/tasks/events`,         { credentials: 'include' }),
        fetch(`${API_BASE}/tasks/announcements`,  { credentials: 'include' }),
      ]);
      if (tasksRes.ok)         setTasks(await tasksRes.json());
      if (eventsRes.ok)        setEventsList(await eventsRes.json());
      if (announcementsRes.ok) setAnnouncements(await announcementsRes.json());
    } catch (err) {
      setError('Failed to load data. Please refresh the page.');
    } finally {
      setIsLoading(false);
    }
  };

  // ════════════════════════════════════════════════════════════
  //  TASK HANDLERS
  // ════════════════════════════════════════════════════════════

  // Toggle task status — PATCH /api/tasks/:task_id/toggle
  const toggleTaskStatus = async (e, taskId) => {
    e.stopPropagation();
    // Optimistic UI update first
    setTasks(prev => prev.map(t =>
      t.task_id === taskId
        ? { ...t, status: t.status === 'pending' ? 'completed' : 'pending' }
        : t
    ));
    try {
      await fetch(`${API_BASE}/tasks/${taskId}/toggle`, {
        method:      'PATCH',
        credentials: 'include',
      });
    } catch (err) {
      // Revert on failure
      setTasks(prev => prev.map(t =>
        t.task_id === taskId
          ? { ...t, status: t.status === 'pending' ? 'completed' : 'pending' }
          : t
      ));
    }
  };

  const openNewTaskModal = () => setTaskModalState({
    isOpen: true, mode: 'create',
    data: { title: '', type: 'Grade Sheets', description: '', priority: 'normal', status: 'pending', due_date: new Date().toISOString().slice(0, 16) }
  });

  const openEditTaskModal  = (task) => setTaskModalState({ isOpen: true, mode: 'edit', data: { ...task } });
  const closeTaskModal     = () => setTaskModalState({ isOpen: false, mode: null, data: null });
  const handleTaskFormChange = (field, value) => setTaskModalState(prev => ({ ...prev, data: { ...prev.data, [field]: value } }));

  // Save task — POST (create) or PUT (edit)
  const saveTask = async (e) => {
    e.preventDefault();
    const { mode, data } = taskModalState;
    if (!data.title || !data.due_date || !data.description) return;

    try {
      if (mode === 'create') {
        const res = await fetch(`${API_BASE}/tasks`, {
          method:      'POST',
          headers:     { 'Content-Type': 'application/json' },
          credentials: 'include',
          body:        JSON.stringify({
            title:       data.title,
            type:        data.type,
            description: data.description,
            priority:    data.priority,
            status:      data.status,
            due_date:    data.due_date,
          }),
        });
        if (res.ok) {
          const result = await res.json();
          setTasks(prev => [...prev, result.task]);
        }
      } else if (mode === 'edit') {
        const res = await fetch(`${API_BASE}/tasks/${data.task_id}`, {
          method:      'PUT',
          headers:     { 'Content-Type': 'application/json' },
          credentials: 'include',
          body:        JSON.stringify({
            title:       data.title,
            type:        data.type,
            description: data.description,
            priority:    data.priority,
            status:      data.status,
            due_date:    data.due_date,
          }),
        });
        if (res.ok) {
          const result = await res.json();
          setTasks(prev => prev.map(t => t.task_id === data.task_id ? result.task : t));
        }
      }
      closeTaskModal();
      showToast(mode === 'create' ? 'Task created successfully!' : 'Task updated successfully!');
    } catch (err) {
      showToast('Failed to save task. Please try again.', 'error');
    }
  };

  // Delete task — DELETE /api/tasks/:task_id
  const deleteTask = async (taskId) => {
    if (!window.confirm('Are you sure you want to delete this task?')) return;
    try {
      const res = await fetch(`${API_BASE}/tasks/${taskId}`, {
        method:      'DELETE',
        credentials: 'include',
      });
      if (res.ok) {
        setTasks(prev => prev.filter(t => t.task_id !== taskId));
        closeTaskModal();
        showToast('Task has been successfully deleted!');
      }
    } catch (err) {
      showToast('❌ Failed to delete task. Please try again.', 'error');
    }
  };

  // ════════════════════════════════════════════════════════════
  //  EVENT HANDLERS
  // ════════════════════════════════════════════════════════════

  const openNewEventModal = () => setEventModalState({
    isOpen: true, mode: 'create',
    data: { title: '', event_type: 'meeting', location: '', start_datetime: new Date().toISOString().slice(0, 16), is_all_day: false, color: 'orange' }
  });

  const openEditEventModal  = (ev) => setEventModalState({ isOpen: true, mode: 'edit', data: { ...ev } });
  const closeEventModal     = () => setEventModalState({ isOpen: false, mode: null, data: null });

  const handleEventFormChange = (field, value) => {
    setEventModalState(prev => {
      const updatedData = { ...prev.data, [field]: value };
      if (field === 'event_type') {
        if (value === 'deadline') updatedData.color = 'red';
        else if (value === 'exam') updatedData.color = 'blue';
        else updatedData.color = 'orange';
      }
      return { ...prev, data: updatedData };
    });
  };

  // Save event — POST (create) or PUT (edit)
  const saveEvent = async (e) => {
    e.preventDefault();
    const { mode, data } = eventModalState;
    if (!data.title || !data.start_datetime || !data.location) return;

    try {
      if (mode === 'create') {
        const res = await fetch(`${API_BASE}/tasks/events`, {
          method:      'POST',
          headers:     { 'Content-Type': 'application/json' },
          credentials: 'include',
          body:        JSON.stringify(data),
        });
        if (res.ok) {
          const result = await res.json();
          setEventsList(prev => [...prev, result.event]);
        }
      } else if (mode === 'edit') {
        const res = await fetch(`${API_BASE}/tasks/events/${data.event_id}`, {
          method:      'PUT',
          headers:     { 'Content-Type': 'application/json' },
          credentials: 'include',
          body:        JSON.stringify(data),
        });
        if (res.ok) {
          const result = await res.json();
          setEventsList(prev => prev.map(ev => ev.event_id === data.event_id ? result.event : ev));
        }
      }
      closeEventModal();
      showToast(mode === 'create' ? 'Schedule added successfully!' : 'Schedule updated successfully!');
    } catch (err) {
      showToast('Failed to save schedule. Please try again.', 'error');
    }
  };

  // Delete event — DELETE /api/tasks/events/:event_id
  const deleteEvent = async (eventId) => {
    if (!window.confirm('Are you sure you want to delete this event?')) return;
    try {
      const res = await fetch(`${API_BASE}/tasks/events/${eventId}`, {
        method:      'DELETE',
        credentials: 'include',
      });
      if (res.ok) {
        setEventsList(prev => prev.filter(ev => ev.event_id !== eventId));
        closeEventModal();
        showToast('Schedule has been successfully deleted!');
      }
    } catch (err) {
      showToast('❌ Failed to delete schedule. Please try again.', 'error');
    }
  };

  // ════════════════════════════════════════════════════════════
  //  ANNOUNCEMENT HANDLERS (Admin only)
  // ════════════════════════════════════════════════════════════

  const openNewAnnouncementModal = () => setAnnouncementModalState({
    isOpen: true, mode: 'create',
    data: {
      title:       '',
      body:        '',
      type:        'info',
      is_pinned:   false,
      dept_name:   'All Departments',
      posted_by:   user?.first_name ? `${user.first_name} ${user.last_name}` : 'Admin',
      published_at: new Date().toISOString()
    }
  });

  const openEditAnnouncementModal  = (ann) => setAnnouncementModalState({ isOpen: true, mode: 'edit', data: { ...ann } });
  const closeAnnouncementModal     = () => setAnnouncementModalState({ isOpen: false, mode: null, data: null });
  const handleAnnouncementFormChange = (field, value) => setAnnouncementModalState(prev => ({ ...prev, data: { ...prev.data, [field]: value } }));

  // Save announcement — POST (create) or PUT (edit)
  const saveAnnouncement = async (e) => {
    e.preventDefault();
    const { mode, data } = announcementModalState;
    if (!data.title || !data.body) return;

    try {
      if (mode === 'create') {
        const res = await fetch(`${API_BASE}/tasks/announcements`, {
          method:      'POST',
          headers:     { 'Content-Type': 'application/json' },
          credentials: 'include',
          body:        JSON.stringify(data),
        });
        if (res.ok) {
          const result = await res.json();
          setAnnouncements(prev => [result.announcement, ...prev]);
        }
      } else if (mode === 'edit') {
        const res = await fetch(`${API_BASE}/tasks/announcements/${data.announcement_id}`, {
          method:      'PUT',
          headers:     { 'Content-Type': 'application/json' },
          credentials: 'include',
          body:        JSON.stringify(data),
        });
        if (res.ok) {
          const result = await res.json();
          setAnnouncements(prev => prev.map(a => a.announcement_id === data.announcement_id ? result.announcement : a));
        }
      }
      closeAnnouncementModal();
    } catch (err) {
      setError('Failed to save announcement. Please try again.');
    }
  };

  // Delete announcement — DELETE /api/tasks/announcements/:announcement_id
  const deleteAnnouncement = async (announcementId) => {
    if (!window.confirm('Are you sure you want to delete this announcement?')) return;
    try {
      const res = await fetch(`${API_BASE}/tasks/announcements/${announcementId}`, {
        method:      'DELETE',
        credentials: 'include',
      });
      if (res.ok) {
        setAnnouncements(prev => prev.filter(a => a.announcement_id !== announcementId));
        closeAnnouncementModal();
      }
    } catch (err) {
      setError('Failed to delete announcement. Please try again.');
    }
  };

  // ── Filter tasks locally (no API call needed) ─────────────
  const filteredTasks = tasks.filter(task => {
    if (filters.status !== 'all' && task.status !== filters.status) return false;
    if (filters.priority !== 'all' && task.priority !== filters.priority) return false;
    if (filters.type !== 'all' && task.type !== filters.type) return false;
    return true;
  });

  // ── Group events by date for the schedule view ────────────
  const groupedEvents = eventsList.reduce((acc, ev) => {
    const dateKey = new Date(ev.start_datetime).toLocaleDateString('en-GB', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    if (!acc[dateKey]) acc[dateKey] = [];
    acc[dateKey].push(ev);
    return acc;
  }, {});

  // ── Loading state ─────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="animate-spin text-green-600 mr-3" size={28} />
        <p className="text-gray-500 font-medium">Loading tasks & schedule...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-300 relative">

      {/* Error Toast */}
      {error && (
        <div className="fixed top-6 right-6 bg-red-50 border-l-4 border-red-500 p-4 rounded-xl shadow-2xl z-[100] flex items-center">
          <X className="text-red-600 mr-3 cursor-pointer" size={18} onClick={() => setError('')} />
          <p className="text-sm text-red-800 font-bold">{error}</p>
        </div>
      )}

      {/* Success/Error Toast Notification */}
      {toast.show && (
        <div className={`fixed top-6 right-6 z-[100] flex items-center gap-3 px-5 py-4 rounded-2xl shadow-2xl border animate-in fade-in slide-in-from-top-4 duration-300 ${
          toast.type === 'error'
            ? 'bg-red-50 border-red-200 text-red-800'
            : 'bg-green-50 border-green-200 text-green-800'
        }`}>
          <CheckCircle2 size={20} className={toast.type === 'error' ? 'text-red-500' : 'text-green-600'} />
          <p className="text-sm font-bold">{toast.message}</p>
          <button onClick={() => setToast({ show: false, message: '', type: 'success' })}
            className="ml-2 text-gray-400 hover:text-gray-600">
            <X size={16} />
          </button>
        </div>
      )}

      {/* ── Page Header ─────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Tasks & Schedule</h1>
          <p className="text-sm text-gray-500 mt-1 font-medium">Manage your tasks, events, and announcements.</p>
        </div>
        <div className="flex gap-3">
          <button onClick={openNewEventModal} className="px-4 py-2.5 bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 font-bold rounded-xl text-sm transition-all shadow-sm flex items-center active:scale-95">
            <CalendarIcon size={15} className="mr-1.5 text-green-700" /> Add Event
          </button>
          <button onClick={openNewTaskModal} className="px-4 py-2.5 bg-green-700 hover:bg-green-800 text-white font-bold rounded-xl text-sm transition-all shadow-md flex items-center active:scale-95">
            <Plus size={15} className="mr-1.5" /> New Task
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

        {/* ── SCHEDULE & ANNOUNCEMENTS COLUMN ─────────────── */}
        <div className="lg:col-span-7 xl:col-span-8 space-y-6">

          {/* SCHEDULE */}
          <div className="bg-white rounded-3xl shadow-xl border border-gray-100 p-8 h-[550px] flex flex-col">
            <div className="flex justify-between items-center mb-8 border-b border-gray-50 pb-4 shrink-0">
              <div className="flex items-center">
                <div className="bg-green-100 p-2.5 rounded-xl mr-4"><CalendarIcon className="text-green-700" size={24} /></div>
                <h2 className="text-xl font-bold text-gray-800 tracking-tight">Upcoming Schedule</h2>
              </div>

            </div>
            <div className="space-y-6 flex-1 overflow-y-auto pr-2">
              {Object.keys(groupedEvents).length === 0 ? (
                <div className="text-center py-10 text-gray-400 font-bold">No upcoming events. Add one!</div>
              ) : (
                Object.entries(groupedEvents).map(([dateLabel, events]) => (
                  <div key={dateLabel}>
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-3">{dateLabel}</p>
                    <div className="space-y-3">
                      {events.map((ev, idx) => (
                        <div key={idx} className="flex items-stretch gap-3 cursor-pointer" onClick={() => openEditEventModal(ev)}>
                          <div className={`w-1 rounded-full shrink-0 ${ev.color === 'red' ? 'bg-red-500' : ev.color === 'orange' ? 'bg-yellow-500' : 'bg-blue-500'}`}></div>
                          <div className="bg-gray-50/50 border border-gray-100 rounded-2xl p-5 hover:shadow-md hover:bg-white transition-all hover:-translate-y-0.5 flex-1">
                            <div className="flex justify-between items-start mb-2">
                              <h4 className="text-base font-bold text-gray-900 leading-tight">{ev.title}</h4>
                              <span className={`shrink-0 ml-4 px-2.5 py-1 rounded text-[9px] font-black uppercase tracking-widest ${ev.color === 'red' ? 'bg-red-100 text-red-700' : ev.color === 'orange' ? 'bg-orange-100 text-orange-700' : 'bg-blue-100 text-blue-700'}`}>
                                {ev.event_type}
                              </span>
                            </div>
                            <div className="flex flex-wrap gap-y-2 gap-x-6 mt-4">
                              <div className="flex items-center text-sm font-medium text-gray-500">
                                <Clock size={16} className="mr-2 text-gray-400" />
                                {ev.is_all_day ? 'All Day' : new Date(ev.start_datetime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </div>
                              <div className="flex items-center text-sm font-medium text-gray-500">
                                <MapPin size={16} className="mr-2 text-gray-400" />
                                {ev.location}
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* ANNOUNCEMENTS (Admin only) */}
          {isAdmin && (
            <div className="bg-white rounded-3xl shadow-xl border border-gray-100 p-8 h-[550px] flex flex-col">
              <div className="flex justify-between items-center mb-8 border-b border-gray-50 pb-4 shrink-0">
                <div className="flex items-center">
                  <div className="bg-yellow-100 p-2.5 rounded-xl mr-4"><Bell className="text-yellow-600" size={24} /></div>
                  <h2 className="text-xl font-bold text-gray-800 tracking-tight">School Announcements</h2>
                </div>
                <button onClick={openNewAnnouncementModal} className="px-4 py-2 bg-yellow-500 hover:bg-yellow-600 text-white font-bold rounded-xl text-sm transition-all shadow-md flex items-center active:scale-95">
                  <Plus size={15} className="mr-1.5" /> New
                </button>
              </div>
              <div className="space-y-4 flex-1 overflow-y-auto pr-2">
                {announcements.length === 0 ? (
                  <div className="text-center py-10 text-gray-400 font-bold">No announcements posted yet.</div>
                ) : (
                  announcements.map(ann => (
                    <div key={ann.announcement_id}
                      className={`group flex items-start justify-between gap-4 p-5 rounded-2xl border-l-4 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md ${ann.is_pinned ? 'bg-yellow-50/50 border-yellow-500' : 'bg-gray-50 border-green-700'}`}>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          {ann.is_pinned && <Pin size={12} className="text-yellow-600 shrink-0" />}
                          <p className="font-bold text-gray-800 text-sm leading-tight truncate">{ann.title}</p>
                          <span className={`shrink-0 px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-widest ${ann.type === 'deadline' ? 'bg-red-100 text-red-700' : ann.type === 'alert' ? 'bg-orange-100 text-orange-700' : 'bg-blue-100 text-blue-700'}`}>{ann.type}</span>
                        </div>
                        <p className="text-xs text-gray-500 leading-relaxed line-clamp-2 mb-2">{ann.body}</p>
                        <div className="flex items-center gap-3 text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                          <span>{ann.dept_name}</span>
                          <span>·</span>
                          <span>{new Date(ann.published_at).toLocaleDateString('en-GB', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                          <span>·</span>
                          <span>{ann.posted_by}</span>
                        </div>
                      </div>
                      <button onClick={() => openEditAnnouncementModal(ann)}
                        className="shrink-0 p-2 text-gray-400 hover:text-yellow-600 hover:bg-yellow-50 rounded-xl transition-all border border-transparent hover:border-yellow-100 opacity-0 group-hover:opacity-100">
                        <Edit size={16} />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* ── TASKS COLUMN ─────────────────────────────────── */}
        <div className="lg:col-span-5 xl:col-span-4 space-y-6">
          <div className="bg-white rounded-3xl shadow-xl border border-gray-100 p-6 sm:p-8 min-h-[600px] flex flex-col">
            <div className="flex items-center justify-between mb-6 border-b border-gray-50 pb-4">
              <div className="flex items-center">
                <div className="bg-red-50 p-2.5 rounded-xl mr-3"><CheckSquare className="text-red-600" size={20} /></div>
                <h2 className="text-xl font-bold text-gray-800 tracking-tight">My Tasks</h2>
              </div>
            </div>
            <div className="flex bg-gray-100 p-1 rounded-xl mb-6 shrink-0">
              <button onClick={() => setFilters({ ...filters, status: 'pending' })} className={`flex-1 text-xs font-bold uppercase tracking-widest py-2.5 rounded-lg transition-all ${filters.status === 'pending' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>Pending</button>
              <button onClick={() => setFilters({ ...filters, status: 'completed' })} className={`flex-1 text-xs font-bold uppercase tracking-widest py-2.5 rounded-lg transition-all ${filters.status === 'completed' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>Completed</button>
            </div>
            <div className="space-y-4 flex-1 overflow-y-auto pr-2">
              {filteredTasks.length === 0 ? (
                <div className="text-center py-10 mt-10">
                  <CheckCircle2 size={48} className="mx-auto text-gray-200 mb-3" />
                  <p className="text-sm font-bold text-gray-400">No matching tasks found.</p>
                </div>
              ) : (
                filteredTasks.map(task => (
                  <div key={task.task_id} onClick={() => openEditTaskModal(task)}
                    className={`group relative p-5 rounded-2xl border transition-all cursor-pointer hover:-translate-y-0.5 ${
                      task.status === 'completed' ? 'bg-gray-50 border-gray-200 opacity-70 hover:opacity-100 hover:shadow-sm'
                      : task.priority === 'high' ? 'bg-red-50/40 border-red-100 hover:bg-white hover:shadow-md hover:border-red-200'
                      : 'bg-white border-gray-100 hover:shadow-md'}`}>
                    <div className="flex items-start gap-4">
                      <button onClick={(e) => toggleTaskStatus(e, task.task_id)} className="mt-1 shrink-0 text-gray-300 hover:text-green-600 transition-colors focus:outline-none">
                        {task.status === 'completed' ? <CheckCircle2 size={24} className="text-green-600" /> : <Circle size={24} />}
                      </button>
                      <div className="flex-1 min-w-0">
                        <p className={`text-[10px] font-black uppercase tracking-[0.2em] mb-1 truncate ${task.priority === 'high' && task.status !== 'completed' ? 'text-red-500' : 'text-gray-400'}`}>{task.type}</p>
                        <h4 className={`text-base font-bold leading-tight mb-2 truncate ${task.status === 'completed' ? 'text-gray-500 line-through' : 'text-gray-900'}`}>{task.title}</h4>
                        <div className="flex items-center gap-3 mt-3 flex-wrap">
                          {task.priority === 'high' && task.status !== 'completed' && (
                            <div className="flex items-center text-[10px] font-bold uppercase tracking-wider text-red-600 bg-red-100 px-2 py-0.5 rounded">
                              <AlertTriangle size={12} className="mr-1" /> High
                            </div>
                          )}
                          <div className="flex items-center text-[10px] font-bold uppercase tracking-wider text-gray-500">
                            <Clock size={12} className="mr-1" />
                            {new Date(task.due_date).toLocaleDateString('en-GB', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ════════════════════════════════════════════════════
          TASK MODAL (Create / Edit)
      ════════════════════════════════════════════════════ */}
      {taskModalState.isOpen && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm" onClick={closeTaskModal}>
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg p-8 animate-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold text-gray-900">{taskModalState.mode === 'create' ? 'New Task' : 'Edit Task'}</h2>
              <button onClick={closeTaskModal} className="p-2 border border-gray-200 rounded-full hover:bg-gray-50"><X size={18} /></button>
            </div>
            <form onSubmit={saveTask} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-1.5">Title *</label>
                <input type="text" required value={taskModalState.data?.title || ''} onChange={e => handleTaskFormChange('title', e.target.value)}
                  className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm font-medium focus:ring-2 focus:ring-green-600 outline-none" placeholder="Task title..." />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-1.5">Type</label>
                  <select value={taskModalState.data?.type || 'Grade Sheets'} onChange={e => handleTaskFormChange('type', e.target.value)}
                    className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm font-medium focus:ring-2 focus:ring-green-600 outline-none">
                    {TASK_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-1.5">Priority</label>
                  <select value={taskModalState.data?.priority || 'normal'} onChange={e => handleTaskFormChange('priority', e.target.value)}
                    className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm font-medium focus:ring-2 focus:ring-green-600 outline-none">
                    <option value="normal">Normal</option>
                    <option value="high">High</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-1.5">Description *</label>
                <textarea rows={3} required value={taskModalState.data?.description || ''} onChange={e => handleTaskFormChange('description', e.target.value)}
                  className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm font-medium focus:ring-2 focus:ring-green-600 outline-none resize-none" placeholder="Describe the task..." />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-1.5">Due Date *</label>
                  <input type="datetime-local" required value={taskModalState.data?.due_date?.slice(0, 16) || ''} onChange={e => handleTaskFormChange('due_date', e.target.value)}
                    className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm font-medium focus:ring-2 focus:ring-green-600 outline-none" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-1.5">Status</label>
                  <select value={taskModalState.data?.status || 'pending'} onChange={e => handleTaskFormChange('status', e.target.value)}
                    className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm font-medium focus:ring-2 focus:ring-green-600 outline-none">
                    <option value="pending">Pending</option>
                    <option value="completed">Completed</option>
                  </select>
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                {taskModalState.mode === 'edit' && (
                  <button type="button" onClick={() => deleteTask(taskModalState.data.task_id)}
                    className="px-4 py-2.5 bg-red-50 hover:bg-red-100 text-red-600 font-bold rounded-xl text-sm transition-all flex items-center">
                    <Trash2 size={15} className="mr-1.5" /> Delete
                  </button>
                )}
                <button type="submit" className="flex-1 py-2.5 bg-green-700 hover:bg-green-800 text-white font-bold rounded-xl text-sm transition-all flex items-center justify-center">
                  <Save size={15} className="mr-1.5" /> {taskModalState.mode === 'create' ? 'Create Task' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* ════════════════════════════════════════════════════
          EVENT MODAL (Create / Edit)
      ════════════════════════════════════════════════════ */}
      {eventModalState.isOpen && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm" onClick={closeEventModal}>
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg p-8 animate-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold text-gray-900">{eventModalState.mode === 'create' ? 'New Event' : 'Edit Event'}</h2>
              <button onClick={closeEventModal} className="p-2 border border-gray-200 rounded-full hover:bg-gray-50"><X size={18} /></button>
            </div>
            <form onSubmit={saveEvent} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-1.5">Event Title *</label>
                <input type="text" required value={eventModalState.data?.title || ''} onChange={e => handleEventFormChange('title', e.target.value)}
                  className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm font-medium focus:ring-2 focus:ring-green-600 outline-none" placeholder="Event title..." />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-1.5">Type</label>
                  <select value={eventModalState.data?.event_type || 'meeting'} onChange={e => handleEventFormChange('event_type', e.target.value)}
                    className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm font-medium focus:ring-2 focus:ring-green-600 outline-none">
                    <option value="meeting">Meeting</option>
                    <option value="deadline">Deadline</option>
                    <option value="exam">Exam</option>
                    <option value="holiday">Holiday</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-1.5">Location *</label>
                  <input type="text" required value={eventModalState.data?.location || ''} onChange={e => handleEventFormChange('location', e.target.value)}
                    className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm font-medium focus:ring-2 focus:ring-green-600 outline-none" placeholder="Location..." />
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-1.5">Date & Time *</label>
                <input type="datetime-local" required value={eventModalState.data?.start_datetime?.slice(0, 16) || ''} onChange={e => handleEventFormChange('start_datetime', e.target.value)}
                  className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm font-medium focus:ring-2 focus:ring-green-600 outline-none" />
              </div>
              <div className="flex items-center gap-3">
                <input type="checkbox" id="is_all_day" checked={eventModalState.data?.is_all_day || false} onChange={e => handleEventFormChange('is_all_day', e.target.checked)}
                  className="w-4 h-4 accent-green-700" />
                <label htmlFor="is_all_day" className="text-sm font-bold text-gray-600">All Day Event</label>
              </div>
              <div className="flex gap-3 pt-2">
                {eventModalState.mode === 'edit' && (
                  <button type="button" onClick={() => deleteEvent(eventModalState.data.event_id)}
                    className="px-4 py-2.5 bg-red-50 hover:bg-red-100 text-red-600 font-bold rounded-xl text-sm transition-all flex items-center">
                    <Trash2 size={15} className="mr-1.5" /> Delete
                  </button>
                )}
                <button type="submit" className="flex-1 py-2.5 bg-green-700 hover:bg-green-800 text-white font-bold rounded-xl text-sm transition-all flex items-center justify-center">
                  <Save size={15} className="mr-1.5" /> {eventModalState.mode === 'create' ? 'Add Event' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* ════════════════════════════════════════════════════
          ANNOUNCEMENT MODAL (Admin only)
      ════════════════════════════════════════════════════ */}
      {announcementModalState.isOpen && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm" onClick={closeAnnouncementModal}>
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg p-8 animate-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold text-gray-900">{announcementModalState.mode === 'create' ? 'New Announcement' : 'Edit Announcement'}</h2>
              <button onClick={closeAnnouncementModal} className="p-2 border border-gray-200 rounded-full hover:bg-gray-50"><X size={18} /></button>
            </div>
            <form onSubmit={saveAnnouncement} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-1.5">Title *</label>
                <input type="text" required value={announcementModalState.data?.title || ''} onChange={e => handleAnnouncementFormChange('title', e.target.value)}
                  className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm font-medium focus:ring-2 focus:ring-green-600 outline-none" placeholder="Announcement title..." />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-1.5">Body *</label>
                <textarea rows={4} required value={announcementModalState.data?.body || ''} onChange={e => handleAnnouncementFormChange('body', e.target.value)}
                  className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm font-medium focus:ring-2 focus:ring-green-600 outline-none resize-none" placeholder="Announcement content..." />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-1.5">Type</label>
                  <select value={announcementModalState.data?.type || 'info'} onChange={e => handleAnnouncementFormChange('type', e.target.value)}
                    className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm font-medium focus:ring-2 focus:ring-green-600 outline-none">
                    {ANN_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-1.5">Department</label>
                  <select value={announcementModalState.data?.dept_name || 'All Departments'} onChange={e => handleAnnouncementFormChange('dept_name', e.target.value)}
                    className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm font-medium focus:ring-2 focus:ring-green-600 outline-none">
                    {DEPT_OPTIONS.map(d => <option key={d} value={d}>{d}</option>)}
                  </select>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <input type="checkbox" id="is_pinned" checked={announcementModalState.data?.is_pinned || false} onChange={e => handleAnnouncementFormChange('is_pinned', e.target.checked)}
                  className="w-4 h-4 accent-yellow-500" />
                <label htmlFor="is_pinned" className="text-sm font-bold text-gray-600">📌 Pin this announcement</label>
              </div>
              <div className="flex gap-3 pt-2">
                {announcementModalState.mode === 'edit' && (
                  <button type="button" onClick={() => deleteAnnouncement(announcementModalState.data.announcement_id)}
                    className="px-4 py-2.5 bg-red-50 hover:bg-red-100 text-red-600 font-bold rounded-xl text-sm transition-all flex items-center">
                    <Trash2 size={15} className="mr-1.5" /> Delete
                  </button>
                )}
                <button type="submit" className="flex-1 py-2.5 bg-yellow-500 hover:bg-yellow-600 text-white font-bold rounded-xl text-sm transition-all flex items-center justify-center">
                  <Save size={15} className="mr-1.5" /> {announcementModalState.mode === 'create' ? 'Post Announcement' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

    </div>
  );
}