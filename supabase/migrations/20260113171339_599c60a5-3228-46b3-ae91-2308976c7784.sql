-- Adicionar coluna de função na tabela report_attendance
ALTER TABLE report_attendance 
ADD COLUMN function_role TEXT;

-- Comentário explicativo
COMMENT ON COLUMN report_attendance.function_role IS 'Função/nível do colaborador (ex: Escalador N1, N2, N3, Supervisor, etc.)';