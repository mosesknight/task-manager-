export interface Option {
  label: string;
  value: string;
  icon?: React.ComponentType<{ className?: string }>;
  withCount?: boolean;
}

export interface Profile {
  id: string;
  email: string;
  created_at: string;
  updated_at: string;
}

export type TaskCategory = 'Work' | 'Personal' | 'Shopping' | 'Health';
export type TaskPriority = 'High' | 'Medium' | 'Low';

export interface Task {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  completed: boolean;
  category: TaskCategory;
  priority: TaskPriority;
  due_date: string | null;
  tags: string[];
  created_at: string;
  updated_at: string;
}

export interface DashboardStats {
  total: number;
  completed: number;
  pending: number;
}
