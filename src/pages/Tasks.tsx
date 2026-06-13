import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/db/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { TagInput } from '@/components/common/TagInput';
import type { Task, TaskCategory, TaskPriority } from '@/types';
import {
  Plus,
  Pencil,
  Trash2,
  CheckSquare,
  Square,
  Search,
  ClipboardList,
  CalendarDays,
  X,
  Filter,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Tag,
} from 'lucide-react';
import { format } from 'date-fns';

const categories: TaskCategory[] = ['Work', 'Personal', 'Shopping', 'Health'];
const priorities: TaskPriority[] = ['High', 'Medium', 'Low'];

const categoryBadgeClass: Record<TaskCategory, string> = {
  Work: 'badge-category-work',
  Personal: 'badge-category-personal',
  Shopping: 'badge-category-shopping',
  Health: 'badge-category-health',
};

const priorityBadgeClass: Record<TaskPriority, string> = {
  High: 'badge-priority-high',
  Medium: 'badge-priority-medium',
  Low: 'badge-priority-low',
};

const priorityOrder: Record<TaskPriority, number> = { High: 0, Medium: 1, Low: 2 };

type SortField = 'created_at' | 'due_date' | 'priority' | 'title';
type SortDir = 'asc' | 'desc';

function todayKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function isOverdue(dueDate: string | null, completed: boolean): boolean {
  if (!dueDate || completed) return false;
  // Compare date strings directly to avoid UTC timezone shift
  return dueDate.slice(0, 10) < todayKey();
}

export default function Tasks() {
  const { user } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCategory, setFilterCategory] = useState<TaskCategory | 'all'>('all');
  const [filterPriority, setFilterPriority] = useState<TaskPriority | 'all'>('all');
  const [filterStatus, setFilterStatus] = useState<'all' | 'completed' | 'pending'>('all');
  const [filterTag, setFilterTag] = useState<string>('all');
  const [sortField, setSortField] = useState<SortField>('created_at');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<TaskCategory>('Personal');
  const [priority, setPriority] = useState<TaskPriority>('Medium');
  const [dueDate, setDueDate] = useState<Date | undefined>(undefined);
  const [tags, setTags] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const fetchTasks = async () => {
    if (!user) return;
    setLoading(true);
    const { data, error } = await supabase
      .from('tasks')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (error) {
      toast.error('Failed to fetch tasks');
    } else {
      setTasks(Array.isArray(data) ? data : []);
    }
    setLoading(false);
  };

  useEffect(() => { fetchTasks(); }, [user]);

  // Collect all unique tags across tasks for autocomplete
  const allTags = useMemo(() => {
    const set = new Set<string>();
    for (const t of tasks) {
      for (const tag of t.tags || []) set.add(tag);
    }
    return Array.from(set).sort();
  }, [tasks]);

  const sortedFilteredTasks = useMemo(() => {
    let result = tasks.filter((t) => {
      const matchesSearch =
        t.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (t.description?.toLowerCase() || '').includes(searchQuery.toLowerCase());
      const matchesCategory = filterCategory === 'all' || t.category === filterCategory;
      const matchesPriority = filterPriority === 'all' || t.priority === filterPriority;
      const matchesStatus =
        filterStatus === 'all' ||
        (filterStatus === 'completed' ? t.completed : !t.completed);
      const matchesTag =
        filterTag === 'all' || (t.tags || []).includes(filterTag);
      return matchesSearch && matchesCategory && matchesPriority && matchesStatus && matchesTag;
    });

    result = [...result].sort((a, b) => {
      let cmp = 0;
      if (sortField === 'created_at') {
        cmp = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      } else if (sortField === 'due_date') {
        const aDate = a.due_date ? new Date(a.due_date).getTime() : Infinity;
        const bDate = b.due_date ? new Date(b.due_date).getTime() : Infinity;
        cmp = aDate - bDate;
      } else if (sortField === 'priority') {
        cmp = priorityOrder[a.priority] - priorityOrder[b.priority];
      } else if (sortField === 'title') {
        cmp = a.title.localeCompare(b.title);
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });

    return result;
  }, [tasks, searchQuery, filterCategory, filterPriority, filterStatus, filterTag, sortField, sortDir]);

  const activeFiltersCount = [filterCategory, filterPriority, filterStatus, filterTag].filter(
    (f) => f !== 'all'
  ).length + (searchQuery ? 1 : 0);

  const clearFilters = () => {
    setFilterCategory('all');
    setFilterPriority('all');
    setFilterStatus('all');
    setFilterTag('all');
    setSearchQuery('');
  };

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDir('desc');
    }
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <ArrowUpDown className="h-3.5 w-3.5 opacity-40" />;
    return sortDir === 'asc'
      ? <ArrowUp className="h-3.5 w-3.5" />
      : <ArrowDown className="h-3.5 w-3.5" />;
  };

  const handleCreate = () => {
    setEditingTask(null);
    setTitle('');
    setDescription('');
    setCategory('Personal');
    setPriority('Medium');
    setDueDate(undefined);
    setTags([]);
    setDialogOpen(true);
  };

  const handleEdit = (task: Task) => {
    setEditingTask(task);
    setTitle(task.title);
    setDescription(task.description || '');
    setCategory(task.category);
    setPriority(task.priority);
    setDueDate(task.due_date ? new Date(task.due_date) : undefined);
    setTags(task.tags || []);
    setDialogOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) { toast.error('Task title is required'); return; }
    if (!user) return;

    setIsSubmitting(true);
    const payload = {
      title: title.trim(),
      description: description.trim() || null,
      category,
      priority,
      due_date: dueDate ? format(dueDate, 'yyyy-MM-dd') : null,
      tags: [...new Set(tags)],
    };

    if (editingTask) {
      const { error } = await supabase.from('tasks').update(payload).eq('id', editingTask.id).eq('user_id', user.id);
      if (error) { toast.error('Failed to update task'); }
      else { toast.success('Task updated'); setDialogOpen(false); fetchTasks(); }
    } else {
      const { error } = await supabase.from('tasks').insert({ user_id: user.id, ...payload });
      if (error) { toast.error('Failed to create task'); }
      else { toast.success('Task created'); setDialogOpen(false); fetchTasks(); }
    }
    setIsSubmitting(false);
  };

  const toggleComplete = async (task: Task) => {
    if (!user) return;
    const { error } = await supabase.from('tasks').update({ completed: !task.completed }).eq('id', task.id).eq('user_id', user.id);
    if (error) { toast.error('Failed to update task'); }
    else { toast.success(task.completed ? 'Marked as pending' : 'Marked as completed'); fetchTasks(); }
  };

  const handleDelete = async (taskId: string) => {
    if (!user) return;
    const { error } = await supabase.from('tasks').delete().eq('id', taskId).eq('user_id', user.id);
    if (error) { toast.error('Failed to delete task'); }
    else { toast.success('Task deleted'); setDeleteConfirmId(null); fetchTasks(); }
  };

  const EmptyState = () => (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted mb-4">
        <ClipboardList className="h-8 w-8 text-muted-foreground" />
      </div>
      <h3 className="text-lg font-semibold">No tasks yet</h3>
      <p className="text-sm text-muted-foreground mt-1 mb-4 max-w-xs">
        Get started by creating your first task.
      </p>
      <Button onClick={handleCreate}><Plus className="mr-2 h-4 w-4" />Create Task</Button>
    </div>
  );

  const FilterSelect = ({ label, value, options, onChange }: { label: string; value: string; options: string[]; onChange: (val: string) => void; }) => (
    <div className="flex items-center gap-2">
      <Label className="text-xs font-medium text-muted-foreground shrink-0">{label}</Label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-8 rounded-md border border-input bg-background px-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
      >
        <option value="all">All</option>
        {options.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
    </div>
  );

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Tasks</h1>
          <p className="text-muted-foreground">Manage and track all your tasks</p>
        </div>
        <Button onClick={handleCreate} className="shrink-0">
          <Plus className="mr-2 h-4 w-4" />New Task
        </Button>
      </div>

      {tasks.length > 0 && (
        <div className="space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search tasks..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-9" />
          </div>

          {/* Filters */}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <FilterSelect label="Category" value={filterCategory} options={categories} onChange={(v) => setFilterCategory(v as TaskCategory | 'all')} />
            <FilterSelect label="Priority" value={filterPriority} options={priorities} onChange={(v) => setFilterPriority(v as TaskPriority | 'all')} />
            <FilterSelect label="Status" value={filterStatus} options={['Completed', 'Pending']} onChange={(v) => setFilterStatus(v.toLowerCase() as 'all' | 'completed' | 'pending')} />
            {allTags.length > 0 && (
              <FilterSelect label="Tag" value={filterTag} options={allTags} onChange={(v) => setFilterTag(v)} />
            )}
            {activeFiltersCount > 0 && (
              <Button variant="ghost" size="sm" className="h-8 px-2" onClick={clearFilters}>
                <X className="mr-1 h-3.5 w-3.5" />Clear
              </Button>
            )}
          </div>

          {/* Sort controls */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-medium text-muted-foreground">Sort:</span>
            {(['created_at', 'due_date', 'priority', 'title'] as SortField[]).map((field) => (
              <Button
                key={field}
                variant={sortField === field ? 'secondary' : 'ghost'}
                size="sm"
                className="h-7 px-2 gap-1 text-xs"
                onClick={() => toggleSort(field)}
              >
                {field === 'created_at' ? 'Date' : field.charAt(0).toUpperCase() + field.slice(1).replace('_', ' ')}
                <SortIcon field={field} />
              </Button>
            ))}
          </div>
        </div>
      )}

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Card key={i}><CardContent className="p-4"><Skeleton className="h-5 w-1/2 mb-2" /><Skeleton className="h-4 w-3/4" /></CardContent></Card>
          ))}
        </div>
      ) : tasks.length === 0 ? (
        <EmptyState />
      ) : sortedFilteredTasks.length === 0 ? (
        <div className="text-center py-12">
          <Filter className="mx-auto h-8 w-8 text-muted-foreground mb-2" />
          <p className="text-muted-foreground">No tasks match your filters</p>
          <Button variant="ghost" size="sm" className="mt-2" onClick={clearFilters}>Clear filters</Button>
        </div>
      ) : (
        <div className="space-y-3">
          {sortedFilteredTasks.map((task) => {
            const overdue = isOverdue(task.due_date, task.completed);
            return (
              <Card key={task.id} className={`group transition-all hover:shadow-md ${task.completed ? 'opacity-70' : ''} ${overdue ? 'border-l-4 border-l-[hsl(var(--status-error))]' : ''}`}>
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <button onClick={() => toggleComplete(task)} className="mt-0.5 shrink-0 text-muted-foreground hover:text-primary transition-colors">
                      {task.completed
                        ? <CheckSquare className="h-5 w-5 text-green-600 dark:text-green-400" />
                        : <Square className="h-5 w-5" />}
                    </button>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        <h3 className={`font-medium text-balance ${task.completed ? 'line-through text-muted-foreground' : ''}`}>
                          {task.title}
                        </h3>
                        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${categoryBadgeClass[task.category]}`}>{task.category}</span>
                        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${priorityBadgeClass[task.priority]}`}>{task.priority}</span>
                      </div>
                      {task.description && <p className="text-sm text-muted-foreground mt-1 text-pretty">{task.description}</p>}
                      {(task.tags || []).length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mt-2">
                          {(task.tags || []).map((tag) => (
                            <span key={tag} className="inline-flex items-center gap-1 rounded-full bg-secondary px-2 py-0.5 text-xs text-secondary-foreground">
                              <Tag className="h-2.5 w-2.5" />{tag}
                            </span>
                          ))}
                        </div>
                      )}
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 text-xs text-muted-foreground">
                        <span>Created {new Date(task.created_at).toLocaleDateString()}</span>
                        {task.due_date && (
                          <span className={`flex items-center gap-1 ${overdue ? 'overdue-indicator font-medium' : ''}`}>
                            <CalendarDays className="h-3.5 w-3.5" />
                            Due {new Date(task.due_date + 'T12:00:00').toLocaleDateString()}{overdue && ' (Overdue)'}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleEdit(task)}>
                        <Pencil className="h-4 w-4" /><span className="sr-only">Edit</span>
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => setDeleteConfirmId(task.id)}>
                        <Trash2 className="h-4 w-4" /><span className="sr-only">Delete</span>
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Create / Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-[calc(100%-2rem)] md:max-w-lg max-h-[90dvh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingTask ? 'Edit Task' : 'Create Task'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit}>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="title">Title</Label>
                <Input id="title" placeholder="Enter task title" value={title} onChange={(e) => setTitle(e.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">Description (optional)</Label>
                <Textarea id="description" placeholder="Add a description…" value={description} onChange={(e) => setDescription(e.target.value)} rows={3} />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="category">Category</Label>
                  <select id="category" value={category} onChange={(e) => setCategory(e.target.value as TaskCategory)} className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring">
                    {categories.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="priority">Priority</Label>
                  <select id="priority" value={priority} onChange={(e) => setPriority(e.target.value as TaskPriority)} className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring">
                    {priorities.map((p) => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Due Date (optional)</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-full justify-start text-left font-normal">
                      <CalendarDays className="mr-2 h-4 w-4" />
                      {dueDate ? format(dueDate, 'PPP') : 'Pick a date'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar mode="single" selected={dueDate} onSelect={setDueDate} initialFocus />
                  </PopoverContent>
                </Popover>
                {dueDate && (
                  <Button type="button" variant="ghost" size="sm" className="h-7 px-2" onClick={() => setDueDate(undefined)}>
                    <X className="mr-1 h-3.5 w-3.5" />Clear date
                  </Button>
                )}
              </div>
              <div className="space-y-2">
                <Label>Tags</Label>
                <TagInput tags={tags} onChange={setTags} suggestions={allTags} />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? 'Saving…' : editingTask ? 'Update Task' : 'Create Task'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!deleteConfirmId} onOpenChange={() => setDeleteConfirmId(null)}>
        <DialogContent className="max-w-[calc(100%-2rem)] md:max-w-lg">
          <DialogHeader><DialogTitle>Delete Task</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">Are you sure you want to delete this task? This action cannot be undone.</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirmId(null)}>Cancel</Button>
            <Button variant="destructive" onClick={() => deleteConfirmId && handleDelete(deleteConfirmId)}>Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
