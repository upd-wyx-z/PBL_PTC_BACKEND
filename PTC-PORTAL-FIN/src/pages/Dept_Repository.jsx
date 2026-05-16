import React, { useState, useRef, useCallback, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { 
  FileText, FileSpreadsheet, Image as ImageIcon, File, 
  Search, Eye, Download, X, Lock, Globe, Shield, 
  Calendar, User, FolderOpen, ArrowUpDown, ArrowUp, 
  ArrowDown, SlidersHorizontal, Upload, Users,
  FileImage, Film, Archive, Layers, Trash2
} from 'lucide-react';

// --- API BASE ---
const API_BASE = '/api';

// --- HELPERS ---
const formatBytes = (bytes) => {
  if (!bytes) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const getFileIcon = (mime) => {
  if (!mime) return <File size={20} className="text-gray-400" />;
  if (mime.includes('pdf')) return <FileText size={20} className="text-red-500" />;
  if (mime.includes('sheet') || mime.includes('excel') || mime.includes('csv')) return <FileSpreadsheet size={20} className="text-green-600" />;
  if (mime.includes('word') || mime.includes('document')) return <FileText size={20} className="text-blue-500" />;
  if (mime.includes('presentation') || mime.includes('powerpoint')) return <Layers size={20} className="text-orange-500" />;
  if (mime.includes('image')) return <FileImage size={20} className="text-purple-500" />;
  if (mime.includes('video')) return <Film size={20} className="text-pink-500" />;
  if (mime.includes('zip') || mime.includes('rar')) return <Archive size={20} className="text-yellow-600" />;
  return <File size={20} className="text-gray-400" />;
};

const getFileBg = (mime) => {
  if (!mime) return 'bg-gray-50';
  if (mime.includes('pdf')) return 'bg-red-50';
  if (mime.includes('sheet') || mime.includes('excel')) return 'bg-green-50';
  if (mime.includes('word') || mime.includes('document')) return 'bg-blue-50';
  if (mime.includes('presentation')) return 'bg-orange-50';
  if (mime.includes('image')) return 'bg-purple-50';
  return 'bg-gray-50';
};

const getVisibilityIcon = (vis) => {
  switch(vis) {
    case 'public': 
    case 'all': return <Globe size={14} className="text-blue-500" title="All Staff" />;
    case 'admins': return <Shield size={14} className="text-orange-500" title="Admins Only" />;
    case 'specific': return <Users size={14} className="text-blue-400" title="Specific People" />;
    case 'private': return <Lock size={14} className="text-red-500" title="Only Me" />;
    default: return <Globe size={14} className="text-gray-400" />;
  }
};

export default function Repository({ user }) {
  if (!user) return <div className="p-8 text-center text-gray-500">Loading repository...</div>;
  
  const currentUserId = user?.user_id;
  const userRole      = user?.role_name || 'faculty';
  const isSysAdmin    = userRole === 'system_admin';

  const [files, setFiles]           = useState([]);
  const [schoolYears, setSchoolYears] = useState([]);
  const [subjects, setSubjects]     = useState([]);
  const [allUsers, setAllUsers]     = useState([]);
  const [isUploading, setIsUploading] = useState(false);
  const [errorMsg, setErrorMsg]     = useState('');
  const [toast, setToast] = useState({ show: false, message: '', type: 'success' });

  // Toast helper
  const showToast = (message, type = 'success') => {
    setToast({ show: true, message, type });
    setTimeout(() => setToast({ show: false, message: '', type: 'success' }), 3500);
  };
  
  // States for Search & Filter
  const [searchTerm, setSearchTerm] = useState('');
  const [filterSY, setFilterSY] = useState('All');
  const [isFilterOpen, setIsFilterOpen] = useState(false);

  // States for Custom Sorting
  const [sortBy, setSortBy] = useState('upload_date');
  const [sortDir, setSortDir] = useState('desc');
  const [isSortOpen, setIsSortOpen] = useState(false);

  // Modal States
  const [viewModalData, setViewModalData] = useState(null);
  const [uploadModal, setUploadModal] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [isDragging, setIsDragging] = useState(false);

  const fileInputRef = useRef();

  // ── Fetch all data on mount ──────────────────────────────
  useEffect(() => {
    fetchFiles();
    fetchLookups();
  }, []);

  const fetchFiles = async () => {
    try {
      const res = await fetch(`${API_BASE}/repository`, { credentials: 'include' });
      if (res.ok) setFiles(await res.json());
    } catch (err) { console.error('fetchFiles error:', err); }
  };

  const fetchLookups = async () => {
    try {
      const [syRes, subRes, usersRes] = await Promise.all([
        fetch(`${API_BASE}/repository/lookup/school-years`, { credentials: 'include' }),
        fetch(`${API_BASE}/repository/lookup/subjects`,     { credentials: 'include' }),
        fetch(`${API_BASE}/repository/lookup/users`,        { credentials: 'include' }),
      ]);
      if (syRes.ok)    setSchoolYears(await syRes.json());
      if (subRes.ok)   setSubjects(await subRes.json());
      if (usersRes.ok) setAllUsers(await usersRes.json());
    } catch (err) { console.error('fetchLookups error:', err); }
  };

  const [uploadForm, setUploadForm] = useState({
    title: '', sy_id: 1, subject_id: '',
    remarks_faculty: '', deadline: '', visibility: 'all', visible_to: [],
    file: null,
  });

  // --- SORTING & FILTERING LOGIC ---
  const toggleSort = (key) => {
    if (sortBy === key) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(key);
      setSortDir('desc');
    }
  };

  let processedFiles = files.filter(f => {
    const matchesSearch = f.file_name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          (f.title && f.title.toLowerCase().includes(searchTerm.toLowerCase()));
    
    // Visibility Security Logic
    let hasAccess = true;
    if (f.visibility === 'private' && f.uploader_id !== currentUserId) {
      hasAccess = false;
    } else if (f.visibility === 'admins' && !userRole.startsWith('admin_') && f.uploader_id !== currentUserId) {
      hasAccess = false;
    } else if (f.visibility === 'specific' && f.uploader_id !== currentUserId && !f.visible_to?.includes(currentUserId)) {
      hasAccess = false;
    }

    return matchesSearch && hasAccess;
  });

  processedFiles.sort((a, b) => {
    let valA = a[sortBy] || '';
    let valB = b[sortBy] || '';

    if (sortBy === 'upload_date') {
      valA = new Date(valA).getTime();
      valB = new Date(valB).getTime();
    } else if (typeof valA === 'string') {
      valA = valA.toLowerCase();
      valB = valB.toLowerCase();
    }

    if (valA < valB) return sortDir === 'asc' ? -1 : 1;
    if (valA > valB) return sortDir === 'asc' ? 1 : -1;
    return 0;
  });

  const activeFilterCount = filterSY !== 'All' ? 1 : 0;

  // Format bytes from DB (file_size_bytes integer)
  const getSize = (file) => file.file_size_bytes ? formatBytes(file.file_size_bytes) : (file.size || '—');

  // --- ACTIONS ---
  const handleDownload = async (file) => {
    try {
      const res = await fetch(`${API_BASE}/repository/${file.file_id}/download`, {
        credentials: 'include',
      });
      if (!res.ok) { alert('Download failed.'); return; }
      const blob = await res.blob();
      const url  = window.URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href     = url;
      a.download = file.file_name;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      // Update download count locally
      setFiles(prev => prev.map(f => f.file_id === file.file_id ? { ...f, download_count: (f.download_count || 0) + 1 } : f));
      showToast(`"${file.title || file.file_name}" downloaded successfully!`);
    } catch (err) { showToast('Download failed. Please try again.', 'error'); }
  };

  const handleDeleteFile = async () => {
    const fileName = deleteTarget?.title || deleteTarget?.file_name || 'File';
    try {
      const res = await fetch(`${API_BASE}/repository/${deleteTarget.file_id}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (res.ok) {
        setFiles(prev => prev.filter(f => f.file_id !== deleteTarget.file_id));
        setDeleteTarget(null);
        setViewModalData(null);
        showToast(`"${fileName}" has been successfully deleted!`);
      } else {
        const data = await res.json();
        showToast(data.message || 'Delete failed. Please try again.', 'error');
      }
    } catch (err) { showToast('Delete failed. Please try again.', 'error'); }
  };

  // --- UPLOAD HANDLERS ---
  const handleFileDrop = useCallback((e) => {
    e.preventDefault(); setIsDragging(false);
    const f = e.dataTransfer?.files?.[0] || e.target?.files?.[0];
    if (f) setUploadForm(prev => ({ ...prev, file: f }));
  }, []);

  const handleUploadSubmit = async (e) => {
    e.preventDefault();
    if (!uploadForm.file || !uploadForm.title) return;
    setIsUploading(true);
    setErrorMsg('');
    try {
      const formData = new FormData();
      formData.append('file',             uploadForm.file);
      formData.append('title',            uploadForm.title);
      formData.append('sy_id',            uploadForm.sy_id || '');
      formData.append('subject_id',       uploadForm.subject_id || '');
      formData.append('remarks_faculty',  uploadForm.remarks_faculty || '');
      formData.append('visibility',       uploadForm.visibility);
      formData.append('visible_to',       JSON.stringify(uploadForm.visible_to));

      const res = await fetch(`${API_BASE}/repository/upload`, {
        method:      'POST',
        credentials: 'include',
        body:        formData,
        // NO Content-Type header — browser sets it automatically for FormData
      });

      const data = await res.json();
      if (!res.ok) { setErrorMsg(data.message || 'Upload failed.'); return; }

      setFiles(prev => [data.file, ...prev]);
      setUploadModal(false);
      setUploadForm({ title: '', sy_id: 1, subject_id: '', remarks_faculty: '', deadline: '', visibility: 'all', visible_to: [], file: null });
      showToast(`"${data.file?.title || uploadForm.title}" uploaded successfully!`);
    } catch (err) {
      setErrorMsg('Upload failed. Please try again.');
    } finally {
      setIsUploading(false);
    }
  };


  return (
    <div className="space-y-6 h-full max-w-[1600px] mx-auto animate-in fade-in duration-300 relative">

      {/* Toast Notification */}
      {toast.show && (
        <div className={`fixed top-6 right-6 z-[99999] flex items-center gap-3 px-5 py-4 rounded-2xl shadow-2xl border animate-in fade-in slide-in-from-top-4 duration-300 ${
          toast.type === 'error'
            ? 'bg-red-50 border-red-200 text-red-800'
            : 'bg-green-50 border-green-200 text-green-800'
        }`}>
          <span className="text-sm font-bold">{toast.message}</span>
          <button onClick={() => setToast({ show: false, message: '', type: 'success' })}
            className="ml-2 text-gray-400 hover:text-gray-600 transition-colors">
            <X size={16} />
          </button>
        </div>
      )}

      {/* =========================================
          MODAL: UPLOAD DOCUMENT
          ========================================= */}
      {uploadModal && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in" onClick={() => setUploadModal(false)}>
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-xl p-6 sm:p-8 flex flex-col max-h-[92vh] animate-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-6 shrink-0">
              <div>
                <h2 className="text-xs font-black text-gray-400 uppercase tracking-[0.2em]">Department Repository</h2>
                <p className="text-lg font-bold text-gray-900 mt-0.5">Upload New Document</p>
              </div>
              <button onClick={() => setUploadModal(false)} className="p-2 border border-gray-200 rounded-full hover:bg-gray-50 text-gray-500 transition-all active:scale-90"><X size={18} /></button>
            </div>

            <form onSubmit={handleUploadSubmit} className="space-y-5 overflow-y-auto pr-1 flex-1 custom-scrollbar">
              {errorMsg && (
                <div className="bg-red-50 border-l-4 border-red-500 p-3 rounded-lg text-sm text-red-800 font-medium">
                  {errorMsg}
                </div>
              )}
              {/* DROP ZONE */}
              <div
                onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={handleFileDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer transition-all ${isDragging ? 'border-green-500 bg-green-50' : uploadForm.file ? 'border-green-400 bg-green-50/50' : 'border-gray-200 hover:border-green-400 hover:bg-gray-50'}`}
              >
                <input ref={fileInputRef} type="file" className="hidden"
                  accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.jpg,.jpeg,.png"
                  onChange={handleFileDrop} />
                {uploadForm.file ? (
                  <div className="flex items-center justify-center gap-3">
                    <div className={`p-2 rounded-xl ${getFileBg(uploadForm.file.type)}`}>{getFileIcon(uploadForm.file.type)}</div>
                    <div className="text-left">
                      <p className="text-sm font-bold text-gray-800 truncate max-w-[260px]">{uploadForm.file.name}</p>
                      <p className="text-xs text-gray-500">{formatBytes(uploadForm.file.size)}</p>
                    </div>
                    <button type="button" onClick={(e) => { e.stopPropagation(); setUploadForm(p => ({ ...p, file: null })); }}
                      className="ml-auto p-1.5 hover:bg-red-50 rounded-lg text-gray-400 hover:text-red-500 transition-colors">
                      <X size={14} />
                    </button>
                  </div>
                ) : (
                  <>
                    <Upload className="mx-auto text-gray-300 mb-3" size={36} />
                    <p className="text-sm font-bold text-gray-600">Drop file here or <span className="text-green-700 underline">browse</span></p>
                    <p className="text-xs text-gray-400 mt-1">PDF, DOC, DOCX, XLS, XLSX, PPT, PPTX, JPG, PNG — max 500 MB</p>
                  </>
                )}
              </div>

              {/* TITLE */}
              <div>
                <div className="flex justify-between mb-1.5">
                  <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Document Title</label>
                  <span className={`text-[10px] font-bold ${uploadForm.title.length >= 100 ? 'text-red-500' : 'text-gray-400'}`}>{uploadForm.title.length}/100</span>
                </div>
                <input type="text" required maxLength={100}
                  value={uploadForm.title}
                  onChange={e => setUploadForm(p => ({ ...p, title: e.target.value.slice(0, 100) }))}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-green-600 outline-none font-medium text-gray-800 text-sm"
                  placeholder="e.g. IT301 Syllabus 2nd Semester 2026" />
              </div>

              <div className="grid grid-cols-2 gap-4">
                {/* SCHOOL YEAR */}
                <div>
                  <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1.5">School Year</label>
                  <select value={uploadForm.sy_id} onChange={e => setUploadForm(p => ({ ...p, sy_id: e.target.value }))}
                    className="w-full p-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-green-600 outline-none text-sm font-medium text-gray-800">
                    {schoolYears.map(sy => <option key={sy.sy_id} value={sy.sy_id}>{sy.sy_label} — {sy.semester} Sem</option>)}
                  </select>
                </div>
                {/* SUBJECT */}
                <div>
                  <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1.5">Subject <span className="normal-case text-gray-400">(optional)</span></label>
                  <select value={uploadForm.subject_id} onChange={e => setUploadForm(p => ({ ...p, subject_id: e.target.value }))}
                    className="w-full p-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-green-600 outline-none text-sm font-medium text-gray-800">
                    <option value="">— None —</option>
                    {subjects.map(s => <option key={s.subject_id} value={s.subject_id}>{s.subject_code} — {s.subject_name}</option>)}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1.5">Submission Deadline <span className="normal-case text-gray-400">(optional)</span></label>
                <input type="datetime-local" value={uploadForm.deadline}
                  onChange={e => setUploadForm(p => ({ ...p, deadline: e.target.value }))}
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-green-600 outline-none text-sm font-medium text-gray-800" />
              </div>

              {/* REMARKS */}
              <div>
                <div className="flex justify-between mb-1.5">
                  <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Remarks / Notes</label>
                  <span className={`text-[10px] font-bold ${uploadForm.remarks_faculty.length >= 200 ? 'text-red-500' : 'text-gray-400'}`}>{uploadForm.remarks_faculty.length}/200</span>
                </div>
                <textarea rows="2" maxLength={200}
                  value={uploadForm.remarks_faculty}
                  onChange={e => setUploadForm(p => ({ ...p, remarks_faculty: e.target.value.slice(0, 200) }))}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-green-600 outline-none text-sm font-medium text-gray-800 resize-none"
                  placeholder="Optional context or notes about this file..." />
              </div>

              {/* VISIBILITY */}
              <div>
                <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-2">Who Can See This</label>
                <div className="flex gap-2">
                  {[
                    { val: 'all',      label: 'All Staff',     icon: <Globe size={14} /> },
                    { val: 'specific', label: 'Specific',      icon: <Users size={14} /> },
                    { val: 'private',  label: 'Only Me',       icon: <Lock size={14} /> },
                  ].map(opt => (
                    <button key={opt.val} type="button"
                      onClick={() => setUploadForm(p => ({ ...p, visibility: opt.val, visible_to: [] }))}
                      className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-bold border transition-all ${uploadForm.visibility === opt.val ? 'bg-[#0e5c2b] text-white border-[#0e5c2b]' : 'bg-white text-gray-600 border-gray-200 hover:border-green-400'}`}>
                      {opt.icon} {opt.label}
                    </button>
                  ))}
                </div>
                
                {uploadForm.visibility === 'specific' && (
                  <div className="mt-3 space-y-2">
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Select people:</p>
                    {allUsers.map(u => (
                      <label key={u.user_id} className="flex items-center gap-3 p-3 rounded-xl border border-gray-100 hover:bg-gray-50 cursor-pointer transition-colors">
                        <input type="checkbox"
                          checked={uploadForm.visible_to.includes(u.user_id)}
                          onChange={e => setUploadForm(p => ({
                            ...p,
                            visible_to: e.target.checked
                              ? [...p.visible_to, u.user_id]
                              : p.visible_to.filter(id => id !== u.user_id)
                          }))}
                          className="w-4 h-4 text-green-600 border-gray-300 rounded focus:ring-green-600" />
                        <div>
                          <p className="text-sm font-bold text-gray-800 leading-tight">{u.name}</p>
                          <p className="text-[10px] text-gray-400 uppercase tracking-wider">{u.role.replace('_', ' ')}</p>
                        </div>
                      </label>
                    ))}
                  </div>
                )}
              </div>
            </form>

            <div className="mt-6 pt-5 border-t border-gray-100 flex justify-end gap-3 shrink-0">
              <button type="button" onClick={() => setUploadModal(false)} className="px-5 py-2.5 text-sm font-bold text-gray-600 hover:bg-gray-100 rounded-xl transition-all">Cancel</button>
              <button type="submit" onClick={handleUploadSubmit}
                disabled={!uploadForm.file || !uploadForm.title}
                className="px-6 py-2.5 text-sm font-bold text-white bg-[#0e5c2b] hover:bg-[#0a4720] rounded-xl shadow-md transition-all flex items-center active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed">
                <Upload size={15} className="mr-2" /> Upload to Repository
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* =========================================
          MODAL: VIEW & PREVIEW FILE
          ========================================= */}
      {viewModalData && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in" onClick={() => setViewModalData(null)}>
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-4xl h-[85vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
            <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/50 shrink-0">
              <div className="flex items-center">
                <div className="p-2 bg-white rounded-lg border border-gray-200 shadow-sm mr-4">
                  {getFileIcon(viewModalData.file_type)}
                </div>
                <div>
                  <h2 className="text-lg font-bold text-gray-900 leading-tight">{viewModalData.title || viewModalData.file_name}</h2>
                  <div className="text-xs text-gray-500 font-medium flex items-center mt-1">
                    {viewModalData.size} • Uploaded by {viewModalData.uploaded_by} • 
                    <span className="mx-2 flex items-center gap-1 bg-gray-200 px-2 py-0.5 rounded text-[10px] uppercase font-bold text-gray-600 tracking-wider">
                      {getVisibilityIcon(viewModalData.visibility)} 
                      <span className="ml-1">{viewModalData.visibility}</span>
                    </span>
                  </div>
                </div>
              </div>
              <button onClick={() => setViewModalData(null)} className="p-2 bg-white border border-gray-200 rounded-full hover:bg-red-50 hover:text-red-600 transition-all shadow-sm active:scale-90">
                <X size={18} strokeWidth={2.5} />
              </button>
            </div>

            <div className="flex-1 bg-gray-100 relative overflow-hidden">
              {/* PDF Viewer — uses browser built-in PDF renderer */}
              {viewModalData.file_type?.includes('pdf') ? (
                <iframe
                  src={`/api/repository/${viewModalData.file_id}/view`}
                  className="w-full h-full border-0"
                  title={viewModalData.file_name}
                />
              ) : (
                /* Non-PDF files — show download prompt */
                <div className="w-full h-full flex items-center justify-center p-6">
                  <div className="absolute inset-0 opacity-10 bg-[radial-gradient(#000_1px,transparent_1px)] [background-size:16px_16px]"></div>
                  <div className="bg-white w-full max-w-md rounded-xl shadow-lg border border-gray-200 p-10 flex flex-col items-center justify-center text-center relative z-10">
                    <div className="p-4 bg-gray-50 rounded-full mb-4">
                      {getFileIcon(viewModalData.file_type)}
                    </div>
                    <h3 className="text-lg font-bold text-gray-800 mb-2">Preview Not Available</h3>
                    <p className="text-sm text-gray-500 mb-1">
                      <strong>{viewModalData.file_name}</strong>
                    </p>
                    <p className="text-xs text-gray-400 mt-2">
                      Only PDF files can be previewed directly. Please download the file to view it.
                    </p>
                  </div>
                </div>
              )}
            </div>

            <div className="px-6 py-4 border-t border-gray-100 bg-white shrink-0 flex justify-end items-center gap-3">
              {(isSysAdmin || viewModalData.uploader_id === currentUserId) && (
                <button 
                  onClick={() => {
                    setViewModalData(null);
                    setDeleteTarget(viewModalData);
                  }}
                  className="px-6 py-2.5 text-sm font-bold text-red-600 bg-red-50 hover:bg-red-100 rounded-xl shadow-sm transition-all active:scale-95 flex items-center"
                >
                  <Trash2 size={18} className="mr-2" /> Delete
                </button>
              )}
              <button 
                onClick={() => handleDownload(viewModalData)}
                className="px-6 py-2.5 text-sm font-bold text-white bg-[#0e5c2b] hover:bg-[#0a4720] rounded-xl shadow-md transition-all active:scale-95 flex items-center"
              >
                <Download size={18} className="mr-2" /> Download File
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* =========================================
          MODAL: DELETE CONFIRMATION
          ========================================= */}
      {deleteTarget && createPortal(
        <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in" onClick={() => setDeleteTarget(null)}>
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm p-8 text-center animate-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
            <div className="w-16 h-16 bg-red-50 text-red-600 rounded-full flex items-center justify-center mx-auto mb-6 border-4 border-white shadow-sm">
              <Trash2 size={32} />
            </div>
            <h3 className="text-xl font-bold text-gray-900 mb-2">Delete File?</h3>
            <p className="text-sm text-gray-500 mb-8 leading-relaxed">
              Are you sure you want to permanently delete <strong>{deleteTarget.title || deleteTarget.file_name}</strong>? This action cannot be undone.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setDeleteTarget(null)}
                className="flex-1 py-3.5 px-4 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-xl transition-all"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteFile}
                className="flex-1 py-3.5 px-4 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl shadow-md transition-all active:scale-95"
              >
                Yes, Delete
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* =========================================
          PAGE HEADER
          ========================================= */}
      <div className="bg-white p-6 sm:p-8 rounded-3xl shadow-sm border border-gray-100 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-6 relative overflow-hidden">
        <div className="absolute right-0 top-0 w-64 h-64 bg-green-50 rounded-full mix-blend-multiply filter blur-3xl opacity-50 -translate-y-1/2 translate-x-1/4 z-0"></div>
        
        <div className="relative z-10">
          <h1 className="text-3xl font-bold text-gray-900 tracking-tight mb-1 flex items-center">
             Department Repository
          </h1>
          <p className="text-sm text-gray-500 font-medium">Browse, upload, and download shared departmental resources.</p>
        </div>

        <div className="relative z-10 flex gap-3 shrink-0">
          <button onClick={() => setUploadModal(true)}
            className="px-6 py-3 bg-[#0e5c2b] hover:bg-[#0a4720] text-white font-bold rounded-xl text-sm transition-all shadow-lg shadow-green-900/20 flex items-center active:scale-95">
            <Upload size={18} className="mr-2" /> Upload Document
          </button>
        </div>
      </div>

      {/* =========================================
          MAIN TABLE & TOOLBAR
          ========================================= */}
      <div className="bg-white rounded-3xl shadow-xl border border-gray-100 overflow-hidden flex flex-col min-h-[500px]">
        
        {/* Integrated Toolbar */}
        <div className="p-4 border-b border-gray-200 bg-white flex flex-row items-center gap-3 flex-wrap">
          
          {/* TOTAL FILES BADGE */}
          <div className="px-4 py-2 border border-gray-200 rounded-lg flex items-center gap-3 bg-gray-50 shrink-0">
            <FolderOpen size={16} className="text-green-700" />
            <div>
              <span className="text-lg font-bold text-gray-900 leading-none">{processedFiles.length}</span>
              <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-2">Files</span>
            </div>
          </div>

          {/* Search Bar */}
          <div className="relative shrink min-w-[200px] flex-1 max-w-md">
            <Search className="absolute left-3.5 top-2.5 text-gray-400" size={16} />
            <input 
              type="text" 
              placeholder="Search by file name or title..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-green-600 outline-none text-sm font-medium transition-shadow bg-gray-50 focus:bg-white"
            />
          </div>
          
          {/* Actions */}
          <div className="flex items-center gap-3 shrink-0 ml-auto">
            
            {/* Custom Sort Dropdown Component */}
            <div className="relative">
              <button 
                onClick={() => setIsSortOpen(!isSortOpen)}
                className="flex items-center justify-center gap-2 px-4 py-2 bg-white border border-gray-200 text-gray-700 font-bold rounded-lg text-sm hover:bg-gray-50 transition-all shadow-sm">
                <ArrowUpDown size={15} /> Sort
              </button>
              
              {isSortOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setIsSortOpen(false)}></div>
                  <div className="absolute right-0 top-full mt-2 bg-white rounded-2xl shadow-xl border border-gray-100 w-48 z-50 overflow-hidden">
                    {[
                      { key: 'upload_date', label: 'Date Uploaded' },
                      { key: 'file_name',   label: 'File Title' },
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
                className="flex items-center justify-center gap-2 px-4 py-2 bg-white border border-gray-200 text-gray-700 font-bold rounded-lg text-sm hover:bg-gray-50 transition-all shadow-sm">
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
                    <select value={filterSY} onChange={(e) => { setFilterSY(e.target.value); setIsFilterOpen(false); }} className="w-full p-2 border border-gray-200 rounded-xl outline-none text-sm font-medium">
                      <option value="All">All School Years</option>
                      {schoolYears.map(sy => <option key={sy.sy_id} value={sy.sy_id}>{sy.sy_label} — {sy.semester} Sem</option>)}
                    </select>
                  </div>
                </>
              )}
            </div>

          </div>
        </div>

        {/* Files Table */}
        <div className="overflow-x-auto flex-1">
          <table className="w-full text-left border-collapse">
            <thead className="bg-white border-b border-gray-100">
              <tr>
                <th className="px-8 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest">Document Name</th>
                <th className="px-6 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest w-48">Uploaded By</th>
                <th className="px-6 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest w-40">Date</th>
                <th className="px-6 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest w-32">Access Level</th>
                <th className="px-8 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest text-right w-32">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {processedFiles.length === 0 ? (
                <tr>
                  <td colSpan="5" className="py-24 text-center">
                    <FolderOpen className="mx-auto text-gray-200 mb-4" size={48} />
                    <p className="text-gray-500 font-bold">No documents found matching your filters.</p>
                  </td>
                </tr>
              ) : (
                processedFiles.map((file) => (
                  <tr 
                    key={file.file_id} 
                    className="hover:bg-green-50/40 transition-colors group cursor-pointer"
                    onClick={() => setViewModalData(file)}
                  >
                    <td className="px-8 py-5">
                      <div className="flex items-center">
                        <div className={`p-2.5 rounded-xl border border-gray-100 mr-4 group-hover:bg-white transition-colors ${getFileBg(file.file_type)}`}>
                          {getFileIcon(file.file_type)}
                        </div>
                        <div>
                          <div className="text-sm font-bold text-gray-900">{file.title || file.file_name}</div>
                          <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mt-0.5">{file.size} • {file.file_name}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-5">
                      <div className="flex items-center text-sm font-bold text-gray-700">
                        <User size={14} className="mr-2 text-gray-400" />
                        <span className="truncate">{file.uploaded_by}</span>
                      </div>
                    </td>
                    <td className="px-6 py-5 text-sm font-bold text-gray-500">
                       <div className="flex items-center">
                        <Calendar size={14} className="mr-2 text-gray-400" />
                        {new Date(file.upload_date).toLocaleDateString('en-GB', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </div>
                    </td>
                    <td className="px-6 py-5">
                      <div className="flex items-center text-xs font-bold uppercase tracking-wider text-gray-500" title={file.visibility}>
                        {getVisibilityIcon(file.visibility)}
                        <span className="ml-1.5">{file.visibility}</span>
                      </div>
                    </td>
                    <td className="px-8 py-5 text-right">
                      <div className="flex justify-end gap-2">
                        {/* Only show delete if user is SysAdmin OR the user uploaded the file */}
                        {(isSysAdmin || file.uploader_id === currentUserId) && (
                          <button 
                            onClick={(e) => { e.stopPropagation(); setDeleteTarget(file); }}
                            className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                            title="Delete Document"
                          >
                            <Trash2 size={18} />
                          </button>
                        )}
                        <button 
                          onClick={(e) => { e.stopPropagation(); setViewModalData(file); }}
                          className="p-2 text-gray-400 hover:text-green-700 hover:bg-green-50 rounded-lg transition-all"
                          title="View Document"
                        >
                          <Eye size={18} />
                        </button>
                        <button 
                          onClick={(e) => { e.stopPropagation(); handleDownload(file); }}
                          className="p-2 text-gray-400 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition-all"
                          title="Download"
                        >
                          <Download size={18} />
                        </button>
                      </div>
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