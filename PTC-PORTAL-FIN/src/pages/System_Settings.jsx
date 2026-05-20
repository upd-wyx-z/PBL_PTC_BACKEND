import React, { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { 
  Search, X, User, ArrowUpDown, ArrowUp, ArrowDown, SlidersHorizontal, 
  Shield, Database, Download, UploadCloud, Clock, History, FileText,
  AlertTriangle, CheckCircle2, Calendar, Settings, RefreshCw, HardDrive
} from 'lucide-react';

const API_BASE = '/api';
const MODULES  = ['All Modules', 'User Management', 'Department Repository', 'Grading System', 'System Settings', 'Tasks & Schedule', 'Course Scheduling', 'Workload Management'];

export default function SystemSettings({ user }) {
  // ── Tab ───────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState('audit');

  // ── Audit States ──────────────────────────────────────────
  const [logs,          setLogs]          = useState([]);
  const [totalLogs,     setTotalLogs]     = useState(0);
  const [isLoading,     setIsLoading]     = useState(true);
  const [error,         setError]         = useState('');
  const [searchTerm,    setSearchTerm]    = useState('');
  const [filterModule,  setFilterModule]  = useState('All Modules');
  const [isFilterOpen,  setIsFilterOpen]  = useState(false);
  const [sortBy,        setSortBy]        = useState('timestamp');
  const [sortDir,       setSortDir]       = useState('desc');
  const [isSortOpen,    setIsSortOpen]    = useState(false);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);

  // ── Backup States ─────────────────────────────────────────
  const [autoBackupConfig, setAutoBackupConfig] = useState({
    enabled:   true,
    frequency: 'daily',
    time:      '02:00',
    retention: '30',
  });
  const [isBackupLoading,    setIsBackupLoading]    = useState(false);
  const [isRestoreModalOpen, setIsRestoreModalOpen] = useState(false);

  // ── Notification ──────────────────────────────────────────
  const [notification, setNotification] = useState({ show: false, message: '', type: 'success' });

  const showNotification = (msg, type = 'success') => {
    setNotification({ show: true, message: msg, type });
    setTimeout(() => setNotification({ show: false, message: '', type: 'success' }), 4000);
  };

  // ── Fetch audit logs ──────────────────────────────────────
  const fetchLogs = useCallback(async () => {
    setIsLoading(true);
    setError('');
    try {
      const params = new URLSearchParams();
      if (searchTerm.trim())              params.set('search',  searchTerm.trim());
      if (filterModule !== 'All Modules') params.set('module',  filterModule);
      params.set('sortBy',  sortBy === 'timestamp' ? 'created_at' : sortBy);
      params.set('sortDir', sortDir);
      params.set('limit',   '100');

      const res = await fetch(`${API_BASE}/system/audit-logs?${params.toString()}`, {
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Failed to fetch audit logs.');
      const data = await res.json();
      setLogs(data.logs   || []);
      setTotalLogs(data.total || 0);
    } catch (err) {
      setError('Could not load audit logs. Please try again.');
      console.error('fetchLogs error:', err);
    } finally {
      setIsLoading(false);
    }
  }, [searchTerm, filterModule, sortBy, sortDir]);

  useEffect(() => {
    if (activeTab !== 'audit') return;
    const timer = setTimeout(() => fetchLogs(), 400);
    return () => clearTimeout(timer);
  }, [fetchLogs, activeTab]);

  // ── Fetch backup config on tab switch ────────────────────
  useEffect(() => {
    if (activeTab !== 'backup') return;
    const fetchConfig = async () => {
      try {
        const res = await fetch(`${API_BASE}/system/backup-config`, { credentials: 'include' });
        if (res.ok) {
          const data = await res.json();
          setAutoBackupConfig({
            enabled:   data.enabled,
            frequency: data.frequency,
            time:      data.time,
            retention: data.retention,
          });
        }
      } catch (err) {
        console.error('fetchBackupConfig error:', err);
      }
    };
    fetchConfig();
  }, [activeTab]);

  // ── Sort toggle ───────────────────────────────────────────
  const toggleSort = (key) => {
    if (sortBy === key) setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    else { setSortBy(key); setSortDir('desc'); }
  };

  // ── Export PDF — fetches FRESH data from backend (up to 5000 logs) ─
  // NOTE: This is better than filtering the already-loaded 100 logs —
  // it queries the DB fresh so no logs are missed in the export.
  const handleExportPDF = async (e) => {
    e.preventDefault();
    const formData     = new FormData(e.target);
    const startDate    = formData.get('start_date');
    const endDate      = formData.get('end_date');
    const targetModule = formData.get('target_module');

    // Fetch fresh logs from backend with date range filter
    let exportLogs = [];
    try {
      const params = new URLSearchParams({
        module:      targetModule,
        start_date:  startDate,
        end_date:    endDate,
        limit:       5000,
      });
      const res = await fetch(`${API_BASE}/system/audit-logs?${params}`, { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        exportLogs = data.logs || [];
      }
    } catch (err) {
      showNotification('Failed to fetch logs for export.', 'error');
      return;
    }

    if (exportLogs.length === 0) {
      setIsExportModalOpen(false);
      showNotification('No logs found for the selected date range and module.', 'warning');
      return;
    }

    // Generate clean HTML document and trigger Print to PDF
    const printWindow = window.open('', '_blank', 'height=800,width=1000');
    let htmlContent = `
      <html>
        <head>
          <title>Audit Logs - PTC</title>
          <style>
            body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; padding: 40px; color: #333; }
            .header { border-bottom: 2px solid #0e5c2b; padding-bottom: 10px; margin-bottom: 30px; }
            .header h1 { color: #0e5c2b; margin: 0 0 10px 0; font-size: 24px; }
            .meta-info { font-size: 14px; color: #555; margin-bottom: 5px; }
            table { width: 100%; border-collapse: collapse; margin-top: 20px; font-size: 12px; }
            th, td { border: 1px solid #ddd; padding: 12px 8px; text-align: left; }
            th { background-color: #0e5c2b; color: white; font-weight: bold; text-transform: uppercase; font-size: 10px; letter-spacing: 1px; }
            th.text-right, td.text-right { text-align: right; }
            tr:nth-child(even) { background-color: #f9f9f9; }
            .timestamp { white-space: nowrap; }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>PTC System Audit Logs</h1>
            <div class="meta-info"><strong>Target Module:</strong> ${targetModule}</div>
            <div class="meta-info"><strong>Date Range:</strong> ${startDate} to ${endDate}</div>
            <div class="meta-info"><strong>Generated On:</strong> ${new Date().toLocaleString()}</div>
          </div>
          <table>
            <thead>
              <tr>
                <th width="25%">Date & Time</th>
                <th width="35%">User & Role</th>
                <th width="20%">Module</th>
                <th width="20%" class="text-right">Action</th>
              </tr>
            </thead>
            <tbody>
    `;

    exportLogs.forEach(log => {
      const dateStr = new Date(log.timestamp).toLocaleString('en-GB', {
        month: 'short', day: 'numeric', year: 'numeric',
        hour: '2-digit', minute: '2-digit'
      });
      htmlContent += `
        <tr>
          <td class="timestamp">${dateStr}</td>
          <td><strong>${log.user_name}</strong><br><span style="color:#666; font-size:10px;">${log.role}</span></td>
          <td>${log.module}</td>
          <td class="text-right"><strong>${log.action}</strong></td>
        </tr>
      `;
    });

    htmlContent += `</tbody></table></body></html>`;
    printWindow.document.write(htmlContent);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => { printWindow.print(); }, 500);

    setIsExportModalOpen(false);
    showNotification(`Successfully generated PDF report for ${exportLogs.length} log/s.`);
  };

  // ── Manual Backup — real download ────────────────────────
  const handleManualBackup = async () => {
    setIsBackupLoading(true);
    try {
      const res = await fetch(`${API_BASE}/system/backup`, {
        method:      'POST',
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Backup failed.');

      // Trigger file download
      const blob      = await res.blob();
      const url        = URL.createObjectURL(blob);
      const link       = document.createElement('a');
      const today      = new Date().toISOString().split('T')[0];
      link.href        = url;
      link.download    = `PTC_Backup_${today}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      showNotification('System backup downloaded successfully!');

      // Refresh audit logs since backup gets logged
      await fetchLogs();
    } catch (err) {
      showNotification('Failed to generate backup. Please try again.', 'warning');
      console.error('manualBackup error:', err);
    } finally {
      setIsBackupLoading(false);
    }
  };

  // ── Save Auto Backup Config — real API ───────────────────
  const handleSaveAutoBackup = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch(`${API_BASE}/system/backup-config`, {
        method:      'PUT',
        credentials: 'include',
        headers:     { 'Content-Type': 'application/json' },
        body:        JSON.stringify(autoBackupConfig),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      showNotification(data.message);
    } catch (err) {
      showNotification(err.message || 'Failed to save configuration.', 'warning');
    }
  };

  // ── Restore — still UI only (actual restore needs server-side pg_restore) ─
  const handleRestoreSubmit = (e) => {
    e.preventDefault();
    setIsRestoreModalOpen(false);
    showNotification('System restore sequence initiated. Please wait...', 'warning');
  };

  // ─────────────────────────────────────────────────────────
  //  RENDER
  // ─────────────────────────────────────────────────────────
  return (
    <div className="space-y-6 h-full max-w-[1600px] mx-auto animate-in fade-in duration-300 relative">

      {/* NOTIFICATION TOAST */}
      {notification.show && createPortal(
        <div className={`fixed top-8 right-8 z-[10000] p-4 rounded-2xl shadow-xl flex items-center animate-in slide-in-from-top-4 border ${
          notification.type === 'success'
            ? 'bg-green-50 border-green-200 text-green-800'
            : 'bg-yellow-50 border-yellow-200 text-yellow-800'
        }`}>
          {notification.type === 'success'
            ? <CheckCircle2 className="mr-3 shrink-0" size={20}/>
            : <AlertTriangle className="mr-3 shrink-0" size={20}/>
          }
          <p className="text-sm font-bold">{notification.message}</p>
        </div>,
        document.body
      )}

      {/* =========================================
          MODAL 1: EXPORT PDF
          ========================================= */}
      {isExportModalOpen && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in" onClick={() => setIsExportModalOpen(false)}>
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm p-8 animate-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-6 border-b border-gray-50 pb-4">
              <h2 className="text-sm font-bold text-gray-800 uppercase tracking-widest flex items-center">
                <FileText size={18} className="mr-2 text-red-600" /> Export Audit Logs
              </h2>
              <button onClick={() => setIsExportModalOpen(false)} className="p-2 border border-gray-200 rounded-full hover:bg-gray-50 text-gray-600 transition-all active:scale-90">
                <X size={16} strokeWidth={2.5} />
              </button>
            </div>

            <form onSubmit={handleExportPDF} className="space-y-5">
              <div>
                <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Target Module</label>
                <select name="target_module" className="w-full p-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-red-600 outline-none text-sm font-medium">
                  {MODULES.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">From Date</label>
                  <input type="date" name="start_date" required className="w-full p-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-red-600 outline-none text-sm font-medium" />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">To Date</label>
                  <input type="date" name="end_date" required className="w-full p-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-red-600 outline-none text-sm font-medium" />
                </div>
              </div>
              <div className="mt-8 pt-6 border-t border-gray-100">
                <button type="submit" className="w-full px-6 py-3.5 text-sm font-bold text-white bg-red-600 hover:bg-red-700 rounded-xl shadow-md transition-all active:scale-95 flex justify-center items-center">
                  <Download size={18} className="mr-2" /> Generate PDF
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* =========================================
          MODAL 2: SYSTEM RESTORE
          ========================================= */}
      {isRestoreModalOpen && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in" onClick={() => setIsRestoreModalOpen(false)}>
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md p-8 text-center animate-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
            <div className="w-16 h-16 bg-yellow-50 text-yellow-600 rounded-full flex items-center justify-center mx-auto mb-6 border-4 border-white shadow-sm">
              <AlertTriangle size={32} />
            </div>
            <h3 className="text-xl font-bold text-gray-900 mb-2">Restore System State</h3>
            <p className="text-sm text-gray-500 mb-6 leading-relaxed">
              Uploading a backup file will overwrite current database records. Please ensure you are uploading a valid <span className="font-bold text-gray-700">.sql</span> or <span className="font-bold text-gray-700">.zip</span> backup package.
            </p>

            <form onSubmit={handleRestoreSubmit}>
              <div className="border-2 border-dashed border-gray-300 rounded-2xl p-6 bg-gray-50 hover:bg-gray-100 transition-colors cursor-pointer mb-6">
                <UploadCloud size={32} className="mx-auto text-gray-400 mb-2" />
                <p className="text-sm font-bold text-gray-700">Click to select backup file</p>
              </div>

              <div className="relative mb-8 text-left">
                <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5">Admin Password Required</label>
                <input
                  type="password" required
                  className="w-full p-3.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-yellow-500 outline-none text-sm font-medium bg-white"
                  placeholder="Verify password to authorize"
                />
              </div>

              <div className="flex gap-3">
                <button type="button" onClick={() => setIsRestoreModalOpen(false)} className="flex-1 py-3.5 px-4 bg-gray-100 hover:bg-gray-200 text-gray-600 font-bold rounded-xl transition-all">Cancel</button>
                <button type="submit" className="flex-1 py-3.5 px-4 bg-yellow-500 hover:bg-yellow-600 text-white font-bold rounded-xl shadow-md transition-all active:scale-95 flex justify-center items-center">
                  <RefreshCw size={18} className="mr-2" /> Restore
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* =========================================
          PAGE HEADER & TABS
          ========================================= */}
      <div className="bg-white p-6 sm:p-8 rounded-3xl shadow-sm border border-gray-100 relative overflow-hidden flex flex-col md:flex-row justify-between md:items-end gap-6">
        <div className="absolute right-0 top-0 w-64 h-64 bg-green-50 rounded-full mix-blend-multiply filter blur-3xl opacity-50 -translate-y-1/2 translate-x-1/4 z-0"></div>

        <div className="relative z-10">
          <h1 className="text-3xl font-bold text-gray-900 tracking-tight mb-1 flex items-center">
            System Administration
          </h1>
          <p className="text-sm text-gray-500 font-medium">Configure system parameters, audit logs, and backups.</p>
        </div>

        <div className="relative z-10 flex bg-gray-100 p-1 rounded-2xl shrink-0">
          <button
            onClick={() => setActiveTab('audit')}
            className={`flex items-center px-6 py-3 text-sm font-bold uppercase tracking-widest rounded-xl transition-all ${activeTab === 'audit' ? 'bg-white text-green-800 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
          >
            <History size={16} className="mr-2" /> Audit Trails
          </button>
          <button
            onClick={() => setActiveTab('backup')}
            className={`flex items-center px-6 py-3 text-sm font-bold uppercase tracking-widest rounded-xl transition-all ${activeTab === 'backup' ? 'bg-white text-green-800 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
          >
            <Database size={16} className="mr-2" /> Backup & Restore
          </button>
        </div>
      </div>

      {/* =========================================
          TAB 1: AUDIT TRAILS
          ========================================= */}
      {activeTab === 'audit' && (
        <div className="bg-white rounded-3xl shadow-xl border border-gray-100 overflow-hidden flex flex-col min-h-[500px] animate-in fade-in slide-in-from-bottom-4">

          {/* Toolbar */}
          <div className="p-4 border-b border-gray-100 bg-gray-50/30 flex flex-wrap items-center gap-4">

            {/* Total count badge */}
            <div className="px-3 py-1.5 bg-gray-100 border border-gray-200 rounded-lg text-xs font-black text-gray-500 uppercase tracking-widest shrink-0">
              {totalLogs} Logs Total
            </div>

            {/* Search */}
            <div className="flex-1 relative min-w-[200px]">
              <Search className="absolute left-3.5 top-3 text-gray-400" size={16} />
              <input
                type="text" placeholder="Search logs by user, action, or details..."
                value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-green-600 outline-none text-sm font-medium transition-shadow shadow-sm bg-white"
              />
            </div>

            {/* Actions */}
            <div className="flex flex-wrap items-center gap-3 shrink-0 ml-auto">

              {/* Sort */}
              <div className="relative">
                <button
                  onClick={() => setIsSortOpen(!isSortOpen)}
                  className="flex items-center justify-center gap-2 px-4 py-2.5 bg-white border border-gray-200 text-gray-700 font-bold rounded-xl text-sm hover:bg-gray-50 transition-all shadow-sm">
                  <ArrowUpDown size={15} /> Sort
                </button>
                {isSortOpen && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setIsSortOpen(false)}></div>
                    <div className="absolute right-0 top-full mt-2 bg-white rounded-2xl shadow-xl border border-gray-100 w-48 z-50 overflow-hidden">
                      {[
                        { key: 'timestamp', label: 'Date & Time' },
                        { key: 'user_name', label: 'User Name' },
                        { key: 'module',    label: 'Target Module' },
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

              {/* Filter Module */}
              <div className="relative">
                <button
                  onClick={() => setIsFilterOpen(!isFilterOpen)}
                  className="flex items-center justify-center gap-2 px-4 py-2.5 bg-white border border-gray-200 text-gray-700 font-bold rounded-xl text-sm hover:bg-gray-50 transition-all shadow-sm">
                  <SlidersHorizontal size={15} /> Filter Module
                  {filterModule !== 'All Modules' && <span className="w-2 h-2 rounded-full bg-green-600"></span>}
                </button>
                {isFilterOpen && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setIsFilterOpen(false)}></div>
                    <div className="absolute right-0 top-full mt-2 bg-white rounded-2xl shadow-xl border border-gray-100 w-56 z-50 overflow-hidden py-2">
                      <p className="px-4 py-2 text-[10px] font-black text-gray-400 uppercase tracking-widest">Select Module</p>
                      {MODULES.map(m => (
                        <button key={m} onClick={() => { setFilterModule(m); setIsFilterOpen(false); }}
                          className={`w-full flex items-center px-4 py-2.5 text-sm font-medium hover:bg-gray-50 transition-colors ${filterModule === m ? 'text-green-700 font-bold bg-green-50/40' : 'text-gray-700'}`}>
                          {m}
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>

              {/* Export PDF */}
              <button
                onClick={() => setIsExportModalOpen(true)}
                className="flex items-center justify-center gap-2 px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl text-sm transition-all shadow-md active:scale-95"
              >
                <FileText size={16} /> Export PDF
              </button>
            </div>
          </div>

          {/* Audit Table */}
          <div className="overflow-x-auto flex-1">
            <table className="w-full text-left border-collapse min-w-[800px]">
              <thead className="bg-white border-b border-gray-100">
                <tr>
                  <th className="px-6 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest w-1/4">Date & Time</th>
                  <th className="px-6 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest w-1/3">User & Role</th>
                  <th className="px-6 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest w-1/4">Module</th>
                  <th className="px-6 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {isLoading ? (
                  <tr>
                    <td colSpan="4" className="py-24 text-center">
                      <div className="flex flex-col items-center gap-3">
                        <div className="w-8 h-8 border-4 border-green-600 border-t-transparent rounded-full animate-spin"></div>
                        <p className="text-gray-400 font-medium text-sm">Loading audit logs...</p>
                      </div>
                    </td>
                  </tr>
                ) : error ? (
                  <tr>
                    <td colSpan="4" className="py-24 text-center">
                      <p className="text-red-500 font-bold">{error}</p>
                    </td>
                  </tr>
                ) : logs.length === 0 ? (
                  <tr>
                    <td colSpan="4" className="py-24 text-center">
                      <History className="mx-auto text-gray-200 mb-4" size={48} />
                      <p className="text-gray-500 font-bold">No audit logs found matching criteria.</p>
                    </td>
                  </tr>
                ) : (
                  logs.map((log) => (
                    <tr key={log.log_id} className="hover:bg-gray-50/50 transition-colors">
                      <td className="px-6 py-4">
                        <div className="text-sm font-bold text-gray-700">
                          {new Date(log.timestamp).toLocaleDateString('en-GB', { month: 'short', day: 'numeric', year: 'numeric' })}
                        </div>
                        <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                          {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center">
                          <div className="w-8 h-8 bg-gray-100 rounded-full border border-gray-200 mr-3 flex items-center justify-center shrink-0">
                            <User size={14} className="text-gray-400" />
                          </div>
                          <div>
                            <div className="text-sm font-bold text-gray-900">{log.user_name}</div>
                            <div className="text-[10px] font-bold text-gray-500">{log.role}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="inline-flex px-2.5 py-1 bg-gray-100 text-gray-600 rounded-md text-[10px] font-black uppercase tracking-widest border border-gray-200">
                          {log.module}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm font-bold text-gray-800 text-right">
                        {log.action}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* =========================================
          TAB 2: BACKUP & RECOVERY
          ========================================= */}
      {activeTab === 'backup' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-in fade-in slide-in-from-bottom-4">

          {/* Card 1: Manual Backup */}
          <div className="bg-white rounded-3xl shadow-xl border border-gray-100 p-8 flex flex-col text-center hover:-translate-y-1 transition-transform">
            <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-6 border border-blue-100 shadow-sm">
              <Download size={32} />
            </div>
            <h3 className="text-xl font-bold text-gray-900 mb-2">Manual Backup</h3>
            <p className="text-sm text-gray-500 mb-8 leading-relaxed flex-1">
              Download an immediate, complete snapshot of the database, user files, and system configurations.
            </p>
            <button
              onClick={handleManualBackup}
              disabled={isBackupLoading}
              className="w-full py-3.5 px-4 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-md transition-all active:scale-95 flex justify-center items-center disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {isBackupLoading ? (
                <><span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></span> Generating...</>
              ) : (
                <><HardDrive size={18} className="mr-2" /> Download Backup Now</>
              )}
            </button>
          </div>

          {/* Card 2: Restore System */}
          <div className="bg-white rounded-3xl shadow-xl border border-gray-100 p-8 flex flex-col text-center hover:-translate-y-1 transition-transform">
            <div className="w-16 h-16 bg-yellow-50 text-yellow-600 rounded-2xl flex items-center justify-center mx-auto mb-6 border border-yellow-100 shadow-sm">
              <UploadCloud size={32} />
            </div>
            <h3 className="text-xl font-bold text-gray-900 mb-2">Restore System</h3>
            <p className="text-sm text-gray-500 mb-8 leading-relaxed flex-1">
              Upload a previously downloaded backup file to restore the entire system to an earlier state.
            </p>
            <button
              onClick={() => setIsRestoreModalOpen(true)}
              className="w-full py-3.5 px-4 bg-yellow-500 hover:bg-yellow-600 text-white font-bold rounded-xl shadow-md transition-all active:scale-95 flex justify-center items-center"
            >
              <RefreshCw size={18} className="mr-2" /> Initiate Recovery
            </button>
          </div>

          {/* Card 3: Auto Backup Settings */}
          <div className="bg-white rounded-3xl shadow-xl border border-gray-100 p-8 flex flex-col">
            <div className="flex items-center mb-6">
              <div className="w-12 h-12 bg-green-50 text-green-700 rounded-xl flex items-center justify-center mr-4 border border-green-100">
                <Settings size={24} />
              </div>
              <div>
                <h3 className="text-lg font-bold text-gray-900 leading-tight">Auto Backup</h3>
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mt-0.5">Schedule Settings</p>
              </div>
            </div>

            <form onSubmit={handleSaveAutoBackup} className="flex-1 flex flex-col space-y-5">
              <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl border border-gray-100">
                <span className="text-sm font-bold text-gray-700">Enable Automation</span>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox" className="sr-only peer"
                    checked={autoBackupConfig.enabled}
                    onChange={(e) => setAutoBackupConfig({...autoBackupConfig, enabled: e.target.checked})}
                  />
                  <div className="w-11 h-6 bg-gray-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-600"></div>
                </label>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5">Frequency</label>
                  <select
                    disabled={!autoBackupConfig.enabled}
                    value={autoBackupConfig.frequency}
                    onChange={(e) => setAutoBackupConfig({...autoBackupConfig, frequency: e.target.value})}
                    className="w-full p-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-green-600 outline-none text-sm font-medium disabled:opacity-50"
                  >
                    <option value="daily">Daily</option>
                    <option value="weekly">Weekly</option>
                    <option value="monthly">Monthly</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5">Run Time</label>
                  <input
                    type="time"
                    disabled={!autoBackupConfig.enabled}
                    value={autoBackupConfig.time}
                    onChange={(e) => setAutoBackupConfig({...autoBackupConfig, time: e.target.value})}
                    className="w-full p-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-green-600 outline-none text-sm font-medium disabled:opacity-50"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5">Retention Policy</label>
                <select
                  disabled={!autoBackupConfig.enabled}
                  value={autoBackupConfig.retention}
                  onChange={(e) => setAutoBackupConfig({...autoBackupConfig, retention: e.target.value})}
                  className="w-full p-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-green-600 outline-none text-sm font-medium disabled:opacity-50"
                >
                  <option value="7">Keep last 7 days</option>
                  <option value="30">Keep last 30 days</option>
                  <option value="90">Keep last 90 days</option>
                </select>
              </div>

              <button
                type="submit"
                disabled={!autoBackupConfig.enabled}
                className="w-full mt-auto py-3.5 px-4 bg-[#0e5c2b] hover:bg-[#0a4720] text-white font-bold rounded-xl shadow-md transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Save Configuration
              </button>
            </form>
          </div>

        </div>
      )}

    </div>
  );
}