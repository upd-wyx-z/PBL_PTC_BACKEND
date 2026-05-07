import React, { useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { 
  User, Mail, Briefcase, Phone, Lock, 
  X, AlertCircle, CheckCircle2, Save, Settings, Shield,
  Eye, EyeOff, UploadCloud, Camera
} from 'lucide-react';

export default function Profile({ user, onUpdateUser }) {
  // --- CORE PROFILE STATES ---
  const [profileData, setProfileData] = useState({
    firstName: user?.name?.split(' ')[0] || '',
    lastName: user?.name?.split(' ').slice(1).join(' ') || '',
    email: user?.email || '',
    specialization: user?.title || 'Instructor',
    contactNumber: '09123456789' // Mock data
  });
  const [profilePic, setProfilePic] = useState(null); // Saved Display Picture
  const [message, setMessage] = useState({ type: '', text: '' });

  // --- PRIVACY STATES (EYE TOGGLES) ---
  const [showEmail, setShowEmail] = useState(false);
  const [showContact, setShowContact] = useState(false);
  const [showOldPass, setShowOldPass] = useState(false);
  const [showNewPass, setShowNewPass] = useState(false);
  const [showConfirmPass, setShowConfirmPass] = useState(false);

  // --- MODAL & TAB STATES ---
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('info'); // 'info' or 'password'
  const [tempProfilePic, setTempProfilePic] = useState(null); // Preview image before saving
  
  // --- PASSWORD STATES ---
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [passForm, setPassForm] = useState({
    oldPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  const [passError, setPassError] = useState('');

  const fileInputRef = useRef(null);

  // --- HANDLERS ---
  const handleProfileChange = (field, value, limit) => {
    if (value.length <= limit) {
      setProfileData(prev => ({ ...prev, [field]: value }));
    }
  };

  const handlePhotoUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      // Strictly accept JPG and PNG
      if (file.type === 'image/jpeg' || file.type === 'image/png') {
        const reader = new FileReader();
        reader.onloadend = () => {
          setTempProfilePic(reader.result);
        };
        reader.readAsDataURL(file);
      } else {
        alert('Upload Error: Only .JPG and .PNG files are allowed.');
      }
    }
  };

  const handleSaveProfile = (e) => {
    e.preventDefault();
    setProfilePic(tempProfilePic); // Apply the preview image to the actual profile
    setIsSettingsModalOpen(false);
    setMessage({ type: 'success', text: 'Profile information and ID updated successfully.' });
    setTimeout(() => setMessage({ type: '', text: '' }), 3000);
    
    if (onUpdateUser) {
      onUpdateUser({
        ...user,
        name: `${profileData.firstName} ${profileData.lastName}`,
        title: profileData.specialization
      });
    }
  };

  const handleChangePasswordClick = (e) => {
    e.preventDefault();
    setPassError('');
    if (!passForm.oldPassword || !passForm.newPassword || !passForm.confirmPassword) {
      setPassError('All password fields are required.');
      return;
    }
    if (passForm.newPassword !== passForm.confirmPassword) {
      setPassError('New passwords do not match.');
      return;
    }
    if (passForm.newPassword.length < 8) {
      setPassError('New password must be at least 8 characters.');
      return;
    }
    setIsConfirmModalOpen(true);
  };

  const finalizePasswordChange = () => {
    setIsConfirmModalOpen(false);
    setIsSettingsModalOpen(false);
    setPassForm({ oldPassword: '', newPassword: '', confirmPassword: '' });
    setShowOldPass(false); setShowNewPass(false); setShowConfirmPass(false);
    setMessage({ type: 'success', text: 'Password securely changed.' });
    setTimeout(() => setMessage({ type: '', text: '' }), 3000);
  };

  const openSettingsModal = () => {
    setTempProfilePic(profilePic); // Load current picture into preview
    setIsSettingsModalOpen(true);
  };

  const closeSettingsModal = () => {
    setIsSettingsModalOpen(false);
    setPassError('');
    setPassForm({ oldPassword: '', newPassword: '', confirmPassword: '' });
    setShowOldPass(false); setShowNewPass(false); setShowConfirmPass(false);
    setTimeout(() => setActiveTab('info'), 300);
  };

  return (
    <div className="max-w-5xl mx-auto space-y-8 animate-in fade-in duration-300 relative">
      
      {/* =========================================
          MODAL: SETTINGS (MULTI-TAB)
          ========================================= */}
      {isSettingsModalOpen && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in" onClick={closeSettingsModal}>
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
            
            <div className="px-8 pt-8 border-b border-gray-100 shrink-0">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-bold text-gray-900 tracking-tight flex items-center">
                  <Settings size={22} className="mr-3 text-green-700" /> User Settings
                </h2>
                <button onClick={closeSettingsModal} className="p-2 border border-gray-200 rounded-full hover:bg-gray-50 text-gray-600 transition-all active:scale-90">
                  <X size={18} strokeWidth={2.5} />
                </button>
              </div>

              <div className="flex gap-6">
                <button 
                  onClick={() => setActiveTab('info')}
                  className={`pb-4 px-2 text-sm font-bold uppercase tracking-widest transition-all ${activeTab === 'info' ? 'text-green-700 border-b-2 border-green-700' : 'text-gray-400 hover:text-gray-600'}`}
                >
                  General Info
                </button>
                <button 
                  onClick={() => setActiveTab('password')}
                  className={`pb-4 px-2 text-sm font-bold uppercase tracking-widest transition-all ${activeTab === 'password' ? 'text-green-700 border-b-2 border-green-700' : 'text-gray-400 hover:text-gray-600'}`}
                >
                  Security & Password
                </button>
              </div>
            </div>

            <div className="p-8 overflow-y-auto custom-scrollbar flex-1 bg-gray-50/30">
              
              {/* TAB 1: USER INFO */}
              {activeTab === 'info' && (
                <form onSubmit={handleSaveProfile} className="space-y-6 animate-in fade-in">
                  
                  {/* Photo Upload Section */}
                  <div className="flex items-center gap-5 p-5 bg-white border border-gray-100 rounded-2xl shadow-sm mb-2">
                    <div className="w-20 h-20 rounded-full bg-gray-50 border-2 border-dashed border-gray-300 overflow-hidden flex items-center justify-center relative shrink-0">
                      {tempProfilePic ? (
                        <img src={tempProfilePic} alt="Preview" className="w-full h-full object-cover" />
                      ) : (
                        <User size={32} className="text-gray-300" />
                      )}
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-gray-800 mb-1">Profile Display Picture</h4>
                      <p className="text-[10px] text-gray-500 font-medium mb-3">Accepts .JPG or .PNG only (Max 2MB)</p>
                      <input 
                        type="file" 
                        accept=".jpg,.jpeg,.png" 
                        ref={fileInputRef}
                        className="hidden" 
                        onChange={handlePhotoUpload} 
                      />
                      <button 
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-bold uppercase tracking-wider rounded-lg transition-colors flex items-center gap-2"
                      >
                        <Camera size={14} /> Upload Image
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">First Name (Max 30)</label>
                      <input 
                        type="text" required
                        value={profileData.firstName}
                        onChange={(e) => handleProfileChange('firstName', e.target.value, 30)}
                        className="w-full p-3.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-green-600 outline-none text-sm font-medium bg-white shadow-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Last Name (Max 30)</label>
                      <input 
                        type="text" required
                        value={profileData.lastName}
                        onChange={(e) => handleProfileChange('lastName', e.target.value, 30)}
                        className="w-full p-3.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-green-600 outline-none text-sm font-medium bg-white shadow-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Department Specialization</label>
                      <select 
                        value={profileData.specialization}
                        onChange={(e) => handleProfileChange('specialization', e.target.value, 100)}
                        className="w-full p-3.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-green-600 outline-none text-sm font-medium bg-white shadow-sm"
                      >
                        <option value="Instructor">Instructor</option>
                        <option value="Dean">Dean / Admin</option>
                        <option value="General Academics">General Academics</option>
                        <option value="BSIT Faculty">BSIT Faculty</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Contact Number</label>
                      <div className="relative">
                        <Phone size={18} className="absolute left-4 top-3.5 text-gray-400" />
                        <input 
                          type="tel"
                          value={profileData.contactNumber}
                          onChange={(e) => handleProfileChange('contactNumber', e.target.value, 15)}
                          className="w-full pl-12 pr-4 py-3.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-green-600 outline-none text-sm font-medium bg-white shadow-sm"
                        />
                      </div>
                    </div>
                  </div>
                  <div className="flex justify-end pt-4">
                    <button type="submit" className="px-8 py-3 bg-[#0e5c2b] hover:bg-[#0a4720] text-white font-bold rounded-xl shadow-md transition-all active:scale-95 flex items-center gap-2">
                      <Save size={18} /> Save Info Changes
                    </button>
                  </div>
                </form>
              )}

              {/* TAB 2: PASSWORD */}
              {activeTab === 'password' && (
                <form onSubmit={handleChangePasswordClick} className="space-y-6 animate-in fade-in max-w-md mx-auto">
                  
                  {passError && (
                    <div className="p-4 bg-red-50 text-red-700 text-sm font-bold rounded-xl flex items-center border border-red-100">
                      <AlertCircle size={16} className="mr-2 shrink-0" /> {passError}
                    </div>
                  )}
                  
                  <div>
                    <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Current Password</label>
                    <div className="relative">
                      <input 
                        type={showOldPass ? "text" : "password"}
                        maxLength={25}
                        value={passForm.oldPassword}
                        onChange={(e) => setPassForm({...passForm, oldPassword: e.target.value})}
                        className="w-full p-3.5 pr-12 border border-gray-200 rounded-xl focus:ring-2 focus:ring-green-600 outline-none text-sm font-medium bg-white shadow-sm"
                        placeholder="Enter current password"
                      />
                      <button type="button" onClick={() => setShowOldPass(!showOldPass)} className="absolute right-4 top-3.5 text-gray-400 hover:text-gray-600 outline-none">
                        {showOldPass ? <EyeOff size={18} /> : <Eye size={18} />}
                      </button>
                    </div>
                  </div>
                  
                  <div className="pt-4 mt-2 border-t border-gray-200">
                    <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">New Password (Max 25)</label>
                    <div className="relative">
                      <input 
                        type={showNewPass ? "text" : "password"} 
                        maxLength={25}
                        value={passForm.newPassword}
                        onChange={(e) => setPassForm({...passForm, newPassword: e.target.value})}
                        className="w-full p-3.5 pr-12 border border-gray-200 rounded-xl focus:ring-2 focus:ring-green-600 outline-none text-sm font-medium bg-white shadow-sm"
                        placeholder="Enter new password"
                      />
                      <button type="button" onClick={() => setShowNewPass(!showNewPass)} className="absolute right-4 top-3.5 text-gray-400 hover:text-gray-600 outline-none">
                        {showNewPass ? <EyeOff size={18} /> : <Eye size={18} />}
                      </button>
                    </div>
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Confirm New Password</label>
                    <div className="relative">
                      <input 
                        type={showConfirmPass ? "text" : "password"}
                        maxLength={25}
                        value={passForm.confirmPassword}
                        onChange={(e) => setPassForm({...passForm, confirmPassword: e.target.value})}
                        className="w-full p-3.5 pr-12 border border-gray-200 rounded-xl focus:ring-2 focus:ring-green-600 outline-none text-sm font-medium bg-white shadow-sm"
                        placeholder="Re-type new password"
                      />
                      <button type="button" onClick={() => setShowConfirmPass(!showConfirmPass)} className="absolute right-4 top-3.5 text-gray-400 hover:text-gray-600 outline-none">
                        {showConfirmPass ? <EyeOff size={18} /> : <Eye size={18} />}
                      </button>
                    </div>
                  </div>

                  <div className="pt-4">
                    <button type="submit" className="w-full py-3.5 bg-gray-900 hover:bg-black text-white font-bold rounded-xl shadow-md transition-all active:scale-95 flex justify-center items-center gap-2">
                      <Lock size={18} /> Update Password
                    </button>
                  </div>
                </form>
              )}

            </div>
          </div>
        </div>,
        document.body
      )}

      {/* =========================================
          MODAL: FINAL PASSWORD CONFIRMATION
          ========================================= */}
      {isConfirmModalOpen && createPortal(
        <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm p-8 text-center animate-in zoom-in-95 duration-200">
            <div className="w-16 h-16 bg-yellow-50 text-yellow-600 rounded-full flex items-center justify-center mx-auto mb-6 border-4 border-white shadow-sm">
              <Shield size={32} />
            </div>
            <h3 className="text-xl font-bold text-gray-900 mb-2">Confirm Security Change</h3>
            <p className="text-sm text-gray-500 mb-8 leading-relaxed">
              Are you sure you want to change your password? You will be required to use this new password upon your next login.
            </p>
            <div className="flex gap-3">
              <button 
                onClick={() => setIsConfirmModalOpen(false)}
                className="flex-1 py-3 px-4 bg-gray-100 hover:bg-gray-200 text-gray-600 font-bold rounded-xl transition-all"
              >
                Cancel
              </button>
              <button 
                onClick={finalizePasswordChange}
                className="flex-1 py-3 px-4 bg-green-700 hover:bg-green-800 text-white font-bold rounded-xl shadow-md transition-all active:scale-95"
              >
                Yes, Change
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* =========================================
          MAIN PAGE (READ ONLY DASHBOARD)
          ========================================= */}
      
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 tracking-tight mb-1">My Profile</h1>
          <p className="text-sm text-gray-500 font-medium">View your personal information and account details.</p>
        </div>
        <button 
          onClick={openSettingsModal}
          className="px-6 py-3 bg-white border border-gray-200 hover:bg-gray-50 text-gray-800 font-bold rounded-xl shadow-sm transition-all flex items-center gap-2 active:scale-95"
        >
          <Settings size={18} className="text-green-700" /> Edit User Settings
        </button>
      </div>

      {/* Toast Notification */}
      {message.text && (
        <div className={`p-4 rounded-2xl border flex items-center shadow-sm animate-in slide-in-from-top-2 ${message.type === 'success' ? 'bg-green-50 border-green-100 text-green-700' : 'bg-red-50 border-red-100 text-red-700'}`}>
          {message.type === 'success' ? <CheckCircle2 size={18} className="mr-3" /> : <AlertCircle size={18} className="mr-3" />}
          <span className="text-sm font-bold">{message.text}</span>
        </div>
      )}

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        
        {/* LEFT CARD: ID CARD DESIGN */}
        <div className="md:col-span-1">
          <div className="bg-white rounded-3xl shadow-xl border border-gray-100 p-8 flex flex-col items-center text-center relative overflow-hidden h-full">
            <div className="absolute top-0 inset-x-0 h-32 bg-[#0e5c2b]"></div>
            
            <div className="relative z-10 mt-10">
              <div className="w-32 h-32 bg-white rounded-full p-1.5 shadow-xl">
                <div className="w-full h-full bg-gray-50 rounded-full flex items-center justify-center text-[#0e5c2b] border-2 border-green-50 overflow-hidden">
                  {profilePic ? (
                    <img src={profilePic} alt="Profile" className="w-full h-full object-cover" />
                  ) : (
                    <User size={48} />
                  )}
                </div>
              </div>
            </div>
            
            <h2 className="mt-5 text-2xl font-bold text-gray-900 leading-tight">{profileData.firstName} {profileData.lastName}</h2>
            <p className="text-[10px] font-black text-green-700 uppercase tracking-[0.2em] bg-green-50 px-3 py-1.5 rounded-full mt-3 border border-green-100 shadow-sm">
              {user?.role?.replace('_', ' ')}
            </p>

            {/* ID Card Info Section */}
            <div className="w-full mt-8 pt-6 border-t border-gray-100 space-y-4">
              <div className="flex flex-col items-center bg-gray-50 p-2.5 rounded-xl border border-gray-100">
                <span className="text-[9px] font-black text-gray-400 uppercase tracking-[0.2em] mb-1">Department / Spec.</span>
                <span className="text-sm font-bold text-gray-800 flex items-center"><Briefcase size={14} className="mr-2 text-green-700"/> {profileData.specialization}</span>
              </div>
              <div className="flex flex-col items-center bg-gray-50 p-2.5 rounded-xl border border-gray-100">
                <span className="text-[9px] font-black text-gray-400 uppercase tracking-[0.2em] mb-1">Contact No.</span>
                <span className="text-sm font-bold text-gray-800 flex items-center">
                  <Phone size={14} className="mr-2 text-green-700"/> 
                  {showContact ? profileData.contactNumber : '•••••••••••'}
                </span>
              </div>
              <div className="flex flex-col items-center bg-gray-50 p-2.5 rounded-xl border border-gray-100">
                <span className="text-[9px] font-black text-gray-400 uppercase tracking-[0.2em] mb-1">Email Address</span>
                <span className="text-xs font-bold text-gray-800 flex items-center">
                  <Mail size={14} className="mr-2 text-green-700"/> 
                  {showEmail ? profileData.email : '••••••••@ptc.edu.ph'}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT CARD: Detailed Info with Toggles */}
        <div className="md:col-span-2">
          <div className="bg-white rounded-3xl shadow-xl border border-gray-100 p-8 h-full">
            <h3 className="text-sm font-bold text-gray-800 uppercase tracking-widest flex items-center border-b border-gray-50 pb-5 mb-6">
              <User size={18} className="mr-3 text-green-700" /> Account Details
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-8 gap-x-6">
              <div>
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5">First Name</p>
                <p className="text-base font-bold text-gray-900 bg-gray-50 p-3.5 rounded-xl border border-gray-100">{profileData.firstName}</p>
              </div>
              <div>
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5">Last Name</p>
                <p className="text-base font-bold text-gray-900 bg-gray-50 p-3.5 rounded-xl border border-gray-100">{profileData.lastName}</p>
              </div>
              
              <div>
                <div className="flex justify-between items-center mb-1.5 pr-2">
                  <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Email Address</p>
                  <button onClick={() => setShowEmail(!showEmail)} className="text-gray-400 hover:text-green-700 transition-colors" title="Toggle visibility">
                    {showEmail ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
                <p className="text-base font-bold text-gray-900 bg-gray-50 p-3.5 rounded-xl border border-gray-100 flex items-center">
                  <Mail size={16} className="mr-3 text-gray-400" /> {showEmail ? profileData.email : '••••••••@ptc.edu.ph'}
                </p>
              </div>

              <div>
                <div className="flex justify-between items-center mb-1.5 pr-2">
                  <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Contact Number</p>
                  <button onClick={() => setShowContact(!showContact)} className="text-gray-400 hover:text-green-700 transition-colors" title="Toggle visibility">
                    {showContact ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
                <p className="text-base font-bold text-gray-900 bg-gray-50 p-3.5 rounded-xl border border-gray-100 flex items-center">
                  <Phone size={16} className="mr-3 text-gray-400" /> {showContact ? profileData.contactNumber : '•••••••••••'}
                </p>
              </div>

              <div className="sm:col-span-2">
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5">Department / Specialization</p>
                <p className="text-base font-bold text-gray-900 bg-gray-50 p-3.5 rounded-xl border border-gray-100 flex items-center">
                  <Briefcase size={16} className="mr-3 text-gray-400" /> {profileData.specialization}
                </p>
              </div>
            </div>

            <div className="mt-8 p-4 bg-yellow-50 rounded-xl border border-yellow-100 flex items-start">
              <Lock size={18} className="text-yellow-600 mr-3 mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-bold text-yellow-800">Account Security</p>
                <p className="text-xs text-yellow-700 mt-1 font-medium">To update your password, display picture, or change these details, click the "Edit User Settings" button at the top of the page.</p>
              </div>
            </div>

          </div>
        </div>

      </div>
    </div>
  );
}