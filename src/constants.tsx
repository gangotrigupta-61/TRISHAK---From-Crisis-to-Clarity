import { Flame, Stethoscope, Package, HelpCircle } from 'lucide-react';
import { IncidentType } from './types';

export interface SOSType {
  id: IncidentType;
  label: string;
  icon: any;
  emoji: string;
  color: string;
  bg: string;
}

export const SOS_TYPES: SOSType[] = [
  { id: 'fire', label: 'Fire', icon: Flame, emoji: '🔥', color: 'red', bg: 'bg-red-600' },
  { id: 'medical', label: 'Medical', icon: Stethoscope, emoji: '🩺', color: 'blue', bg: 'bg-blue-600' },
  { id: 'theft', label: 'Theft', icon: Package, emoji: '📦', color: 'orange', bg: 'bg-orange-600' },
  { id: 'other', label: 'Other', icon: HelpCircle, emoji: '❓', color: 'gray', bg: 'bg-text-secondary' }
];

export const mapOldIncidentType = (type: string): IncidentType => {
  const mapping: Record<string, IncidentType> = {
    'panic': 'other',
    'fall': 'other',
    'gas_leak': 'other',
    'security': 'other',
    'unknown': 'other'
  };
  return (mapping[type] || (['fire', 'medical', 'theft', 'other'].includes(type) ? type : 'other')) as IncidentType;
};
