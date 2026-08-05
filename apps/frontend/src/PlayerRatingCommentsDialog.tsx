import { useEffect, useState } from 'react';
import type { RatingCommentDto } from '@rondo/contracts';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import CircularProgress from '@mui/material/CircularProgress';
import Dialog from '@mui/material/Dialog';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import IconButton from '@mui/material/IconButton';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import { ApiError, useApi } from './apiClient';
import { StarsRow } from './PlayerProfileCardDialog';

type PlayerRatingCommentsDialogProps = {
  open: boolean;
  userId: string | null;
  sportId: string;
  sportName: string;
  onClose: () => void;
};

function describeError(error: unknown, fallback: string): string {
  return error instanceof ApiError ? error.message : fallback;
}

function formatCommentDate(iso: string): string {
  return new Intl.DateTimeFormat('es-AR').format(new Date(iso));
}

/**
 * Floating modal for a player's written comments, always scoped to one
 * sport -- never embedded inline under a list (see MatchCandidatesSection
 * and PlayerProfileCardDialog, both of which open this instead of showing
 * comments themselves). A standalone Dialog rather than nested inside
 * PlayerProfileCardDialog's own Dialog, to avoid MUI's focus-trap issues
 * with dialogs stacked on dialogs -- the caller closes that one first.
 */
function PlayerRatingCommentsDialog({ open, userId, sportId, sportName, onClose }: PlayerRatingCommentsDialogProps) {
  const api = useApi();

  const [comments, setComments] = useState<RatingCommentDto[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !userId) {
      return;
    }

    let cancelled = false;
    setComments(null);
    setError(null);
    setLoading(true);

    const load = async () => {
      try {
        const response = await api.get<{ data: RatingCommentDto[] }>(`/api/v1/users/${userId}/rating-comments?sportId=${sportId}`);
        if (!cancelled) {
          setComments(response.data);
        }
      } catch (caught) {
        if (!cancelled) {
          setError(describeError(caught, 'No pudimos cargar los comentarios. Reintentá más tarde.'));
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void load();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, userId, sportId]);

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs" scroll="paper">
      <DialogTitle sx={{ pr: 12 }}>Comentarios de {sportName}</DialogTitle>
      <IconButton aria-label="Cerrar" onClick={onClose} size="small" sx={{ position: 'absolute', top: 12, right: 12 }}>
        <CloseRoundedIcon fontSize="small" />
      </IconButton>

      <DialogContent dividers>
        {loading ? (
          <Stack alignItems="center" sx={{ py: 6 }}>
            <CircularProgress size={28} />
          </Stack>
        ) : error ? (
          <Alert severity="error">{error}</Alert>
        ) : comments && comments.length > 0 ? (
          <Stack spacing={3}>
            {comments.map((comment) => (
              <Box key={comment.id} sx={{ p: 3, borderRadius: '12px', bgcolor: 'background.default', border: '1px solid', borderColor: 'divider' }}>
                <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
                  <Typography variant="body2" sx={{ fontWeight: 700 }}>
                    {comment.authorDisplayName}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {formatCommentDate(comment.createdAt)}
                  </Typography>
                </Stack>
                <Stack spacing={0.5} sx={{ mb: 1 }}>
                  <StarsRow label="Juego" value={comment.gameplayScore} />
                  <StarsRow label="Conducta" value={comment.conductScore} />
                </Stack>
                <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
                  "{comment.comment}"
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {comment.sportName} • {comment.modalityName}
                </Typography>
              </Box>
            ))}
          </Stack>
        ) : (
          <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 4 }}>
            Este jugador todavía no recibió comentarios en {sportName}.
          </Typography>
        )}
      </DialogContent>
    </Dialog>
  );
}

export default PlayerRatingCommentsDialog;
