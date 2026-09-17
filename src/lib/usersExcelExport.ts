import ExcelJS from 'exceljs';
import { format } from 'date-fns';

export interface UserSheetRow {
  name: string;
  email: string;
  role: string;
  job_title?: string | null;
  state?: string | null;
  employment_type?: string | null;
  is_active?: boolean;
  has_pin?: boolean;
  sites_count?: number;
  created_at?: string | null;
}

const ROLE_LABELS: Record<string, string> = {
  super_admin: 'Super Admin',
  master: 'Master',
  admin: 'Administrador',
  director: 'Diretor',
  supervisor: 'Supervisor',
  leader: 'Líder',
  collaborator: 'Operacional',
  hr: 'RH',
  client: 'Cliente',
};

const EMPLOYMENT_LABELS: Record<string, string> = {
  fixo: 'Fixo',
  intermitente: 'Intermitente',
};

const stripAccents = (v: string) =>
  v.normalize('NFD').replace(/[\u0300-\u036f]/g, '');

export async function exportUsersToExcel(users: UserSheetRow[]) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Sistema RDO';
  workbook.created = new Date();

  const sheet = workbook.addWorksheet('Colaboradores', {
    views: [{ state: 'frozen', ySplit: 2 }],
  });

  const headers = [
    'Nome',
    'Função',
    'Perfil de acesso',
    'Vínculo',
    'Estado',
    'Situação',
    'Fábricas',
    'Email / Acesso',
    'Data de cadastro',
  ];

  // Título
  sheet.mergeCells(1, 1, 1, headers.length);
  const titleCell = sheet.getCell('A1');
  titleCell.value = `Colaboradores — ${users.length} registro${users.length === 1 ? '' : 's'} — gerado em ${format(new Date(), 'dd/MM/yyyy HH:mm')}`;
  titleCell.font = { bold: true, size: 13, color: { argb: 'FF9B1C1C' } };
  titleCell.alignment = { vertical: 'middle' };
  sheet.getRow(1).height = 24;

  const headerRow = sheet.addRow(headers);
  headerRow.height = 22;
  headerRow.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF9B1C1C' } };
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    cell.border = { bottom: { style: 'thin', color: { argb: 'FF7A1515' } } };
  });

  const sorted = [...users].sort((a, b) =>
    stripAccents((a.name || '').toLowerCase()).localeCompare(
      stripAccents((b.name || '').toLowerCase()),
      'pt-BR',
    ),
  );

  sorted.forEach((u, index) => {
    const internal = (u.email || '').includes('@internal.local');
    const row = sheet.addRow([
      u.name || '—',
      (u.job_title || '').trim() || '—',
      ROLE_LABELS[u.role] || u.role || '—',
      EMPLOYMENT_LABELS[u.employment_type || ''] || '—',
      (u.state || '').toUpperCase() || '—',
      u.is_active === false ? 'Inativo' : 'Ativo',
      typeof u.sites_count === 'number' ? u.sites_count : 0,
      internal ? 'Somente registro' : u.email || '—',
      u.created_at ? format(new Date(u.created_at), 'dd/MM/yyyy') : '—',
    ]);

    row.height = 18;
    row.eachCell((cell, col) => {
      cell.alignment = {
        vertical: 'middle',
        horizontal: col === 1 || col === 2 || col === 8 ? 'left' : 'center',
      };
      cell.font = { size: 10 };
      cell.border = { bottom: { style: 'hair', color: { argb: 'FFE5E5E5' } } };
      if (index % 2 === 1) {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFAFAFA' } };
      }
    });

    // Destaque para inativos
    if (u.is_active === false) {
      row.getCell(6).font = { size: 10, bold: true, color: { argb: 'FFB91C1C' } };
    } else {
      row.getCell(6).font = { size: 10, color: { argb: 'FF15803D' } };
    }
    // Função sem preenchimento fica em destaque suave
    if (!(u.job_title || '').trim()) {
      row.getCell(2).font = { size: 10, italic: true, color: { argb: 'FFB45309' } };
    }
  });

  sheet.columns = [
    { width: 38 },
    { width: 28 },
    { width: 18 },
    { width: 14 },
    { width: 10 },
    { width: 12 },
    { width: 10 },
    { width: 32 },
    { width: 16 },
  ];

  sheet.autoFilter = {
    from: { row: 2, column: 1 },
    to: { row: 2 + sorted.length, column: headers.length },
  };

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `Colaboradores_${format(new Date(), 'yyyy-MM-dd')}.xlsx`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
