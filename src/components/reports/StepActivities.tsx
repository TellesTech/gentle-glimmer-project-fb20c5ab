import { useState } from 'react';
import { Plus, Trash2, GripVertical, CheckCircle2, Circle } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import type { ReportFormData } from '@/pages/ReportForm';
import type { Activity } from '@/types';

interface StepActivitiesProps {
  data: ReportFormData;
  onChange: (data: Partial<ReportFormData>) => void;
}

export function StepActivities({ data, onChange }: StepActivitiesProps) {
  const [newActivity, setNewActivity] = useState('');

  const addActivity = () => {
    if (!newActivity.trim()) return;
    
    const activity: Activity = {
      id: `temp-${Date.now()}`,
      reportId: '',
      description: newActivity.trim(),
      completed: false,
      order: data.activities.length + 1,
    };
    
    onChange({ activities: [...data.activities, activity] });
    setNewActivity('');
  };

  const removeActivity = (id: string) => {
    onChange({
      activities: data.activities
        .filter(a => a.id !== id)
        .map((a, idx) => ({ ...a, order: idx + 1 })),
    });
  };

  const toggleCompleted = (id: string) => {
    onChange({
      activities: data.activities.map(a =>
        a.id === id ? { ...a, completed: !a.completed } : a
      ),
    });
  };

  const updateDescription = (id: string, description: string) => {
    onChange({
      activities: data.activities.map(a =>
        a.id === id ? { ...a, description } : a
      ),
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <Label>Atividades Executadas</Label>
        <p className="text-sm text-muted-foreground mt-1">
          Liste as atividades realizadas durante o dia
        </p>
      </div>

      {/* Add Activity */}
      <div className="flex gap-2">
        <Input
          value={newActivity}
          onChange={(e) => setNewActivity(e.target.value)}
          placeholder="Descreva a atividade..."
          onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addActivity())}
        />
        <Button onClick={addActivity} disabled={!newActivity.trim()}>
          <Plus className="h-4 w-4" />
        </Button>
      </div>

      {/* Activities List */}
      <div className="space-y-2">
        {data.activities.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground border border-dashed rounded-lg">
            <p>Nenhuma atividade adicionada</p>
            <p className="text-sm">Use o campo acima para adicionar</p>
          </div>
        ) : (
          data.activities.map((activity, index) => (
            <div
              key={activity.id}
              className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg group"
            >
              <GripVertical className="h-4 w-4 text-muted-foreground cursor-grab" />
              <span className="text-sm text-muted-foreground w-6">
                {index + 1}.
              </span>
              <Checkbox
                checked={activity.completed}
                onCheckedChange={() => toggleCompleted(activity.id)}
              />
              <Input
                value={activity.description}
                onChange={(e) => updateDescription(activity.id, e.target.value)}
                className={`flex-1 border-0 bg-transparent p-0 h-auto ${
                  activity.completed ? 'line-through text-muted-foreground' : ''
                }`}
              />
              <Button
                variant="ghost"
                size="icon"
                className="opacity-0 group-hover:opacity-100 transition-opacity h-8 w-8"
                onClick={() => removeActivity(activity.id)}
              >
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </div>
          ))
        )}
      </div>

      {/* Summary */}
      {data.activities.length > 0 && (
        <div className="flex items-center gap-4 text-sm text-muted-foreground pt-4 border-t">
          <div className="flex items-center gap-1">
            <CheckCircle2 className="h-4 w-4 text-success" />
            {data.activities.filter(a => a.completed).length} concluídas
          </div>
          <div className="flex items-center gap-1">
            <Circle className="h-4 w-4" />
            {data.activities.filter(a => !a.completed).length} pendentes
          </div>
        </div>
      )}
    </div>
  );
}
