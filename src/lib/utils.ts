import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { UserProfile } from '../types';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatTimestamp(timestamp: any): string {
  if (!timestamp) return '';
  const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
  const datePart = date.toLocaleDateString([], { month: 'short', day: 'numeric' });
  const timePart = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  return `${datePart}, ${timePart}`;
}

export function getSeverityColor(severity: string): string {
  switch (severity) {
    case 'critical': return 'bg-red-600 text-white';
    case 'high': return 'bg-orange-500 text-white';
    case 'medium': return 'bg-yellow-500 text-black';
    case 'low': return 'bg-blue-500 text-white';
    default: return 'bg-text-secondary text-white';
  }
}

export function getStatusColor(status: string): string {
  switch (status) {
    case 'reported': return 'text-red-600';
    case 'responding': return 'text-blue-600';
    case 'resolved': return 'text-green-600';
    default: return 'text-text-secondary';
  }
}

export function getRoleDisplayName(profile?: UserProfile | null): string {
  if (!profile) return 'User';
  
  if (profile.role === 'security') {
    if (profile.securityType) {
      return `${profile.securityType.charAt(0).toUpperCase() + profile.securityType.slice(1)} Security`;
    }
    // Fallback to ID suffix if securityType is missing from profile but present in code
    if (profile.uniqueId) {
      if (profile.uniqueId.endsWith('FI')) return 'Fire Security';
      if (profile.uniqueId.endsWith('MD')) return 'Medical Security';
      if (profile.uniqueId.endsWith('TH')) return 'Theft Security';
      if (profile.uniqueId.endsWith('OT')) return 'Other Security';
    }
    return 'Security';
  }
  
  return profile.role.charAt(0).toUpperCase() + profile.role.slice(1);
}

/**
 * Safely stringify objects that might contain circular references or large data
 */
export function safeStringify(obj: any, indent = 0): string {
  try {
    const cache = new Set();
    return JSON.stringify(obj, (key, value) => {
      if (typeof value === 'object' && value !== null) {
        if (cache.has(value)) {
          return '[Circular]';
        }
        cache.add(value);
      }
      return value;
    }, indent);
  } catch (err) {
    return String(obj);
  }
}

/**
 * Safely parse JSON strings
 */
export function safeParse<T>(json: string | null, fallback: T): T {
  if (!json) return fallback;
  try {
    return JSON.parse(json) as T;
  } catch (err) {
    console.error('Safe parse failed for:', json);
    return fallback;
  }
}
