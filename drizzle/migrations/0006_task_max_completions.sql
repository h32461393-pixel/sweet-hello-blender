ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS max_completions INT NOT NULL DEFAULT 0;
CREATE INDEX IF NOT EXISTS task_completions_task_key_idx ON public.task_completions (task_key);