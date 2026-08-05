import { useState } from 'react';
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
import type { AdminClubDetailDto, CreateClubInputDto } from '@rondo/contracts';
import { ApiError, useApi } from './apiClient';

type CreateClubDialogProps = {
  open: boolean;
  onClose: () => void;
  onCreated: (club: AdminClubDetailDto) => void;
};

function CreateClubDialog({ open, onClose, onCreated }: CreateClubDialogProps) {
  const api = useApi();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [city, setCity] = useState('');
  const [address, setAddress] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reset = () => {
    setName('');
    setDescription('');
    setCity('');
    setAddress('');
    setError(null);
  };

  const handleClose = () => {
    if (submitting) {
      return;
    }
    reset();
    onClose();
  };

  const handleSubmit = async () => {
    if (!name.trim()) {
      setError('El nombre es obligatorio.');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const input: CreateClubInputDto = {
        name: name.trim(),
        description: description.trim() || null,
        city: city.trim() || null,
        address: address.trim() || null,
      };
      const response = await api.post<{ data: AdminClubDetailDto }>('/api/v1/admin/clubs', input);
      reset();
      onCreated(response.data);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'No pudimos crear el club. Reintentá.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onClose={handleClose} fullWidth maxWidth="xs">
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', pr: 2 }}>
        Crear club
        <IconButton aria-label="Cerrar" onClick={handleClose} size="small" disabled={submitting}>
          <CloseRoundedIcon fontSize="small" />
        </IconButton>
      </DialogTitle>
      <DialogContent dividers>
        <Stack spacing={3} sx={{ pt: 1 }}>
          <TextField label="Nombre" value={name} onChange={(event) => setName(event.target.value)} required fullWidth autoFocus />
          <TextField label="Descripción (opcional)" value={description} onChange={(event) => setDescription(event.target.value)} multiline minRows={2} fullWidth />
          <TextField label="Localidad (opcional)" value={city} onChange={(event) => setCity(event.target.value)} fullWidth />
          <TextField label="Dirección (opcional)" value={address} onChange={(event) => setAddress(event.target.value)} fullWidth />
          {error ? <Alert severity="error">{error}</Alert> : null}
        </Stack>
      </DialogContent>
      <DialogActions sx={{ p: 3 }}>
        <Button onClick={handleClose} disabled={submitting}>
          Cancelar
        </Button>
        <Button variant="contained" onClick={() => void handleSubmit()} disabled={submitting}>
          {submitting ? 'Creando…' : 'Crear club'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export default CreateClubDialog;
