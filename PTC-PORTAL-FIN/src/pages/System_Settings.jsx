import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { 
  Search, X, User, ArrowUpDown, ArrowUp, ArrowDown, SlidersHorizontal, 
  Shield, Database, Download, UploadCloud, Clock, History, FileText,
  AlertTriangle, CheckCircle2, Calendar, Settings, RefreshCw, HardDrive
} from 'lucide-react';

// --- MOCK DATABASE DATA (Audit Logs) ---
const INITIAL_LOGS = [
  { log_id: 1, user_name: 'System Admin', role: 'System Admin', module: 'System Settings', action: 'Modified Backup Schedule', timestamp: '2026-04-22T09:15:00Z', details: 'Changed auto-backup frequency from Weekly to Daily.' },
  { log_id: 2, user_name: 'Maria Clara', role: 'Registrar', module: 'User Management', action: 'Deactivated User', timestamp: '2026-04-21T14:30:00Z', details: 'Deactivated account for user_id: 4 (Jose Rizal).' },
  { log_id: 3, user_name: 'John Kennidy Abunda', role: 'Faculty', module: 'Grading System', action: 'Submitted Grades', timestamp: '2026-04-20T16:45:00Z', details: 'Submitted final grades for ITE314 - BSIT 3A.' },
  { log_id: 4, user_name: 'Angel Cylo G. Real', role: 'Dean', module: 'Filing System', action: 'Uploaded Document', timestamp: '2026-04-20T10:00:00Z', details: 'Uploaded Q1_Department_Budget_Request.xlsx (Admins Only).' },
  { log_id: 5, user_name: 'Maria Clara', role: 'Registrar', module: 'User Management', action: 'Created User', timestamp: '2026-04-19T11:20:00Z', details: 'Created new Faculty account for Anna Reyes.' },
  { log_id: 6, user_name: 'System Admin', role: 'System Admin', module: 'System Settings', action: 'System Restore', timestamp: '2026-03-01T02:00:00Z', details: 'Restored database from backup file backup_20260228.zip.' },
];

const MODULES = ['All Modules', 'User Management', 'Filing System', 'Grading System', 'System Settings', 'Tasks & Schedule'];

export default function SystemSettings({ user }) {
  // --- STATES ---
  const [activeTab, setActiveTab] = useState('audit'); // 'audit' | 'backup'
  
  // Audit States
  const [logs] = useState(INITIAL_LOGS);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterModule, setFilterModule] = useState('All Modules');
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [sortBy, setSortBy] = useState('timestamp');
  const [sortDir, setSortDir] = useState('desc');
  const [isSortOpen, setIsSortOpen] = useState(false);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);

  // Backup States
  const [autoBackupConfig, setAutoBackupConfig] = useState({
    enabled: true,
    frequency: 'daily',
    time: '02:00',
    retention: '30'
  });
  const [isRestoreModalOpen, setIsRestoreModalOpen] = useState(false);
  const [notification, setNotification] = useState({ show: false, message: '', type: 'success' });

  // --- HELPERS ---
  const showNotification = (msg, type = 'success') => {
    setNotification({ show: true, message: msg, type });
    setTimeout(() => setNotification({ show: false, message: '', type: 'success' }), 4000);
  };

  // --- LOGIC: AUDIT SORTING & FILTERING ---
  const toggleSort = (key) => {
    if (sortBy === key) setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    else { setSortBy(key); setSortDir('desc'); }
  };

  let processedLogs = logs.filter(log => {
    const matchesSearch = log.user_name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          log.action.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          log.details.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesModule = filterModule === 'All Modules' || log.module === filterModule;
    return matchesSearch && matchesModule;
  });

  processedLogs.sort((a, b) => {
    let valA = a[sortBy], valB = b[sortBy];
    if (sortBy === 'timestamp') {
      valA = new Date(valA).getTime(); valB = new Date(valB).getTime();
    } else {
      valA = valA.toLowerCase(); valB = valB.toLowerCase();
    }
    if (valA < valB) return sortDir === 'asc' ? -1 : 1;
    if (valA > valB) return sortDir === 'asc' ? 1 : -1;
    return 0;
  });

  // --- ACTIONS ---
  const handleExportPDF = (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const startDate = formData.get('start_date');
    const endDate = formData.get('end_date');
    const targetModule = formData.get('target_module');
    
    // 1. Filter the logs based on the modal inputs
    const exportLogs = logs.filter(log => {
      const logDate = new Date(log.timestamp).toISOString().split('T')[0];
      const matchesModule = targetModule === 'All Modules' || log.module === targetModule;
      const matchesDate = logDate >= startDate && logDate <= endDate;
      return matchesModule && matchesDate;
    });

    if (exportLogs.length === 0) {
      setIsExportModalOpen(false);
      showNotification('No logs found for the selected date range and module.', 'warning');
      return;
    }

    // 2. Generate a clean HTML Document to trigger Print to PDF
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
                <th>Date & Time</th>
                <th>User & Role</th>
                <th>Module</th>
                <th>Action</th>
                <th>Details</th>
              </tr>
            </thead>
            <tbody>
    `;

    exportLogs.forEach(log => {
      const dateStr = new Date(log.timestamp).toLocaleString('en-GB', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });
      htmlContent += `
        <tr>
          <td class="timestamp">${dateStr}</td>
          <td><strong>${log.user_name}</strong><br><span style="color:#666; font-size:10px;">${log.role}</span></td>
          <td>${log.module}</td>
          <td><strong>${log.action}</strong></td>
          <td>${log.details}</td>
        </tr>
      `;
    });

    htmlContent += `
            </tbody>
          </table>
        </body>
      </html>
    `;

    printWindow.document.write(htmlContent);
    printWindow.document.close();
    printWindow.focus();

    // 3. Trigger the print dialog automatically
    setTimeout(() => {
      printWindow.print();
      // Optional: close the window after printing, but leaving it open is safer for some browsers
      // printWindow.close(); 
    }, 500);

    setIsExportModalOpen(false);
    showNotification(`Successfully generated PDF report for ${exportLogs.length} logs. Please use the print dialog to save.`);
  };

  const handleManualBackup = () => {
    showNotification('System backup initiated. Downloading PTC_DB_Backup.zip...');
  };

  const handleSaveAutoBackup = (e) => {
    e.preventDefault();
    showNotification('Automated backup schedule updated successfully.');
  };

  const handleRestoreSubmit = (e) => {
    e.preventDefault();
    setIsRestoreModalOpen(false);
    showNotification('System restore sequence initiated successfully.', 'warning');
  };

  return (
    <div className="space-y-6 h-full max-w-[1600px] mx-auto animate-in fade-in duration-300 relative">
      
      {/* NOTIFICATION TOAST */}
      {notification.show && (
        <div className={`fixed top-8 right-8 z-[9999] p-4 rounded-2xl shadow-xl flex items-center animate-in slide-in-from-top-4 border ${notification.type === 'success' ? 'bg-green-50 border-green-200 text-green-800' : 'bg-yellow-50 border-yellow-200 text-yellow-800'}`}>
          {notification.type === 'success' ? <CheckCircle2 className="mr-3 shrink-0" size={20}/> : <AlertTriangle className="mr-3 shrink-0" size={20}/>}
          <p className="text-sm font-bold">{notification.message}</p>
        </div>
      )}

      {/* =========================================
          MODALS PORTAL
          ========================================= */}
      
      {/* 1. EXPORT PDF MODAL */}
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

      {/* 2. SYSTEM RESTORE MODAL */}
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
          
          {/* Integrated Toolbar */}
          <div className="p-4 border-b border-gray-100 bg-gray-50/30 flex flex-wrap items-center gap-4">
            
            {/* Search Bar */}
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
              
              {/* Custom Sort Dropdown Component */}
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

              {/* Filter Dropdown */}
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

              {/* Export Button */}
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
            <table className="w-full text-left border-collapse min-w-[1000px]">
              <thead className="bg-white border-b border-gray-100">
                <tr>
                  <th className="px-6 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest w-48">Date & Time</th>
                  <th className="px-6 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest w-48">User & Role</th>
                  <th className="px-6 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest w-40">Module</th>
                  <th className="px-6 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest w-48">Action</th>
                  <th className="px-6 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {processedLogs.length === 0 ? (
                  <tr>
                    <td colSpan="5" className="py-24 text-center">
                      <History className="mx-auto text-gray-200 mb-4" size={48} />
                      <p className="text-gray-500 font-bold">No audit logs found matching criteria.</p>
                    </td>
                  </tr>
                ) : (
                  processedLogs.map((log) => (
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
                      <td className="px-6 py-4 text-sm font-bold text-gray-800">
                        {log.action}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600 font-medium">
                        {log.details}
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
              className="w-full py-3.5 px-4 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-md transition-all active:scale-95 flex justify-center items-center"
            >
              <HardDrive size={18} className="mr-2" /> Download Backup Now
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

          {/* Card 3: Automated Backup Settings */}
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
                    type="checkbox" 
                    className="sr-only peer" 
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