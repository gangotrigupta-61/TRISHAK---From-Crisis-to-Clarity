import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Plus, 
  Search, 
  Filter, 
  Edit2, 
  Trash2, 
  CheckCircle2, 
  XCircle, 
  Shield, 
  UserCircle, 
  Key,
  RefreshCw,
  Copy,
  Check,
  AlertCircle,
  ExternalLink,
  Mail,
  User,
  Hash,
  Phone
} from 'lucide-react';
import { 
  collection, 
  query, 
  where, 
  onSnapshot, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc, 
  serverTimestamp,
  orderBy,
  getDocs,
  limit
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { useAuth } from '../hooks/useAuth';
import { SOS_TYPES } from '../constants';
import { RoleCode, UserRole, UserProfile, SecurityType } from '../types';
import { cn } from '../lib/utils';

const ROLE_OPTIONS: UserRole[] = ['receptionist', 'security', 'staff'];

export default function RoleManagement() {
  const { profile } = useAuth();
  const [roleCodes, setRoleCodes] = useState<RoleCode[]>([]);
  const [usersMap, setUsersMap] = useState<Record<string, UserProfile>>({});
  const [loading, setLoading] = useState(true);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSecurityTypeModalOpen, setIsSecurityTypeModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [editingCode, setEditingCode] = useState<RoleCode | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    role: 'staff' as UserRole,
    securityType: 'fire' as SecurityType,
    customCode: '',
    name: '',
    phone: '',
    status: 'active' as 'active' | 'inactive'
  });

  // Real-time Role Codes Sync
  useEffect(() => {
    if (!profile?.organizationId) return;

    const q = query(
      collection(db, 'roleCodes'),
      where('organizationId', '==', profile.organizationId)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      setRoleCodes(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as RoleCode)));
      setLoading(false);
    }, (err) => {
      handleFirestoreError(err, OperationType.LIST, 'roleCodes');
      setError('Failed to sync role codes.');
    });

    return () => unsubscribe();
  }, [profile?.organizationId]);

  // Real-time Users Sync (for Duty Status)
  useEffect(() => {
    if (!profile?.organizationId) return;

    const q = query(
      collection(db, 'users'),
      where('organizationId', '==', profile.organizationId)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const newMap: Record<string, UserProfile> = {};
      snapshot.docs.forEach(doc => {
        newMap[doc.id] = { uid: doc.id, ...doc.data() } as UserProfile;
      });
      setUsersMap(newMap);
      setLoadingUsers(false);
    }, (err) => {
      handleFirestoreError(err, OperationType.LIST, 'users');
      setError('Unable to fetch live duty status.');
    });

    return () => unsubscribe();
  }, [profile?.organizationId]);

  const activeCounts = {
    staff: roleCodes.filter(c => c.role === 'staff' && c.assignedTo && usersMap[c.assignedTo]?.status === 'active').length,
    security: roleCodes.filter(c => c.role === 'security' && c.assignedTo && usersMap[c.assignedTo]?.status === 'active').length,
    receptionist: roleCodes.filter(c => c.role === 'receptionist' && c.assignedTo && usersMap[c.assignedTo]?.status === 'active').length,
  };

  const generateRandomCode = (role: UserRole, securityType?: SecurityType) => {
    if (role === 'security' && securityType) {
      const typeCodes: Record<SecurityType, string> = {
        fire: 'FI',
        medical: 'MD',
        theft: 'TH',
        other: 'OT'
      };
      const random = Math.floor(10 + Math.random() * 90);
      return `SE${random}${typeCodes[securityType]}`;
    }
    const prefix = role.substring(0, 2).toUpperCase();
    const random = Math.floor(1000 + Math.random() * 9000);
    return `${prefix}${random}`;
  };

  const showSuccess = (msg: string) => {
    setSuccess(msg);
    setTimeout(() => setSuccess(null), 3000);
  };

  const formatPhoneNumber = (phone: string) => {
    // Remove all non-digit characters except '+'
    let cleaned = phone.trim().replace(/[^\d+]/g, '');
    
    if (cleaned.startsWith('+')) return cleaned;
    
    // 10 digits: 9140130868 -> +919140130868
    if (cleaned.length === 10) return `+91${cleaned}`;
    
    // 12 digits starting with 91: 919140130868 -> +919140130868
    if (cleaned.length === 12 && cleaned.startsWith('91')) return `+${cleaned}`;
    
    return cleaned;
  };

  const isValidPhone = (phone: string) => {
    const formatted = formatPhoneNumber(phone);
    const digitCount = formatted.replace('+', '').length;
    return formatted.startsWith('+') && digitCount >= 12 && digitCount <= 15;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile?.organizationId) return;

    if (!isValidPhone(formData.phone)) {
      setError('Enter a valid phone number with country code');
      return;
    }

    setError(null);
    try {
      const codeToSave = formData.customCode || generateRandomCode(formData.role, formData.role === 'security' ? formData.securityType : undefined);
      const formattedPhone = formatPhoneNumber(formData.phone);
      
      const roleCodeData: any = {
        role: formData.role,
        code: codeToSave,
        name: formData.name,
        phone: formattedPhone,
        updatedAt: serverTimestamp()
      };

      if (formData.role === 'security') {
        roleCodeData.securityType = formData.securityType;
      }

      if (editingCode) {
        await updateDoc(doc(db, 'roleCodes', editingCode.id), roleCodeData);
        showSuccess('Role code updated successfully');
      } else {
        await addDoc(collection(db, 'roleCodes'), {
          ...roleCodeData,
          organizationId: profile.organizationId,
          status: 'active',
          createdAt: serverTimestamp()
        });

        // Send Onboarding SMS (Non-blocking)
        fetch('/api/send-onboarding-sms', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            phone: formattedPhone,
            role: formData.role.toUpperCase(),
            uniqueId: codeToSave,
            organizationId: profile.organizationId
          })
        })
        .then(async (res) => {
          if (!res.ok) {
            const data = await res.json();
            if (data.code === 'TWILIO_UNVERIFIED_NUMBER') {
              setError('Role generated, but SMS failed: The phone number is not verified in your Twilio Trial account.');
            } else {
              console.error('SMS API Error:', data.error);
            }
          }
        })
        .catch(err => console.error('Failed to send onboarding SMS:', err));

        showSuccess('New role code generated');
      }
      
      setIsModalOpen(false);
      setIsSecurityTypeModalOpen(false);
      setEditingCode(null);
      setFormData({ role: 'staff', securityType: 'fire', customCode: '', name: '', phone: '', status: 'active' });
    } catch (err: any) {
      handleFirestoreError(err, editingCode ? OperationType.UPDATE : OperationType.CREATE, `roleCodes/${editingCode?.id || 'new'}`);
      setError('Failed to save role code. Please try again.');
    }
  };

  const handleDelete = (id: string) => {
    setDeletingId(id);
    setIsDeleteModalOpen(true);
  };

  const confirmDelete = async () => {
    if (!deletingId) return;
    setError(null);
    try {
      await deleteDoc(doc(db, 'roleCodes', deletingId));
      showSuccess('ID deleted successfully');
      setIsDeleteModalOpen(false);
      setDeletingId(null);
    } catch (err: any) {
      handleFirestoreError(err, OperationType.DELETE, `roleCodes/${deletingId}`);
      setError('Failed to delete. Try again.');
    }
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    showSuccess('Code copied to clipboard');
    setTimeout(() => setCopiedId(null), 2000);
  };

  const filteredCodes = roleCodes.filter(code => {
    const user = code.assignedTo ? usersMap[code.assignedTo] : null;
    const dutyStatus = user?.status || 'inactive';

    const matchesSearch = code.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         code.role.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         (code.email && code.email.toLowerCase().includes(searchTerm.toLowerCase())) ||
                         (user?.displayName && user.displayName.toLowerCase().includes(searchTerm.toLowerCase()));
    
    const matchesRole = roleFilter === 'all' || code.role === roleFilter;
    const matchesStatus = statusFilter === 'all' || dutyStatus === statusFilter;
    
    return matchesSearch && matchesRole && matchesStatus;
  });

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'receptionist': return <UserCircle className="w-4 h-4" />;
      case 'security': return <Shield className="w-4 h-4" />;
      default: return <Key className="w-4 h-4" />;
    }
  };

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-8 min-h-screen bg-bg-primary transition-colors duration-500">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-3xl font-black text-text-primary tracking-tight transition-colors">Role Code Management</h1>
          <p className="text-text-secondary font-medium opacity-70 transition-colors">Control panel for staff registration and duty status</p>
        </div>
        <button
          onClick={() => {
            setEditingCode(null);
            setFormData({ role: 'staff', securityType: 'fire', customCode: '', name: '', phone: '+91', status: 'active' });
            setIsModalOpen(true);
          }}
          className="flex items-center justify-center gap-3 bg-text-primary text-bg-primary px-6 py-3 rounded-2xl font-bold transition-all shadow-xl hover:opacity-90 active:scale-95 w-full md:w-auto"
        >
          <Plus className="w-5 h-5" />
          <span>Generate New ID</span>
        </button>
      </div>

      {/* Active User Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          { label: 'Staff On Duty', count: activeCounts.staff, color: 'text-green-500', bg: 'bg-green-500/10', border: 'border-green-500/20' },
          { label: 'Security On Duty', count: activeCounts.security, color: 'text-blue-500', bg: 'bg-blue-500/10', border: 'border-blue-500/20' },
          { label: 'Receptionist On Duty', count: activeCounts.receptionist, color: 'text-purple-500', bg: 'bg-purple-500/10', border: 'border-purple-500/20' },
        ].map((stat, i) => (
          <div key={i} className={cn("p-6 rounded-[2rem] border shadow-sm flex items-center justify-between bg-bg-secondary transition-colors", stat.border || "border-card-border")}>
            <div>
              <p className="text-[10px] font-black text-text-secondary uppercase tracking-widest mb-1 opacity-60 transition-colors">{stat.label}</p>
              <motion.p 
                key={stat.count}
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className={cn("text-3xl font-black transition-colors", stat.color)}
              >
                {stat.count}
              </motion.p>
            </div>
            <div className={cn("p-4 rounded-2xl transition-colors", stat.bg)}>
              <div className={cn("w-3 h-3 rounded-full animate-pulse", stat.count > 0 ? "bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.5)]" : "bg-text-secondary/30")} />
            </div>
          </div>
        ))}
      </div>

      {/* Notifications */}
      <AnimatePresence>
        {error && (
          <motion.div 
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="bg-accent-emergency/10 border border-accent-emergency/20 text-accent-emergency px-4 py-3 rounded-2xl flex items-center gap-3 font-bold uppercase tracking-tight text-xs transition-colors"
          >
            <AlertCircle className="w-5 h-5" />
            {error}
          </motion.div>
        )}
        {success && (
          <motion.div 
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="bg-green-500/10 border border-green-500/20 text-green-500 px-4 py-3 rounded-2xl flex items-center gap-3 font-bold uppercase tracking-tight text-xs transition-colors"
          >
            <CheckCircle2 className="w-5 h-5" />
            {success}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Filters & Search */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        <div className="lg:col-span-6 relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-text-secondary opacity-40 w-5 h-5 transition-colors" />
          <input
            type="text"
            placeholder="Search by code, role, or name..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-12 pr-4 py-4 bg-bg-secondary border border-card-border rounded-2xl focus:ring-4 focus:ring-accent-emergency/5 focus:border-accent-emergency/30 outline-none transition-all font-bold text-text-primary placeholder:text-text-secondary/30"
          />
        </div>
        <div className="lg:col-span-3 relative">
          <Filter className="absolute left-4 top-1/2 -translate-y-1/2 text-text-secondary opacity-40 w-4 h-4 transition-colors" />
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="w-full pl-10 pr-4 py-4 bg-bg-secondary border border-card-border rounded-2xl appearance-none focus:ring-4 focus:ring-accent-emergency/5 outline-none font-bold text-text-primary cursor-pointer transition-colors"
          >
            <option value="all">All Roles</option>
            {ROLE_OPTIONS.map(role => (
              <option key={role} value={role}>{role.charAt(0).toUpperCase() + role.slice(1)}</option>
            ))}
          </select>
        </div>
        <div className="lg:col-span-3 relative">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="w-full px-4 py-4 bg-bg-secondary border border-card-border rounded-2xl appearance-none focus:ring-4 focus:ring-accent-emergency/5 outline-none font-bold text-text-primary cursor-pointer transition-colors"
          >
            <option value="all">All Status</option>
            <option value="active">On Duty</option>
            <option value="inactive">Off Duty</option>
          </select>
        </div>
      </div>

      {/* Data Grid: Table on Desktop, Cards on Mobile */}
      <div className="bg-bg-secondary rounded-[2rem] border border-card-border shadow-sm overflow-hidden transition-colors">
        <div className="hidden md:block overflow-x-auto transition-colors">
          <table className="w-full text-left border-collapse transition-colors">
            <thead>
              <tr className="bg-bg-primary/50 border-b border-card-border transition-colors">
                <th className="px-8 py-5 text-xs font-black text-text-secondary uppercase tracking-widest opacity-60">Role Code</th>
                <th className="px-8 py-5 text-xs font-black text-text-secondary uppercase tracking-widest opacity-60">Role</th>
                <th className="px-8 py-5 text-xs font-black text-text-secondary uppercase tracking-widest opacity-60">Duty Status</th>
                <th className="px-8 py-5 text-xs font-black text-text-secondary uppercase tracking-widest opacity-60">Assignment</th>
                <th className="px-8 py-5 text-xs font-black text-text-secondary uppercase tracking-widest opacity-60">Created</th>
                <th className="px-8 py-5 text-xs font-black text-text-secondary uppercase tracking-widest opacity-60 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-card-border transition-colors">
              {loading || loadingUsers ? (
                <tr>
                  <td colSpan={6} className="px-8 py-20 text-center transition-colors">
                    <div className="flex flex-col items-center gap-4 transition-colors">
                      <RefreshCw className="w-10 h-10 animate-spin text-accent-emergency" />
                      <span className="text-text-secondary font-black uppercase tracking-widest text-xs opacity-40">Synchronizing...</span>
                    </div>
                  </td>
                </tr>
              ) : filteredCodes.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-8 py-20 text-center transition-colors">
                    <div className="flex flex-col items-center gap-2 text-text-secondary transition-colors">
                      <Search className="w-12 h-12 opacity-10 mb-2 transition-colors" />
                      <p className="font-bold transition-colors">No records found</p>
                      <p className="text-sm opacity-60 transition-colors">Try adjusting your filters or search term</p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredCodes.map((code) => {
                  const user = code.assignedTo ? usersMap[code.assignedTo] : null;
                  const isAssigned = !!code.assignedTo;
                  const userFound = !!user;
                  const dutyStatus = user?.status || 'inactive';

                  return (
                    <tr key={code.id} className="group hover:bg-bg-primary/50 transition-colors">
                      <td className="px-8 py-6 transition-colors">
                        <div className="flex items-center gap-3 transition-colors">
                          <div className="bg-bg-primary px-3 py-1.5 rounded-xl font-mono font-black text-text-primary border border-card-border transition-colors">
                            {code.code}
                          </div>
                          <button
                            onClick={() => copyToClipboard(code.code, code.id)}
                            className="p-2 text-text-secondary opacity-40 hover:opacity-100 hover:text-accent-emergency hover:bg-bg-primary hover:shadow-sm rounded-xl transition-all"
                            title="Copy Code"
                          >
                            {copiedId === code.id ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                          </button>
                        </div>
                      </td>
                      <td className="px-8 py-6 transition-colors">
                        <div className="flex items-center gap-3 text-text-primary font-bold transition-colors">
                          <div className="p-2 bg-bg-primary rounded-xl text-text-secondary opacity-60 border border-card-border transition-colors">
                            {getRoleIcon(code.role)}
                          </div>
                          <span className="capitalize transition-colors">
                            {code.role === 'security' && code.securityType 
                              ? `${code.securityType.charAt(0).toUpperCase() + code.securityType.slice(1)} Security`
                              : code.role}
                          </span>
                        </div>
                        {code.role === 'security' && code.securityType && (
                          <div className={cn(
                            "mt-1 inline-flex items-center gap-1.5 px-2 py-0.5 rounded-lg text-[10px] font-black border transition-colors",
                            code.securityType === 'fire' ? "bg-red-500/10 border-red-500/20 text-red-500" :
                            code.securityType === 'medical' ? "bg-blue-500/10 border-blue-500/20 text-blue-500" :
                            code.securityType === 'theft' ? "bg-orange-500/10 border-orange-500/20 text-orange-500" :
                            "bg-bg-primary border-card-border text-text-secondary opacity-60"
                          )}>
                            <span className="transition-colors">{SOS_TYPES.find(t => t.id === code.securityType)?.emoji}</span>
                            <span className="uppercase transition-colors">{code.securityType}</span>
                          </div>
                        )}
                      </td>
                      <td className="px-8 py-6 transition-colors">
                        {!isAssigned ? (
                          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-2xl text-[10px] font-black uppercase tracking-widest bg-bg-primary border border-card-border text-text-secondary opacity-30 transition-colors">
                            Not Assigned
                          </div>
                        ) : !userFound ? (
                          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-2xl text-[10px] font-black uppercase tracking-widest bg-accent-emergency/10 border border-accent-emergency/20 text-accent-emergency opacity-70 transition-colors">
                            User Not Found
                          </div>
                        ) : (
                          <div className={cn(
                            "inline-flex items-center gap-2 px-4 py-2 rounded-2xl text-[10px] font-black uppercase tracking-widest border transition-all",
                            dutyStatus === 'active' 
                              ? "bg-green-500/10 border-green-500/20 text-green-500" 
                              : "bg-bg-primary border-card-border text-text-secondary opacity-40"
                          )}>
                            <div className={cn(
                              "w-2 h-2 rounded-full transition-colors",
                              dutyStatus === 'active' ? "bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.5)]" : "bg-text-secondary/30"
                            )} />
                            {dutyStatus === 'active' ? 'On Duty' : 'Off Duty'}
                          </div>
                        )}
                      </td>
                      <td className="px-8 py-6 transition-colors">
                        <div className="flex flex-col gap-1 transition-colors">
                          <div className="flex items-center gap-2 text-text-primary font-bold text-sm transition-colors">
                            <User className="w-3 h-3 text-text-secondary opacity-40 transition-colors" />
                            {code.name || user?.displayName || code.email?.split('@')[0] || 'Assigned User'}
                          </div>
                          <div className="flex items-center gap-2 text-text-secondary text-[10px] font-black opacity-60 uppercase transition-colors">
                            <Phone className="w-3 h-3 transition-colors text-accent-emergency" />
                            {code.phone || user?.phone || 'No Phone'}
                          </div>
                          {user?.email && (
                            <div className="flex items-center gap-2 text-text-secondary text-[10px] font-black opacity-40 uppercase transition-colors">
                              <Mail className="w-3 h-3 transition-colors" />
                              {user.email}
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-8 py-6 transition-colors">
                        <div className="flex flex-col transition-colors">
                          <span className="text-sm font-bold text-text-primary transition-colors">
                            {code.createdAt?.toDate().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                          </span>
                          <span className="text-[10px] text-text-secondary font-black opacity-40 uppercase transition-colors">
                            {code.createdAt?.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                      </td>
                      <td className="px-8 py-6 text-right transition-colors">
                        <div className="flex justify-end gap-2 transition-opacity opacity-40 group-hover:opacity-100">
                          <button
                            onClick={() => {
                              setEditingCode(code);
                              setFormData({
                                role: code.role,
                                securityType: code.securityType || 'fire',
                                customCode: code.code,
                                name: code.name || '',
                                phone: code.phone || '',
                                status: code.status as 'active' | 'inactive'
                              });
                              setIsModalOpen(true);
                            }}
                            className="p-3 text-text-secondary hover:text-blue-500 hover:bg-bg-primary rounded-2xl transition-all border border-card-border"
                            title="Edit Role"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(code.id)}
                            className="p-3 text-text-secondary hover:text-accent-emergency hover:bg-bg-primary rounded-2xl transition-all border border-card-border"
                            title="Delete Record"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Mobile View: Cards */}
        <div className="md:hidden divide-y divide-card-border transition-colors">
          {loading || loadingUsers ? (
            <div className="p-12 text-center flex flex-col items-center gap-3 transition-colors">
              <RefreshCw className="w-8 h-8 animate-spin text-accent-emergency transition-colors" />
              <span className="text-text-secondary font-black text-[10px] uppercase tracking-widest opacity-40 transition-colors">Synchronizing...</span>
            </div>
          ) : filteredCodes.length === 0 ? (
            <div className="p-12 text-center text-text-secondary opacity-40 transition-colors">
              <p className="font-bold transition-colors">No records found</p>
            </div>
          ) : (
            filteredCodes.map((code) => {
              const user = code.assignedTo ? usersMap[code.assignedTo] : null;
              const dutyStatus = user?.status || 'inactive';
              return (
                <div key={code.id} className="p-6 space-y-4 hover:bg-bg-primary/30 transition-colors">
                  <div className="flex items-center justify-between transition-colors">
                    <div className="flex items-center gap-2 transition-colors">
                      <div className="bg-bg-primary px-3 py-1.5 rounded-xl font-mono font-black text-text-primary border border-card-border text-sm transition-colors">
                        {code.code}
                      </div>
                      <button onClick={() => copyToClipboard(code.code, code.id)} className="p-2 text-text-secondary opacity-40 transition-colors">
                        {copiedId === code.id ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                      </button>
                    </div>
                    <div className={cn(
                      "flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-all",
                      dutyStatus === 'active' ? "bg-green-500/10 border-green-500/20 text-green-500" : "bg-bg-primary border-card-border text-text-secondary opacity-40"
                    )}>
                      <div className={cn("w-1.5 h-1.5 rounded-full transition-colors", dutyStatus === 'active' ? "bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.5)]" : "bg-text-secondary/30")} />
                      {dutyStatus === 'active' ? 'On Duty' : 'Off Duty'}
                    </div>
                  </div>

                  <div className="flex items-center gap-3 transition-colors">
                    <div className="p-3 bg-bg-primary rounded-2xl text-text-secondary opacity-60 border border-card-border transition-colors">
                      {getRoleIcon(code.role)}
                    </div>
                    <div>
                      <h4 className="text-sm font-black text-text-primary capitalize transition-colors">
                        {code.role === 'security' && code.securityType 
                          ? `${code.securityType.charAt(0).toUpperCase() + code.securityType.slice(1)} Security`
                          : code.role}
                      </h4>
                      <p className="text-xs text-text-secondary font-bold opacity-60 transition-colors uppercase tracking-tight">{code.name || user?.displayName || 'User Not Assigned'}</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 pt-2 border-t border-card-border transition-colors">
                    <button
                      onClick={() => {
                        setEditingCode(code);
                        setFormData({
                          role: code.role,
                          securityType: code.securityType || 'fire',
                          customCode: code.code,
                          name: code.name || '',
                          phone: code.phone || '',
                          status: code.status as 'active' | 'inactive'
                        });
                        setIsModalOpen(true);
                      }}
                      className="flex items-center justify-center gap-2 py-3 bg-bg-primary text-text-primary rounded-xl text-[10px] font-black uppercase tracking-widest border border-card-border hover:bg-bg-secondary transition-all"
                    >
                      <Edit2 className="w-3.5 h-3.5 opacity-60" />
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(code.id)}
                      className="flex items-center justify-center gap-2 py-3 bg-accent-emergency/10 text-accent-emergency rounded-xl text-[10px] font-black uppercase tracking-widest border border-accent-emergency/20 hover:bg-accent-emergency/20 transition-all"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      Delete
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsModalOpen(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-md"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative bg-bg-secondary border border-card-border rounded-[2.5rem] shadow-2xl w-full max-w-md overflow-hidden max-h-[90vh] flex flex-col transition-colors"
            >
              <div className="p-6 md:p-8 bg-bg-primary/50 border-b border-card-border shrink-0 transition-colors">
                <h2 className="text-xl md:text-2xl font-black text-text-primary tracking-tight transition-colors">
                  {editingCode ? 'Edit Role ID' : 'Generate New ID'}
                </h2>
                <p className="text-text-secondary text-sm font-bold opacity-60 mt-1 transition-colors uppercase tracking-tight">
                  {editingCode ? 'Update existing role configuration' : 'Create a new unique identifier for staff'}
                </p>
              </div>

              <form onSubmit={handleSubmit} className="p-6 md:p-8 space-y-4 md:space-y-6 overflow-y-auto custom-scrollbar bg-bg-secondary transition-colors">
                <div className="space-y-3">
                  <label className="block text-[10px] font-black text-text-secondary uppercase tracking-widest opacity-60 transition-colors">
                    Select Role
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 transition-colors">
                    {ROLE_OPTIONS.map((role) => (
                      <button
                        key={role}
                        type="button"
                        onClick={() => setFormData({ ...formData, role })}
                        className={cn(
                          "flex items-center gap-3 px-4 py-3 rounded-2xl border-2 transition-all font-black text-xs uppercase tracking-widest",
                          formData.role === role
                            ? "bg-text-primary border-text-primary text-bg-primary shadow-lg"
                            : "bg-bg-primary border-card-border text-text-secondary opacity-60 hover:opacity-100 hover:border-text-secondary/30"
                        )}
                      >
                        {getRoleIcon(role)}
                        <span className="capitalize">{role}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-3">
                  <label className="block text-[10px] font-black text-text-secondary uppercase tracking-widest opacity-60 transition-colors">
                    Full Name (Required)
                  </label>
                  <div className="relative">
                    <User className="absolute left-4 top-1/2 -translate-y-1/2 text-text-secondary opacity-40 w-4 h-4 transition-colors" />
                    <input
                      type="text"
                      required
                      placeholder="e.g. Anamika Verma"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="w-full pl-12 pr-4 py-4 bg-bg-primary border border-card-border rounded-2xl focus:ring-4 focus:ring-accent-emergency/5 focus:border-accent-emergency/30 outline-none transition-all font-bold text-text-primary placeholder:text-text-secondary/20"
                    />
                  </div>
                </div>

                <div className="space-y-3">
                  <label className="block text-[10px] font-black text-text-secondary uppercase tracking-widest opacity-60 transition-colors">
                    Phone Number (Required)
                  </label>
                  <div className="relative">
                    <Phone className="absolute left-4 top-1/2 -translate-y-1/2 text-text-secondary opacity-40 w-4 h-4 transition-colors" />
                    <input
                      type="tel"
                      required
                      placeholder="e.g. +91XXXXXXXXXX"
                      value={formData.phone}
                      onChange={(e) => {
                        let val = e.target.value;
                        if (!val.startsWith('+')) {
                          val = '+' + val.replace(/[^\d]/g, '');
                        }
                        setFormData({ ...formData, phone: val });
                      }}
                      className="w-full pl-12 pr-4 py-4 bg-bg-primary border border-card-border rounded-2xl focus:ring-4 focus:ring-accent-emergency/5 focus:border-accent-emergency/30 outline-none transition-all font-bold text-text-primary placeholder:text-text-secondary/20"
                    />
                  </div>
                  <p className="text-[10px] text-text-secondary opacity-40 font-bold uppercase tracking-tight transition-colors">
                    Phone will be stored in international format (e.g. +91)
                  </p>
                </div>

                <div className="space-y-3">
                  <label className="block text-[10px] font-black text-text-secondary uppercase tracking-widest opacity-60 transition-colors">
                    Custom Code (Optional)
                  </label>
                  <div className="relative">
                    <Hash className="absolute left-4 top-1/2 -translate-y-1/2 text-text-secondary opacity-40 w-4 h-4 transition-colors" />
                    <input
                      type="text"
                      placeholder="e.g. RE123"
                      value={formData.customCode}
                      onChange={(e) => setFormData({ ...formData, customCode: e.target.value.toUpperCase() })}
                      className="w-full pl-12 pr-4 py-4 bg-bg-primary border border-card-border rounded-2xl focus:ring-4 focus:ring-accent-emergency/5 focus:border-accent-emergency/30 outline-none transition-all font-mono font-bold text-text-primary placeholder:text-text-secondary/20"
                    />
                  </div>
                  <p className="text-[10px] text-text-secondary opacity-40 font-bold uppercase tracking-tight transition-colors">
                    Leave blank for auto-generated code (Prefix + 4 digits)
                  </p>
                </div>

                <div className="flex gap-4 pt-4 transition-colors">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="flex-1 px-6 py-4 bg-bg-primary text-text-secondary border border-card-border rounded-2xl font-black uppercase tracking-widest text-[10px] hover:bg-bg-secondary hover:text-text-primary transition-all active:scale-95 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={!formData.name.trim() || !formData.phone.trim() || formData.phone === '+91'}
                    className="flex-1 px-6 py-4 bg-text-primary text-bg-primary rounded-2xl font-black uppercase tracking-widest text-[10px] hover:opacity-90 transition-all shadow-xl active:scale-95 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    onClick={(e) => {
                      if (!editingCode && formData.role === 'security' && !isSecurityTypeModalOpen) {
                        e.preventDefault();
                        setIsSecurityTypeModalOpen(true);
                        return;
                      }
                    }}
                  >
                    {editingCode ? <CheckCircle2 className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                    <span>{editingCode ? 'Save Changes' : 'Generate ID'}</span>
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Security Type Selection Modal */}
      <AnimatePresence>
        {isSecurityTypeModalOpen && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 transition-colors">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsSecurityTypeModalOpen(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-md transition-colors"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative bg-bg-secondary border border-card-border rounded-[2.5rem] shadow-2xl w-full max-w-sm overflow-hidden p-8 transition-colors"
            >
              <div className="flex items-center gap-3 mb-6 transition-colors">
                <div className="p-3 bg-accent-emergency/10 border border-accent-emergency/20 rounded-2xl text-accent-emergency transition-colors">
                  <Shield className="w-6 h-6" />
                </div>
                <div>
                  <h2 className="text-xl font-black text-text-primary tracking-tight transition-colors">Select Security Type</h2>
                  <p className="text-text-secondary text-[10px] font-black uppercase opacity-60 transition-colors">Assign emergency specialization</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 mb-8 transition-colors">
                {SOS_TYPES.map((type) => (
                  <button
                    key={type.id}
                    onClick={() => {
                      setFormData({ ...formData, securityType: type.id as SecurityType });
                    }}
                    className={cn(
                      "flex flex-col items-center gap-2 p-4 rounded-2xl border-2 transition-all group",
                      formData.securityType === type.id
                        ? "bg-text-primary border-text-primary shadow-lg"
                        : "bg-bg-primary border-card-border hover:border-text-secondary/30"
                    )}
                  >
                    <span className="text-2xl group-hover:scale-110 transition-transform transition-colors">{type.emoji}</span>
                    <span className={cn(
                      "text-[10px] font-black uppercase tracking-widest transition-colors",
                      formData.securityType === type.id ? "text-bg-primary" : "text-text-secondary opacity-60"
                    )}>
                      {type.label}
                    </span>
                  </button>
                ))}
              </div>

              <div className="flex gap-4 transition-colors">
                <button
                  onClick={() => setIsSecurityTypeModalOpen(false)}
                  className="flex-1 px-6 py-4 bg-bg-primary text-text-secondary border border-card-border rounded-2xl font-black uppercase tracking-widest text-[10px] hover:bg-bg-secondary hover:text-text-primary transition-all active:scale-95 transition-colors"
                >
                  Back
                </button>
                <button
                  onClick={handleSubmit}
                  className="flex-1 px-6 py-4 bg-text-primary text-bg-primary rounded-2xl font-black uppercase tracking-widest text-[10px] hover:opacity-90 shadow-xl active:scale-95 transition-colors"
                >
                  Confirm ID
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {isDeleteModalOpen && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 transition-colors">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsDeleteModalOpen(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-md transition-colors"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative bg-bg-secondary border border-card-border rounded-[2.5rem] shadow-2xl w-full max-w-sm overflow-hidden p-8 text-center transition-colors"
            >
              <div className="w-20 h-20 bg-accent-emergency/10 border border-accent-emergency/20 rounded-full flex items-center justify-center mx-auto mb-6 transition-colors shadow-[0_0_20px_rgba(239,68,68,0.1)]">
                <AlertCircle className="w-10 h-10 text-accent-emergency" />
              </div>
              
              <h2 className="text-2xl font-black text-text-primary tracking-tight mb-2 transition-colors">
                Are you sure?
              </h2>
              <p className="text-text-secondary font-bold opacity-60 mb-8 transition-colors uppercase tracking-tight text-xs">
                Are you sure you want to delete this ID? This action cannot be undone.
              </p>

              <div className="flex gap-4 transition-colors">
                <button
                  onClick={() => setIsDeleteModalOpen(false)}
                  className="flex-1 px-6 py-4 bg-bg-primary text-text-secondary border border-card-border rounded-2xl font-black uppercase tracking-widest text-[10px] hover:bg-bg-secondary hover:text-text-primary transition-all active:scale-95 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmDelete}
                  className="flex-1 px-6 py-4 bg-accent-emergency text-white rounded-2xl font-black uppercase tracking-widest text-[10px] hover:bg-opacity-90 transition-all shadow-xl shadow-accent-emergency/20 active:scale-95 transition-colors"
                >
                  Delete
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
