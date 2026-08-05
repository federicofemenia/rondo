import { useEffect, useState } from 'react';
import Alert from '@mui/material/Alert';
import Avatar from '@mui/material/Avatar';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import Dialog from '@mui/material/Dialog';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import IconButton from '@mui/material/IconButton';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import type { AdminUserSearchResultDto, ClubAdminUserDto } from '@rondo/contracts';
import { ApiError, useApi } from './apiClient';

type AssignAdminDialogProps = {
  open: boolean;
  clubId: string;
  onClose: () => void;
  onAssigned: (admins: ClubAdminUserDto[]) => void;
};

const SEARCH_DEBOUNCE_MS = 300;

function AssignAdminDialog({ open, clubId, onClose, onAssigned }: AssignAdminDialogProps) {
  const api = useApi();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<AdminUserSearchResultDto[]>([]);
  const [searching, setSearching] = useState(false);
  const [assigningId, setAssigningId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setQuery('');
      setResults([]);
      setError(null);
      return;
    }
  }, [open]);

  useEffect(() => {
    if (!open || query.trim().length === 0) {
      setResults([]);
      return;
    }

    let cancelled = false;
    setSearching(true);
    const timeout = setTimeout(() => {
      api
        .get<{ data: AdminUserSearchResultDto[] }>(`/api/v1/admin/users/search?q=${encodeURIComponent(query.trim())}`)
        .then((response) => {
          if (!cancelled) {
            setResults(response.data);
          }
        })
        .catch(() => {
          if (!cancelled) {
            setError('No pudimos buscar usuarios. Reintentá.');
          }
        })
        .finally(() => {
          if (!cancelled) {
            setSearching(false);
          }
        });
    }, SEARCH_DEBOUNCE_MS);

    return () => {
      cancelled = true;
      clearTimeout(timeout);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, query]);

  const handleAssign = async (userId: string) => {
    setAssigningId(userId);
    setError(null);
    try {
      const response = await api.post<{ data: ClubAdminUserDto[] }>(`/api/v1/admin/clubs/${clubId}/admins`, { userId });
      onAssigned(response.data);
      onClose();
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'No pudimos asignar el administrador. Reintentá.');
    } finally {
      setAssigningId(null);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', pr: 2 }}>
        Agregar administrador
        <IconButton aria-label="Cerrar" onClick={onClose} size="small">
          <CloseRoundedIcon fontSize="small" />
        </IconButton>
      </DialogTitle>
      <DialogContent dividers>
        <Stack spacing={3} sx={{ pt: 1 }}>
          <TextField
            label="Buscar por nombre o usuario"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            fullWidth
            autoFocus
          />

          {error ? <Alert severity="error">{error}</Alert> : null}

          {searching ? (
            <Stack alignItems="center" sx={{ py: 4 }}>
              <CircularProgress size={24} />
            </Stack>
          ) : query.trim().length === 0 ? (
            <Typography variant="body2" color="text.secondary">
              Escribí un nombre o usuario para buscar.
            </Typography>
          ) : results.length === 0 ? (
            <Typography variant="body2" color="text.secondary">
              No encontramos usuarios que coincidan con la búsqueda.
            </Typography>
          ) : (
            <Stack spacing={2}>
              {results.map((user) => (
                <Stack key={user.id} direction="row" alignItems="center" spacing={2} sx={{ p: 2, border: '1px solid', borderColor: 'divider', borderRadius: '12px' }}>
                  <Avatar src={user.avatarUrl ?? undefined}>{user.displayName.charAt(0).toUpperCase()}</Avatar>
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography sx={{ fontWeight: 700 }} noWrap>
                      {user.displayName}
                    </Typography>
                    {user.username ? (
                      <Typography variant="caption" color="text.secondary">
                        @{user.username}
                      </Typography>
                    ) : null}
                  </Box>
                  <Button variant="outlined" size="small" disabled={assigningId === user.id} onClick={() => void handleAssign(user.id)}>
                    {assigningId === user.id ? 'Asignando…' : 'Asignar'}
                  </Button>
                </Stack>
              ))}
            </Stack>
          )}
        </Stack>
      </DialogContent>
    </Dialog>
  );
}

export default AssignAdminDialog;
