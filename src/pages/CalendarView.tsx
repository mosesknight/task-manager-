import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/db/supabase';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import type { Task, TaskPriority } from '@/types';
import {
  ChevronLeft,
  ChevronRight,
  CalendarDays,
  CheckSquare,
  Square,
  Tag,
  Pencil,
} from 'lucide-react';

const DAYS_OF_WEEK = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const priorityBadgeClass: Record<TaskPriority, string> = {
  High: 'badge-priority-high',
  Medium: 'badge-priority-medium',
  Low: 'badge-priority-low',
};

function toDateKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function todayKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function isOverdue(dueDate: string | null, completed: boolean): boolean {
  if (!dueDate || completed) return false;
  // Compare date strings directly to avoid UTC timezone shift
  return dueDate < todayKey();
}

function isToday(date: Date): boolean {
  const now = new Date();
  return (
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate()
  );
}

export default function CalendarView() {
  const { user } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [taskDialogOpen, setTaskDialogOpen] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const fetchTasks = async () => {
    if (!user) return;
    setLoading(true);
    const { data, error } = await supabase
      .from('tasks')
      .select('*')
      .eq('user_id', user.id)
      .not('due_date', 'is', null)
      .order('due_date', { ascending: true });

    if (error) {
      toast.error('Failed to load tasks');
    } else {
      setTasks(Array.isArray(data) ? data : []);
    }
    setLoading(false);
  };

  useEffect(() => { fetchTasks(); }, [user]);

  // Map dateKey -> tasks
  const tasksByDay = useMemo(() => {
    const map = new Map<string, Task[]>();
    for (const task of tasks) {
      if (!task.due_date) continue;
      // due_date is stored as "yyyy-MM-dd" — use directly as key to avoid UTC shift
      const key = task.due_date.slice(0, 10);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(task);
    }
    return map;
  }, [tasks]);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const monthName = currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  // Build grid: weeks × days
  const calendarDays = useMemo(() => {
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const cells: (Date | null)[] = Array(firstDay).fill(null);
    for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(year, month, d));
    const remainder = cells.length % 7;
    if (remainder !== 0) for (let i = 0; i < 7 - remainder; i++) cells.push(null);
    const weeks: (Date | null)[][] = [];
    for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
    return weeks;
  }, [year, month]);

  const prevMonth = () => setCurrentDate(new Date(year, month - 1, 1));
  const nextMonth = () => setCurrentDate(new Date(year, month + 1, 1));
  const goToday = () => setCurrentDate(new Date());

  const selectedDayTasks = selectedDay ? (tasksByDay.get(selectedDay) ?? []) : [];

  const handleDayClick = (date: Date) => {
    const key = toDateKey(date);
    setSelectedDay(key);
  };

  const openTask = (task: Task) => {
    setSelectedTask(task);
    setTaskDialogOpen(true);
  };

  const toggleComplete = async (task: Task) => {
    if (!user) return;
    setUpdatingId(task.id);
    const { error } = await supabase
      .from('tasks')
      .update({ completed: !task.completed })
      .eq('id', task.id)
      .eq('user_id', user.id);

    if (error) {
      toast.error('Failed to update task');
    } else {
      toast.success(task.completed ? 'Marked as pending' : 'Marked as completed');
      if (selectedTask?.id === task.id) {
        setSelectedTask({ ...selectedTask, completed: !task.completed });
      }
      fetchTasks();
    }
    setUpdatingId(null);
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Calendar</h1>
          <p className="text-muted-foreground">Tasks visualized by due date</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button variant="outline" size="sm" onClick={goToday}>Today</Button>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={prevMonth}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm font-semibold min-w-[11rem] text-center">{monthName}</span>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={nextMonth}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-[1fr_300px]">
        {/* Calendar Grid */}
        <Card>
          <CardContent className="p-3 md:p-4">
            {loading ? (
              <div className="space-y-2">
                {[1, 2, 3, 4, 5].map((i) => <Skeleton key={i} className="h-16 w-full" />)}
              </div>
            ) : (
              <>
                {/* Day headers */}
                <div className="grid grid-cols-7 mb-1">
                  {DAYS_OF_WEEK.map((d) => (
                    <div key={d} className="py-2 text-center text-xs font-medium text-muted-foreground">
                      {d}
                    </div>
                  ))}
                </div>
                {/* Weeks */}
                <div className="space-y-1">
                  {calendarDays.map((week, wi) => (
                    <div key={wi} className="grid grid-cols-7 gap-1">
                      {week.map((date, di) => {
                        if (!date) return <div key={di} className="min-h-[4.5rem] md:min-h-[5.5rem] rounded-md bg-muted/20" />;
                        const key = toDateKey(date);
                        const dayTasks = tasksByDay.get(key) ?? [];
                        const today = isToday(date);
                        const isSelected = selectedDay === key;
                        const hasOverdue = dayTasks.some((t) => isOverdue(t.due_date, t.completed));
                        const allDone = dayTasks.length > 0 && dayTasks.every((t) => t.completed);

                        return (
                          <button
                            key={di}
                            onClick={() => handleDayClick(date)}
                            className={`min-h-[4.5rem] md:min-h-[5.5rem] rounded-md p-1.5 text-left transition-colors border ${
                              isSelected
                                ? 'border-primary bg-primary/5'
                                : today
                                  ? 'border-primary/40 bg-primary/5'
                                  : 'border-transparent hover:border-border hover:bg-muted/40'
                            }`}
                          >
                            <span className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-medium mb-1 ${
                              today ? 'bg-primary text-primary-foreground' : 'text-foreground'
                            }`}>
                              {date.getDate()}
                            </span>

                            {/* Task indicators */}
                            <div className="space-y-0.5">
                              {dayTasks.slice(0, 3).map((task) => (
                                <div
                                  key={task.id}
                                  className={`truncate rounded px-1 py-0.5 text-[10px] leading-tight font-medium ${
                                    task.completed
                                      ? 'bg-muted text-muted-foreground line-through'
                                      : isOverdue(task.due_date, task.completed)
                                        ? 'bg-[hsl(var(--status-error))]/10 text-[hsl(var(--status-error))]'
                                        : 'bg-primary/10 text-primary'
                                  }`}
                                >
                                  {task.title}
                                </div>
                              ))}
                              {dayTasks.length > 3 && (
                                <div className="text-[10px] text-muted-foreground px-1">
                                  +{dayTasks.length - 3} more
                                </div>
                              )}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  ))}
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Day Panel */}
        <div className="space-y-4">
          <Card className="h-full">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <CalendarDays className="h-4 w-4 shrink-0" />
                {selectedDay
                  ? new Date(selectedDay + 'T00:00:00').toLocaleDateString('en-US', {
                      weekday: 'long',
                      month: 'long',
                      day: 'numeric',
                    })
                  : 'Select a day'}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {!selectedDay ? (
                <p className="text-sm text-muted-foreground">Click any day to see its tasks.</p>
              ) : selectedDayTasks.length === 0 ? (
                <p className="text-sm text-muted-foreground">No tasks due on this day.</p>
              ) : (
                <div className="space-y-2">
                  {selectedDayTasks.map((task) => {
                    const overdue = isOverdue(task.due_date, task.completed);
                    return (
                      <div
                        key={task.id}
                        className={`rounded-lg border p-3 transition-colors ${
                          overdue && !task.completed
                            ? 'border-l-2 border-l-[hsl(var(--status-error))] bg-[hsl(var(--status-error))]/5'
                            : 'hover:bg-muted/40'
                        }`}
                      >
                        <div className="flex items-start gap-2">
                          <button
                            onClick={() => toggleComplete(task)}
                            disabled={updatingId === task.id}
                            className="mt-0.5 shrink-0 text-muted-foreground hover:text-primary transition-colors disabled:opacity-40"
                          >
                            {task.completed
                              ? <CheckSquare className="h-4 w-4 text-green-600 dark:text-green-400" />
                              : <Square className="h-4 w-4" />}
                          </button>
                          <div className="min-w-0 flex-1">
                            <p className={`text-sm font-medium text-balance ${task.completed ? 'line-through text-muted-foreground' : ''}`}>
                              {task.title}
                            </p>
                            <div className="flex flex-wrap gap-1.5 mt-1.5">
                              <span className={`inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-medium ${priorityBadgeClass[task.priority]}`}>
                                {task.priority}
                              </span>
                              {(task.tags || []).slice(0, 2).map((tag) => (
                                <span key={tag} className="inline-flex items-center gap-0.5 rounded-full bg-secondary px-1.5 py-0.5 text-[10px] text-secondary-foreground">
                                  <Tag className="h-2 w-2" />{tag}
                                </span>
                              ))}
                            </div>
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 shrink-0"
                            onClick={() => openTask(task)}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Legend */}
          <Card>
            <CardContent className="p-4 space-y-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Legend</p>
              <div className="space-y-1.5 text-xs">
                <div className="flex items-center gap-2">
                  <div className="h-3 w-3 rounded bg-primary/20 shrink-0" />
                  <span className="text-muted-foreground">Upcoming task</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="h-3 w-3 rounded bg-[hsl(var(--status-error))]/20 shrink-0" />
                  <span className="text-muted-foreground">Overdue task</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="h-3 w-3 rounded bg-muted shrink-0" />
                  <span className="text-muted-foreground">Completed task</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="h-5 w-5 rounded-full bg-primary flex items-center justify-center text-[9px] text-primary-foreground font-bold shrink-0">1</div>
                  <span className="text-muted-foreground">Today</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Task Detail Dialog */}
      <Dialog open={taskDialogOpen} onOpenChange={setTaskDialogOpen}>
        <DialogContent className="max-w-[calc(100%-2rem)] md:max-w-lg">
          <DialogHeader>
            <DialogTitle>Task Details</DialogTitle>
          </DialogHeader>
          {selectedTask && (
            <div className="space-y-4 py-2">
              <div>
                <p className={`text-base font-semibold ${selectedTask.completed ? 'line-through text-muted-foreground' : ''}`}>
                  {selectedTask.title}
                </p>
                {selectedTask.description && (
                  <p className="text-sm text-muted-foreground mt-1 text-pretty">{selectedTask.description}</p>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                <span className="inline-flex items-center rounded-full bg-secondary px-2.5 py-1 text-xs font-medium text-secondary-foreground">
                  {selectedTask.category}
                </span>
                <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${priorityBadgeClass[selectedTask.priority]}`}>
                  {selectedTask.priority} priority
                </span>
              </div>
              {selectedTask.due_date && (
                <div className={`flex items-center gap-2 text-sm ${isOverdue(selectedTask.due_date, selectedTask.completed) ? 'overdue-indicator' : 'text-muted-foreground'}`}>
                  <CalendarDays className="h-4 w-4 shrink-0" />
                  <span>
                    Due {new Date(selectedTask.due_date + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                    {isOverdue(selectedTask.due_date, selectedTask.completed) && ' (Overdue)'}
                  </span>
                </div>
              )}
              {(selectedTask.tags || []).length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {(selectedTask.tags || []).map((tag) => (
                    <span key={tag} className="inline-flex items-center gap-1 rounded-full bg-secondary px-2.5 py-1 text-xs text-secondary-foreground">
                      <Tag className="h-3 w-3" />{tag}
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setTaskDialogOpen(false);
                fetchTasks();
              }}
            >
              Close
            </Button>
            {selectedTask && (
              <Button
                onClick={() => toggleComplete(selectedTask)}
                disabled={updatingId === selectedTask.id}
              >
                {selectedTask.completed ? 'Mark as Pending' : 'Mark as Completed'}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
