import { useEffect, useState } from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import IconButton from '@mui/material/IconButton';
import Rating from '@mui/material/Rating';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import StarRoundedIcon from '@mui/icons-material/StarRounded';
import type { PlayerRating } from './types';

const MAX_COMMENT_LENGTH = 300;

type RatePlayerDialogProps = {
  open: boolean;
  playerName: string;
  initialRating?: PlayerRating | null;
  onClose: () => void;
  onSubmit: (rating: PlayerRating) => Promise<void> | void;
};

function RatePlayerDialog({ open, playerName, initialRating, onClose, onSubmit }: RatePlayerDialogProps) {
  const [gameplayScore, setGameplayScore] = useState<number | null>(initialRating?.gameplayScore ?? null);
  const [conductScore, setConductScore] = useState<number | null>(initialRating?.conductScore ?? null);
  const [comment, setComment] = useState(initialRating?.comment ?? '');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setGameplayScore(initialRating?.gameplayScore ?? null);
      setConductScore(initialRating?.conductScore ?? null);
      setComment(initialRating?.comment ?? '');
      setError(null);
    }
  }, [open, initialRating]);

  const canSubmit = gameplayScore !== null && conductScore !== null && !submitting;

  const handleSubmit = async () => {
    if (gameplayScore === null || conductScore === null) {
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await onSubmit({ gameplayScore, conductScore, comment: comment.trim() || undefined });
      onClose();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'No pudimos guardar la valoración.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onClose={submitting ? undefined : onClose} fullWidth maxWidth="xs">
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', pr: 2 }}>
        Valorar a {playerName}
        <IconButton aria-label="Cerrar" onClick={onClose} size="small" disabled={submitting}>
          <CloseRoundedIcon fontSize="small" />
        </IconButton>
      </DialogTitle>
      <DialogContent dividers>
        <Stack spacing={4} sx={{ pt: 1 }}>
          <Box>
            <Typography sx={{ fontWeight: 700, mb: 1 }}>Nivel de juego</Typography>
            <Rating
              value={gameplayScore}
              onChange={(_event, value) => setGameplayScore(value)}
              icon={<StarRoundedIcon fontSize="inherit" sx={{ color: 'primary.main' }} />}
              emptyIcon={<StarRoundedIcon fontSize="inherit" sx={{ color: 'divider' }} />}
              size="large"
            />
          </Box>
          <Box>
            <Typography sx={{ fontWeight: 700, mb: 1 }}>Conducta</Typography>
            <Rating
              value={conductScore}
              onChange={(_event, value) => setConductScore(value)}
              icon={<StarRoundedIcon fontSize="inherit" sx={{ color: 'primary.main' }} />}
              emptyIcon={<StarRoundedIcon fontSize="inherit" sx={{ color: 'divider' }} />}
              size="large"
            />
          </Box>
          <TextField
            label="Comentario (opcional)"
            value={comment}
            onChange={(event) => setComment(event.target.value.slice(0, MAX_COMMENT_LENGTH))}
            multiline
            minRows={2}
            fullWidth
            helperText={`${comment.length}/${MAX_COMMENT_LENGTH}`}
          />
          {error ? (
            <Typography variant="body2" color="error.main">
              {error}
            </Typography>
          ) : null}
        </Stack>
      </DialogContent>
      <DialogActions sx={{ p: 3 }}>
        <Button onClick={onClose} disabled={submitting}>
          Cancelar
        </Button>
        <Button variant="contained" onClick={handleSubmit} disabled={!canSubmit}>
          {submitting ? 'Guardando…' : 'Guardar valoración'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export default RatePlayerDialog;
