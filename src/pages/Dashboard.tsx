import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/db/supabase';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import type { DashboardStats, Task } from '@/types';
import { CheckSquare, Clock, ListTodo, ArrowRight, AlertTriangle, CalendarDays } from 'lucide-react';
export default function Dashboard() {
  const { user } = useAuth();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [overdueCount, setOverdueCount] = useState(0);
  const [recentTasks, setRecentTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;

    const fetchStats = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from('tasks')
        .select('*')
        .eq('user_id', user.id);

      if (error) {
        console.error('Failed to fetch stats:', error);
        setLoading(false);
        return;
      }

      const tasks = Array.isArray(data) ? data : [];
      const total = tasks.length;
      const completed = tasks.filter((t) => t.completed).length;
      const pending = total - completed;
      const now = new Date().toISOString();
      const overdue = tasks.filter(
        (t) => !t.completed && t.due_date && t.due_date < now
      ).length;

      setStats({ total, completed, pending });
      setOverdueCount(overdue);
      setRecentTasks(tasks.slice(0, 5));
      setLoading(false);
    };

    fetchStats();
  }, [user]);

  const StatCard = ({
    title,
    value,
    icon: Icon,
    colorClass,
  }: {
    title: string;
    value: number;
    icon: React.ElementType;
    colorClass: string;
  }) => (
    <Card className="h-full">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {title}
        </CardTitle>
        <div className={`flex h-8 w-8 items-center justify-center rounded-md ${colorClass}`}>
          <Icon className="h-4 w-4" />
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <Skeleton className="h-8 w-16" />
        ) : (
          <p className="text-2xl font-bold">{value}</p>
        )}
      </CardContent>
    </Card>
  );

  const isOverdue = (task: Task) => {
    if (!task.due_date || task.completed) return false;
    return new Date(task.due_date) < new Date();
  };

  const priorityBadgeClass: Record<string, string> = {
    High: 'badge-priority-high',
    Medium: 'badge-priority-medium',
    Low: 'badge-priority-low',
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">
          Welcome back! Here's an overview of your tasks.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Total Tasks"
          value={stats?.total ?? 0}
          icon={ListTodo}
          colorClass="bg-primary/10 text-primary"
        />
        <StatCard
          title="Completed"
          value={stats?.completed ?? 0}
          icon={CheckSquare}
          colorClass="bg-[hsl(var(--status-success))]/10 text-[hsl(var(--status-success))]"
        />
        <StatCard
          title="Pending"
          value={stats?.pending ?? 0}
          icon={Clock}
          colorClass="bg-[hsl(var(--status-warning))]/10 text-[hsl(var(--status-warning))]"
        />
        <StatCard
          title="Overdue"
          value={overdueCount}
          icon={AlertTriangle}
          colorClass="bg-[hsl(var(--status-error))]/10 text-[hsl(var(--status-error))]"
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Quick Actions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Manage your tasks efficiently. Create, edit, and track your progress.
            </p>
            <div className="flex flex-wrap gap-3">
              <Button asChild>
                <Link to="/tasks">
                  View Tasks
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
              <Button variant="outline" asChild>
                <Link to="/tasks">
                  Create Task
                </Link>
              </Button>
              <Button variant="outline" asChild>
                <Link to="/calendar">
                  <CalendarDays className="mr-2 h-4 w-4" />
                  Calendar
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Recent Tasks</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-2">
                <Skeleton className="h-5 w-full" />
                <Skeleton className="h-5 w-full" />
                <Skeleton className="h-5 w-3/4" />
              </div>
            ) : recentTasks.length === 0 ? (
              <p className="text-sm text-muted-foreground">No tasks yet. Create your first task!</p>
            ) : (
              <div className="space-y-3">
                {recentTasks.map((task) => (
                  <div key={task.id} className="flex items-center gap-2">
                    <div className="min-w-0 flex-1">
                      <p className={`text-sm font-medium truncate ${task.completed ? 'line-through text-muted-foreground' : ''}`}>
                        {task.title}
                      </p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className={`inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-medium ${priorityBadgeClass[task.priority]}`}>
                          {task.priority}
                        </span>
                        {task.due_date && (
                          <span className={`flex items-center gap-1 text-xs ${isOverdue(task) ? 'overdue-indicator font-medium' : 'text-muted-foreground'}`}>
                            <CalendarDays className="h-3 w-3" />
                            {new Date(task.due_date).toLocaleDateString()}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
                {stats && stats.total > 5 && (
                  <Button variant="ghost" size="sm" className="w-full" asChild>
                    <Link to="/tasks">View all tasks</Link>
                  </Button>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}