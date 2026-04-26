export type UserRole = 'guest' | 'receptionist' | 'staff' | 'security' | 'admin' | 'responder';

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  photoURL: string;
  phone?: string;
  role: UserRole;
  status: 'active' | 'inactive';
  securityType?: SecurityType;
  lastDutyChange?: any;
  organizationId?: string;
  uniqueId?: string;
  guestTokenId?: string;
  verifiedBy?: string;
  lastLocation?: {
    lat: number;
    lng: number;
    timestamp: string;
  };
}

export type OrganizationType = 'hospital' | 'hotel' | 'restaurant';

export interface Organization {
  id: string;
  orgId: string; // The user-entered ID (e.g., "HOSP-001")
  name: string;
  type: OrganizationType;
  location: {
    lat: number;
    lng: number;
    address: string;
  };
  adminId: string;
  createdAt: any;
  updatedAt: any;
}

export interface Guest {
  id: string;
  guestId: string;
  code?: string;
  name: string;
  phone: string;
  email?: string;
  status: 'active' | 'used' | 'expired';
  organizationId: string;
  createdAt: any;
  usedBy?: string;
  usedAt?: any;
}

export interface GuestToken {
  id: string;
  code: string;
  guestName?: string;
  guestPhone?: string;
  guestEmail?: string;
  receptionistId: string;
  organizationId?: string;
  guestId?: string;
  status: 'active' | 'used' | 'expired';
  createdAt: any;
  expiresAt: any;
}

export type IncidentType = 'fire' | 'medical' | 'theft' | 'other' | 'unknown';
export type IncidentSeverity = 'critical' | 'high' | 'medium' | 'low';
export type IncidentStatus = 'reported' | 'acknowledged' | 'assigned' | 'escalated' | 'responding' | 'resolved' | 'closed';
export type SecurityType = 'fire' | 'medical' | 'theft' | 'other';

export interface ResponderDetail {
  uid: string;
  name: string;
  role: UserRole;
  status: 'responding' | 'arrived' | 'completed';
  eta?: string; // e.g., "5 mins"
  estimatedArrivalTime?: any; // Firestore Timestamp
  location?: {
    lat: number;
    lng: number;
    address?: string;
  };
  updatedAt: any;
}

export interface Incident {
  id: string;
  type: IncidentType;
  severity: IncidentSeverity;
  status: IncidentStatus;
  organizationId?: string;
  reporterId: string;
  reporterName?: string;
  reporterRole?: string;
  location: {
    lat: number;
    lng: number;
    address: string;
    floor?: string;
    zone?: string;
  };
  description: string;
  createdAt: any; // Firestore Timestamp
  updatedAt: any; // Firestore Timestamp
  responders: string[]; // List of responder UIDs
  responderDetails?: { [uid: string]: ResponderDetail };
  assignedToRoles?: UserRole[];
  assignedTo?: string;
  assignedUsers?: string[];
  securityType?: SecurityType;
  aiSummary?: string;
  aiResponsePlan?: string;
  forwardedToEmergencyServices?: boolean;
  isGlobal?: boolean;
  triggeredBy?: string;
  triggeredByRole?: UserRole;
}

export interface RoleCode {
  id: string;
  code: string; // e.g., RE123
  role: UserRole;
  securityType?: SecurityType;
  organizationId: string;
  status: 'active' | 'inactive' | 'used';
  assignedTo?: string; // userId if used
  email?: string; // email used for this code
  name?: string;
  phone?: string;
  createdAt: any;
  updatedAt: any;
}

export interface Message {
  id: string;
  incidentId: string;
  senderId: string;
  senderName: string;
  senderRole: string;
  text: string;
  type: 'text' | 'system' | 'image' | 'voice';
  mediaUrl?: string;
  estimatedArrivalTime?: any; // Firestore Timestamp
  timestamp: any; // Firestore Timestamp
}

export interface GuestSession {
  sessionId: string;
  guestId: string;
  guestCode: string;
  userId: string;
  userEmail: string;
  timestamp: any;
  userAgent?: string;
}
