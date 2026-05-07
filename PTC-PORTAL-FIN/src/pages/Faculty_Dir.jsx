import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { 
  Search, X, User, Mail, Phone, Briefcase, Building, 
  ArrowUpDown, ArrowUp, ArrowDown, SlidersHorizontal, 
  Eye, Shield, Users
} from 'lucide-react';

// --- MOCK DATABASE DATA (Based on PTC_DB users & roles schema) ---
const DIRECTORY_USERS = [
  {
    user_id: 1,
    first_name: 'John Kennidy',
    last_name: 'Abunda',
    email: 'faculty@ptc.edu.ph',
    contact_no: '09123456789',
    role: 'Faculty',
    department: 'IICT',
    specialization: 'Web Systems and Technologies',
    profile_pic: null,
    status: 'Active'
  },
  {
    user_id: 2,
    first_name: 'Angel Cylo G.',
    last_name: 'Real',
    email: 'dean@ptc.edu.ph',
    contact_no: '09198765432',
    role: 'Dean',
    department: 'IICT',
    specialization: 'Information Assurance and Security',
    profile_pic: null,
    status: 'Active'
  },
  {
    user_id: 3,
    first_name: 'Maria Clara',
    last_name: 'Santos',
    email: 'registrar@ptc.edu.ph',
    contact_no: '09223334455',
    role: 'Registrar',
    department: 'Administration',
    specialization: 'Student Records & Admissions',
    profile_pic: null,
    status: 'Active'
  },
  {
    user_id: 4,
    first_name: 'Jose',
    last_name: 'Rizal',
    email: 'vpaa@ptc.edu.ph',
    contact_no: '09998887766',
    role: 'VPAA',
    department: 'Administration',
    specialization: 'Academic Affairs',
    profile_pic: null,
    status: 'Active'
  },
  {
    user_id: 5,
    first_name: 'Anna',
    last_name: 'Reyes',
    email: 'areyes@ptc.edu.ph',
    contact_no: '09176543210',
    role: 'Faculty',
    department: 'CBM',
    specialization: 'Business Administration',
    profile_pic: null,
    status: 'Active'
  }
];

const DEPARTMENTS = ['All Departments', 'IICT', 'CBM', 'Administration'];
const ROLES = ['All Roles', 'Faculty', 'Dean', 'Registrar', 'VPAA', 'System Admin'];

export default function Directory({ user }) {
  const [usersList] = useState(DIRECTORY_USERS);
  
  // --- STATES FOR SEARCH & FILTER ---
  const [searchTerm, setSearchTerm] = useState('');
  const [filterDept, setFilterDept] = useState('All Departments');
  const [filterRole, setFilterRole] = useState('All Roles');
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  
  // --- STATES FOR SORTING ---
  const [sortBy, setSortBy] = useState('name');
  const [sortDir, setSortDir] = useState('asc');

  // --- MODAL STATE ---
  const [selectedUser, setSelectedUser] = useState(null);

  // --- SORTING LOGIC ---
  const toggleSort = (key) => {
    if (sortBy === key) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(key);
      setSortDir('asc'); // Default to ascending for names/strings
    }
  };

  // --- FILTERING & PROCESSING LOGIC ---
  let processedUsers = usersList.filter(u => {
    const fullName = `${u.first_name} ${u.last_name}`.toLowerCase();
    const matchesSearch = fullName.includes(searchTerm.toLowerCase()) || 
                          u.email.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesDept = filterDept === 'All Departments' || u.department === filterDept;
    const matchesRole = filterRole === 'All Roles' || u.role === filterRole;

    return matchesSearch && matchesDept && matchesRole;
  });

  processedUsers.sort((a, b) => {
    let valA, valB;

    if (sortBy === 'name') {
      valA = a.last_name.toLowerCase();
      valB = b.last_name.toLowerCase();
    } else {
      valA = a[sortBy]?.toLowerCase() || '';
      valB = b[sortBy]?.toLowerCase() || '';
    }

    if (valA < valB) return sortDir === 'asc' ? -1 : 1;
    if (valA > valB) return sortDir === 'asc' ? 1 : -1;
    return 0;
  });

  let activeFilterCount = 0;
  if (filterDept !== 'All Departments') activeFilterCount++;
  if (filterRole !== 'All Roles') activeFilterCount++;

  return (
    <div className="space-y-6 h-full max-w-[1600px] mx-auto animate-in fade-in duration-300 relative">

      {/* =========================================
          MODAL: FILTER SETTINGS
          ========================================= */}
      {isFilterOpen && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in" onClick={() => setIsFilterOpen(false)}>
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm p-6 sm:p-8 animate-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-6 border-b border-gray-50 pb-4">
              <h2 className="text-sm font-bold text-gray-800 uppercase tracking-widest flex items-center">
                <SlidersHorizontal size={18} className="mr-2 text-green-700" /> Filter Directory
              </h2>
              <button onClick={() => setIsFilterOpen(false)} className="p-2 border border-gray-200 rounded-full hover:bg-gray-50 text-gray-600 transition-all active:scale-90">
                <X size={16} strokeWidth={2.5} />
              </button>
            </div>
            
            <div className="space-y-5">
              <div>
                <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Department</label>
                <select 
                  value={filterDept} 
                  onChange={(e) => setFilterDept(e.target.value)}
                  className="w-full p-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-green-600 outline-none text-sm font-medium"
                >
                  {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">System Role</label>
                <select 
                  value={filterRole} 
                  onChange={(e) => setFilterRole(e.target.value)}
                  className="w-full p-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-green-600 outline-none text-sm font-medium"
                >
                  {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
            </div>

            <div className="mt-8 pt-6 border-t border-gray-100 flex gap-3">
              <button onClick={() => { setFilterDept('All Departments'); setFilterRole('All Roles'); setIsFilterOpen(false); }} className="flex-1 px-4 py-3 text-sm font-bold text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-xl transition-all">
                Clear
              </button>
              <button onClick={() => setIsFilterOpen(false)} className="flex-1 px-4 py-3 text-sm font-bold text-white bg-gray-900 hover:bg-black rounded-xl shadow-md transition-all active:scale-95">
                Apply Filter
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* =========================================
          MODAL: USER PROFILE DETAILS
          ========================================= */}
      {selectedUser && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in" onClick={() => setSelectedUser(null)}>
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg flex flex-col overflow-hidden animate-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
            
            {/* Header / Cover Area */}
            <div className="h-32 bg-[#0e5c2b] relative">
              <button onClick={() => setSelectedUser(null)} className="absolute top-4 right-4 p-2 bg-white/20 hover:bg-white/40 text-white rounded-full transition-all backdrop-blur-sm">
                <X size={18} strokeWidth={2.5} />
              </button>
            </div>
            
            <div className="px-8 pb-8 relative -mt-16 text-center">
              {/* Profile Picture */}
              <div className="w-32 h-32 bg-white rounded-full p-1.5 shadow-xl mx-auto mb-4 border-4 border-white">
                <div className="w-full h-full bg-gray-50 rounded-full flex items-center justify-center text-[#0e5c2b] overflow-hidden">
                  {selectedUser.profile_pic ? (
                    <img src={selectedUser.profile_pic} alt={selectedUser.first_name} className="w-full h-full object-cover" />
                  ) : (
                    <User size={50} />
                  )}
                </div>
              </div>
              
              <h2 className="text-2xl font-bold text-gray-900 leading-tight">
                {selectedUser.first_name} {selectedUser.last_name}
              </h2>
              <p className="text-[10px] font-black text-green-700 uppercase tracking-widest bg-green-50 px-3 py-1.5 rounded-full inline-block mt-3 border border-green-100 shadow-sm">
                {selectedUser.role}
              </p>

              {/* ID Card Info Section */}
              <div className="w-full mt-8 grid grid-cols-1 sm:grid-cols-2 gap-4 text-left">
                <div className="flex flex-col bg-gray-50 p-4 rounded-2xl border border-gray-100">
                  <span className="text-[9px] font-black text-gray-400 uppercase tracking-[0.2em] mb-1.5">Department</span>
                  <span className="text-sm font-bold text-gray-800 flex items-center">
                    <Building size={16} className="mr-2 text-green-700"/> {selectedUser.department}
                  </span>
                </div>
                <div className="flex flex-col bg-gray-50 p-4 rounded-2xl border border-gray-100">
                  <span className="text-[9px] font-black text-gray-400 uppercase tracking-[0.2em] mb-1.5">Specialization</span>
                  <span className="text-sm font-bold text-gray-800 flex items-center">
                    <Briefcase size={16} className="mr-2 text-green-700"/> {selectedUser.specialization}
                  </span>
                </div>
                <div className="flex flex-col bg-gray-50 p-4 rounded-2xl border border-gray-100">
                  <span className="text-[9px] font-black text-gray-400 uppercase tracking-[0.2em] mb-1.5">Email Address</span>
                  <span className="text-sm font-bold text-gray-800 flex items-center">
                    <Mail size={16} className="mr-2 text-green-700"/> 
                    <a href={`mailto:${selectedUser.email}`} className="hover:underline hover:text-green-700 truncate">{selectedUser.email}</a>
                  </span>
                </div>
                <div className="flex flex-col bg-gray-50 p-4 rounded-2xl border border-gray-100">
                  <span className="text-[9px] font-black text-gray-400 uppercase tracking-[0.2em] mb-1.5">Contact No.</span>
                  <span className="text-sm font-bold text-gray-800 flex items-center">
                    <Phone size={16} className="mr-2 text-green-700"/> {selectedUser.contact_no}
                  </span>
                </div>
              </div>

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
             Faculty Directory
          </h1>
          <p className="text-sm text-gray-500 font-medium">Search and connect with faculty members and administrators.</p>
        </div>
      </div>

      {/* =========================================
          MAIN TABLE & TOOLBAR
          ========================================= */}
      <div className="bg-white rounded-3xl shadow-xl border border-gray-100 overflow-hidden flex flex-col min-h-[500px]">
        
        {/* Integrated Toolbar */}
        <div className="p-5 border-b border-gray-100 bg-gray-50/30 flex flex-col xl:flex-row justify-between items-center gap-4">
          
          {/* TOTAL USERS METRIC - Integrated into the left side */}
          <div className="flex items-center gap-3 shrink-0 pr-4 xl:border-r border-gray-200 w-full xl:w-auto">
            <div className="p-2 bg-green-50 rounded-lg border border-green-100">
              <Users size={20} className="text-green-700" />
            </div>
            <div>
              <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-0.5">Total Members</p>
              <h2 className="text-lg font-bold text-gray-900 leading-none">{processedUsers.length} <span className="text-xs text-gray-400 font-medium">Active</span></h2>
            </div>
          </div>

          {/* Search Bar */}
          <div className="flex-1 w-full relative">
            <Search className="absolute left-3.5 top-3 text-gray-400" size={16} />
            <input 
              type="text" 
              placeholder="Search by name or email..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-green-600 outline-none text-sm font-medium transition-shadow shadow-sm bg-white"
            />
          </div>
          
          {/* Filter & Sort Actions */}
          <div className="flex space-x-3 w-full xl:w-auto">
            
            {/* Custom Sort Dropdown Component */}
            <div className="relative group w-full xl:w-auto">
              <button className="w-full flex items-center justify-center xl:justify-start gap-2 px-4 py-2.5 bg-white border border-gray-200 text-gray-700 font-bold rounded-xl text-sm hover:bg-gray-50 transition-all shadow-sm">
                <ArrowUpDown size={15} /> Sort
              </button>
              <div className="absolute right-0 top-full mt-1.5 bg-white rounded-2xl shadow-xl border border-gray-100 w-48 z-50 hidden group-hover:block overflow-hidden">
                {[
                  { key: 'name',       label: 'Name (Last Name)' },
                  { key: 'department', label: 'Department' },
                  { key: 'role',       label: 'System Role' },
                ].map(opt => (
                  <button key={opt.key} onClick={() => toggleSort(opt.key)}
                    className={`w-full flex items-center justify-between px-4 py-2.5 text-sm font-medium hover:bg-gray-50 transition-colors ${sortBy === opt.key ? 'text-green-700 font-bold bg-green-50/40' : 'text-gray-700'}`}>
                    {opt.label}
                    {sortBy === opt.key && (sortDir === 'asc' ? <ArrowUp size={13} className="text-green-600" /> : <ArrowDown size={13} className="text-green-600" />)}
                  </button>
                ))}
              </div>
            </div>

            {/* Filter Button */}
            <button onClick={() => setIsFilterOpen(true)}
              className="w-full xl:w-auto flex items-center justify-center xl:justify-start gap-2 px-4 py-2.5 bg-white border border-gray-200 text-gray-700 font-bold rounded-xl text-sm hover:bg-gray-50 transition-all shadow-sm">
              <SlidersHorizontal size={15} /> Filter
              {activeFilterCount > 0 && (
                <span className="w-4 h-4 rounded-full bg-green-600 text-white text-[9px] font-black flex items-center justify-center shadow-sm">{activeFilterCount}</span>
              )}
            </button>
          </div>
        </div>

        {/* Users Table */}
        <div className="overflow-x-auto flex-1">
          <table className="w-full text-left border-collapse">
            <thead className="bg-white border-b border-gray-100">
              <tr>
                <th className="px-8 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest">Faculty Member</th>
                <th className="px-6 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest">Department</th>
                <th className="px-6 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest">System Role</th>
                <th className="px-6 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest hidden lg:table-cell">Specialization</th>
                <th className="px-8 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest text-right w-24">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {processedUsers.length === 0 ? (
                <tr>
                  <td colSpan="5" className="py-24 text-center">
                    <Users className="mx-auto text-gray-200 mb-4" size={48} />
                    <p className="text-gray-500 font-bold">No members found matching your filters.</p>
                  </td>
                </tr>
              ) : (
                processedUsers.map((member) => (
                  <tr 
                    key={member.user_id} 
                    className="hover:bg-green-50/40 transition-colors group cursor-pointer"
                    onClick={() => setSelectedUser(member)}
                  >
                    <td className="px-8 py-4">
                      <div className="flex items-center">
                        <div className="w-12 h-12 bg-gray-100 rounded-full border border-gray-200 mr-4 overflow-hidden flex items-center justify-center shrink-0">
                          {member.profile_pic ? (
                            <img src={member.profile_pic} alt="Profile" className="w-full h-full object-cover" />
                          ) : (
                            <User size={20} className="text-gray-400" />
                          )}
                        </div>
                        <div>
                          <div className="text-sm font-bold text-gray-900 group-hover:text-green-800 transition-colors">
                            {member.last_name}, {member.first_name}
                          </div>
                          <div className="text-xs font-medium text-gray-500 flex items-center mt-0.5">
                            <Mail size={12} className="mr-1 text-gray-400" /> {member.email}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-xs font-bold text-gray-600 bg-gray-100 px-3 py-1.5 rounded-lg border border-gray-200 shadow-sm flex items-center w-max">
                        <Building size={14} className="mr-2 text-gray-400"/> {member.department}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center text-xs font-bold text-gray-700">
                        {member.role.includes('Admin') || member.role.includes('Dean') || member.role.includes('VPAA') || member.role.includes('Registrar') 
                          ? <Shield size={14} className="mr-2 text-orange-500" /> 
                          : <User size={14} className="mr-2 text-blue-500" />
                        }
                        {member.role}
                      </div>
                    </td>
                    <td className="px-6 py-4 hidden lg:table-cell">
                      <span className="text-sm font-medium text-gray-600 truncate max-w-[200px] block">
                        {member.specialization}
                      </span>
                    </td>
                    <td className="px-8 py-4 text-right">
                      <button 
                        onClick={(e) => { e.stopPropagation(); setSelectedUser(member); }}
                        className="p-2.5 text-gray-400 hover:text-green-700 hover:bg-green-50 rounded-xl transition-all border border-transparent hover:border-green-100 shadow-sm opacity-0 group-hover:opacity-100"
                        title="View Profile"
                      >
                        <Eye size={18} />
                      </button>
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