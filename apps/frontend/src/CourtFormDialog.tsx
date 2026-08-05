import { useEffect, useState } from 'react';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import IconButton from '@mui/material/IconButton';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import type { CourtAdminDto, CreateCourtInputDto, UpdateCourtInputDto } from '@rondo/contracts';
import { ApiError, useApi } from './apiClient';
import { useSports } from './useSports';

type CourtFormDialogProps = {
  open: boolean;
  clubId: string;
  court: CourtAdminDto | null;
  onClose: () => void;
  onSaved: (court: CourtAdminDto) => void;
};

function CourtFormDialog({ open, clubId, court, onClose, onSaved }: CourtFormDialogProps) {
  const api = useApi();
  const { sports, loading: sportsLoading } = useSports();
  const [name, setName] = useState('');
  const [sportModalityId, setSportModalityId] = useState('');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setName(court?.name ?? '');
      setSportModalityId(court?.sportModalityId ?? '');
      setDescription(court?.description ?? '');
      setError(null);
    }
  }, [open, court]);

  const handleClose = () => {
    if (submitting) {
      return;
    }
    onClose();
  };

  const handleSubmit = async () => {
    if (!name.trim()) {
      setError('El nombre es obligatorio.');
      return;
    }
    if (!sportModalityId) {
      setError('Elegí una modalidad.');
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      if (court) {
        const input: UpdateCourtInputDto = { name: name.trim(), sportModalityId, description: description.trim() || null };
        const response = await api.put<{ data: CourtAdminDto }>(`/api/v1/admin/clubs/${clubId}/courts/${court.id}`, input);
        onSaved(response.data);
      } else {
        const input: CreateCourtInputDto = { name: name.trim(), sportModalityId, description: description.trim() || null };
        const response = await api.post<{ data: CourtAdminDto }>(`/api/v1/admin/clubs/${clubId}/courts`, input);
        onSaved(response.data);
      }
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'No pudimos guardar la cancha. Reintentá.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onClose={handleClose} fullWidth maxWidth="xs">
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', pr: 2 }}>
        {court ? 'Editar cancha' : 'Nueva cancha'}
        <IconButton aria-label="Cerrar" onClick={handleClose} size="small" disabled={submitting}>
          <CloseRoundedIcon fontSize="small" />
        </IconButton>
      </DialogTitle>
      <DialogContent dividers>
        <Stack spacing={3} sx={{ pt: 1 }}>
          <TextField label="Nombre" value={name} onChange={(event) => setName(event.target.value)} required fullWidth autoFocus />
          <TextField
            select
            label="Modalidad"
            value={sportModalityId}
            onChange={(event) => setSportModalityId(event.target.value)}
            slotProps={{ select: { native: true } }}
            required
            fullWidth
            disabled={sportsLoading}
          >
            <option value="" />
            {sports.flatMap((sport) =>
              sport.modalities.map((modality) => (
                <option key={modality.id} value={modality.id}>
                  {sport.name} • {modality.name}
                </option>
              )),
            )}
          </TextField>
          <TextField label="Descripción (opcional)" value={description} onChange={(event) => setDescription(event.target.value)} multiline minRows={2} fullWidth />
          {error ? <Alert severity="error">{error}</Alert> : null}
        </Stack>
      </DialogContent>
      <DialogActions sx={{ p: 3 }}>
        <Button onClick={handleClose} disabled={submitting}>
          Cancelar
        </Button>
        <Button variant="contained" onClick={() => void handleSubmit()} disabled={submitting}>
          {submitting ? 'Guardando…' : 'Guardar'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export default CourtFormDialog;
