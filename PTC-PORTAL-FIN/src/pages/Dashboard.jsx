import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { 
  Bell, CheckSquare, Clock, ChevronLeft, ChevronRight, 
  Pin, CalendarIcon, MoreHorizontal,
  X, MapPin, Flag, Activity, User, CalendarDays
} from 'lucide-react';

export default function Dashboard({ user, setCurrentView, tasks, eventsList, announcements }) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [time, setTime] = useState(new Date());
  const [modalContent, setModalContent] = useState(null);

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const [localEvents, setLocalEvents]             = useState(eventsList || []);
  const [localTasks, setLocalTasks]               = useState(tasks || []);
  const [localAnnouncements, setLocalAnnouncements] = useState(announcements || []);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [evRes, taskRes, annRes] = await Promise.all([
          fetch('/api/tasks/events',        { credentials: 'include' }),
          fetch('/api/tasks',               { credentials: 'include' }),
          fetch('/api/tasks/announcements', { credentials: 'include' }),
        ]);
        if (evRes.ok)   setLocalEvents(await evRes.json());
        if (taskRes.ok) setLocalTasks(await taskRes.json());
        if (annRes.ok)  setLocalAnnouncements(await annRes.json());
      } catch (err) {
        console.error('Dashboard self-fetch error:', err);
      }
    };
    fetchData();
  }, []);

  useEffect(() => { if (tasks?.length)         setLocalTasks(tasks); },               [tasks]);
  useEffect(() => { if (eventsList?.length)    setLocalEvents(eventsList); },         [eventsList]);
  useEffect(() => { if (announcements?.length) setLocalAnnouncements(announcements); }, [announcements]);

  const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  const years = Array.from({length: 11}, (_, i) => 2024 + i);
  const daysInMonth = (year, month) => new Date(year, month + 1, 0).getDate();
  const firstDayOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1).getDay();

  const closeModal = () => setModalContent(null);
  const isFaculty = user?.role_name === 'faculty';

  const renderModalDetails = () => {
    if (!modalContent) return null;
    const { type, data } = modalContent;

    if (type === 'event') {
      return (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-2xl font-bold text-gray-900 tracking-tight">{data.title}</h3>
            <span className={`px-3 py-1 rounded-md text-[10px] font-extrabold uppercase tracking-wider 
              ${data.color === 'red' ? 'bg-red-100 text-red-700' : data.color === 'orange' ? 'bg-orange-100 text-orange-700' : 'bg-blue-100 text-blue-700'}`}>
              {data.event_type}
            </span>
          </div>
          <div className="grid grid-cols-2 gap-y-5 gap-x-4 pt-4">
            <div className="flex items-center text-sm text-gray-600 font-medium">
              <MapPin size={18} className="mr-3 text-green-600" />
              <span className="truncate">{data.location}</span>
            </div>
            <div className="flex items-center text-sm text-gray-600 font-medium">
              <Clock size={18} className="mr-3 text-green-600" />
              <span>{data.is_all_day ? 'All Day' : new Date(data.start_datetime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true })}</span>
            </div>
            <div className="flex items-center text-sm text-gray-600 font-medium">
              <CalendarDays size={18} className="mr-3 text-green-600" />
              <span>{new Date(data.start_datetime).toLocaleDateString('en-GB')}</span>
            </div>
          </div>
        </div>
      );
    }

    if (type === 'announcement') {
      return (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-2xl font-bold text-gray-900 tracking-tight">{data.title}</h3>
            {data.is_pinned && <Pin size={20} className="text-yellow-500 rotate-45 shrink-0" />}
          </div>
          <div className="p-5 border border-gray-100/80 bg-gray-50/50 rounded-xl mb-6 shadow-sm">
            <p className="text-sm text-gray-600 leading-relaxed">{data.body}</p>
          </div>
          <div className="grid grid-cols-2 gap-y-5 gap-x-4">
            <div className="flex items-center text-sm text-gray-600 font-medium">
              <User size={18} className="mr-3 text-green-600" />
              <span className="truncate">{data.posted_by}</span>
            </div>
            <div className="flex items-center text-sm text-gray-600 font-medium">
              <Activity size={18} className="mr-3 text-green-600" />
              <span className="truncate">{data.dept_name}</span>
            </div>
            <div className="flex items-center text-sm text-gray-600 font-medium">
              <CalendarDays size={18} className="mr-3 text-green-600" />
              <span>Published: {new Date(data.published_at).toLocaleDateString('en-GB')}</span>
            </div>
          </div>
        </div>
      );
    }

    if (type === 'task') {
      return (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-2xl font-bold text-gray-900 tracking-tight">{data.title}</h3>
            <span className={`px-3 py-1 rounded-md text-[10px] font-extrabold uppercase tracking-wider ${data.priority === 'high' ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'}`}>
              {data.priority} priority
            </span>
          </div>
          <div className="p-5 border border-gray-100/80 bg-gray-50/50 rounded-xl mb-6 shadow-sm">
            <p className="text-sm text-gray-600 leading-relaxed">{data.description}</p>
          </div>
          <div className="grid grid-cols-2 gap-y-5 gap-x-4">
            <div className="flex items-center text-sm text-gray-600 font-medium">
              <Flag size={18} className="mr-3 text-green-600" />
              <span>Status: <span className="uppercase">{data.status}</span></span>
            </div>
            <div className="flex items-center text-sm text-gray-600 font-medium">
              <Clock size={18} className="mr-3 text-green-600" />
              <span>Due: {new Date(data.due_date).toLocaleDateString('en-GB')}</span>
            </div>
          </div>
        </div>
      );
    }
  };

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto relative">

      {modalContent && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in" onClick={closeModal}>
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg p-6 sm:p-8 animate-in zoom-in-95 duration-200 flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-[11px] font-extrabold text-gray-400 uppercase tracking-[0.2em]">
                {modalContent.type} OVERVIEW
              </h2>
              <button onClick={closeModal} className="p-2 border border-gray-200 rounded-full hover:bg-gray-50 text-gray-600 hover:text-gray-900 transition-all active:scale-90">
                <X size={18} strokeWidth={2.5} />
              </button>
            </div>
            <div className="mb-2">{renderModalDetails()}</div>
            {isFaculty && (
              <div className="mt-8 pt-6 border-t border-gray-100 flex justify-end">
                <button
                  onClick={() => { if (setCurrentView) setCurrentView('tasks'); closeModal(); }}
                  className="px-6 py-2.5 text-sm font-bold text-white bg-[#0e5c2b] hover:bg-[#0a4720] rounded-xl shadow-md transition-all flex items-center active:scale-95"
                >
                  Full View <ChevronRight size={16} className="ml-1" />
                </button>
              </div>
            )}
          </div>
        </div>,
        document.body
      )}

      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">System Dashboard</h1>
          <p className="text-gray-500 font-medium tracking-tight">
            Welcome back, <span className="text-green-700 font-bold">{user?.name || 'Faculty Member'}</span>
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">

        <div className="xl:col-span-8">
          <div className="bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden flex flex-col h-full min-h-[700px]">
            <div className="bg-[#0e5c2b] p-6 text-white">
              <div className="flex justify-between items-center mb-6">
                <div className="flex items-center text-yellow-400 font-mono font-bold text-lg bg-[#08381a] px-4 py-2 rounded-xl border border-[#0e5c2b] shadow-inner">
                  <Clock size={18} className="mr-3 animate-pulse" />
                  {time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true })}
                </div>
                <select
                  value={currentDate.getFullYear()}
                  onChange={(e) => setCurrentDate(new Date(parseInt(e.target.value), currentDate.getMonth(), 1))}
                  className="bg-[#137a39] text-sm font-bold border-none rounded-xl px-4 py-2 focus:ring-0 cursor-pointer uppercase tracking-widest transition-all hover:bg-[#189647] outline-none"
                >
                  {years.map(y => <option key={y} value={y}>{y}</option>)}
                </select>
              </div>
              <div className="flex justify-between items-center px-2">
                <button onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1))} className="text-green-200 hover:text-white flex items-center transition-all hover:-translate-x-1 group">
                  <ChevronLeft size={24} />
                  <span className="text-[10px] ml-1 uppercase font-bold tracking-widest hidden md:block opacity-70 group-hover:opacity-100">{months[currentDate.getMonth() === 0 ? 11 : currentDate.getMonth() - 1]}</span>
                </button>
                <h2 className="text-4xl font-bold font-serif text-white tracking-tight">{months[currentDate.getMonth()]} {currentDate.getFullYear()}</h2>
                <button onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1))} className="text-green-200 hover:text-white flex items-center transition-all hover:translate-x-1 group">
                  <span className="text-[10px] mr-1 uppercase font-bold tracking-widest hidden md:block opacity-70 group-hover:opacity-100">{months[currentDate.getMonth() === 11 ? 0 : currentDate.getMonth() + 1]}</span>
                  <ChevronRight size={24} />
                </button>
              </div>
            </div>

            <div className="bg-gray-50/30 p-1">
              <div className="grid grid-cols-7 border-b bg-white py-3 shadow-sm">
                {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(d => (
                  <div key={d} className="text-center text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">{d}</div>
                ))}
              </div>
              <div className="grid grid-cols-7">
                {Array.from({length: (firstDayOfMonth === 0 ? 6 : firstDayOfMonth - 1)}).map((_, i) => (
                  <div key={`e-${i}`} className="border-r border-b bg-gray-50/50"></div>
                ))}
                {Array.from({length: daysInMonth(currentDate.getFullYear(), currentDate.getMonth())}).map((_, i) => {
                  const d = i + 1;
                  const isToday = new Date().getDate() === d && new Date().getMonth() === currentDate.getMonth() && new Date().getFullYear() === currentDate.getFullYear();

                  const dayEvents = localEvents.filter(ev => {
                    if (!ev.start_datetime) return false;
                    const evDate = new Date(ev.start_datetime);
                    return evDate.getDate() === d &&
                           evDate.getMonth() === currentDate.getMonth() &&
                           evDate.getFullYear() === currentDate.getFullYear();
                  });

                  return (
                    <div
                      key={d}
                      className="border-r border-b bg-white min-h-[90px] p-2 hover:bg-green-50/30 transition-colors group relative"
                    >
                      <div className="flex justify-between items-start mb-2">
                        <span className={`text-sm font-black flex items-center justify-center w-8 h-8 rounded-full ${isToday ? 'bg-yellow-400 text-green-950 shadow-lg scale-110' : 'text-gray-400 group-hover:text-green-800'}`}>{d}</span>
                        <MoreHorizontal size={14} className="text-gray-300 opacity-0 group-hover:opacity-100" />
                      </div>
                      <div className="space-y-1 overflow-hidden">
                        {dayEvents.map((ev, idx) => (
                          <div 
                            key={idx} 
                            onClick={() => setModalContent({ type: 'event', data: ev })} 
                            className={`cursor-pointer hover:scale-[1.02] transition-transform text-[9px] font-bold px-2 py-1 rounded border-l-4 truncate 
                            ${ev.color === 'red' ? 'bg-red-50 text-red-700 border-red-400' : ev.color === 'orange' ? 'bg-orange-50 text-orange-700 border-orange-400' : 'bg-blue-50 text-blue-700 border-blue-400'}`}>
                            {ev.title}
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        <div className="xl:col-span-4 space-y-6">
          <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-6 flex flex-col h-[350px]">
            <div className="flex justify-between items-center mb-6 border-b border-gray-50 pb-4">
              <h3 className="font-bold text-gray-800 flex items-center uppercase tracking-widest text-xs">
                <Bell className="mr-3 text-yellow-500" size={20} /> School Announcements
              </h3>
            </div>
            <div className="space-y-4 overflow-y-auto pr-2">
              {localAnnouncements.map(ann => (
                <div
                  key={ann.announcement_id}
                  className={`p-4 rounded-2xl border-l-4 shadow-sm transition-all hover:-translate-y-0.5 cursor-pointer hover:shadow-md ${ann.is_pinned ? 'bg-yellow-50/50 border-yellow-500' : 'bg-gray-50 border-green-700'}`}
                  onClick={() => setModalContent({ type: 'announcement', data: ann })}
                >
                  <div className="flex justify-between items-start mb-1">
                    <p className="font-bold text-gray-800 text-sm leading-tight">{ann.title}</p>
                    {ann.is_pinned && <Pin size={12} className="text-yellow-600 shrink-0 ml-2" />}
                  </div>
                  <p className="text-xs text-gray-500 leading-relaxed line-clamp-2">{ann.body}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-6 flex-1">
            <div className="flex justify-between items-center mb-6 border-b border-gray-50 pb-4">
              <h3 className="font-bold text-gray-800 flex items-center uppercase tracking-widest text-xs">
                <CheckSquare className="mr-3 text-red-500" size={20} /> Tasks
              </h3>
            </div>
            <div className="space-y-4">
              {localTasks.filter(t => t.status !== 'completed').slice(0, 3).map(task => (
                <div
                  key={task.task_id}
                  className={`p-4 rounded-2xl border shadow-sm relative overflow-hidden transition-all hover:shadow-md cursor-pointer ${task.priority === 'high' ? 'bg-red-50 border-red-100' : 'bg-blue-50 border-blue-100'}`}
                  onClick={() => setModalContent({ type: 'task', data: task })}
                >
                  <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1">{task.type}</p>
                  <p className="text-sm font-bold text-gray-800">{task.title}</p>
                  <div className={`flex items-center mt-3 text-[10px] font-bold uppercase ${task.priority === 'high' ? 'text-red-700' : 'text-blue-700'}`}>
                    <Clock size={12} className="mr-1" /> Due: {new Date(task.due_date).toLocaleDateString([], { month: 'long', day: 'numeric' })}
                  </div>
                </div>
              ))}
              {localTasks.filter(t => t.status !== 'completed').length === 0 && (
                <p className="text-sm text-gray-400 font-bold text-center mt-8">All tasks completed!</p>
              )}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}